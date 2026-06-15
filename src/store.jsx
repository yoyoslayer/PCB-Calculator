import { createContext, useContext, useReducer, useCallback } from 'react';
import { buildReport } from './report.js';

export const STAGES = [
  { key: 'stage1', n: 1, title: 'Requirements', short: 'Idea' },
  { key: 'stage2', n: 2, title: 'Components', short: 'Parts' },
  { key: 'stage3', n: 3, title: 'Pin Mapping', short: 'Nets' },
  { key: 'stage4', n: 4, title: 'Schematic', short: 'Sheets' },
  { key: 'stage5', n: 5, title: 'PCB Setup', short: 'Rules' },
  { key: 'stage6', n: 6, title: 'Layout & Export', short: 'Layout' },
];

const initialState = {
  meta: { name: 'Untitled board', created: new Date().toISOString() },
  active: 'stage1',
  status: Object.fromEntries(STAGES.map((s) => [s.key, { complete: false, stale: false }])),
  data: {
    stage1: null,
    stage2: null,
    stage3: null,
    stage4: null,
    stage5: null,
    stage6: null,
  },
};

function indexOfKey(key) {
  return STAGES.findIndex((s) => s.key === key);
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_ACTIVE':
      return { ...state, active: action.key };

    case 'SET_DATA': {
      const { key, data } = action;
      const idx = indexOfKey(key);
      // Mark this stage complete; mark every downstream completed stage stale.
      const status = { ...state.status, [key]: { complete: true, stale: false } };
      STAGES.forEach((s, i) => {
        if (i > idx && status[s.key].complete) {
          status[s.key] = { ...status[s.key], stale: true };
        }
      });
      return { ...state, status, data: { ...state.data, [key]: data } };
    }

    case 'RENAME':
      return { ...state, meta: { ...state.meta, name: action.name } };

    case 'IMPORT':
      return { ...action.state, active: action.state.active || 'stage1' };

    case 'RESET':
      return { ...initialState, meta: { name: 'Untitled board', created: new Date().toISOString() } };

    default:
      return state;
  }
}

const DesignContext = createContext(null);

export function DesignProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setData = useCallback((key, data) => dispatch({ type: 'SET_DATA', key, data }), []);
  const setActive = useCallback((key) => dispatch({ type: 'SET_ACTIVE', key }), []);
  const rename = useCallback((name) => dispatch({ type: 'RENAME', name }), []);
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  const exportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safe = (state.meta.name || 'pcb-creation').replace(/[^a-z0-9-_]+/gi, '_');
    a.href = url;
    a.download = `${safe}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state]);

  const importJSON = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed.data || !parsed.status) throw new Error('Not a PCB Creation file.');
        dispatch({ type: 'IMPORT', state: parsed });
      } catch (e) {
        alert(`Could not import: ${e.message}`);
      }
    };
    reader.readAsText(file);
  }, []);

  const exportReport = useCallback(() => {
    const md = buildReport(state);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safe = (state.meta.name || 'pcb-creation').replace(/[^a-z0-9-_]+/gi, '_');
    a.href = url;
    a.download = `${safe}-recommendations.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state]);

  const value = { state, setData, setActive, rename, reset, exportJSON, importJSON, exportReport };
  return <DesignContext.Provider value={value}>{children}</DesignContext.Provider>;
}

export function useDesign() {
  const ctx = useContext(DesignContext);
  if (!ctx) throw new Error('useDesign must be used inside DesignProvider');
  return ctx;
}
