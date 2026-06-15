import { useRef } from 'react';
import { useDesign, STAGES } from './store.jsx';
import { Button } from './ui.jsx';
import Stage1 from './stages/Stage1.jsx';
import Stage2 from './stages/Stage2.jsx';
import Stage3 from './stages/Stage3.jsx';
import Stage4 from './stages/Stage4.jsx';
import Stage5 from './stages/Stage5.jsx';
import Stage6 from './stages/Stage6.jsx';
import Glossary from './stages/Glossary.jsx';
import CategoryPage from './stages/CategoryPage.jsx';
import { CATEGORY_PAGES } from './config/catalog/index.js';

const STAGE_COMPONENTS = {
  stage1: Stage1, stage2: Stage2, stage3: Stage3,
  stage4: Stage4, stage5: Stage5, stage6: Stage6,
};

export default function App() {
  const { state, setActive, rename, exportJSON, importJSON, exportReport, reset } = useDesign();
  const fileRef = useRef(null);
  const lastStage = useRef('stage1');
  if (state.active.startsWith('stage')) lastStage.current = state.active;

  const isCatalog = state.active.startsWith('catalog:');
  const Active = STAGE_COMPONENTS[state.active];

  let view;
  if (state.active === 'glossary') view = <Glossary onClose={() => setActive(lastStage.current)} />;
  else if (isCatalog) view = <CategoryPage catKey={state.active.slice('catalog:'.length)} />;
  else if (Active) view = <Active />;
  else view = <Stage1 />;

  return (
    <div className="app">
      <nav className="rail">
        <div className="brand">
          <span className="brand__mark">PCB</span>
          <div>
            <div className="brand__name">Creation</div>
            <div className="brand__sub">idea &rarr; gerber</div>
          </div>
        </div>

        <div className="stack">
          <div className="stack__caption">Layer stack</div>
          {STAGES.map((s) => {
            const st = state.status[s.key];
            const isActive = state.active === s.key;
            return (
              <button
                key={s.key}
                className={`layer ${isActive ? 'is-active' : ''} ${st.complete ? 'is-complete' : ''}`}
                onClick={() => setActive(s.key)}
              >
                <div className="layer__n">L{s.n}</div>
                <div className="layer__title">{s.title}</div>
                <div className="layer__flags">
                  {st.complete && <span className="flag flag--done">done</span>}
                  {st.stale && <span className="flag flag--stale">stale</span>}
                </div>
              </button>
            );
          })}
        </div>

        <div className="catnav">
          <div className="stack__caption">Browse parts</div>
          {CATEGORY_PAGES.map((p) => (
            <button
              key={p.key}
              className={`catlink ${state.active === `catalog:${p.key}` ? 'is-active' : ''}`}
              onClick={() => setActive(`catalog:${p.key}`)}
            >
              {p.nav}
            </button>
          ))}
        </div>

        <div className="rail__spacer" />

        <div className="rail__io">
          <input
            className="rail__name"
            value={state.meta.name}
            onChange={(e) => rename(e.target.value)}
            aria-label="Project name"
          />
          <Button variant={state.active === 'glossary' ? 'primary' : 'ghost'} onClick={() => setActive('glossary')}>Glossary</Button>
          <div className="rail__row">
            <Button variant="ghost" onClick={exportJSON}>Save</Button>
            <Button variant="ghost" onClick={() => fileRef.current?.click()}>Open</Button>
          </div>
          <Button variant="copper" onClick={exportReport}>Download report</Button>
          <Button variant="danger" onClick={() => { if (confirm('Clear all stages and start over?')) reset(); }}>
            Reset project
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files[0]) importJSON(e.target.files[0]); e.target.value = ''; }}
          />
        </div>
      </nav>

      <main className="main">{view}</main>
    </div>
  );
}
