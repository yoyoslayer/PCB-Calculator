import { useEffect, useMemo, useState } from 'react';
import { useDesign, makeRef } from '../store.jsx';
import { COMPONENT_TEMPLATES, POWER_SOURCES } from '../config/data.js';
import {
  batteryLife, traceWidthIPC2221, regulatorAdvice,
  voltageDivider, solveDividerR2, ledResistor, i2cPullup, bulkCapForDroop, nearestESeries,
} from '../engine/calculators.js';
import { runChecks, componentAdvice, railFeeds } from '../engine/rules.js';
import { CATALOG_BY_LCSC } from '../config/catalog/index.js';
import {
  Panel, Field, NumberField, TextField, Select, Button, Pill, Stat, Callout, Drawer,
} from '../ui.jsx';
import StageShell from './StageShell.jsx';

const ROLE_TONE = { source: 'copper', regulator: 'copper', controller: 'mask', sensor: 'mask', actuator: 'warn', passive: 'default' };
const TEMPLATE_OPTIONS = Object.entries(COMPONENT_TEMPLATES).map(([k, v]) => ({ value: k, label: v.name }));

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
  const { state, setData, seedBom, addPart, updatePart, removePart } = useDesign();
  const stage1 = state.data.stage1;
  const saved = state.data.stage2;
  const blocks = state.bom;
  const [addKey, setAddKey] = useState('');

  // Seed the bill of materials once, from the requirements stage.
  useEffect(() => {
    if (state.bomSeeded || !stage1) return;
    const seeded = [];
    const push = (tpl) => { const blk = structuredClone(tpl); blk.id = makeRef(seeded, blk.role); seeded.push(blk); };
    if (stage1.powerSource && POWER_SOURCES[stage1.powerSource]) push(POWER_SOURCES[stage1.powerSource]);
    (stage1.seedBlocks || []).forEach((k) => COMPONENT_TEMPLATES[k] && push(COMPONENT_TEMPLATES[k]));
    seedBom(seeded);
  }, [state.bomSeeded, stage1, seedBom]);

  const design = useMemo(() => splitDesign(blocks), [blocks]);
  const checks = useMemo(() => runChecks(design), [design]);
  const source = design.source;
  const capacity = source?.capacityMah;
  const life = capacity ? batteryLife(capacity, checks.budget.activeMa) : null;
  const copperOz = stage1?.constraintSeed?.copperOz ?? 1;

  // Downstream current each regulator must carry, used by its automatic advice.
  const regOut = useMemo(() => {
    const map = {};
    design.regulators.forEach((reg) => {
      map[reg.id] = design.loads.filter((l) => railFeeds(reg, l)).reduce((s, l) => s + (Number(l.current.active_mA) || 0), 0) / 1000;
    });
    return map;
  }, [design]);

  function ctxFor(b) {
    return {
      source: design.source,
      busVcc: design.buses[0]?.vcc,
      copperOz,
      regOutA: regOut[b.id],
      driver: b.driverLcsc ? CATALOG_BY_LCSC[b.driverLcsc] : undefined,
    };
  }

  const updateCurrent = (id, field, val) => updatePart(id, { current: { ...blocks.find((b) => b.id === id).current, [field]: val } });
  const updateVtyp = (id, val) => updatePart(id, { voltage: { ...blocks.find((b) => b.id === id).voltage, typ: val } });
  const add = () => { if (addKey) { addPart(structuredClone(COMPONENT_TEMPLATES[addKey])); setAddKey(''); } };

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
      title="Set each part, get its plan automatically"
      lead="Set each part's voltage and current. The moment you do, this stage works out the supporting parts that part needs, the regulator type, the decoupling, the pull-ups, the driver, and the trace width, all from formulas. Browse the catalog pages in the sidebar to drop in real parts."
    >
      <Panel
        title="Bill of materials"
        kicker="Each part shows its own recommendations"
        action={
          <div className="rail__row">
            <Select value={addKey} onChange={setAddKey} options={TEMPLATE_OPTIONS} placeholder="Add a generic part" />
            <Button variant="copper" onClick={add} disabled={!addKey}>Add</Button>
          </div>
        }
      >
        {blocks.length === 0 && <div className="empty">No parts yet. Add a generic part above, or open a catalog page from the sidebar.</div>}
        <div className="itemlist">
          {blocks.map((b) => (
            <ComponentCard
              key={b.id}
              b={b}
              advice={componentAdvice(b, ctxFor(b))}
              onVtyp={(v) => updateVtyp(b.id, v)}
              onCurrent={(f, v) => updateCurrent(b.id, f, v)}
              onPatch={(patch) => updatePart(b.id, patch)}
              onRemove={() => removePart(b.id)}
            />
          ))}
        </div>
      </Panel>

      <LcscFinder />

      <Panel title="Power budget" kicker="Computed from the parts above">
        <div className="stats">
          <Stat label="Active draw, duty weighted" value={checks.budget.activeMa.toFixed(1)} unit="mA" tone="copper" />
          <Stat label="Peak draw, worst case" value={checks.budget.peakMa.toFixed(0)} unit="mA" tone="warn" />
          <Stat label="Sleep draw" value={checks.budget.sleepUa.toFixed(1)} unit="uA" />
          {life != null && <Stat label={`Runtime on ${capacity} mAh`} value={isFinite(life) ? life.toFixed(1) : 'forever'} unit="h" tone="mask" />}
        </div>
        <Callout tone="info">
          Peak adds every part peaking at once. Real designs rarely do, but sizing the source and the bulk capacitors for it is the safe choice. <span className="cite">currentBudget, batteryLife at a 0.8 derate</span>
        </Callout>
      </Panel>

      <Panel title="Whole board checks" kicker="Deterministic rules across all parts">
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

      <Panel title="Manual calculators" kicker="Advanced and optional. The per part recommendations above are automatic.">
        <TraceWidthCalc budget={checks.budget} copperOz={copperOz} />
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

