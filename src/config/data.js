/**
 * PCB Creation - Config data
 * Editable without touching component code. Numbers cite their basis in comments.
 * Manufacturer specs change. Always re-check the live capabilities page before ordering.
 */

// JLCPCB capabilities verified late 2025 -> 2026 against jlcpcb.com blog and capability pages.
// 2-layer standard 6 mil for margin; multilayer min 3.5 mil; min hole 0.15 mm; min annular 0.15 mm.
export const MANUFACTURERS = {
  jlcpcb: {
    id: 'jlcpcb',
    name: 'JLCPCB',
    maxLayers: 20,
    edgeClearanceMm: 0.3,
    silkMinHeightMm: 0.8,
    verifyNote: 'Verify against the live JLCPCB capabilities page before ordering. Specs change.',
    tiers: {
      twoLayer: {
        minTraceMil: 6,      // 5 mil is the floor; 6 leaves manufacturing margin
        minSpaceMil: 6,
        minViaDrillMm: 0.3,  // 0.8 mm pad / 0.4 mm drill recommended for reliability
        minViaPadMm: 0.5,
        minAnnularMm: 0.15,
        minHoleMm: 0.3,      // below 0.3 mm counts as a small hole and may add cost
      },
      multiLayer: {
        minTraceMil: 4,      // 4 mil free on 4-layer; 3.0-3.5 mil adds fees
        minSpaceMil: 4,
        minViaDrillMm: 0.15,
        minViaPadMm: 0.25,
        minAnnularMm: 0.15,
        minHoleMm: 0.15,
      },
    },
    notes: [
      'Odd layer counts are built as the next even number.',
      'Standard thickness 1.6 mm at +/- 10 percent.',
      'Free resin-filled, copper-capped via-in-pad on 6 to 20 layer boards.',
      '2 oz copper needs wider traces because thick copper etches less precisely.',
    ],
  },
};

// IPC defaults referenced across stages.
export const IPC_DEFAULTS = {
  traceWidthStandard: 'IPC-2221 (conservative). IPC-2152 optional for tighter high-current work.',
  impedanceStandard: 'IPC-2141A closed-form (first-pass). Field solver for final values.',
  defaultDeltaTC: 10,
  defaultErFR4: 4.2,
};

// Project archetypes. Picking one seeds the power source, layer target, and suggested blocks.
export const PROJECT_TYPES = [
  {
    id: 'battery_sensor',
    label: 'Battery sensor node',
    blurb: 'A small board that runs on a battery, reads one or more sensors, and reports the readings, often over a wireless link. How long it lasts on a charge is the main concern. For example, a temperature and humidity logger that runs for months on one cell.',
    defaults: { powerSource: 'lipo_1s', layerTarget: 2, environment: 'portable' },
    seedBlocks: ['mcu_3v3', 'ldo_3v3', 'i2c_sensor'],
    hints: ['Idle current, not active current, decides how long the battery lasts.', 'A wireless radio can draw a large current spike, so check it against the cell limit.'],
  },
  {
    id: 'audio_player',
    label: 'Audio playback device',
    blurb: 'A board that stores or receives sound and plays it through a small speaker. For example, a button that plays a sound clip, which is the same pattern as your motivational bot.',
    defaults: { powerSource: 'lipo_1s', layerTarget: 2, environment: 'portable' },
    seedBlocks: ['mcu_3v3', 'ldo_3v3', 'i2s_amp', 'speaker'],
    hints: ['The amplifier draws sharp current spikes on loud passages, so a buffer capacitor matters.', 'Keep the speaker wiring away from sensitive sensor signals.'],
  },
  {
    id: 'motor_driver',
    label: 'Motor or actuator driver',
    blurb: 'A board that switches a motor, a relay, or a solenoid on and off under the control of a small computer chip. For example, a fan controller or a board that releases a latch.',
    defaults: { powerSource: 'dc_barrel', layerTarget: 2, environment: 'benchtop' },
    seedBlocks: ['mcu_3v3', 'buck_5v', 'motor'],
    hints: ['A motor or coil kicks back a voltage spike when switched off and needs a protection diode.', 'Keep the high-current motor return path separate from the signal ground.'],
  },
  {
    id: 'usb_peripheral',
    label: 'USB device',
    blurb: 'A board that plugs into a computer with a Universal Serial Bus cable and talks to it as a device. For example, a custom keyboard or a sensor dongle. The two data wires have to be a closely matched pair.',
    defaults: { powerSource: 'usb_5v', layerTarget: 4, environment: 'benchtop' },
    seedBlocks: ['mcu_3v3', 'ldo_3v3'],
    hints: ['Route the two USB data wires as a matched pair held at a 90 ohm differential impedance.', 'Four copper layers make that impedance much easier to hit.'],
  },
  {
    id: 'breakout',
    label: 'Breakout or development board',
    blurb: 'A simple board that brings the pins of a single chip out to labeled holes so you can wire it on a breadboard and experiment. For example, breaking out a new sensor chip you want to try.',
    defaults: { powerSource: 'usb_5v', layerTarget: 2, environment: 'benchtop' },
    seedBlocks: ['mcu_3v3', 'ldo_3v3'],
    hints: ['Add test points and label every pin on the silkscreen.', 'Keep it simple, since the goal is to learn the chip.'],
  },
];

