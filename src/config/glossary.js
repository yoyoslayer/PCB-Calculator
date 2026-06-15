/**
 * PCB Creation - Glossary
 * Plain-language definitions, written for someone new to hardware.
 * Each entry has a key used by the inline Term component.
 */
export const GLOSSARY = [
  // ----- Power
  { key: 'regulator', term: 'Voltage regulator', cat: 'Power', def: 'A part that takes one voltage in and holds a steady, chosen voltage out for the rest of the board.' },
  { key: 'ldo', term: 'Linear regulator', cat: 'Power', def: 'A simple voltage regulator that burns off the extra voltage as heat. Cheap and quiet, but wasteful when the voltage drop is large. It is called a low dropout regulator, or LDO, when it works with only a small difference between input and output.' },
  { key: 'buck', term: 'Buck converter', cat: 'Power', def: 'A switching voltage regulator that steps a higher voltage down by rapidly turning it on and off. It wastes far less energy as heat than a linear regulator, so it suits large voltage drops or high current.' },
  { key: 'lipo', term: 'Lithium polymer battery', cat: 'Power', def: 'A rechargeable battery, often a single flat cell, that supplies about 3.0 to 4.2 volts. Light and energy dense, and common in portable devices. Often shortened to LiPo.' },
  { key: 'coincell', term: 'Coin cell', cat: 'Power', def: 'A small round non-rechargeable battery, such as a CR2032, that supplies about 3 volts. Good for very low power devices that must run a long time.' },
  { key: 'decoupling', term: 'Decoupling capacitor', cat: 'Power', def: 'A small capacitor placed right next to a chip power pin. It supplies quick bursts of current and smooths noise on the power line.' },
  { key: 'bulk', term: 'Bulk capacitor', cat: 'Power', def: 'A larger capacitor on a power rail that holds the voltage steady when the load suddenly draws more current.' },
  { key: 'duty', term: 'Duty cycle', cat: 'Power', def: 'The fraction of time a part is actively working rather than idle, written from 0 to 1. It is used to estimate the average current draw.' },
  { key: 'budget', term: 'Current budget', cat: 'Power', def: 'The total current the board needs, split into the average while working, the worst case peak, and the tiny draw while asleep.' },

  // ----- Signals
  { key: 'pullup', term: 'Pull-up resistor', cat: 'Signals', def: 'A resistor that gently ties a signal wire to the supply voltage, so the line sits high when nothing is actively pulling it low.' },
  { key: 'impedance', term: 'Impedance', cat: 'Signals', def: 'The opposition a fast signal feels as it travels down a trace. For fast signals the trace width and the distance to the nearest copper plane set this value, and it must be controlled or the signal reflects and distorts.' },
  { key: 'diffpair', term: 'Differential pair', cat: 'Signals', def: 'Two traces carrying the same fast signal in opposite directions, routed side by side and kept the same length. USB and Ethernet use them.' },
  { key: 'net', term: 'Net', cat: 'Signals', def: 'A single electrical connection. Every pin joined to the same net is wired together.' },
  { key: 'netlist', term: 'Netlist', cat: 'Signals', def: 'The full list of nets, telling you which pins connect to which.' },
  { key: 'netclass', term: 'Net class', cat: 'Signals', def: 'A named group of nets that share routing rules such as trace width, spacing, and via size.' },
  { key: 'flyback', term: 'Flyback diode', cat: 'Signals', def: 'A diode placed across a motor or coil that safely absorbs the voltage spike produced when the current is switched off.' },
  { key: 'i2c', term: 'I2C bus', cat: 'Signals', def: 'A simple two wire system that lets a chip talk to several sensors over shared data and clock lines. Each line needs a pull-up resistor.' },
  { key: 'usbpair', term: 'USB data pair', cat: 'Signals', def: 'The two wires in a Universal Serial Bus connection that carry data. They must be routed as a matched differential pair held near 90 ohms.' },

  // ----- Board and manufacturing
  { key: 'trace', term: 'Trace', cat: 'Board', def: 'A copper line on the board that carries a signal or power. Also called a track.' },
  { key: 'tracewidth', term: 'Trace width', cat: 'Board', def: 'How wide a copper line is. Wider lines carry more current and run cooler.' },
  { key: 'clearance', term: 'Clearance', cat: 'Board', def: 'The smallest gap the manufacturer can reliably leave between two separate pieces of copper.' },
  { key: 'via', term: 'Via', cat: 'Board', def: 'A small plated hole that carries a connection from one layer of the board to another.' },
  { key: 'annular', term: 'Annular ring', cat: 'Board', def: 'The ring of copper left around a via or hole. If it is too thin, the manufacturer may break through the edge.' },
  { key: 'viadrill', term: 'Minimum via drill', cat: 'Board', def: 'The smallest hole the manufacturer will drill for a via that connects layers. Going below this costs more or is not allowed.' },
  { key: 'minhole', term: 'Minimum hole', cat: 'Board', def: 'The smallest hole the manufacturer will drill at all, including holes for parts with legs. Going below it adds cost.' },
  { key: 'pour', term: 'Copper pour', cat: 'Board', def: 'A large filled area of copper, usually tied to ground, that fills the empty space on a layer and gives signals a clean return path.' },
  { key: 'stackup', term: 'Layer stackup', cat: 'Board', def: 'The order and thickness of the copper layers and the insulating material between them, from the top of the board to the bottom.' },
  { key: 'microstrip', term: 'Microstrip', cat: 'Board', def: 'A trace on an outer layer with a copper plane below it. Its width and the distance to that plane set its impedance.' },
  { key: 'silk', term: 'Silkscreen', cat: 'Board', def: 'The printed text and outlines on the board surface, used for labels and part markings.' },
  { key: 'footprint', term: 'Footprint', cat: 'Board', def: 'The pattern of copper pads and the outline that a specific physical part solders onto.' },
  { key: 'gerber', term: 'Gerber files', cat: 'Board', def: 'The standard set of files that tell a manufacturer how to make each layer of the board.' },
  { key: 'drc', term: 'Design rule check', cat: 'Board', def: 'An automatic check in your design tool that flags anything thinner, closer, or smaller than the manufacturer allows. Often shortened to DRC.' },

  // ----- Units
  { key: 'mil', term: 'mil', cat: 'Units', def: 'One thousandth of an inch, a common unit for trace widths. One mil is about 0.0254 millimeters.' },
  { key: 'copperweight', term: 'Copper weight', cat: 'Units', def: 'How thick a copper layer is, given in ounces. One ounce is about 35 micrometers. Thicker copper carries more current.' },
];

export const GLOSSARY_MAP = Object.fromEntries(GLOSSARY.map((g) => [g.key, g]));
