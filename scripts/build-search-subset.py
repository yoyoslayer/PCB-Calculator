#!/usr/bin/env python3
import tarfile, gzip, json, io, re, sys, time, os

TAR='/tmp/ghp.tgz'
LUT=json.load(gzip.open('/tmp/jlcparts-gh-pages/data/attributes-lut.json.gz'))
BASIC={3573:'Basic',8101:'Preferred'}
K=int(sys.argv[1]) if len(sys.argv)>1 else 16
MINSTOCK=int(sys.argv[2]) if len(sys.argv)>2 else 80
DS_PREFIX='https://jlcpcb.com/api/file/downloadByFileSystemAccessId/'

def primary(idx):
    name,spec=LUT[idx]
    key=spec.get('primary') or spec.get('default'); vals=spec.get('values',{})
    if key and key in vals: return name,vals[key][0]
    if vals:
        k0=next(iter(vals)); return name,vals[k0][0]
    return name,None

def cat_label(fn):
    base=fn.split('/')[-1][len('browse-components-'):]
    base=re.sub(r'__[0-9a-f]+-\d+\.jsonl\.gz$','',base)
    return re.sub(r'\s+',' ',base.replace('aka',' / ').replace('_',' ').strip())

cat_index={}
def cidx(cl):
    if cl not in cat_index: cat_index[cl]=len(cat_index)
    return cat_index[cl]

def shorten_ds(ds):
    if not ds: return None
    if ds.startswith(DS_PREFIX): return ds[len(DS_PREFIX):]  # digits only
    return ds

def mk(row,ix,cl):
    attrs_idx=row[ix['attributes']]
    flag=None; pkg=None; mfr=None
    for ai in attrs_idx:
        if ai in BASIC: flag=BASIC[ai]
    for ai in attrs_idx:
        try:
            nm,v=primary(ai)
            if nm=='Package': pkg=v
            elif nm=='Manufacturer': mfr=v
        except Exception: pass
    pr=row[ix['price']]; price=pr[0].get('price') if isinstance(pr,list) and pr else None
    rec={'c':row[ix['lcsc']],'m':row[ix['mfr']],'f':mfr,'d':row[ix['description']],
         'g':cidx(cl),'ds':shorten_ds(row[ix['datasheet']]),'u':row[ix['url']] or None,
         's':row[ix['stock']],'b':flag[0] if flag else None,'pkg':pkg}
    if price is not None: rec['p']=round(price,4)
    return flag,rec

records=[]; batt=[]; n_total=0; t0=time.time(); n_files=0
with tarfile.open(TAR,'r:gz') as tar:
    for m in tar:
        if not m.isfile() or '/data/browse-components-' not in m.name: continue
        n_files+=1
        f=tar.extractfile(m)
        if f is None: continue
        try:
            gz=gzip.GzipFile(fileobj=io.BytesIO(f.read()))
            text=io.TextIOWrapper(gz,encoding='utf-8'); header=json.loads(text.readline())
        except Exception: continue
        ix=header; cl=cat_label(m.name); is_batt='batter' in m.name.lower()
        keep=[]; bp=[]
        for line in text:
            try: row=json.loads(line)
            except Exception: continue
            n_total+=1
            flag,rec=mk(row,ix,cl)
            (bp if flag else keep).append(rec)
            if is_batt: batt.append(rec)
        keep=[r for r in keep if (r['s'] or 0)>=MINSTOCK]
        keep.sort(key=lambda r:-(r['s'] or 0))
        records.extend(bp+keep[:K])
cats=[None]*len(cat_index)
for k,v in cat_index.items(): cats[v]=k
with open('/tmp/lcsc-subset.jsonl','w') as out:
    out.write(json.dumps({'_meta':{'cats':cats,'dsPrefix':DS_PREFIX,
        'urlPrefix':'https://www.lcsc.com/product-detail/','urlSuffix':'.html',
        'count':len(records)}},ensure_ascii=False)+'\n')
    for r in records: out.write(json.dumps(r,ensure_ascii=False)+'\n')
json.dump(batt,open('/tmp/battery_candidates.json','w'),ensure_ascii=False)
sz=os.path.getsize('/tmp/lcsc-subset.jsonl')/1e6
print(f"DONE total={n_total} kept={len(records)} cats={len(cats)} battery={len(batt)} t={time.time()-t0:.0f}s size={sz:.2f}MB")
