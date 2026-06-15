import { useMemo } from 'react';
import { useDesign } from '../store.jsx';
import { Panel, Pill, Callout, Button } from '../ui.jsx';
import StageShell from './StageShell.jsx';

const GROUPS = [
  { key: 'power', label: 'Power', tone: 'copper', desc: 'Source, regulators, bulk and input caps. Draw power flowing left to right or top to bottom.' },
  { key: 'controller', label: 'Controller', tone: 'mask', desc: 'The MCU and its decoupling. Put each 100 nF right next to the pin it serves.' },
  { key: 'sensor', label: 'Sensors / I2C', tone: 'mask', desc: 'Sensors and bus pull-ups. Keep the bus short and the pull-ups near one end.' },
  { key: 'actuator', label: 'Actuators / drivers', tone: 'warn', desc: 'Motors, speakers, and their drivers plus flyback. Separate the noisy power return.' },
  { key: 'connector', label: 'Connectors / IO', tone: 'default', desc: 'External connectors and test points. Place at the edges of the sheet.' },
];

function classify(block, additions) {
  if (block.role === 'source') return block.io?.interfaces?.includes('usb') ? 'connector' : 'power';
  if (block.role === 'regulator') return 'power';
  if (block.role === 'controller') return 'controller';
  if (block.role === 'sensor') return 'sensor';
  if (block.role === 'actuator') return 'actuator';
  return 'connector';
}

export default function Stage4() {
  const { state, setData } = useDesign();
  const s2 = state.data.stage2;
  const saved = state.data.stage4;

  const grouped = useMemo(() => {
    if (!s2) return null;
    const g = Object.fromEntries(GROUPS.map((x) => [x.key, []]));
    s2.blocks.forEach((b) => g[classify(b)].push({ ref: b.id, name: b.name }));
    // fold supporting parts into the right groups
    (s2.additions || []).forEach((a) => {
      const tgt = a.target;
      if (a.type === 'pullup') g.sensor.push({ ref: '-', name: 'I2C pull-ups' });
      else if (a.type === 'decoupling') { /* shown as a controller convention */ }
      else if (a.type === 'flyback_diode' || a.type === 'driver') g.actuator.push({ ref: '-', name: a.type === 'driver' ? 'Driver transistor' : 'Flyback diode' });
      else if (a.type === 'bulk_cap' || a.type === 'regulator') g.power.push({ ref: '-', name: a.type === 'regulator' ? 'Regulator' : 'Bulk cap' });
      else if (a.type === 'level_shifter') g.controller.push({ ref: '-', name: 'Level shifter' });
    });
    return g;
  }, [s2]);

  const symbolCount = s2 ? s2.blocks.length + (s2.additions?.length || 0) : 0;
  const multiSheet = symbolCount > 15;

  function save() {
    setData('stage4', {
      groups: grouped,
      sheetPlan: multiSheet ? 'multi' : 'single',
      sheets: multiSheet ? GROUPS.filter((g) => grouped[g.key].length).map((g) => g.label) : ['Main'],
    });
  }

  if (!s2) {
    return (
      <StageShell stageKey="stage4" title="Organize the schematic" lead="Build the BOM in Stage 2 first.">
        <Callout tone="warn" title="No BOM yet">Save a bill of materials in Layer 2.</Callout>
      </StageShell>
    );
  }

  return (
    <StageShell
      stageKey="stage4"
      title="Group it so it reads cleanly"
      lead="A schematic is for humans. Grouping by function makes it reviewable and makes layout easier later. Here is how to cluster your parts and how to structure the sheets."
    >
      <Panel title="Functional groups" kicker="Cluster these together on the sheet">
        {GROUPS.map((g) => grouped[g.key].length > 0 && (
          <div key={g.key} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Pill tone={g.tone}>{g.label}</Pill>
              {grouped[g.key].map((p, i) => <span key={i} className="item__meta">{p.name}{i < grouped[g.key].length - 1 ? ',' : ''}</span>)}
            </div>
            <div className="item__meta" style={{ color: 'var(--faint)' }}>{g.desc}</div>
          </div>
        ))}
      </Panel>

      <Panel title="Sheet structure" kicker="Computed from symbol count">
        <Callout tone={multiSheet ? 'warn' : 'mask'}>
          About {symbolCount} symbols. {multiSheet
            ? 'Split into multiple sheets, one per functional group, with a top sheet wiring them by labels.'
            : 'A single sheet is fine. Keep it on one page so reviewers see the whole design at once.'}
        </Callout>
        <ul className="hint-list">
          {(multiSheet ? GROUPS.filter((g) => grouped[g.key].length).map((g) => `${g.label} sheet`) : ['Single main sheet']).map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      </Panel>

      <Panel title="Conventions" kicker="Make it professional">
        <ul className="hint-list">
          <li>Power enters top-left, ground sinks to the bottom. Signals flow left to right.</li>
          <li>Use named net labels (GND, 3V3, SDA) instead of long wires across the sheet.</li>
          <li>Place every decoupling cap immediately beside the pin it decouples, not in a corner.</li>
          <li>Put a title block with the board name, revision, and date on each sheet.</li>
          <li>Group bypass caps and the regulator's in/out caps tight to their IC.</li>
          <li>Mark pin 1, polarity, and connector orientation on the schematic, not just the layout.</li>
        </ul>
      </Panel>

      <div className="btnrow">
        <Button variant="primary" onClick={save}>Save organization</Button>
        {saved && <span className="cite">Saved. Stage 5 turns this into PCB rules and a stackup.</span>}
      </div>
    </StageShell>
  );
}
