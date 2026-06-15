# PCB Creation

A guided design copilot that walks you from a project idea to fab-ready Gerber and STEP files. It does not do the CAD work. It advises: it recommends parts, ratings, constraints, layouts, and routing rules, and you execute each step in your own EDA tool such as KiCad.

## Setup

You need Node.js version 18 or newer. Check with `node -v`. If you do not have it, install the LTS build from nodejs.org.

1. Open a terminal in this `pcb-creation` folder.
2. Install dependencies:
   ```
   npm install
   ```
3. Start the dev server:
   ```
   npm run dev
   ```
4. Your browser opens at http://localhost:5173. If it does not, open that address yourself.

To make a production build, run `npm run build`, then `npm run preview` to serve it locally.

## The six stages

1. Requirements. Project type, power source, environment, size, layer target. Seeds everything downstream.
2. Components. Set each part's current and voltage. A deterministic rules engine checks the design and appends supporting parts, regulators, caps, pull-ups, drivers, until the bill of materials holds together. Calculators for trace width, LDO vs buck, voltage divider, LED resistor, I2C pull-up, and bulk cap.
3. Pin mapping. Tag each pin's role and get a netlist telling you which pins to wire together.
4. Schematic organization. Groups parts by function and recommends a sheet structure.
5. PCB setup. Design rules, net classes sized from the current budget, a layer stackup, and an impedance check, all from the JLCPCB profile. Every value is editable.
6. Layout and export. Layer assignment, placement order, routing priority, and a DFM plus Gerber/STEP export checklist for KiCad.

Your whole design is held in memory and can be saved with the Export button in the sidebar, which downloads a JSON file. Import it later to pick up where you left off. There is no backend and nothing is stored in your browser, so the JSON file is your save file.

## Engineering basis

All math is deterministic and traceable. No AI is used for any calculation.

- Trace width: IPC-2221, the conservative standard. It gives wider, safer traces than IPC-2152.
- Characteristic impedance: IPC-2141A closed-form microstrip and stripline. These are first-pass estimates. Verify against your fab's stackup or a field solver before ordering.
- I2C pull-ups: the NXP I2C-bus rise-time and drive-strength limits.
- Manufacturer rules: JLCPCB capabilities verified in late 2025. These change, so always confirm against the live capabilities page before you order.

## Editing the data

Manufacturer profiles, IPC defaults, project archetypes, and component templates all live in `src/config/data.js`. Edit that file to change recommendations without touching component code. The calculators are in `src/engine/calculators.js` and the rules engine is in `src/engine/rules.js`.

## Adding a backend later

v1 runs entirely in the browser because every calculation is local math and the only persistence is the JSON file. If you later want server-side project storage, accounts, or a shared parts library, the natural seam is the store in `src/store.jsx`. Its `exportJSON` and `importJSON` would become API calls, and the rest of the app would not need to change.
