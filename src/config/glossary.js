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
  { key: 'spi', term: 'SPI bus', cat: 'Signals', def: 'A fast four wire system for a chip to talk to one device at a time, using separate data out, data in, clock, and select lines.' },
  { key: 'uart', term: 'Serial port, also called UART', cat: 'Signals', def: 'A simple two wire link, one wire each way, for sending bytes between two chips. Common for modules and debug output.' },
  { key: 'onewire', term: 'One wire bus', cat: 'Signals', def: 'A scheme where several sensors share a single data wire, each with its own address. The DS18B20 temperature sensor uses it.' },
  { key: 'pwm', term: 'Pulse width signal', cat: 'Signals', def: 'A square wave switched on and off quickly, where the share of on time sets an average level. It controls motor speed, light brightness, and servo angle.' },
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

  // ----- Parts
  { key: 'microcontroller', term: 'Microcontroller', cat: 'Parts', def: 'A small computer on a single chip that runs your program and controls the rest of the board. Often shortened to MCU.' },
  { key: 'hbridge', term: 'H bridge', cat: 'Parts', def: 'A circuit of four switches that can drive a motor forwards or backwards. Motor driver chips contain one or two of these.' },
  { key: 'driver', term: 'Driver', cat: 'Parts', def: 'A part that takes a weak control signal from a chip and switches the much larger current a motor, coil, or light needs.' },
  { key: 'phototransistor', term: 'Phototransistor', cat: 'Parts', def: 'A light sensitive part that passes more current as the light on it grows brighter. Read it with an analog input and a resistor.' },
  { key: 'thermistor', term: 'Thermistor', cat: 'Parts', def: 'A resistor whose value changes with temperature. Cheap, but it needs a companion resistor and a small calculation to read a temperature.' },
  { key: 'accelerometer', term: 'Accelerometer', cat: 'Parts', def: 'A sensor that measures acceleration, including the steady pull of gravity, so it can tell tilt and movement.' },
  { key: 'gyroscope', term: 'Gyroscope', cat: 'Parts', def: 'A sensor that measures how fast something is turning. Paired with an accelerometer it tracks orientation.' },
  { key: 'imu', term: 'Motion sensor, also called an IMU', cat: 'Parts', def: 'One chip that combines an accelerometer and a gyroscope, and sometimes a compass, to track motion and orientation.' },
  { key: 'hall', term: 'Hall sensor', cat: 'Parts', def: 'A sensor that detects a magnet. It can count wheel turns, find an end stop, or read a shaft angle with no contact.' },
  { key: 'oled', term: 'OLED screen', cat: 'Parts', def: 'A small display where each pixel makes its own light, so it needs no backlight and shows deep blacks. Common ones use the two wire I2C bus.' },
  { key: 'stepper', term: 'Stepper motor', cat: 'Parts', def: 'A motor that turns in small fixed steps and holds its position, good for precise movement without a separate position sensor.' },
  { key: 'servo', term: 'Servo motor', cat: 'Parts', def: 'A small geared motor with built in control that moves to a set angle from a single timing signal. It has its own driver inside.' },
  { key: 'brushless', term: 'Brushless motor', cat: 'Parts', def: 'An efficient long lived motor with no wearing brushes. It needs a special three phase driver to run.' },
  { key: 'capacitive', term: 'Capacitive sensing', cat: 'Parts', def: 'Sensing touch or a nearby liquid by measuring tiny changes in stored charge on a copper pad. Works through a non metal wall.' },
  { key: 'protection', term: 'Battery protection circuit', cat: 'Parts', def: 'A small circuit that guards a lithium cell against over charge, over discharge, and short circuit, so it stays safe.' },

  // ----- Units
  { key: 'mil', term: 'mil', cat: 'Units', def: 'One thousandth of an inch, a common unit for trace widths. One mil is about 0.0254 millimeters.' },
  { key: 'lux', term: 'lux', cat: 'Units', def: 'The unit of how bright light is on a surface. A dim room is a few hundred lux, full daylight is many thousands.' },
  { key: 'esr', term: 'Low resistance capacitor', cat: 'Units', def: 'A capacitor with very little internal resistance, often asked for on a regulator output so it stays stable. The measure is called equivalent series resistance.' },
  { key: 'copperweight', term: 'Copper weight', cat: 'Units', def: 'How thick a copper layer is, given in ounces. One ounce is about 35 micrometers. Thicker copper carries more current.' },
];

export const GLOSSARY_MAP = Object.fromEntries(GLOSSARY.map((g) => [g.key, g]));
