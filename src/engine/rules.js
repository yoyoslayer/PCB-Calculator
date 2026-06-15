/**
 * PCB Creation - Rules engine
 * Deterministic if-then logic. No AI, no randomness. Every output traces to a rule.
 */
import {
  currentBudget, regulatorAdvice, i2cPullup, traceWidthIPC2221, solveMicrostripWidth,
  decouplingPlan, ledResistor,
} from './calculators.js';

// ------------------------------------------- Stage 2: verification + augmentation
export function runChecks(design) {
  const issues = [];
  const additions = [];
  const { source, regulators = [], loads = [], buses = [] } = design;
  const rails = [source, ...regulators].filter(Boolean);

  // 1. Voltage compatibility
  for (const load of loads) {
    const fed = rails.find((rail) => railFeeds(rail, load));
    if (!fed) {
      issues.push({ level: 'error', text: `${load.name} has no rail inside its ${load.voltage.min}-${load.voltage.max} V window.` });
      additions.push({ type: 'regulator', reason: `Add a regulator to make a rail for ${load.name}.`, target: load.id });
    }
  }

  // 2. Source current capability
  const budget = currentBudget(loads);
  const sourcePeak = source?.current?.peak_mA ?? 0;
  if (sourcePeak && budget.peakMa > sourcePeak * 0.8) {
    issues.push({ level: 'warn', text: `Peak demand ${budget.peakMa.toFixed(0)} mA is near or above the source limit ${sourcePeak} mA.` });
    additions.push({ type: 'bulk_cap', reason: 'Add a bulk capacitor at the source to buffer current peaks.', target: source?.id });
  }

  // 3. Regulator dissipation -> LDO vs buck
  for (const reg of regulators) {
    const downstream = loads.filter((l) => railFeeds(reg, l));
    const ioutA = downstream.reduce((s, l) => s + (Number(l.current.active_mA) || 0), 0) / 1000;
    if (ioutA > 0 && source) {
      const adv = regulatorAdvice(source.voltage.typ, reg.voltage.typ, ioutA);
      issues.push({ level: 'info', text: `${reg.name}: ${adv.recommendation} About ${adv.ldoPowerW.toFixed(2)} W dissipated if an LDO.` });
    }
  }

  // 4. Logic-level mismatch on a shared bus
  for (const bus of buses) {
    const levels = (bus.members || [])
      .map((id) => loads.find((l) => l.id === id)?.io?.logic_level_V)
      .filter((x) => x != null);
    if (new Set(levels).size > 1) {
      issues.push({ level: 'warn', text: `Bus ${bus.type} mixes logic levels: ${[...new Set(levels)].join(' V, ')} V.` });
      additions.push({ type: 'level_shifter', reason: `Add a level shifter on the ${bus.type} bus.`, target: bus.type });
    }
  }

  // 5. Decoupling on every powered IC
  for (const ic of loads.filter((l) => l.role === 'controller' || l.role === 'sensor')) {
    additions.push({
      type: 'decoupling',
      reason: `Decouple ${ic.name}: one 100 nF per power pin at the pin, plus a 1-10 uF bulk cap per rail.`,
      target: ic.id,
    });
  }

  // 6. Sized I2C pull-ups
  for (const bus of buses.filter((b) => b.type === 'i2c')) {
    const pu = i2cPullup(bus.vcc ?? 3.3, { busCapPf: bus.busCapPf ?? 100, mode: bus.mode ?? 'fast' });
    additions.push({
      type: 'pullup',
      reason: `I2C pull-ups: ${Math.round(pu.suggestedOhm)} ohm on SDA and SCL. Valid range ${Math.round(pu.rpMinOhm)} to ${Math.round(pu.rpMaxOhm)} ohm.`,
      target: bus.type,
    });
  }

  // 7. Inductive loads
  for (const act of loads.filter((l) => l.inductive)) {
    additions.push({ type: 'flyback_diode', reason: `Add a flyback diode across ${act.name}.`, target: act.id });
    additions.push({ type: 'driver', reason: `Drive ${act.name} through a transistor or MOSFET, not an MCU pin.`, target: act.id });
  }

  return { issues, additions, budget };
}

export function railFeeds(rail, load) {
  if (!rail) return false;
  const v = rail.voltage.typ;
  return v >= load.voltage.min && v <= load.voltage.max;
}

