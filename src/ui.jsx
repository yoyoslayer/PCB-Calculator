import { useState } from 'react';
import { GLOSSARY_MAP } from './config/glossary.js';

export function Panel({ title, kicker, children, action }) {
  return (
    <section className="panel">
      {(title || action) && (
        <div className="panel__head">
          <div>
            {kicker && <div className="panel__kicker">{kicker}</div>}
            {title && <h2 className="panel__title">{title}</h2>}
          </div>
          {action}
        </div>
      )}
      <div className="panel__body">{children}</div>
    </section>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

export function NumberField({ value, onChange, step = 'any', min, suffix, placeholder }) {
  return (
    <span className="numwrap">
      <input
        className="input input--num"
        type="number"
        value={value ?? ''}
        step={step}
        min={min}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      />
      {suffix && <span className="numwrap__suffix">{suffix}</span>}
    </span>
  );
}

export function TextField({ value, onChange, placeholder }) {
  return (
    <input
      className="input"
      type="text"
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Select({ value, onChange, options, placeholder }) {
  return (
    <select className="input select" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function Button({ children, onClick, variant = 'default', type = 'button', disabled }) {
  return (
    <button className={`btn btn--${variant}`} type={type} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function Pill({ children, tone = 'default' }) {
  return <span className={`pill pill--${tone}`}>{children}</span>;
}

export function Stat({ label, value, unit, tone = 'default' }) {
  return (
    <div className={`stat stat--${tone}`}>
      <div className="stat__value">
        <span className="mono">{value}</span>
        {unit && <span className="stat__unit"> {unit}</span>}
      </div>
      <div className="stat__label">{label}</div>
    </div>
  );
}

export function Callout({ tone = 'info', title, children }) {
  return (
    <div className={`callout callout--${tone}`}>
      {title && <div className="callout__title">{title}</div>}
      <div className="callout__body">{children}</div>
    </div>
  );
}

// A small "where this came from" tag for traceability.
export function Cite({ children }) {
  return <span className="cite">{children}</span>;
}

// A toggleable disclosure for the calculator drawers.
export function Drawer({ label, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`drawer ${open ? 'is-open' : ''}`}>
      <button className="drawer__toggle" onClick={() => setOpen(!open)}>
        <span className="drawer__chev">{open ? '\u2212' : '+'}</span> {label}
      </button>
      {open && <div className="drawer__body">{children}</div>}
    </div>
  );
}

// Inline term with a glossary definition shown on hover or keyboard focus.
export function Term({ k, children }) {
  const entry = GLOSSARY_MAP[k];
  if (!entry) return <>{children}</>;
  return (
    <span className="term" tabIndex={0}>
      {children}
      <span className="term__pop" role="tooltip">
        <strong>{entry.term}</strong>
        <span>{entry.def}</span>
      </span>
    </span>
  );
}
