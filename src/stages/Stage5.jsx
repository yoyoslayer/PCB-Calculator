import { useMemo, useState } from 'react';
import { useDesign } from '../store.jsx';
import { MANUFACTURERS } from '../config/data.js';
import { deriveDesignRules, deriveNetClasses, generateStackup } from '../engine/rules.js';
import { microstripImpedance, solveMicrostripWidth } from '../engine/calculators.js';
import { Panel, Field, NumberField, Select, Button, Pill, Stat, Callout, Drawer, Term } from '../ui.jsx';
import StageShell from './StageShell.jsx';

export default function Stage5() {
  const { state, setData } = useDesign();
  const s1 = state.data.stage1;
  const s2 = state.data.stage2;
  const saved = state.data.stage5;

  const profile = MANUFACTURERS.jlcpcb;
  const [layerCount, setLayerCount] = useState(saved?.designRules?.layerCount ?? s1?.layerTarget ?? 2);
  const [copperOz, setCopperOz] = useState(saved?.designRules?.copperOz ?? s1?.constraintSeed?.copperOz ?? 1);

  const baseRules = useMemo(() => deriveDesignRules(profile, layerCount, copperOz), [profile, layerCount, copperOz]);
  // editable copy so the user can match their exact order
  const [rules, setRules] = useState(saved?.designRules || baseRules);
  // re-seed editable rules when layer/copper changes
  const rulesKey = `${layerCount}-${copperOz}`;
  const [lastKey, setLastKey] = useState(rulesKey);
  if (rulesKey !== lastKey) { setRules(baseRules); setLastKey(rulesKey); }

  const stackup = useMemo(() => generateStackup(layerCount, copperOz), [layerCount, copperOz]);
  const budget = s2?.budget || { peakMa: 500 };
  // A USB data pair is only needed when the project actually talks over USB, which the
  // questionnaire now asks directly.
  const usesUsb = !!(s1?.usesUsbData || s1?.constraintSeed?.usesUsbData);
  const netClasses = useMemo(() => deriveNetClasses(budget, rules, copperOz, stackup, usesUsb), [budget, rules, copperOz, stackup, usesUsb]);

  const board = s1?.sizeMm;

  function save() {
    setData('stage5', { manufacturer: profile.name, designRules: rules, netClasses, stackup, boardDims: board });
  }

  if (!s2) {
    return (
      <StageShell stageKey="stage5" title="Set up the PCB" lead="Finish the BOM in Stage 2 so net classes can size from your current budget.">
        <Callout tone="warn" title="No budget yet">Save a bill of materials in Layer 2.</Callout>
      </StageShell>
    );
  }

  return (
    <StageShell
      stageKey="stage5"
      title="Design rules, net classes, and a stackup"
      lead="These are the numbers you type into your EDA tool's board setup. They come from the JLCPCB profile, your layer count, and the current budget from Stage 2. Edit any value to match your actual order."
    >
      <Panel title="Board profile" kicker={profile.name}>
        <div className="grid grid--3">
          <Field label="Layers">
            <Select value={String(layerCount)} onChange={(v) => setLayerCount(Number(v))}
              options={[{ value: '2', label: '2 layers' }, { value: '4', label: '4 layers' }, { value: '6', label: '6 layers' }]} />
          </Field>
          <Field label="Copper weight">
            <Select value={String(copperOz)} onChange={(v) => setCopperOz(Number(v))}
              options={[{ value: '1', label: '1 oz' }, { value: '2', label: '2 oz' }]} />
          </Field>
          <Field label="Board size">
            <div className="result-line" style={{ paddingTop: 9 }}>
              <span className="result-line__v">{board?.w && board?.h ? `${board.w} × ${board.h} mm` : 'not set'}</span>
            </div>
          </Field>
        </div>
        <Callout tone="warn">{profile.verifyNote}</Callout>
      </Panel>

      <Panel title="Design rules" kicker="Type these into your editor's board setup. Editable.">
        <div className="grid grid--3">
          <Field label={<Term k="tracewidth">Minimum trace width</Term>}><NumberField value={rules.minTraceMil} onChange={(v) => setRules({ ...rules, minTraceMil: v })} suffix="mil" /></Field>
          <Field label={<Term k="clearance">Minimum spacing</Term>}><NumberField value={rules.minSpaceMil} onChange={(v) => setRules({ ...rules, minSpaceMil: v })} suffix="mil" /></Field>
          <Field label={<Term k="viadrill">Minimum via drill</Term>}><NumberField value={rules.minViaDrillMm} onChange={(v) => setRules({ ...rules, minViaDrillMm: v })} suffix="mm" /></Field>
          <Field label={<Term k="via">Minimum via pad</Term>}><NumberField value={rules.minViaPadMm} onChange={(v) => setRules({ ...rules, minViaPadMm: v })} suffix="mm" /></Field>
          <Field label={<Term k="annular">Minimum annular ring</Term>}><NumberField value={rules.minAnnularMm} onChange={(v) => setRules({ ...rules, minAnnularMm: v })} suffix="mm" /></Field>
          <Field label={<Term k="minhole">Minimum hole</Term>}><NumberField value={rules.minHoleMm} onChange={(v) => setRules({ ...rules, minHoleMm: v })} suffix="mm" /></Field>
          <Field label="Edge clearance"><NumberField value={rules.edgeClearanceMm} onChange={(v) => setRules({ ...rules, edgeClearanceMm: v })} suffix="mm" /></Field>
          <Field label={<Term k="silk">Minimum silkscreen text height</Term>}><NumberField value={rules.silkMinHeightMm} onChange={(v) => setRules({ ...rules, silkMinHeightMm: v })} suffix="mm" /></Field>
        </div>
        <Callout tone="info">
          {layerCount <= 2 ? 'The 2-layer floor is 5 mil. This uses 6 mil for manufacturing margin.' : 'On 4 or more layers, 4 mil is free and 3.0 to 3.5 mil adds a fee.'} <span className="cite">JLCPCB, verified late 2025</span>
        </Callout>
      </Panel>

      <Panel title="Net classes" kicker="Type these into your editor's Net Classes table, in millimeters">
        <table className="tbl">
          <thead><tr><th>Class</th><th>Track width</th><th>Clearance</th><th>Via size</th><th>Via hole</th><th>Why</th></tr></thead>
          <tbody>
            {netClasses.map((c) => (
              <tr key={c.name}>
                <td><Pill tone={c.name === 'Power' || c.name === 'Ground' ? 'copper' : c.isDiff ? 'mask' : 'default'}>{c.name}</Pill></td>
                <td className="mono">{c.trackWidthMm != null ? `${c.trackWidthMm} mm` : '—'}</td>
                <td className="mono">{c.clearanceMm} mm</td>
                <td className="mono">{c.viaSizeMm} mm</td>
                <td className="mono">{c.viaHoleMm} mm</td>
                <td className="item__meta">
                  {c.isDiff && !c.impractical && (
                    <span className="mono" style={{ color: 'var(--mask)' }}>DP width {c.dpWidthMm} mm, DP gap {c.dpGapMm} mm. </span>
                  )}
                  {c.note}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Callout tone="info">
          These map to the columns in your editor's Net Classes table. Differential-pair width and gap appear in the notes for the pair. <span className="cite">Widths from IPC-2221 and IPC-2141A</span>
        </Callout>
      </Panel>

      <Panel title="Layer stackup" kicker={`${stackup.layerCount} layers · ${stackup.totalMm} mm`}>
        <div className="itemlist">
          {stackup.layers.map((l, i) => (
            <div key={i} className="item">
              <div className="item__main">
                <div className="item__name">{l.name} {l.type.includes('plane') && <Pill tone="copper">{l.type}</Pill>}</div>
                <div className="item__meta">{l.detail}</div>
              </div>
              <Pill tone={l.type === 'dielectric' ? 'default' : 'mask'}>{l.type}</Pill>
            </div>
          ))}
        </div>
        <Callout tone="info">{stackup.note}</Callout>
      </Panel>

      <Panel title="Impedance check" kicker="IPC-2141A first-pass">
        <ImpedanceCalc stackup={stackup} />
      </Panel>

      <div className="btnrow">
        <Button variant="primary" onClick={save}>Save PCB setup</Button>
        {saved && <span className="cite">Saved. Stage 6 covers layer assignment, placement, and export.</span>}
      </div>
    </StageShell>
  );
}

function ImpedanceCalc({ stackup }) {
  const [target, setTarget] = useState(50);
  const [diffTarget, setDiffTarget] = useState(90);
  const h = stackup.outerDielectricMil;
  const er = stackup.er;
  const wSingle = solveMicrostripWidth(Number(target), { hMil: h, er });
  const wDiff = solveMicrostripWidth(Number(diffTarget) / 2, { hMil: h, er });
  const check = microstripImpedance({ wMil: wSingle, hMil: h, er });
  return (
    <div>
      <div className="grid grid--2">
        <Field label="Single-ended target" hint="50 ohm is typical for digital and RF.">
          <NumberField value={target} onChange={setTarget} suffix="Ω" />
        </Field>
        <Field label="Differential target" hint="90 ohm for USB, 100 ohm for Ethernet.">
          <NumberField value={diffTarget} onChange={setDiffTarget} suffix="Ω" />
        </Field>
      </div>
      <div className="result-line"><span className="result-line__k">Microstrip width for {target} Ω</span><span className="result-line__v">{wSingle.toFixed(1)} mil</span></div>
      <div className="result-line"><span className="result-line__k">Each trace width for {diffTarget} Ω diff</span><span className="result-line__v">{wDiff.toFixed(1)} mil</span></div>
      <div className="result-line"><span className="result-line__k">Outer dielectric / εr used</span><span className="result-line__v">{h} mil / {er}</span></div>
      {!check.inRange && <Callout tone="warn">The solved width falls outside the formula's reliable W/H range. Treat it as a rough start and confirm with a field solver.</Callout>}
      <Callout tone="info">{check.note} On 2 layers, controlled impedance needs wide traces because the reference plane is far. 4 layers makes this much easier.</Callout>
    </div>
  );
}