export const POWER_SOURCES = {
  lipo_1s: { id: 'bat1', name: 'LiPo 1S', role: 'source', voltage: { min: 3.0, typ: 3.7, max: 4.2 }, current: { active_mA: 0, peak_mA: 2000, sleep_uA: 0 }, signal: { domain: 'power', acdc: 'dc' }, io: { logic_level_V: 0, interfaces: [] }, outputType: 'VBAT rail', capacityMah: 1000 },
  usb_5v: { id: 'usb1', name: 'USB 5V', role: 'source', voltage: { min: 4.75, typ: 5.0, max: 5.25 }, current: { active_mA: 0, peak_mA: 500, sleep_uA: 0 }, signal: { domain: 'power', acdc: 'dc' }, io: { logic_level_V: 0, interfaces: ['usb'] }, outputType: '5V rail' },
  coin_cell: { id: 'bat1', name: 'Coin cell CR2032', role: 'source', voltage: { min: 2.0, typ: 3.0, max: 3.3 }, current: { active_mA: 0, peak_mA: 20, sleep_uA: 0 }, signal: { domain: 'power', acdc: 'dc' }, io: { logic_level_V: 0, interfaces: [] }, outputType: '3V rail', capacityMah: 220 },
  dc_barrel: { id: 'dc1', name: 'DC barrel 12V', role: 'source', voltage: { min: 11, typ: 12, max: 13 }, current: { active_mA: 0, peak_mA: 2000, sleep_uA: 0 }, signal: { domain: 'power', acdc: 'dc' }, io: { logic_level_V: 0, interfaces: [] }, outputType: '12V rail' },
};

// Component envelope templates. Numbers are TYPICAL placeholders. Verify against the datasheet.
export const COMPONENT_TEMPLATES = {
  mcu_3v3: { name: 'MCU 3.3 V', role: 'controller', voltage: { min: 3.0, typ: 3.3, max: 3.6 }, current: { active_mA: 240, peak_mA: 500, sleep_uA: 10 }, signal: { domain: 'mixed', acdc: 'dc' }, io: { logic_level_V: 3.3, interfaces: ['i2c', 'spi', 'uart', 'usb'] }, dutyCycle: 0.3, _verify: true },
  ldo_3v3: { name: 'LDO 3.3 V', role: 'regulator', voltage: { min: 3.3, typ: 3.3, max: 3.3 }, current: { active_mA: 0, peak_mA: 600, sleep_uA: 50 }, signal: { domain: 'power', acdc: 'dc' }, io: { logic_level_V: 0, interfaces: [] }, outputType: '3V3 rail', _verify: true },
  buck_5v: { name: 'Buck 5 V', role: 'regulator', voltage: { min: 5.0, typ: 5.0, max: 5.0 }, current: { active_mA: 0, peak_mA: 2000, sleep_uA: 20 }, signal: { domain: 'power', acdc: 'dc' }, io: { logic_level_V: 0, interfaces: [] }, outputType: '5V rail', _verify: true },
  i2c_sensor: { name: 'I2C sensor', role: 'sensor', voltage: { min: 1.8, typ: 3.3, max: 3.6 }, current: { active_mA: 1, peak_mA: 5, sleep_uA: 2 }, signal: { domain: 'mixed', acdc: 'dc' }, io: { logic_level_V: 3.3, interfaces: ['i2c'] }, _verify: true },
  i2s_amp: { name: 'I2S Class-D amp', role: 'actuator', voltage: { min: 2.7, typ: 5.0, max: 5.5 }, current: { active_mA: 700, peak_mA: 1500, sleep_uA: 5 }, signal: { domain: 'mixed', acdc: 'dc' }, io: { logic_level_V: 3.3, interfaces: ['i2s'] }, _verify: true },
  speaker: { name: 'Speaker 4 ohm', role: 'actuator', voltage: { min: 0, typ: 0, max: 0 }, current: { active_mA: 0, peak_mA: 0, sleep_uA: 0 }, signal: { domain: 'analog', acdc: 'ac' }, io: { logic_level_V: 0, interfaces: [] }, _verify: true },
  motor: { name: 'DC motor', role: 'actuator', voltage: { min: 3, typ: 5, max: 12 }, current: { active_mA: 300, peak_mA: 1200, sleep_uA: 0 }, signal: { domain: 'power', acdc: 'dc' }, io: { logic_level_V: 0, interfaces: [] }, inductive: true, _verify: true },
  led: { name: 'LED', role: 'actuator', led: true, vf: 2.0, ifMa: 10, voltage: { min: 1.8, typ: 2.0, max: 3.6 }, current: { active_mA: 10, peak_mA: 20, sleep_uA: 0 }, signal: { domain: 'analog', acdc: 'dc' }, io: { logic_level_V: 0, interfaces: [] }, _verify: true },
};
