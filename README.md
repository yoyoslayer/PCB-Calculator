# PCB Creation

A guided design copilot that walks you from a project idea to fab-ready Gerber and STEP files. It does not do the CAD work. It advises: it recommends parts, ratings, constraints, layouts, and routing rules, and you execute each step in your own EDA tool such as KiCad.

## Setup

You need Node.js version 18 or newer. Check with `node -v`. If you do not have it, install the LTS build from nodejs.org.

1. Open a terminal in this folder.
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
2. Components. Set each part's current and voltage. The moment you do, each part shows its own recommendations worked out automatically from its properties, every one citing the formula it came from. A deterministic rules engine also checks the whole design and appends supporting parts until the bill of materials holds together. Manual calculators are kept as an advanced section.
3. Pin mapping. Tag each pin's role and get a netlist telling you which pins to wire together.
4. Schematic organization. Groups parts by function and recommends a sheet structure.
5. PCB setup. Design rules, net classes sized from the current budget, a layer stackup, and an impedance check, all from the JLCPCB profile. Every value is editable.
6. Layout and export. Layer assignment, placement order, routing priority, and a checklist for clean Gerber and STEP export from KiCad.

Your whole design is held in memory and can be saved with the Save button in the sidebar, which downloads a JSON file. Open it later to pick up where you left off. There is no backend, so the JSON file is your save file.

## Automatic per-part recommendations

On the Components stage, every part now derives and shows its own plan from its entered voltage and current, with no drawers to open:

- A regulator shows the linear versus buck choice from its input, output, and downstream current, the recommended input and output capacitors, and the trace width for its output rail.
- A controller or sensor shows its decoupling plan, which is one 100 nanofarad capacitor per power pin plus a bulk capacitor per rail.
- Any I2C device shows the pull-up resistor value for the bus, sized once per bus to the NXP limits.
- A motor or any inductive part shows the flyback diode, a matched real driver chip, and the trace width for its current.
- An LED shows its series resistor.
- Every part shows the power and ground trace width from its own current, using IPC-2221.

Each recommendation prints the rule or formula it came from. The manual calculators are still there, under Manual calculators, marked advanced.

## Browse parts catalog

Five browse pages in the sidebar hold a curated catalog of real, specific parts: Microcontrollers, Sensors, Screens, Motors, and Batteries. Each part lists its key specifications, a short pros and cons, its package, and links to its LCSC page and datasheet. Selecting Add to design drops the part into your bill of materials, prefilled with its real voltage, current, interface, and LCSC number, so it flows into the rest of the stages.

Every catalog entry that has a confirmed LCSC part is marked verified and carries its real LCSC number, manufacturer part number, datasheet link, and LCSC link from the dataset. A few entries cover a category that LCSC does not stock as a single part, such as turbidity sensors and bare motors. Those are clearly marked unverified and carry no invented part number. Battery entries pair a standard cell chemistry with the real LCSC holder or connector you solder to the board.

## In-app parts search

The Search all parts page is a second search tier. Tier one, on the Components stage, opens a full LCSC search in a new tab. Tier two bundles a parts subset into the app, stores it in your browser using IndexedDB, and lets you search and filter without leaving the site. Results link to the LCSC page and the datasheet, and can be parked in your design.

The bundled file `public/data/lcsc-basic-preferred.jsonl` is about 3 megabytes. It holds the JLCPCB basic and preferred parts plus the best stocked parts in each category, so it loads and searches fast in the browser. The full multi gigabyte database is not committed.

## Where the parts data comes from

Every LCSC number, manufacturer part number, datasheet link, and LCSC link traces to the maintained open dataset from the `yaqwsx/jlcparts` project. None of it is invented. Where a specification could not be confirmed from the dataset or a datasheet, the field is marked unverified rather than guessed. The dataset is not scraped from LCSC in a loop, because that gets the address blocked.

The data is a snapshot, so stock, price, and a few specifications can drift. Always open the LCSC link to confirm a part before ordering. The trace width, impedance, and pull-up formulas do not use this data and never go stale.

To refresh the snapshot, see `scripts/README.md`. The scripts download the dataset, rebuild the bundled search subset, and rebuild the catalog. The large raw download is kept out of git by the `data-raw/` rule in `.gitignore`.

## Engineering basis

All math is deterministic and traceable. No AI is used for any calculation, and there is no backend or API key.

- Trace width: IPC-2221, the conservative standard. It gives wider, safer traces than IPC-2152.
- Characteristic impedance: IPC-2141A closed-form microstrip and stripline. These are first-pass estimates. Verify against your fab's stackup or a field solver before ordering.
- I2C pull-ups: the NXP I2C-bus rise-time and drive-strength limits.
- Manufacturer rules: JLCPCB capabilities verified in late 2025. These change, so always confirm against the live capabilities page before you order.

## Editing the data

Manufacturer profiles, IPC defaults, project archetypes, and component templates live in `src/config/data.js`. The catalog lives in `src/config/catalog`, one file per category. The calculators are in `src/engine/calculators.js`, the rules engine and the per-part advice are in `src/engine/rules.js`, and the in-app search backend is in `src/engine/partsdb.js`.

## A note on the branch

This work is on the branch `v2-catalog-and-calculators`, as the task required. That is a deliberate choice over the session's default working branch, noted here and in the first commit so the difference is not a surprise.

## Adding a backend later

This app runs entirely in the browser because every calculation is local math and the only persistence is the JSON file and the browser's copy of the search subset. If you later want server-side project storage, accounts, or a shared parts library, the natural seam is the store in `src/store.jsx`. Its `exportJSON` and `importJSON` would become API calls, and the rest of the app would not need to change.
