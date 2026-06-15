/**
 * PCB Creation - Tier 2 parts search backend.
 *
 * Loads the bundled basic and preferred parts subset once, stores it in the
 * browser's IndexedDB so later visits do not re-download it, and queries it
 * locally. No backend, no network beyond fetching the one bundled file.
 *
 * The file is a JSON Lines document. The first line is a small metadata header
 * (category list and the link prefixes that were stripped to save space). Every
 * later line is one compact part record: c is the LCSC number, m the
 * manufacturer part number, f the manufacturer, d the description, g the
 * category index, ds the datasheet (a JLCPCB file id, or a full url), u the LCSC
 * url slug, s the stock, b the basic or preferred flag, pkg the package.
 */
const DB_NAME = 'pcb-creation-parts';
const STORE = 'parts';
const META_STORE = 'meta';
const DATA_URL = (import.meta.env.BASE_URL || '/') + 'data/lcsc-basic-preferred.jsonl';

let cache = null;   // in-memory array of records
let meta = null;    // header metadata
let loading = null; // in-flight promise

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no indexeddb')); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'c' });
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGetAll(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function idbGetMeta(db) {
  return new Promise((resolve) => {
    const tx = db.transaction(META_STORE, 'readonly');
    const req = tx.objectStore(META_STORE).get('header');
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

function idbPutAll(db, records, header) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE, META_STORE], 'readwrite');
    const store = tx.objectStore(STORE);
    for (const r of records) store.put(r);
    tx.objectStore(META_STORE).put(header, 'header');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function fetchSubset(onProgress) {
  onProgress && onProgress('Downloading the parts subset');
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`Could not load the parts file (${res.status}).`);
  const text = await res.text();
  const lines = text.split('\n').filter(Boolean);
  const header = JSON.parse(lines[0])._meta;
  const records = new Array(lines.length - 1);
  for (let i = 1; i < lines.length; i++) records[i - 1] = JSON.parse(lines[i]);
  return { header, records };
}

// Make sure the dataset is loaded into memory, using IndexedDB as a cache.
export function ensureLoaded(onProgress) {
  if (cache) return Promise.resolve({ count: cache.length, meta });
  if (loading) return loading;
  loading = (async () => {
    let db = null;
    try { db = await openDb(); } catch { db = null; }

    if (db) {
      try {
        const [recs, hdr] = await Promise.all([idbGetAll(db), idbGetMeta(db)]);
        if (recs.length && hdr) { cache = recs; meta = hdr; return { count: cache.length, meta, source: 'cache' }; }
      } catch { /* fall through to fetch */ }
    }

    const { header, records } = await fetchSubset(onProgress);
    cache = records; meta = header;
    if (db) {
      try { onProgress && onProgress('Saving to your browser'); await idbPutAll(db, records, header); } catch { /* not fatal */ }
    }
    return { count: cache.length, meta, source: 'network' };
  })();
  return loading;
}

export function getMeta() { return meta; }

// Reconstruct the LCSC and datasheet links for a record.
export function recordLinks(r) {
  const lcscUrl = r.u
    ? (meta.urlPrefix + r.u + meta.urlSuffix)
    : `https://www.lcsc.com/search?q=${encodeURIComponent(r.c)}`;
  let ds = null;
  if (r.ds) ds = /^\d+$/.test(r.ds) ? (meta.dsPrefix + r.ds) : r.ds;
  const category = meta.cats[r.g] || '';
  return { lcscUrl, ds, category };
}

// Local search across the cached records. Every term must match somewhere.
export function searchParts(query, opts = {}) {
  if (!cache) return [];
  const { onlyPreferred = false, limit = 100 } = opts;
  const terms = (query || '').toLowerCase().split(/\s+/).filter(Boolean);
  const out = [];
  for (const r of cache) {
    if (onlyPreferred && !r.b) continue;
    if (terms.length) {
      const hay = `${r.m || ''} ${r.c || ''} ${r.f || ''} ${r.d || ''} ${r.pkg || ''} ${meta.cats[r.g] || ''}`.toLowerCase();
      let ok = true;
      for (const t of terms) { if (!hay.includes(t)) { ok = false; break; } }
      if (!ok) continue;
    }
    out.push(r);
  }
  out.sort((a, b) => (b.s || 0) - (a.s || 0));
  return out.slice(0, limit);
}
