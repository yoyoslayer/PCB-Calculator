/**
 * PCB Creation - Calculator library
 * Pure functions. Every formula is standard, public-domain engineering math.
 *
 * Sources (verified across DigiKey, Altium, AdvancedPCB, IPC-2141A):
 *   - Trace width: IPC-2221 sec 6.2.  I = k * dT^0.44 * A^0.725
 *       k = 0.048 external, 0.024 internal. 1 oz copper = 1.378 mils.
 *       IPC-2221 is the conservative standard (wider, safer traces) and is the default here.
 *   - Microstrip Z0: IPC-2141A.  87/sqrt(er+1.41) * ln(5.98H / (0.8W + T))   valid 0.1 < W/H < 3.0
 *   - Stripline Z0: IPC-2141A.    60/sqrt(er) * ln(4B / (0.67*pi*(0.8W + T)))
 *   - Differential approx:        Zdiff = 2*Z0*(1 - 0.48*e^(-0.96*s/h))
 *   - I2C pull-ups: NXP I2C spec.  Rp_min = (Vcc - Vol)/Iol ; Rp_max = t_rise/(0.8473*C_bus)
 *   All impedance results are first-pass estimates. Verify against the fab stackup / a field solver.
 */

const OZ_TO_MILS = 1.378;
const MIL_TO_MM = 0.0254;
const OZ_TO_UM = 35; // 1 oz copper approx 35 microns

export const constants = { OZ_TO_MILS, MIL_TO_MM, OZ_TO_UM };

// ---------------------------------------------------------------- trace width
export function traceWidthIPC2221(currentA, deltaTC = 10, copperOz = 1, layer = 'external') {
  const k = layer === 'internal' ? 0.024 : 0.048;
  const b = 0.44, c = 0.725;
  const areaMils2 = Math.pow(currentA / (k * Math.pow(deltaTC, b)), 1 / c);
  const thicknessMils = copperOz * OZ_TO_MILS;
  const widthMils = areaMils2 / thicknessMils;
  return {
    areaMils2,
    widthMils,
    widthMm: widthMils * MIL_TO_MM,
    thicknessMils,
    note: 'IPC-2221, conservative. IPC-2152 allows narrower with copper pours and thicker board.',
  };
}

// -------------------------------------------------------------- current budget
export function currentBudget(blocks, peakCoincidence = 1.0) {
  let activeMa = 0, peakMa = 0, sleepUa = 0;
  for (const blk of blocks) {
    const cur = blk.current || {};
    activeMa += (Number(cur.active_mA) || 0) * (blk.dutyCycle ?? 1);
    peakMa += (Number(cur.peak_mA) ?? Number(cur.active_mA) ?? 0) || 0;
    sleepUa += Number(cur.sleep_uA) || 0;
  }
  return { activeMa, peakMa: peakMa * peakCoincidence, sleepUa };
}

export function batteryLife(capacityMah, avgCurrentMa, derate = 0.8) {
  if (avgCurrentMa <= 0) return Infinity;
  return (capacityMah * derate) / avgCurrentMa;
}

// ----------------------------------------------------------- regulator choice
export function regulatorAdvice(vin, vout, ioutA, opts = {}) {
  const dropout = opts.dropout ?? 0.3;
  const pkgThermalLimitW = opts.pkgThermalLimitW ?? 0.5;
  const ldoPowerW = (vin - vout) * ioutA;
  const ldoEfficiency = vout / vin;
  const dropoutOK = (vin - vout) >= dropout;
  let recommendation;
  if (!dropoutOK) recommendation = 'Buck-boost or raise Vin: not enough headroom for an LDO dropout.';
  else if (ldoPowerW > pkgThermalLimitW) recommendation = 'Buck converter: an LDO would dissipate too much heat.';
  else recommendation = 'LDO: low dissipation and adequate headroom.';
  return { ldoPowerW, ldoEfficiency, dropoutOK, recommendation };
}

// --------------------------------------------------------------- ohms law etc
export function ohmsLaw({ v, i, r } = {}) {
  if (v != null && i != null) r = v / i;
  else if (v != null && r != null) i = v / r;
  else if (i != null && r != null) v = i * r;
  else throw new Error('Provide any two of v, i, r');
  return { v, i, r, p: v * i };
}

export function voltageDivider(vin, r1, r2) {
  const vout = vin * (r2 / (r1 + r2));
  const currentMa = (vin / (r1 + r2)) * 1000;
  return { vout, currentMa };
}

export function solveDividerR2(vin, voutTarget, r1) {
  return r1 * voutTarget / (vin - voutTarget);
}

export function ledResistor(vsupply, vForward, ifMa) {
  const ifA = ifMa / 1000;
  const rOhm = (vsupply - vForward) / ifA;
  return { rOhm, nearestE12: nearestESeries(rOhm, 'E12'), powerW: (vsupply - vForward) * ifA };
}

