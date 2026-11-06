"""Restore/check the one native animation used by the local Q cast timing adapter."""
import argparse,hashlib,json,struct
from pathlib import Path
MODEL='74d0b55f5aad08646fbd24f660ed533bc8fd5798e8a60dc0983d97960b47a377'
HEADER='65975b5a38b56d99dc7d746b07810cf48fb94c11cda383e3728ea2710546311b'
def require(ok,message):
 if not ok:raise ValueError(message)
def sha(raw):return hashlib.sha256(raw).hexdigest()
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--check',action='store_true');p.add_argument('--sources',type=Path,default=Path('.cache/ahri-q-cast-animation'));a=p.parse_args()
 raw=Path('docs/reference/ahri-model.json').read_bytes();require(sha(raw)==MODEL,'Frozen model differs');model=json.loads(raw);row=next(r for r in model['extraction']['files'] if r['path'].endswith('/spell1.anm'))
 target=a.sources/(row['wadPathHash']+'.anm');require(not any(p.is_symlink() for p in [target,*target.parents]),'Animation source cannot contain symlinks')
 def verify(raw):
  require(len(raw)==row['bytes'] and sha(raw)==row['sha256'],'Native animation bytes differ');header=Path('docs/reference/ahri/q-cast-animation-header.bin').read_bytes();require(sha(header)==HEADER and raw[:40]==header,'Retained native header differs')
 if target.exists():verify(target.read_bytes())
 elif a.check:raise ValueError('Missing native animation source')
 else:
  from riot_archive import RiotArchive
  from xxhash import xxh64_intdigest
  import tempfile
  toc='data/final/champions/ahri.wad.subchunktoc';archive=RiotArchive({f'{xxh64_intdigest(x):016x}':x for x in [row['path'],toc]},pinned=model['extraction'],archive_name='DATA/FINAL/Champions/Ahri.wad.client')
  with tempfile.TemporaryDirectory(prefix='ahri-cast-anm-')as tmp:
   archive.extract([row['path']],tmp,flat=True);raw=(Path(tmp)/target.name).read_bytes();verify(raw);target.parent.mkdir(parents=True,exist_ok=True)
   with target.open('xb')as out:out.write(raw)
 raw=target.read_bytes();verify(raw);print(json.dumps(dict(result='passed',source=row,retainedHeaderBytes=40,mode='check'if a.check else'restore',runtimeChanged=False)))
if __name__=='__main__':main()
