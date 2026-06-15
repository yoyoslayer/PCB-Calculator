# Parts data scripts

These scripts turn the open JLCPCB and LCSC parts dataset into the two committed
data files this app uses:

1. `src/config/catalog/*.js` the curated, verified parts catalog shown on the browse pages.
2. `public/data/lcsc-basic-preferred.jsonl` the bundled subset the in app search uses.

Nothing here runs in the app or in a build. The app only reads the two files above.

## Where the data comes from

The source is the maintained open dataset from the `yaqwsx/jlcparts` project. It is
published to that project's `gh-pages` branch as one compressed file per category,
plus one shared attribute lookup table. Every LCSC part number, manufacturer part
number, datasheet link, and LCSC link in this app traces back to that dataset.

We deliberately do not scrape LCSC directly. The dataset already aggregates the data,
and scraping in a loop gets the address blocked.

## Refreshing the data

1. Download the dataset. It is large, about 1.3 gigabytes, so it is kept out of git
   by the `data-raw/` rule in `.gitignore`.

   ```
   mkdir -p data-raw
   curl -L -o data-raw/jlcparts-gh-pages.tgz \
     https://codeload.github.com/yaqwsx/jlcparts/tar.gz/refs/heads/gh-pages
   ```

2. Unpack the attribute lookup table and the category files you need into a working
   folder, then point the two scripts at them. The scripts expect the unpacked tree
   under `/tmp/jlcparts-gh-pages/data` by default, which you can change at the top of
   each script. `decode.py` is the shared decoder.

3. Rebuild the bundled search subset. This walks every category, keeps the basic and
   preferred parts plus the most stocked parts in each category, and writes a roughly
   three megabyte file:

   ```
   python3 scripts/build-search-subset.py 16 80
   cp /tmp/lcsc-subset.jsonl public/data/lcsc-basic-preferred.jsonl
   ```

4. Rebuild the catalog. The catalog is hand curated: `scripts/data/catalog_raw.jsonl`
   holds the verified dataset records for the chosen parts, and the curation, the pros,
   the cons, and the typical use notes live inside `build-catalog.py`. To add a part,
   look up its record, add a line to `catalog_raw.jsonl`, add its curation entry, then:

   ```
   python3 scripts/build-catalog.py
   ```

## How stale can it be

The upstream dataset updates daily. The two files committed here are a snapshot taken
when the scripts were last run, so stock numbers, prices, and a few specifications can
drift. Treat stock and price as a hint, not a promise, and always open the LCSC link to
confirm a part before you order. The trace width, impedance, and pull-up formulas do not
depend on this data and never go stale.
