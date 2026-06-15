#!/usr/bin/env python3
"""Decoder for the yaqwsx/jlcparts gh-pages JSONL dataset."""
import gzip, json, sys, os

DATA = '/tmp/jlcparts-gh-pages/data'
LUT = json.load(gzip.open(os.path.join(DATA, 'attributes-lut.json.gz')))

def attr_value(idx):
    name, spec = LUT[idx]
    key = spec.get('primary') or spec.get('default')
    vals = spec.get('values', {})
    if key and key in vals:
        return name, vals[key][0]
    if vals:
        k0 = next(iter(vals))
        return name, vals[k0][0]
    return name, None

def lcsc_url(slug):
    return f"https://www.lcsc.com/product-detail/{slug}.html" if slug else None

def decode_file(name):
    path = os.path.join(DATA, name)
    recs = []
    with gzip.open(path, 'rt') as f:
        header = json.loads(f.readline())
        for line in f:
            row = json.loads(line)
            d = {k: row[i] for k, i in header.items()}
            attrs = {}
            for ai in d.get('attributes', []):
                try:
                    n, v = attr_value(ai)
                    attrs[n] = v
                except Exception:
                    pass
            price = None
            if isinstance(d.get('price'), list) and d['price']:
                price = d['price'][0].get('price')
            recs.append({
                'lcsc': d.get('lcsc'),
                'mpn': d.get('mfr'),
                'mfrName': attrs.get('Manufacturer'),
                'desc': d.get('description'),
                'datasheet': d.get('datasheet'),
                'url': lcsc_url(d.get('url')),
                'stock': d.get('stock', 0),
                'basic': attrs.get('Basic/Extended'),
                'price1': price,
                'attrs': attrs,
            })
    return recs

if __name__ == '__main__':
    # usage: decode.py <file> [topN] [mpn_filter]
    name = sys.argv[1]
    topN = int(sys.argv[2]) if len(sys.argv) > 2 else 15
    filt = sys.argv[3].lower() if len(sys.argv) > 3 else None
    recs = decode_file(name)
    if filt:
        recs = [r for r in recs if filt in (r['mpn'] or '').lower() or filt in (r['desc'] or '').lower()]
    recs.sort(key=lambda r: -(r['stock'] or 0))
    print(f"# {name}: {len(recs)} records (showing {min(topN,len(recs))} by stock)")
    for r in recs[:topN]:
        ak = {k: v for k, v in r['attrs'].items() if k not in ('Manufacturer', 'Basic/Extended')}
        print(f"{r['lcsc']:>8} | {r['basic'] or '-':9} | stk={r['stock']:>7} | {r['mfrName'] or '?':18} | {r['mpn']}")
        print(f"         desc: {r['desc']}")
        print(f"         attrs: {json.dumps(ak, ensure_ascii=False)[:240]}")