// ------------------------------------------- Stage 2: per-component automatic advice
// Returns a list of recommendations derived from one component's own properties.
// Each item cites the rule or formula it came from. Pure: all inputs come in via ctx.
// ctx: { source, busVcc, busCapPf, busMode, copperOz, regOutA, driver }
export function componentAdvice(block, ctx = {}) {
  const recs = [];
  const oz = ctx.copperOz || 1;
  const peakMa = Number(block.current?.peak_mA) || Number(block.current?.active_mA) || 0;
  const peakA = peakMa / 1000;
  const FLOOR_MM = 0.15; // a sensible minimum trace width when the current is tiny

  // Trace width from a current, with the fab minimum as a floor. IPC-2221.
  const traceRec = (title, amps, lead) => {
    const tw = traceWidthIPC2221(amps, 10, oz, 'external');
    const thin = tw.widthMm < FLOOR_MM;
    return {
      kind: 'trace',
      title,
      value: `${Math.max(tw.widthMm, FLOOR_MM).toFixed(3)} mm`,
      detail: thin
        ? `${lead} That is little current, so the formula allows a very thin trace. Use your fab minimum of about ${FLOOR_MM} millimetres instead.`
        : `${lead} Make the trace at least this wide.`,
      cite: `IPC-2221 at a 10 degree rise, ${oz} ounce copper`,
    };
  };

  // Every power and ground connection: trace width from this part's current.
  if (peakA > 0) {
    recs.push(traceRec('Power and ground trace width', peakA, `This part can draw ${peakMa.toFixed(0)} milliamps.`));
  }

  // A regulator: linear versus switching, input and output capacitors, output rail width.
  if (block.role === 'regulator') {
    const vin = ctx.vinTyp ?? ctx.source?.voltage?.typ ?? null;
    const vout = block.voltage?.typ;
    const iout = ctx.regOutA ?? 0;
    if (vin && vout) {
      const adv = regulatorAdvice(vin, vout, iout || 0.1);
      const isLdo = adv.recommendation.startsWith('LDO');
      recs.push({
        kind: 'reg',
        title: 'Regulator type',
        value: isLdo ? 'Linear regulator' : 'Switching buck converter',
        detail: `From ${vin} volts in to ${vout} volts out at about ${(iout * 1000 || 0).toFixed(0)} milliamps. A linear regulator would turn about ${adv.ldoPowerW.toFixed(2)} watts into heat at ${(adv.ldoEfficiency * 100).toFixed(0)} percent efficiency. ${adv.recommendation}`,
        cite: 'Power lost in a linear regulator is voltage drop times current',
      });
      recs.push({
        kind: 'caps',
        title: 'Input and output capacitors',
        value: isLdo ? '1 microfarad in, 1 to 10 microfarads out' : '10 microfarads in, 22 microfarads out',
        detail: isLdo
          ? 'A typical linear regulator wants a small input capacitor and a stable output capacitor. Many need a low resistance type on the output. Confirm the exact values against the chip datasheet.'
          : 'A typical buck converter wants bulk input and output capacitors to smooth the switching. Confirm the exact values and types against the chip datasheet.',
        cite: 'Common starting values, verify against the datasheet',
      });
      if (iout > 0) {
        recs.push(traceRec('Output rail trace width', iout, `The ${vout} volt rail carries about ${(iout * 1000).toFixed(0)} milliamps to everything it feeds.`));
      }
    }
  }

  // A controller or sensor: the decoupling plan.
  if (block.role === 'controller' || block.role === 'sensor') {
    const pins = Number(block.powerPins) || (block.role === 'controller' ? 2 : 1);
    const plan = decouplingPlan(pins, 1);
    recs.push({
      kind: 'decap',
      title: 'Decoupling capacitors',
      value: `${pins} times 100 nanofarads, plus ${plan.bulkUf} microfarads bulk`,
      detail: `Place one 100 nanofarad capacitor hard against each of the ${pins} power pin${pins > 1 ? 's' : ''}, then one ${plan.bulkUf} microfarad bulk capacitor for the rail.`,
      cite: 'One 100 nanofarad capacitor per power pin, plus a bulk capacitor per rail',
    });
  }

  // Any I2C device: the pull-up value for the bus, sized once per bus.
  if ((block.io?.interfaces || []).includes('i2c')) {
    const vcc = ctx.busVcc ?? block.voltage?.typ ?? 3.3;
    const pu = i2cPullup(vcc, { busCapPf: ctx.busCapPf ?? 100, mode: ctx.busMode ?? 'fast' });
    recs.push({
      kind: 'pullup',
      title: 'I2C pull-up resistors',
      value: `${Math.round(pu.suggestedOhm)} ohms`,
      detail: `Size these once for the whole bus at ${vcc} volts, not once per part. One on the data line and one on the clock line. The valid range is ${Math.round(pu.rpMinOhm)} to ${Math.round(pu.rpMaxOhm)} ohms.`,
      cite: 'NXP I2C limits: lowest from drive strength, highest from rise time',
    });
  }

  // A motor or any inductive part: flyback diode, driver, and trace width.
  if (block.inductive) {
    recs.push({
      kind: 'flyback',
      title: 'Flyback diode',
      value: 'Add a diode across the coil',
      detail: 'A motor or coil kicks back a high voltage spike when it is switched off. Put a diode across it to clamp that spike and protect the driver.',
      cite: 'Inductive load protection',
    });
    const drv = ctx.driver;
    recs.push({
      kind: 'driver',
      title: 'Driver',
      value: drv ? drv.name : 'Use a transistor or driver chip',
      detail: drv
        ? `Do not switch this from a logic pin. ${drv.name} suits it, LCSC part ${drv.lcsc}.`
        : 'Do not switch this from a logic pin. Use a transistor or an H bridge driver rated for the stall current.',
      cite: drv ? 'Matched driver from the catalog' : 'Inductive loads need a driver',
    });
  }

  // An LED, if present: the series resistor.
  if (block.led) {
    const vs = ctx.source?.voltage?.typ ?? block.voltage?.typ ?? 3.3;
    const vf = Number(block.vf) || 2.0;
    const ifMa = Number(block.ifMa) || 10;
    const r = ledResistor(vs, vf, ifMa);
    recs.push({
      kind: 'led',
      title: 'LED series resistor',
      value: `${r.nearestE12} ohms`,
      detail: `From a ${vs} volt supply, an LED dropping ${vf} volts at ${ifMa} milliamps needs about ${r.rOhm.toFixed(0)} ohms. The nearest standard value is ${r.nearestE12} ohms, dissipating ${(r.powerW * 1000).toFixed(1)} milliwatts.`,
      cite: 'Resistor equals supply minus LED drop, divided by current',
    });
  }

  return recs;
}

