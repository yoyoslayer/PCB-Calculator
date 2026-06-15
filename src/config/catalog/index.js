/**
 * PCB Creation catalog index. Aggregates the per category files and exposes
 * helpers used by the browse pages and the rest of the app.
 */
import { microcontrollers } from './microcontrollers.js';
import { batteries } from './batteries.js';
import { screens } from './screens.js';
import { motors } from './motors.js';
import { sensors } from './sensors.js';

export const CATALOG_BY_CATEGORY = { microcontroller: microcontrollers, battery: batteries, screen: screens, motor: motors, sensor: sensors };
export const CATALOG = [...microcontrollers, ...batteries, ...screens, ...motors, ...sensors];
export const CATALOG_INDEX = Object.fromEntries(CATALOG.map((e) => [e.id, e]));
export const CATALOG_BY_LCSC = Object.fromEntries(CATALOG.filter((e) => e.lcsc).map((e) => [e.lcsc, e]));

// Page metadata for the five browse pages. Plain language, no abbreviations left bare.
export const CATEGORY_PAGES = [
  { key: 'microcontroller', nav: 'Chips', title: 'Microcontrollers', blurb: 'The brain of the board. Pick one to set your logic voltage and the buses you can use.' },
  { key: 'sensor', nav: 'Sensors', title: 'Sensors', blurb: 'Parts that measure the world: light, temperature, humidity, motion, and more. Confirmed LCSC parts where they exist.' },
  { key: 'screen', nav: 'Screens', title: 'Screens', blurb: 'Small displays for status and menus. These are self lit OLED modules on the two wire I2C bus.' },
  { key: 'motor', nav: 'Motors', title: 'Motors and drivers', blurb: 'Things that move, and the driver chips that switch them. Each motor names a real driver to use with it.' },
  { key: 'battery', nav: 'Batteries', title: 'Batteries', blurb: 'Power sources by chemistry and size, each paired with the real LCSC holder or connector you solder down.' },
];

// Turn a catalog entry into a component block for stage 2.
export function catalogToComponent(entry) {
  const isDigital = entry.role === 'controller' || entry.role === 'sensor';
  return {
    name: entry.name,
    role: entry.role,
    voltage: { ...entry.voltage },
    current: { ...entry.current },
    signal: { ...entry.signal },
    io: { logic_level_V: isDigital ? entry.voltage.typ : 0, interfaces: [...(entry.interfaces || [])] },
    lcsc: entry.lcsc || '',
    catalogId: entry.id,
    ...(entry.inductive ? { inductive: true } : {}),
    ...(entry.capacityMah ? { capacityMah: entry.capacityMah } : {}),
    ...(entry.driverLcsc ? { driverLcsc: entry.driverLcsc } : {}),
    ...(entry.verified ? {} : { _verify: true }),
  };
}