// ------------------------------------------------------------------ pull-ups
export function i2cPullup(vcc, opts = {}) {
  const { iolMa = 3, busCapPf = 100, mode = 'fast', volMax = 0.4 } = opts;
  const trNs = { standard: 1000, fast: 300, fastplus: 120 }[mode] ?? 300;
  const rpMinOhm = (vcc - volMax) / (iolMa / 1000);
  const rpMaxOhm = (trNs * 1e-9) / (0.8473 * busCapPf * 1e-12);
  return {
    rpMinOhm,
    rpMaxOhm,
    suggestedOhm: suggestWithinRange(rpMinOhm, rpMaxOhm),
    valid: rpMaxOhm > rpMinOhm,
  };
}

// Generic static-logic pull-up / pull-down. Returns a sane range and a default.
export function genericPullup(vcc, opts = {}) {
  const { sinkMa = 4, leakageUa = 1, volMax = 0.4 } = opts;
  const minOhm = (vcc - volMax) / (sinkMa / 1000); // do not overload the driver pulling low
  const maxOhm = (vcc * 0.1) / (leakageUa / 1e6);  // keep within 10% of Vcc against input leakage
  return { minOhm, maxOhm, suggestedOhm: suggestWithinRange(minOhm, Math.min(maxOhm, 100000)) };
}

// ------------------------------------------------------------- decoupling
// Rule of thumb: one 100 nF per power pin placed at the pin, plus bulk per rail.
export function decouplingPlan(powerPins = 1, rails = 1) {
  return {
    perPinNf: 100,
    perPinCount: powerPins,
    bulkUf: 10,
    bulkCount: rails,
    summary: `${powerPins} x 100 nF at the power pins, plus ${rails} x 10 uF bulk per rail.`,
  };
}

// Bulk cap to hold a rail within a droop limit during a load step. C = I*t/V
export function bulkCapForDroop(deltaIa, deltaTs, allowedDroopV) {
  const farads = (deltaIa * deltaTs) / allowedDroopV;
  return { farads, microfarads: farads * 1e6, nearestUf: nearestESeries(farads * 1e6, 'E12') };
}

// -------------------------------------------------------------- impedance
export function effectiveErMicrostrip(er, hMil, wMil) {
  return (er + 1) / 2 + ((er - 1) / 2) * Math.pow(1 + (12 * hMil) / wMil, -0.5);
}

// All dimensions in mils. Returns Z0 in ohms.
export function microstripImpedance({ wMil, hMil, tMil = 1.378, er = 4.2 }) {
  const z0 = (87 / Math.sqrt(er + 1.41)) * Math.log((5.98 * hMil) / (0.8 * wMil + tMil));
  const wOverH = wMil / hMil;
  return {
    z0,
    effEr: effectiveErMicrostrip(er, hMil, wMil),
    inRange: wOverH >= 0.1 && wOverH <= 3.0,
    note: 'IPC-2141A microstrip estimate. Verify with the fab stackup.',
  };
}

export function striplineImpedance({ wMil, bMil, tMil = 1.378, er = 4.2 }) {
  const z0 = (60 / Math.sqrt(er)) * Math.log((4 * bMil) / (0.67 * Math.PI * (0.8 * wMil + tMil)));
  return { z0, note: 'IPC-2141A stripline estimate. Verify with the fab stackup.' };
}

export function diffImpedance(z0Single, sMil, hMil) {
  return 2 * z0Single * (1 - 0.48 * Math.exp((-0.96 * sMil) / hMil));
}

// Solve microstrip width that yields a target single-ended Z0, by bisection.
export function solveMicrostripWidth(targetZ0, { hMil, tMil = 1.378, er = 4.2 }) {
  let lo = 0.5, hi = 200; // mils
  for (let n = 0; n < 60; n++) {
    const mid = (lo + hi) / 2;
    const z = microstripImpedance({ wMil: mid, hMil, tMil, er }).z0;
    if (z > targetZ0) lo = mid; // wider trace -> lower Z
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// --------------------------------------------------------- E-series helpers
const ESERIES = {
  E12: [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2],
  E24: [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0,
        3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1],
};

export function nearestESeries(value, series = 'E12') {
  if (!isFinite(value) || value <= 0) return value;
  const base = ESERIES[series];
  const decade = Math.floor(Math.log10(value));
  const norm = value / Math.pow(10, decade);
  let best = base[0], bestErr = Infinity;
  for (const v of base) {
    const err = Math.abs(v - norm);
    if (err < bestErr) { bestErr = err; best = v; }
  }
  return Number((best * Math.pow(10, decade)).toPrecision(3));
}

function suggestWithinRange(minOhm, maxOhm) {
  if (maxOhm <= minOhm) return nearestESeries(minOhm, 'E12');
  const target = Math.sqrt(minOhm * maxOhm);
  const candidates = [];
  for (let decade = 0; decade <= 6; decade++) {
    for (const v of ESERIES.E12) candidates.push(v * Math.pow(10, decade));
  }
  const inRange = candidates.filter((c) => c >= minOhm && c <= maxOhm);
  if (!inRange.length) return nearestESeries(target, 'E12');
  return inRange.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
}
