import { useDesign, STAGES } from '../store.jsx';
import { Button } from '../ui.jsx';

export default function StageShell({ stageKey, title, lead, children }) {
  const { state, setActive } = useDesign();
  const idx = STAGES.findIndex((s) => s.key === stageKey);
  const stage = STAGES[idx];
  const prev = STAGES[idx - 1];
  const next = STAGES[idx + 1];
  const stale = state.status[stageKey].stale;

  return (
    <div>
      <header className="stage__head">
        <div className="stage__eyebrow">Layer {stage.n} of {STAGES.length} &middot; {stage.short}</div>
        <h1 className="stage__title">{title}</h1>
        <p className="stage__lead">{lead}</p>
      </header>

      {stale && (
        <div className="stale-banner">
          <span aria-hidden>&#9888;</span>
          <span>An earlier stage changed after you finished this one. Re-check the recommendations below; they may be based on old inputs.</span>
        </div>
      )}

      {children}

      <div className="foot-nav">
        {prev ? <Button variant="ghost" onClick={() => setActive(prev.key)}>&larr; {prev.title}</Button> : <span />}
        {next ? <Button onClick={() => setActive(next.key)}>{next.title} &rarr;</Button> : <span />}
      </div>
    </div>
  );
}
