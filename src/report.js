/**
 * Builds a human-readable Markdown report of every recommendation in the project.
 * Only includes stages that have been completed.
 */
export function buildReport(state) {
  const d = state.data;
  const L = [];
  const h1 = (t) => L.push(`# ${t}`);
  const h2 = (t) => L.push(`\n## ${t}`);
  const p = (t) => L.push(t);
  const li = (t) => L.push(`- ${t}`);
  const blank = () => L.push('');

  h1(`PCB Creation report: ${state.meta.name}`);
  p(`Generated ${new Date().toLocaleString()}`);
  p('All recommendations are advisory. Verify manufacturer limits and any controlled impedance against the live capabilities page and the fab stackup before ordering.');

  // Stage 1
  if (d.stage1) {
    const s = d.stage1;
    h2('1. Requirements');
    li(`Project type: ${s.projectLabel || s.projectType}`);
    li(`Power source: ${s.powerSource}`);
    li(`Environment: ${s.environment}`);
    li(`Layer target: ${s.layerTarget}`);
    if (s.sizeMm?.w && s.sizeMm?.h) li(`Board size: ${s.sizeMm.w} by ${s.sizeMm.h} mm`);
    li(`Copper weight: ${s.constraintSeed?.copperOz} ounce`);
  }

  // Stage 2
  if (d.stage2) {
    const s = d.stage2;
    h2('2. Components and power budget');
    if (s.budget) {
      li(`Average current while working: ${s.budget.activeMa?.toFixed(1)} milliamps`);
      li(`Worst case peak current: ${s.budget.peakMa?.toFixed(0)} milliamps`);
      li(`Sleep current: ${s.budget.sleepUa?.toFixed(1)} microamps`);
    }
    blank();
    p('Parts:');
    (s.blocks || []).forEach((b) => li(`${b.id}, ${b.name}, role ${b.role}, voltage ${b.voltage.min} to ${b.voltage.max} volts${b.lcsc ? `, LCSC ${b.lcsc}` : ''}`));
    if (s.issues?.length) {
      blank(); p('Checks:');
      s.issues.forEach((i) => li(typeof i === 'string' ? i : i.text));
    }
    if (s.additions?.length) {
      blank(); p('Supporting parts to add:');
      const seen = new Set();
      s.additions.forEach((a) => { const k = `${a.type}:${a.target}`; if (!seen.has(k)) { seen.add(k); li(a.reason); } });
    }
  }

  // Stage 3
  if (d.stage3?.netlist) {
    h2('3. Netlist');
    (d.stage3.netlist.list || []).forEach((n) => li(`${n.net}: ${n.members.map((m) => `${m.ref}.${m.pin}`).join(' + ')}`));
    if (d.stage3.netlist.unassigned?.length) {
      blank(); p('Wire by hand:');
      d.stage3.netlist.unassigned.forEach((u) => li(`${u.ref}.${u.pin}`));
    }
  }

  // Stage 4
  if (d.stage4) {
    h2('4. Schematic organization');
    li(`Sheet plan: ${d.stage4.sheetPlan === 'multi' ? 'multiple sheets' : 'single sheet'}`);
    (d.stage4.sheets || []).forEach((s) => li(`Sheet: ${s}`));
  }

  // Stage 5
  if (d.stage5) {
    const s = d.stage5;
    h2('5. PCB setup');
    p(`Manufacturer profile: ${s.manufacturer}`);
    blank(); p('Design rules, in millimeters unless noted:');
    const r = s.designRules || {};
    li(`Minimum trace width: ${r.minTraceMil} mil`);
    li(`Minimum spacing: ${r.minSpaceMil} mil`);
    li(`Minimum via drill: ${r.minViaDrillMm} mm`);
    li(`Minimum via pad: ${r.minViaPadMm} mm`);
    li(`Minimum annular ring: ${r.minAnnularMm} mm`);
    li(`Minimum hole: ${r.minHoleMm} mm`);
    blank(); p('Net classes, in millimeters:');
    (s.netClasses || []).forEach((c) => {
      const w = c.trackWidthMm != null ? `${c.trackWidthMm} mm` : 'not practical on this stackup';
      let line = `${c.name}: track width ${w}, clearance ${c.clearanceMm} mm, via ${c.viaSizeMm} by ${c.viaHoleMm} mm`;
      if (c.dpWidthMm != null) line += `, differential pair width ${c.dpWidthMm} mm and gap ${c.dpGapMm} mm`;
      li(line);
    });
    blank(); p('Layer stackup:');
    (s.stackup?.layers || []).forEach((l) => li(`${l.name}: ${l.detail}`));
  }

  // Stage 6
  if (d.stage6) {
    const s = d.stage6;
    h2('6. Layout and export');
    p('Layer assignment:');
    (s.assignment || []).forEach((a) => li(`${a.layer}: ${a.use}`));
    blank(); p('Placement order:');
    (s.placement || []).forEach((x, i) => li(`${i + 1}. ${x}`));
    blank(); p('Routing priority:');
    (s.routing || []).forEach((x, i) => li(`${i + 1}. ${x}`));
    blank(); p('Before you export:');
    (s.dfm || []).forEach((x) => li(x));
    blank(); p('Export steps:');
    (s.exportSteps || []).forEach((x, i) => li(`${i + 1}. ${x}`));
  }

  if (L.length <= 3) p('\nNothing recorded yet. Complete a stage and download again.');
  return L.join('\n');
}
