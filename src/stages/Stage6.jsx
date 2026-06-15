import { useMemo } from 'react';
import { useDesign } from '../store.jsx';
import { Panel, Pill, Callout, Button } from '../ui.jsx';
import StageShell from './StageShell.jsx';

function layerAssignment(layerCount) {
  if (layerCount >= 6) {
    return [
      { layer: 'L1 Top', use: 'Components and short signal routing', tone: 'mask' },
      { layer: 'L2', use: 'Ground plane, continuous', tone: 'copper' },
      { layer: 'L3', use: 'High-speed signals, referenced to L2', tone: 'mask' },
      { layer: 'L4', use: 'Signals, referenced to L5', tone: 'mask' },
      { layer: 'L5', use: 'Power plane', tone: 'copper' },
      { layer: 'L6 Bottom', use: 'Components and routing', tone: 'mask' },
    ];
  }
  if (layerCount === 4) {
    return [
      { layer: 'L1 Top', use: 'All components plus signal routing', tone: 'mask' },
      { layer: 'L2 Inner', use: 'Ground plane, keep it unbroken under fast signals', tone: 'copper' },
      { layer: 'L3 Inner', use: 'Power plane and power routing', tone: 'copper' },
      { layer: 'L4 Bottom', use: 'Remaining signals and a ground pour', tone: 'mask' },
    ];
  }
  return [
    { layer: 'Top', use: 'All components and most routing. Single-side assembly is cheaper at JLCPCB.', tone: 'mask' },
    { layer: 'Bottom', use: 'Ground pour plus the few crossover traces. Keep the pour as continuous as you can.', tone: 'copper' },
  ];
}

export default function Stage6() {
  const { state, setData } = useDesign();
  const s5 = state.data.stage5;
  const saved = state.data.stage6;

  const layerCount = s5?.designRules?.layerCount ?? 2;
  const hasDiff = useMemo(() => (s5?.netClasses || []).some((c) => c.name.startsWith('USB')), [s5]);
  const assignment = useMemo(() => layerAssignment(layerCount), [layerCount]);

  const placement = [
    'Connectors and mounting holes at the board edges first. They are fixed points everything else works around.',
    'Power section next: regulator with its input and output caps, placed near where power enters.',
    'Put the main IC roughly central so its many nets fan out with short traces.',
    'Decoupling caps go hard against each power pin, on the same side as the IC.',
    'Crystal or oscillator sits right next to the IC with the shortest possible traces and a local ground.',
    ...(hasDiff ? ['USB connector at the edge, with the D+/D- pair running straight into the IC, kept short.'] : []),
    'Sensors and the rest fill in last, grouped the way you drew them on the schematic.',
  ];

  const routing = [
    'Power and ground first, at the widths from your Power and Ground net classes. Wide and direct.',
    ...(hasDiff ? ['USB D+/D- as a length-matched differential pair at the impedance width, kept over a solid reference plane.'] : []),
    'Clock and crystal lines next: short, away from other signals, with ground nearby.',
    'Everything else after, following the shortest sensible path.',
    'Pour copper last, then stitch the grounds together with vias along the edges and between planes.',
  ];

  const dfm = [
    'Run DRC and clear every error against the rules from Stage 5.',
    'Check silkscreen sits off all pads and meets the minimum text height.',
    'Confirm edge clearance and that mounting holes match your enclosure.',
    'Add ground stitching vias and tie all ground pours together.',
    ...(hasDiff || layerCount >= 4 ? ['Add a fab note with the stackup and any controlled-impedance requirement so the fab matches it.'] : []),
  ];

  const exportSteps = [
    'In KiCad PCB editor, run File then Plot. Select the copper, mask, silkscreen, and edge-cuts layers.',
    'Generate drill files from the same dialog, then zip the Gerbers and drills together.',
    'Upload the zip to JLCPCB and confirm the layer mapping and the stackup match what you set.',
    'For the 3D model and enclosure fit, run File then Export then STEP.',
    'Order a small quantity first and verify the real board before a full run.',
  ];

  function save() {
    setData('stage6', { layerCount, assignment, placement, routing, dfm, exportSteps, complete: true });
  }

  if (!s5) {
    return (
      <StageShell stageKey="stage6" title="Lay it out and export" lead="Finish the PCB setup in Stage 5 first.">
        <Callout tone="warn" title="No PCB setup yet">Save design rules and a stackup in Layer 5.</Callout>
      </StageShell>
    );
  }

  return (
    <StageShell
      stageKey="stage6"
      title="Place, route, and ship the files"
      lead="The final stage. Here is which layer does what, the order to place and route in, and the checklist to get clean Gerbers and a STEP model out of KiCad."
    >
      <Panel title="Layer assignment" kicker={`${layerCount}-layer board`}>
        <div className="itemlist">
          {assignment.map((a, i) => (
            <div key={i} className="item">
              <div className="item__main">
                <div className="item__name"><Pill tone={a.tone}>{a.layer}</Pill></div>
                <div className="item__meta">{a.use}</div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Placement order" kicker="Place in this sequence">
        <ol className="hint-list">{placement.map((p, i) => <li key={i}>{p}</li>)}</ol>
      </Panel>

      <Panel title="Routing priority" kicker="Route in this sequence">
        <ol className="hint-list">{routing.map((r, i) => <li key={i}>{r}</li>)}</ol>
      </Panel>

      <Panel title="DFM check" kicker="Before you export">
        <ul className="hint-list">{dfm.map((d, i) => <li key={i}>{d}</li>)}</ul>
      </Panel>

      <Panel title="Gerber and STEP export" kicker="KiCad steps">
        <ol className="hint-list">{exportSteps.map((e, i) => <li key={i}>{e}</li>)}</ol>
        <Callout tone="mask" title="That is the whole flow">
          From a project idea to fab-ready files. Export your project as JSON from the sidebar to save this design or hand it off.
        </Callout>
      </Panel>

      <div className="btnrow">
        <Button variant="primary" onClick={save}>Mark layout complete</Button>
        {saved && <span className="cite">Done. All six layers complete.</span>}
      </div>
    </StageShell>
  );
}