// ----------------------------------------------- Stage 5: manufacturer-driven rules
// profile is a manufacturer capability object (see config/data.js).
export function deriveDesignRules(profile, layerCount, copperOz = 1) {
  const tier = layerCount <= 2 ? 'twoLayer' : 'multiLayer';
  const t = profile.tiers[tier];
  return {
    layerCount,
    copperOz,
    minTraceMil: t.minTraceMil,
    minSpaceMil: t.minSpaceMil,
    minViaDrillMm: t.minViaDrillMm,
    minViaPadMm: t.minViaPadMm,
    minAnnularMm: t.minAnnularMm,
    minHoleMm: t.minHoleMm,
    edgeClearanceMm: profile.edgeClearanceMm,
    silkMinHeightMm: profile.silkMinHeightMm,
    source: profile.name,
    verifyNote: profile.verifyNote,
  };
}

// Net classes derived from the current budget and the design rules.
// Values are returned in millimeters to match the units KiCad's Net Classes table uses.
// Each class maps to KiCad fields: Track Width, Clearance, Via Size, Via Hole, and for a
// differential pair, DP Width and DP Gap. usesUsb controls whether a USB pair class appears.
export function deriveNetClasses(budget, rules, copperOz = 1, stackup = null, usesUsb = false) {
  const MIL = 0.0254;
  const mm = (mil, d = 3) => Number((mil * MIL).toFixed(d));

  const signalWidthMil = rules.minTraceMil * 1.3;
  // Power should never be narrower than a general signal trace, even on low-current designs.
  const powerWidthMil = Math.max(rules.minTraceMil, signalWidthMil, traceWidthIPC2221((budget.peakMa || 0) / 1000 || 0.5, 10, copperOz, 'external').widthMils);

  // Signal vias use the design-rule minimums. Power and ground vias are a step up for current.
  const viaSig = { sizeMm: rules.minViaPadMm, holeMm: rules.minViaDrillMm };
  const viaPwr = { sizeMm: Math.max(0.8, rules.minViaPadMm), holeMm: Math.max(0.4, rules.minViaDrillMm) };

  const classes = [
    { name: 'Power', trackWidthMm: mm(powerWidthMil), clearanceMm: mm(Math.max(rules.minSpaceMil, 8)), viaSizeMm: viaPwr.sizeMm, viaHoleMm: viaPwr.holeMm, note: `Carries ${(budget.peakMa || 0).toFixed(0)} mA peak. Width from IPC-2221 at a 10 degree C rise.` },
    { name: 'Signal', trackWidthMm: mm(signalWidthMil), clearanceMm: mm(rules.minSpaceMil), viaSizeMm: viaSig.sizeMm, viaHoleMm: viaSig.holeMm, note: 'General routing. A small margin over the minimum track width.' },
    { name: 'Ground', trackWidthMm: mm(powerWidthMil), clearanceMm: mm(rules.minSpaceMil), viaSizeMm: viaPwr.sizeMm, viaHoleMm: viaPwr.holeMm, note: 'Prefer a copper pour. This width applies only to ground routed as a track.' },
  ];

  if (usesUsb) {
    const layers = rules.layerCount;
    if (layers >= 4 && stackup) {
      const wMil = solveMicrostripWidth(45, { hMil: stackup.outerDielectricMil || 8, er: stackup.er || 4.2 });
      classes.push({
        name: 'USB differential pair, 90 ohm',
        isDiff: true,
        trackWidthMm: mm(wMil), clearanceMm: mm(rules.minSpaceMil),
        viaSizeMm: viaSig.sizeMm, viaHoleMm: viaSig.holeMm,
        dpWidthMm: mm(wMil), dpGapMm: mm(wMil),
        note: 'Starting point for a 90 ohm pair on an outer layer. Match the two trace lengths within 0.1 mm and confirm against the fab impedance calculator before ordering.',
      });
    } else {
      classes.push({
        name: 'USB differential pair, 90 ohm',
        isDiff: true, impractical: true,
        trackWidthMm: null, clearanceMm: mm(rules.minSpaceMil),
        viaSizeMm: viaSig.sizeMm, viaHoleMm: viaSig.holeMm,
        dpWidthMm: null, dpGapMm: null,
        note: 'A controlled 90 ohm pair is not practical on 2 layers, because the ground plane sits about 1.5 mm below the trace and that forces an impractically wide trace. Move to a 4-layer board for USB.',
      });
    }
  }
  return classes;
}

