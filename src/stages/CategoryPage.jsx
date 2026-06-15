import { useMemo, useState } from 'react';
import { useDesign } from '../store.jsx';
import { CATALOG_BY_CATEGORY, CATEGORY_PAGES, catalogToComponent } from '../config/catalog/index.js';
import { Panel, Pill, Button, Callout } from '../ui.jsx';

export default function CategoryPage({ catKey }) {
  const { addPart, setActive } = useDesign();
  const meta = CATEGORY_PAGES.find((p) => p.key === catKey);
  const items = CATALOG_BY_CATEGORY[catKey] || [];
  const [added, setAdded] = useState(0);

  // Group by subtype so long lists stay readable.
  const groups = useMemo(() => {
    const m = new Map();
    for (const e of items) {
      const k = e.subtype || 'Other';
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(e);
    }
    return [...m.entries()];
  }, [items]);

  function addOne(entry) {
    addPart(catalogToComponent(entry));
    setAdded((n) => n + 1);
  }

  if (!meta) return <div className="main"><div className="empty">Unknown category.</div></div>;

  return (
    <div>
      <header className="stage__head">
        <div className="stage__eyebrow">Catalog &middot; verified parts</div>
        <h1 className="stage__title">{meta.title}</h1>
        <p className="stage__lead">{meta.blurb}</p>
      </header>

      {added > 0 && (
        <div className="addbar">
          <span>{added} part{added > 1 ? 's' : ''} added to your design.</span>
          <Button variant="primary" onClick={() => setActive('stage2')}>Open the Components stage</Button>
        </div>
      )}

      {groups.map(([sub, entries]) => (
        <Panel key={sub} title={sub} kicker={`${entries.length} part${entries.length > 1 ? 's' : ''}`}>
          <div className="cards">
            {entries.map((e) => <CatalogCard key={e.id} e={e} onAdd={() => addOne(e)} />)}
          </div>
        </Panel>
      ))}
      {items.length === 0 && <div className="empty">No parts in this category yet.</div>}
    </div>
  );
}

function CatalogCard({ e, onAdd }) {
  const iface = (e.interfaces || []).length ? e.interfaces.join(', ') : 'no digital bus';
  return (
    <div className="card">
      <div className="card__head">
        <div>
          <div className="card__name">{e.name}</div>
          <div className="card__mfr">{e.manufacturer}{e.mpn ? ` · ${e.mpn}` : ''}</div>
        </div>
        <div className="card__badges">
          {e.verified
            ? <Pill tone="mask">verified</Pill>
            : <Pill tone="warn">unverified</Pill>}
          {e.preferred && <Pill tone="copper">preferred</Pill>}
        </div>
      </div>

      <div className="card__id">
        {e.lcsc ? <span className="mono">{e.lcsc}</span> : <span className="mono">no LCSC part</span>}
        {e.package && <span className="card__pkg mono"> {e.package}</span>}
      </div>

      <dl className="kv">
        {Object.entries(e.specs || {}).map(([k, v]) => (
          <div className="kv__row" key={k}>
            <dt>{k}</dt>
            <dd className="mono">{String(v)}</dd>
          </div>
        ))}
      </dl>

      <div className="card__procon">
        <ul className="proslist">
          {(e.pros || []).map((p, i) => <li key={i}>{p}</li>)}
        </ul>
        <ul className="conslist">
          {(e.cons || []).map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      </div>

      <div className="card__use">{e.use}</div>
      {e.note && <Callout tone="warn">{e.note}</Callout>}

      <div className="card__foot">
        <div className="card__links">
          {e.lcscUrl
            ? <a className="btn btn--ghost btn--small" href={e.lcscUrl} target="_blank" rel="noreferrer">LCSC page</a>
            : <span className="cite">not stocked at LCSC</span>}
          {e.datasheet && <a className="btn btn--ghost btn--small" href={e.datasheet} target="_blank" rel="noreferrer">Datasheet</a>}
        </div>
        <Button variant="copper" onClick={onAdd}>Add to design</Button>
      </div>

      <div className="card__prefill cite">
        Adds as a {e.role}, {e.voltage.typ} volts, {e.current.active_mA} milliamps typical, {iface}.
      </div>
    </div>
  );
}
