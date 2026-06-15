import { useEffect, useMemo, useState } from 'react';
import { useDesign } from '../store.jsx';
import { ensureLoaded, searchParts, recordLinks } from '../engine/partsdb.js';
import { Panel, Field, TextField, Button, Pill, Callout } from '../ui.jsx';

export default function SearchPage() {
  const { addPart } = useDesign();
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [note, setNote] = useState('Starting up');
  const [count, setCount] = useState(0);
  const [query, setQuery] = useState('');
  const [onlyPreferred, setOnlyPreferred] = useState(false);
  const [added, setAdded] = useState(0);

  useEffect(() => {
    let alive = true;
    ensureLoaded((m) => alive && setNote(m))
      .then((r) => { if (alive) { setCount(r.count); setStatus('ready'); } })
      .catch((e) => { if (alive) { setNote(e.message); setStatus('error'); } });
    return () => { alive = false; };
  }, []);

  const results = useMemo(() => {
    if (status !== 'ready') return [];
    return searchParts(query, { onlyPreferred, limit: 100 });
  }, [query, onlyPreferred, status]);

  function addRecord(r) {
    const links = recordLinks(r);
    addPart({
      name: r.m || r.c,
      role: 'passive',
      voltage: { min: 0, typ: 0, max: 0 },
      current: { active_mA: 0, peak_mA: 0, sleep_uA: 0 },
      signal: { domain: 'analog', acdc: 'dc' },
      io: { logic_level_V: 0, interfaces: [] },
      lcsc: r.c,
      note: links.category,
      _verify: true,
    });
    setAdded((n) => n + 1);
  }

  return (
    <div>
      <header className="stage__head">
        <div className="stage__eyebrow">Tier two &middot; search inside this site</div>
        <h1 className="stage__title">Search the parts dataset</h1>
        <p className="stage__lead">
          A subset of the JLCPCB and LCSC parts is bundled into this app and stored in your browser, so you can search without leaving the site. Every result links to its LCSC page and, where the dataset has one, its datasheet. For the full catalogue of millions of parts, use the tier one search on the Components stage, which opens LCSC.
        </p>
      </header>

      {status === 'loading' && <Callout tone="info" title="Loading the parts database">{note}. The first load fetches about 3 megabytes, then it is kept in your browser.</Callout>}
      {status === 'error' && <Callout tone="danger" title="Could not load the parts database">{note}</Callout>}

      {status === 'ready' && (
        <>
          {added > 0 && (
            <div className="addbar">
              <span>{added} part{added > 1 ? 's' : ''} added to your design. Set its voltage and current on the Components stage.</span>
            </div>
          )}

          <Panel title="Search" kicker={`${count.toLocaleString()} parts ready in your browser`}>
            <div className="grid grid--2">
              <Field label="Search by part number, name, maker, or description" hint="For example: BME280, or 3.3 volt regulator, or USB connector.">
                <TextField value={query} onChange={setQuery} placeholder="Type to search" />
              </Field>
              <Field label="Filter" hint="Basic and preferred parts cost less to assemble at the fab.">
                <label className="checkrow">
                  <input type="checkbox" checked={onlyPreferred} onChange={(e) => setOnlyPreferred(e.target.checked)} />
                  <span>Show only basic and preferred parts</span>
                </label>
              </Field>
            </div>
          </Panel>

          <Panel title="Results" kicker={query || onlyPreferred ? `${results.length}${results.length === 100 ? ' or more' : ''} matches, best stocked first` : 'Top stocked parts. Type above to narrow.'}>
            {results.length === 0 && <div className="empty">No parts match that search.</div>}
            {results.length > 0 && (
              <div className="tbl-wrap">
                <table className="tbl tbl--search">
                  <thead>
                    <tr>
                      <th>LCSC</th><th>Part</th><th>Maker</th><th>Description</th><th>Stock</th><th>Tier</th><th>Links</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => {
                      const l = recordLinks(r);
                      return (
                        <tr key={r.c}>
                          <td className="mono"><a href={l.lcscUrl} target="_blank" rel="noreferrer">{r.c}</a></td>
                          <td>{r.m}{r.pkg ? <div className="cite">{r.pkg}</div> : null}</td>
                          <td className="item__meta">{r.f || '-'}</td>
                          <td className="search__desc">{r.d}</td>
                          <td className="mono">{(r.s || 0).toLocaleString()}</td>
                          <td>{r.b ? <Pill tone={r.b === 'B' ? 'mask' : 'copper'}>{r.b === 'B' ? 'basic' : 'preferred'}</Pill> : <span className="cite">extended</span>}</td>
                          <td>
                            <div className="card__links">
                              <a className="btn btn--ghost btn--small" href={l.lcscUrl} target="_blank" rel="noreferrer">LCSC</a>
                              {l.ds && <a className="btn btn--ghost btn--small" href={l.ds} target="_blank" rel="noreferrer">Data</a>}
                            </div>
                          </td>
                          <td><Button variant="ghost" onClick={() => addRecord(r)}>Add</Button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Callout tone="info" title="About this data">
            This bundled subset holds the basic and preferred parts plus the best stocked parts in each category, kept to about 3 megabytes so search stays fast. It is a snapshot, so stock, price, and a few specifications can drift. Always open the LCSC page to confirm a part before ordering. To refresh the snapshot, see the notes in the scripts folder of the project. The trace width, impedance, and pull-up formulas do not use this data and never go stale.
          </Callout>
        </>
      )}
    </div>
  );
}
