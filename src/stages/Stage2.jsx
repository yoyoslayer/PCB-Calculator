import { useMemo, useState } from 'react';
import { useDesign } from '../store.jsx';
import { COMPONENT_TEMPLATES, POWER_SOURCES } from '../config/data.js';
import {
  currentBudget, batteryLife, traceWidthIPC2221, regulatorAdvice,
  voltageDivider, solveDividerR2, ledResistor, i2cPullup, bulkCapForDroop, nearestESeries,
} from '../engine/calculators.js';
import { runChecks } from '../engine/rules.js';
import {
  Panel, Field, NumberField, TextField, Select, Button, Pill, Stat, Callout, Drawer,
} from '../ui.jsx';
import StageShell from './StageShell.jsx';

let uid = 0;
const newId = (role) => `${role[0]}${++uid}`;

const ROLE_TONE = { source: 'copper', regulator: 'copper', controller: 'mask', sensor: 'mask', actuator: 'warn', passive: 'default' };
const TEMPLATE_OPTIONS = Object.entries(COMPONENT_TEMPLATES).map(([k, v]) => ({ value: k, label: v.name }));

function instantiate(key) {
  const t = COMPONENT_TEMPLATES[key];
  return { ...structuredClone(t), id: newId(t.role) };
}

function splitDesign(blocks) {
  const source = blocks.find((b) => b.role === 'source') || null;
  const regulators = blocks.filter((b) => b.role === 'regulator');
  const loads = blocks.filter((b) => ['controller', 'sensor', 'actuator'].includes(b.role));
  const i2cMembers = loads.filter((l) => l.io?.interfaces?.includes('i2c'));
  const rail33 = regulators.find((r) => Math.abs(r.voltage.typ - 3.3) < 0.2);
  const buses = i2cMembers.length
    ? [{ type: 'i2c', vcc: rail33?.voltage.typ ?? source?.voltage.typ ?? 3.3, members: i2cMembers.map((m) => m.id), mode: 'fast', busCapPf: 100 }]
    : [];
  return { source, regulators, loads, buses };
}