// Layer stackup. Approximate JLCPCB 1.6 mm builds, flagged for verification.
export function generateStackup(layerCount, copperOz = 1) {
  if (layerCount <= 2) {
    return {
      layerCount: 2,
      totalMm: 1.6,
      outerDielectricMil: Number((1.53 / 0.0254).toFixed(1)), // microstrip ref to opposite plane/pour
      er: 4.6,
      layers: [
        { name: 'Top Copper', type: 'signal', detail: `${copperOz} oz, ~${(copperOz * 35)} um` },
        { name: 'Core FR-4', type: 'dielectric', detail: '~1.53 mm, er ~4.6' },
        { name: 'Bottom Copper', type: 'signal/pour', detail: `${copperOz} oz, ~${(copperOz * 35)} um` },
      ],
      note: 'JLCPCB 2-layer 1.6 mm. For controlled impedance on 2 layers, expect wide traces. Verify stackup.',
    };
  }
  // 4-layer JLC7628 style
  return {
    layerCount: 4,
    totalMm: 1.6,
    outerDielectricMil: 8.0, // approx prepreg 7628 ~0.2104 mm to the inner plane
    er: 4.2,
    layers: [
      { name: 'L1 Top Copper', type: 'signal', detail: 'outer, plated to ~1 oz' },
      { name: 'Prepreg 7628', type: 'dielectric', detail: '~0.21 mm, er ~4.2' },
      { name: 'L2 Inner', type: 'ground plane', detail: '0.5 oz' },
      { name: 'Core', type: 'dielectric', detail: '~1.065 mm' },
      { name: 'L3 Inner', type: 'power plane', detail: '0.5 oz' },
      { name: 'Prepreg 7628', type: 'dielectric', detail: '~0.21 mm, er ~4.2' },
      { name: 'L4 Bottom Copper', type: 'signal', detail: 'outer, plated to ~1 oz' },
    ],
    note: 'JLCPCB 4-layer 1.6 mm JLC7628. Reference signals to the adjacent plane. Verify stackup before ordering.',
  };
}
