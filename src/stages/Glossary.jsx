import { useState, useMemo } from 'react';
import { GLOSSARY } from '../config/glossary.js';
import { Button } from '../ui.jsx';

const CATS = ['Power', 'Signals', 'Parts', 'Board', 'Units'];
const CAT_LABEL = { Power: 'Power', Signals: 'Signals and connections', Parts: 'Parts and sensors', Board: 'Board and manufacturing', Units: 'Units' };

export default function Glossary({ onClose }) {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return GLOSSARY;
    return GLOSSARY.filter((g) => g.term.toLowerCase().includes(needle) || g.def.toLowerCase().includes(needle));
  }, [q]);

  return (
    <div>
      <header className="stage__head">
        <div className="stage__eyebrow">Reference</div>
        <h1 className="stage__title">Glossary</h1>
        <p className="stage__lead">Plain explanations of the terms and rules this tool uses. Search, or browse by group.</p>
      </header>

      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <input className="input" placeholder="Search terms" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant="ghost" onClick={onClose}>Back to design</Button>
      </div>

      {CATS.map((cat) => {
        const items = filtered.filter((g) => g.cat === cat);
        if (!items.length) return null;
        return (
          <section className="panel" key={cat}>
            <div className="panel__head"><h2 className="panel__title">{CAT_LABEL[cat]}</h2></div>
            <div className="panel__body">
              <dl className="gloss">
                {items.map((g) => (
                  <div className="gloss__row" key={g.key}>
                    <dt className="gloss__term">{g.term}</dt>
                    <dd className="gloss__def">{g.def}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        );
      })}
      {filtered.length === 0 && <div className="empty">No terms match that search.</div>}
    </div>
  );
}