export default function Stage2() {
  const { state, setData } = useDesign();
  const stage1 = state.data.stage1;
  const saved = state.data.stage2;

  const [blocks, setBlocks] = useState(() => {
    if (saved?.blocks) return saved.blocks;
    const seeded = [];
    if (stage1?.powerSource && POWER_SOURCES[stage1.powerSource]) {
      seeded.push({ ...structuredClone(POWER_SOURCES[stage1.powerSource]) });
    }
    (stage1?.seedBlocks || []).forEach((k) => COMPONENT_TEMPLATES[k] && seeded.push(instantiate(k)));
    return seeded;
  });
  const [addKey, setAddKey] = useState('');

  const design = useMemo(() => splitDesign(blocks), [blocks]);
  const checks = useMemo(() => runChecks(design), [design]);
  const source = design.source;
  const capacity = source?.capacityMah;
  const life = capacity ? batteryLife(capacity, checks.budget.activeMa) : null;

  function update(id, patch) {
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }
  function updateCurrent(id, field, val) {
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, current: { ...b.current, [field]: val } } : b)));
  }
  function updateVtyp(id, val) {
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, voltage: { ...b.voltage, typ: val } } : b)));
  }
  function updateLcsc(id, val) {
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, lcsc: val } : b)));
  }
  function remove(id) { setBlocks((bs) => bs.filter((b) => b.id !== id)); }
  function add() { if (addKey) { setBlocks((bs) => [...bs, instantiate(addKey)]); setAddKey(''); } }

  function save() {
    setData('stage2', {
      blocks,
      buses: design.buses,
      budget: checks.budget,
      issues: checks.issues,
      additions: checks.additions,
      bom: [
        ...blocks.map((b) => ({ ref: b.id, name: b.name, role: b.role, vtyp: b.voltage.typ, lcsc: b.lcsc || null })),
        ...dedupeAdditions(checks.additions).map((a) => ({ ref: '-', name: a.label, role: 'support', note: a.reason })),
      ],
    });
  }

  if (!stage1) {
    return (
      <StageShell stageKey="stage2" title="Pick the parts" lead="Finish the requirements stage first so this one can seed itself.">
        <Callout tone="warn" title="No requirements yet">Go back to Layer 1 and save your project type and power source.</Callout>
      </StageShell>
    );
  }

  return (
    <StageShell
      stageKey="stage2"
      title="Pick the parts, then let the checks fill the gaps"
      lead="Start with the essential parts. Set each part's current and voltage. The engine checks the design and appends supporting parts until the bill of materials holds together. Every number traces to a formula."
    >
      <Panel
        title="Bill of materials"
        kicker="Most essential first"
        action={
          <div className="rail__row">
            <Select value={addKey} onChange={setAddKey} options={TEMPLATE_OPTIONS} placeholder="Add a part" />
            <Button variant="copper" onClick={add} disabled={!addKey}>Add</Button>
          </div>
        }
      >
        {blocks.length === 0 && <div className="empty">No parts yet. Add your main chip first, then build outward.</div>}
        <div className="itemlist">
          {blocks.map((b) => (
            <div key={b.id} className="panel" style={{ margin: 0 }}>
              <div className="panel__head" style={{ padding: '11px 14px' }}>
                <div className="item__main">
                  <div className="item__name">
                    {b.name} <Pill tone={ROLE_TONE[b.role]}>{b.role}</Pill>
                    {b._verify && <span className="cite"> verify vs datasheet</span>}
                  </div>
                  <div className="item__meta">{b.id} &middot; {b.io?.interfaces?.join(', ') || 'no digital bus'}</div>
                </div>
                <Button variant="danger" onClick={() => remove(b.id)}>Remove</Button>
              </div>
              <div className="panel__body" style={{ padding: '13px 14px' }}>
                <div className="item__meta" style={{ marginBottom: 10 }}>
                  Operating voltage range: <span className="mono">{b.voltage.min} to {b.voltage.max} volts</span>
                </div>
                <div className="grid grid--3">
                  <Field label="Typical voltage"><NumberField value={b.voltage.typ} onChange={(v) => updateVtyp(b.id, v)} suffix="V" /></Field>
                  <Field label="Active current"><NumberField value={b.current.active_mA} onChange={(v) => updateCurrent(b.id, 'active_mA', v)} suffix="mA" /></Field>
                  <Field label="Peak current"><NumberField value={b.current.peak_mA} onChange={(v) => updateCurrent(b.id, 'peak_mA', v)} suffix="mA" /></Field>
                  <Field label="Sleep current"><NumberField value={b.current.sleep_uA} onChange={(v) => updateCurrent(b.id, 'sleep_uA', v)} suffix="uA" /></Field>
                  {['controller', 'sensor', 'actuator'].includes(b.role) && (
                    <Field label="Duty cycle" hint="0 to 1, the share of time the part is active"><NumberField value={b.dutyCycle ?? 1} onChange={(v) => update(b.id, { dutyCycle: v })} min={0} /></Field>
                  )}
                </div>
                <div className="grid grid--2" style={{ marginTop: 12 }}>
                  <Field label="LCSC part number" hint="The real part you chose, like C2040. Use the finder below.">
                    <TextField value={b.lcsc || ''} onChange={(v) => updateLcsc(b.id, v)} placeholder="C2040" />
                  </Field>
                  {b.lcsc && (
                    <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                      <a className="btn btn--ghost btn--small" href={`https://www.lcsc.com/search?q=${encodeURIComponent(b.lcsc)}`} target="_blank" rel="noreferrer">View {b.lcsc} on LCSC</a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <LcscFinder />

      <Panel title="Power budget" kicker="Computed from the BOM">
        <div className="stats">
          <Stat label="Active draw (duty-weighted)" value={checks.budget.activeMa.toFixed(1)} unit="mA" tone="copper" />
          <Stat label="Peak draw (worst case)" value={checks.budget.peakMa.toFixed(0)} unit="mA" tone="warn" />
          <Stat label="Sleep draw" value={checks.budget.sleepUa.toFixed(1)} unit="uA" />
          {life != null && <Stat label={`Runtime on ${capacity} mAh`} value={isFinite(life) ? life.toFixed(1) : '∞'} unit="h" tone="mask" />}
        </div>
        <Callout tone="info">
          Peak is summed worst-case, every part peaking at once. Real designs rarely do, but sizing the source and bulk caps for it is the safe choice. <span className="cite">currentBudget(), batteryLife() at 0.8 derate</span>
        </Callout>
      </Panel>

      <Panel title="Checks and what to add" kicker="Deterministic rules">
        {checks.issues.length === 0 && checks.additions.length === 0 && (
          <div className="empty">Add parts to run the checks.</div>
        )}
        {checks.issues.map((iss, i) => (
          <Callout key={i} tone={iss.level === 'error' ? 'danger' : iss.level === 'warn' ? 'warn' : 'info'}>{iss.text}</Callout>
        ))}
        {checks.additions.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div className="panel__kicker" style={{ marginBottom: 8 }}>Supporting parts to add</div>
            {dedupeAdditions(checks.additions).map((a, i) => (
              <div key={i} className="addition">
                <span className="addition__dot">+</span>
                <div><strong>{a.label}</strong><div className="item__meta" style={{ marginTop: 2 }}>{a.reason}</div></div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Calculators" kicker="Run any of these as you size parts">
        <TraceWidthCalc budget={checks.budget} copperOz={stage1.constraintSeed?.copperOz ?? 1} />
        <RegulatorCalc source={source} />
        <DividerCalc />
        <LedCalc source={source} />
        <I2cCalc vcc={design.buses[0]?.vcc ?? 3.3} />
        <BulkCapCalc />
      </Panel>

      <div className="btnrow">
        <Button variant="primary" onClick={save}>Save BOM &amp; budget</Button>
        {saved && <span className="cite">Saved. Stage 3 will list these parts for pin mapping.</span>}
      </div>
    </StageShell>
  );
}

// Collapse duplicate decoupling/pullup entries and give each a human label.
function dedupeAdditions(additions) {
  const LABEL = {
    regulator: 'Voltage regulator', bulk_cap: 'Bulk capacitor', level_shifter: 'Level shifter',
    decoupling: 'Decoupling capacitors', pullup: 'I2C pull-up resistors', flyback_diode: 'Flyback diode', driver: 'Transistor / MOSFET driver',
  };
  const seen = new Map();
  for (const a of additions) {
    const k = `${a.type}:${a.target}`;
    if (!seen.has(k)) seen.set(k, { ...a, label: LABEL[a.type] || a.type });
  }
  return [...seen.values()];
}

/* ----------------------------------------------------------- calculators */
function Result({ k, v }) { return <div className="result-line"><span className="result-line__k">{k}</span><span className="result-line__v">{v}</span></div>; }

// LCSC tier 1: open a search in a new tab, then resolve a chosen part number to its page.
function LcscFinder() {
  const [query, setQuery] = useState('');
  const [part, setPart] = useState('');
  const partUrl = part.trim() ? `https://www.lcsc.com/search?q=${encodeURIComponent(part.trim())}` : null;
  const openSearch = () => {
    if (query.trim()) window.open(`https://www.lcsc.com/search?q=${encodeURIComponent(query.trim())}`, '_blank', 'noopener');
  };
  return (
    <Panel title="Find a part on LCSC" kicker="Search there, bring the part number back">
      <div className="grid grid--2">
        <Field label="Describe what you need" hint="For example: 3.3V LDO 500mA SOT-23, or BME280.">
          <div className="rail__row">
            <TextField value={query} onChange={setQuery} placeholder="3.3V LDO 500mA" />
            <Button variant="copper" onClick={openSearch} disabled={!query.trim()}>Search LCSC</Button>
          </div>
        </Field>
        <Field label="Got a part number" hint="Paste it to open that exact part, where the datasheet lives.">
          <div className="rail__row">
            <TextField value={part} onChange={setPart} placeholder="C2040" />
            {partUrl
              ? <a className="btn btn--primary" href={partUrl} target="_blank" rel="noreferrer">Open</a>
              : <Button variant="ghost" disabled>Open</Button>}
          </div>
        </Field>
      </div>
      <Callout tone="info">
        Search opens LCSC in a new tab. Pick a part there, copy its number like C2040, then paste it into the matching part above so it is saved with your design and shows in the report. The datasheet is on the part's LCSC page.
      </Callout>
    </Panel>
  );
}

function TraceWidthCalc({ budget, copperOz }) {
  const [i, setI] = useState(((budget.peakMa || 500) / 1000).toFixed(2));
  const [dt, setDt] = useState(10);
  const [layer, setLayer] = useState('external');
  const r = traceWidthIPC2221(Number(i) || 0, Number(dt) || 10, copperOz, layer);
  return (
    <Drawer label="Trace width for current (IPC-2221)">
      <div className="grid grid--3">
        <Field label="Current"><NumberField value={i} onChange={setI} suffix="A" /></Field>
        <Field label="Temp rise"><NumberField value={dt} onChange={setDt} suffix="°C" /></Field>
        <Field label="Layer"><Select value={layer} onChange={setLayer} options={[{ value: 'external', label: 'External' }, { value: 'internal', label: 'Internal' }]} /></Field>
      </div>
      <Result k="Cross-section" v={`${r.areaMils2.toFixed(1)} mil²`} />
      <Result k="Min width" v={`${r.widthMils.toFixed(1)} mil  /  ${r.widthMm.toFixed(3)} mm`} />
      <Callout tone="info">{r.note} Using {copperOz} oz copper from your environment setting.</Callout>
    </Drawer>
  );
}

function RegulatorCalc({ source }) {
  const [vin, setVin] = useState(source?.voltage.typ ?? 5);
  const [vout, setVout] = useState(3.3);
  const [iout, setIout] = useState(0.5);
  const r = regulatorAdvice(Number(vin), Number(vout), Number(iout));
  return (
    <Drawer label="LDO vs buck">
      <div className="grid grid--3">
        <Field label="Vin"><NumberField value={vin} onChange={setVin} suffix="V" /></Field>
        <Field label="Vout"><NumberField value={vout} onChange={setVout} suffix="V" /></Field>
        <Field label="Load"><NumberField value={iout} onChange={setIout} suffix="A" /></Field>
      </div>
      <Result k="LDO dissipation" v={`${r.ldoPowerW.toFixed(2)} W`} />
      <Result k="LDO efficiency" v={`${(r.ldoEfficiency * 100).toFixed(0)} %`} />
      <Callout tone={r.recommendation.startsWith('LDO') ? 'mask' : 'warn'}>{r.recommendation}</Callout>
    </Drawer>
  );
}

function DividerCalc() {
  const [vin, setVin] = useState(5);
  const [vout, setVout] = useState(3.3);
  const [r1, setR1] = useState(10000);
  const r2 = solveDividerR2(Number(vin), Number(vout), Number(r1));
  const r2e = nearestESeries(r2, 'E24');
  const actual = voltageDivider(Number(vin), Number(r1), r2e);
  return (
    <Drawer label="Voltage divider">
      <div className="grid grid--3">
        <Field label="Vin"><NumberField value={vin} onChange={setVin} suffix="V" /></Field>
        <Field label="Target Vout"><NumberField value={vout} onChange={setVout} suffix="V" /></Field>
        <Field label="R1"><NumberField value={r1} onChange={setR1} suffix="Ω" /></Field>
      </div>
      <Result k="R2 ideal" v={`${r2.toFixed(0)} Ω`} />
      <Result k="R2 nearest E24" v={`${r2e} Ω`} />
      <Result k="Actual Vout" v={`${actual.vout.toFixed(3)} V`} />
      <Result k="Divider current" v={`${actual.currentMa.toFixed(3)} mA`} />
    </Drawer>
  );
}

function LedCalc({ source }) {
  const [vs, setVs] = useState(source?.voltage.typ ?? 3.3);
  const [vf, setVf] = useState(2.0);
  const [i, setI] = useState(10);
  const r = ledResistor(Number(vs), Number(vf), Number(i));
  return (
    <Drawer label="LED series resistor">
      <div className="grid grid--3">
        <Field label="Supply"><NumberField value={vs} onChange={setVs} suffix="V" /></Field>
        <Field label="LED Vf"><NumberField value={vf} onChange={setVf} suffix="V" /></Field>
        <Field label="LED current"><NumberField value={i} onChange={setI} suffix="mA" /></Field>
      </div>
      <Result k="Resistor" v={`${r.rOhm.toFixed(0)} Ω → ${r.nearestE12} Ω (E12)`} />
      <Result k="Resistor power" v={`${(r.powerW * 1000).toFixed(1)} mW`} />
    </Drawer>
  );
}

function I2cCalc({ vcc }) {
  const [v, setV] = useState(vcc);
  const [cap, setCap] = useState(100);
  const [mode, setMode] = useState('fast');
  const r = i2cPullup(Number(v), { busCapPf: Number(cap), mode });
  return (
    <Drawer label="I2C / logic pull-up sizing">
      <div className="grid grid--3">
        <Field label="Bus Vcc"><NumberField value={v} onChange={setV} suffix="V" /></Field>
        <Field label="Bus capacitance"><NumberField value={cap} onChange={setCap} suffix="pF" /></Field>
        <Field label="Mode"><Select value={mode} onChange={setMode} options={[{ value: 'standard', label: 'Standard 100k' }, { value: 'fast', label: 'Fast 400k' }, { value: 'fastplus', label: 'Fast+ 1M' }]} /></Field>
      </div>
      <Result k="Min (drive strength)" v={`${r.rpMinOhm.toFixed(0)} Ω`} />
      <Result k="Max (rise time)" v={`${r.rpMaxOhm.toFixed(0)} Ω`} />
      <Result k="Suggested" v={`${r.suggestedOhm} Ω`} />
      {!r.valid && <Callout tone="danger">No valid value: bus capacitance is too high for this mode. Reduce devices or trace length.</Callout>}
    </Drawer>
  );
}

function BulkCapCalc() {
  const [di, setDi] = useState(0.5);
  const [dt, setDt] = useState(1);
  const [droop, setDroop] = useState(0.1);
  const r = bulkCapForDroop(Number(di), Number(dt) / 1000, Number(droop));
  return (
    <Drawer label="Bulk capacitor for a load step">
      <div className="grid grid--3">
        <Field label="Current step"><NumberField value={di} onChange={setDi} suffix="A" /></Field>
        <Field label="Step duration"><NumberField value={dt} onChange={setDt} suffix="ms" /></Field>
        <Field label="Allowed droop"><NumberField value={droop} onChange={setDroop} suffix="V" /></Field>
      </div>
      <Result k="Capacitance" v={`${r.microfarads.toFixed(1)} µF`} />
      <Result k="Nearest standard" v={`${r.nearestUf} µF`} />
      <Callout tone="info">C = I × t / V. Place near the load that causes the step.</Callout>
    </Drawer>
  );
}