// One component, with its editable properties and its automatic recommendations.
function ComponentCard({ b, advice, onVtyp, onCurrent, onPatch, onRemove }) {
  const isLoad = ['controller', 'sensor', 'actuator'].includes(b.role);
  const isIc = b.role === 'controller' || b.role === 'sensor';
  return (
    <div className="panel" style={{ margin: 0 }}>
      <div className="panel__head" style={{ padding: '11px 14px' }}>
        <div className="item__main">
          <div className="item__name">
            {b.name} <Pill tone={ROLE_TONE[b.role]}>{b.role}</Pill>
            {b._verify && <span className="cite"> verify vs datasheet</span>}
          </div>
          <div className="item__meta">{b.id} &middot; {b.io?.interfaces?.join(', ') || 'no digital bus'}</div>
        </div>
        <Button variant="danger" onClick={onRemove}>Remove</Button>
      </div>
      <div className="panel__body" style={{ padding: '13px 14px' }}>
        <div className="item__meta" style={{ marginBottom: 10 }}>
          Operating voltage range: <span className="mono">{b.voltage.min} to {b.voltage.max} volts</span>
        </div>
        <div className="grid grid--3">
          <Field label="Typical voltage"><NumberField value={b.voltage.typ} onChange={onVtyp} suffix="V" /></Field>
          <Field label="Active current"><NumberField value={b.current.active_mA} onChange={(v) => onCurrent('active_mA', v)} suffix="mA" /></Field>
          <Field label="Peak current"><NumberField value={b.current.peak_mA} onChange={(v) => onCurrent('peak_mA', v)} suffix="mA" /></Field>
          <Field label="Sleep current"><NumberField value={b.current.sleep_uA} onChange={(v) => onCurrent('sleep_uA', v)} suffix="uA" /></Field>
          {isLoad && (
            <Field label="Duty cycle" hint="0 to 1, the share of time the part is active"><NumberField value={b.dutyCycle ?? 1} onChange={(v) => onPatch({ dutyCycle: v })} min={0} /></Field>
          )}
          {isIc && (
            <Field label="Power pins" hint="How many power pins, for the decoupling count"><NumberField value={b.powerPins ?? (b.role === 'controller' ? 2 : 1)} onChange={(v) => onPatch({ powerPins: v })} min={1} /></Field>
          )}
          {b.led && (
            <>
              <Field label="LED forward voltage"><NumberField value={b.vf ?? 2.0} onChange={(v) => onPatch({ vf: v })} suffix="V" /></Field>
              <Field label="LED current"><NumberField value={b.ifMa ?? 10} onChange={(v) => onPatch({ ifMa: v })} suffix="mA" /></Field>
            </>
          )}
        </div>

        <div className="grid grid--2" style={{ marginTop: 12 }}>
          <Field label="LCSC part number" hint="The real part you chose, like C2040. Use a catalog page or the finder below.">
            <TextField value={b.lcsc || ''} onChange={(v) => onPatch({ lcsc: v })} placeholder="C2040" />
          </Field>
          {b.lcsc && (
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
              <a className="btn btn--ghost btn--small" href={`https://www.lcsc.com/search?q=${encodeURIComponent(b.lcsc)}`} target="_blank" rel="noreferrer">View {b.lcsc} on LCSC</a>
            </div>
          )}
        </div>

        {advice.length > 0 && (
          <div className="recs">
            <div className="recs__cap">Automatic recommendations for this part</div>
            {advice.map((r, i) => (
              <div className="rec" key={i}>
                <div className="rec__row">
                  <span className="rec__title">{r.title}</span>
                  <span className="rec__val mono">{r.value}</span>
                </div>
                <div className="rec__detail">{r.detail}</div>
                <div className="cite">{r.cite}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
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
    <Panel title="Find a part on LCSC" kicker="Tier one: search there. Tier two search lives in the sidebar.">
      <div className="grid grid--2">
        <Field label="Describe what you need" hint="For example: 3.3 volt regulator 500 milliamps, or BME280.">
          <div className="rail__row">
            <TextField value={query} onChange={setQuery} placeholder="3.3 volt regulator 500 mA" />
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
        Search opens LCSC in a new tab. Pick a part there, copy its number like C2040, then paste it into the matching part above so it is saved with your design and shows in the report. For a faster search without leaving this site, open the parts search page from the sidebar.
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
    <Drawer label="Trace width for current, IPC-2221">
      <div className="grid grid--3">
        <Field label="Current"><NumberField value={i} onChange={setI} suffix="A" /></Field>
        <Field label="Temp rise"><NumberField value={dt} onChange={setDt} suffix="degrees C" /></Field>
        <Field label="Layer"><Select value={layer} onChange={setLayer} options={[{ value: 'external', label: 'External' }, { value: 'internal', label: 'Internal' }]} /></Field>
      </div>
      <Result k="Cross-section" v={`${r.areaMils2.toFixed(1)} square mil`} />
      <Result k="Min width" v={`${r.widthMils.toFixed(1)} mil  /  ${r.widthMm.toFixed(3)} mm`} />
      <Callout tone="info">{r.note} Using {copperOz} ounce copper from your environment setting.</Callout>
    </Drawer>
  );
}

function RegulatorCalc({ source }) {
  const [vin, setVin] = useState(source?.voltage.typ ?? 5);
  const [vout, setVout] = useState(3.3);
  const [iout, setIout] = useState(0.5);
  const r = regulatorAdvice(Number(vin), Number(vout), Number(iout));
  return (
    <Drawer label="Linear versus buck regulator">
      <div className="grid grid--3">
        <Field label="Voltage in"><NumberField value={vin} onChange={setVin} suffix="V" /></Field>
        <Field label="Voltage out"><NumberField value={vout} onChange={setVout} suffix="V" /></Field>
        <Field label="Load"><NumberField value={iout} onChange={setIout} suffix="A" /></Field>
      </div>
      <Result k="Linear regulator heat" v={`${r.ldoPowerW.toFixed(2)} W`} />
      <Result k="Linear efficiency" v={`${(r.ldoEfficiency * 100).toFixed(0)} percent`} />
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
        <Field label="Voltage in"><NumberField value={vin} onChange={setVin} suffix="V" /></Field>
        <Field label="Target voltage out"><NumberField value={vout} onChange={setVout} suffix="V" /></Field>
        <Field label="R1"><NumberField value={r1} onChange={setR1} suffix="ohm" /></Field>
      </div>
      <Result k="R2 ideal" v={`${r2.toFixed(0)} ohm`} />
      <Result k="R2 nearest standard" v={`${r2e} ohm`} />
      <Result k="Actual voltage out" v={`${actual.vout.toFixed(3)} V`} />
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
        <Field label="LED forward voltage"><NumberField value={vf} onChange={setVf} suffix="V" /></Field>
        <Field label="LED current"><NumberField value={i} onChange={setI} suffix="mA" /></Field>
      </div>
      <Result k="Resistor" v={`${r.rOhm.toFixed(0)} ohm, nearest ${r.nearestE12} ohm`} />
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
    <Drawer label="I2C and logic pull-up sizing">
      <div className="grid grid--3">
        <Field label="Bus voltage"><NumberField value={v} onChange={setV} suffix="V" /></Field>
        <Field label="Bus capacitance"><NumberField value={cap} onChange={setCap} suffix="pF" /></Field>
        <Field label="Mode"><Select value={mode} onChange={setMode} options={[{ value: 'standard', label: 'Standard 100 kilohertz' }, { value: 'fast', label: 'Fast 400 kilohertz' }, { value: 'fastplus', label: 'Fast plus 1 megahertz' }]} /></Field>
      </div>
      <Result k="Lowest, from drive strength" v={`${r.rpMinOhm.toFixed(0)} ohm`} />
      <Result k="Highest, from rise time" v={`${r.rpMaxOhm.toFixed(0)} ohm`} />
      <Result k="Suggested" v={`${r.suggestedOhm} ohm`} />
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
      <Result k="Capacitance" v={`${r.microfarads.toFixed(1)} uF`} />
      <Result k="Nearest standard" v={`${r.nearestUf} uF`} />
      <Callout tone="info">Capacitance equals current times time divided by allowed droop. Place near the load that causes the step.</Callout>
    </Drawer>
  );
}
