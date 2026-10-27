"""Restore one original Gromp Troy source using frozen SHA256 and bounded ranges."""
from pathlib import Path
import json
from xxhash import xxh64_intdigest
import native_constructor_witness as witness
from riot_archive import RiotArchive
from legacy_troy import read,decode
PIN=Path('docs/reference/gromp-effects.json')
PIN_SHA256='3cb54cd774fbfd66cc52846bb8775d17ab0adb473a570600e274e5f2ae0a1033'
ROOT=Path('.cache/native-legacy-color-curve-source-v1')
NAME='data/particles/sru_gromp_death_pop.troybin'

def restore():
 pin=json.loads(witness.pinned(PIN,PIN_SHA256));extraction=pin['extraction'];manifest=Path('.cache/riot-reference/29CE6E781C3B6368.manifest');receipts=[]
 if not manifest.exists():
  row={**extraction['manifest'],'path':str(manifest),'bytes':16683525};raw,receipt=witness.restored.fetch(row);manifest.parent.mkdir(parents=True,exist_ok=True)
  with manifest.open('xb')as stream:stream.write(raw)
  receipts.append(receipt)
 witness.pinned(manifest,extraction['manifest']['sha256']);ROOT.mkdir(parents=True,exist_ok=True)
 class FrozenArchive(RiotArchive):
  def prefetch(self,ranges):
   for offset,size in ranges:
    for _,chunk in self.chunks_for(offset,size):
     key=f'{chunk.chunk_id:016X}';row=extraction['chunks'].get(key)
     witness.require(row is not None and row['offset']==chunk.offset and row['bytes']==chunk.size and row['url']==f'https://lol.dyn.riotcdn.net/channels/public/bundles/{chunk.bundle.bundle_id:016X}.bundle','Gromp source chunk binding differs');path=Path('.cache/riot-reference')/(key+'.chunk')
     if not path.exists():
      raw,receipt=witness.restored.fetch({**row,'path':str(path),'range':[chunk.offset,chunk.offset+chunk.size-1]})
      with path.open('xb')as stream:stream.write(raw)
      receipts.append(receipt)
      with(ROOT/'fetch-receipts.jsonl').open('a')as stream:stream.write(json.dumps(receipt)+'\n')
     witness.restored.checked(path.read_bytes(),{**row,'path':str(path)})
 archive=FrozenArchive({f'{xxh64_intdigest(NAME):016x}':NAME},extraction,archive_name=extraction['archive']);entry=archive.entries[NAME];raw=entry.read_data(archive,archive.toc);row=next(row for row in extraction['files']if row['path']==NAME);witness.restored.checked(raw,row);parsed=read(raw);expected=pin['records'][NAME]
 witness.require(parsed==expected['typed']and decode(parsed,expected['labels'])==expected['decoded'],'Restored original Troy parsing differs');target=ROOT/Path(NAME).name
 if target.exists():witness.restored.checked(target.read_bytes(),row)
 else:
  with target.open('xb')as stream:stream.write(raw)
 return {'resource':row,'path':str(target),'parsedTypedRows':len(parsed['rows']),'originalTypedAndDecodedRecordsExact':True,'receiptsThisRun':receipts,'archive':archive.provenance(),'scope':'One original Gromp death Troy resource; not all36 Gromp resources or any missing historical Leona certificate.','nativeExecuted':False}
if __name__=='__main__':
 import argparse
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,default=ROOT/'restore-check.json');args=parser.parse_args();result=restore();args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'bytes':result['resource']['bytes'],'rows':result['parsedTypedRows'],'receipts':len(result['receiptsThisRun']),'exact':True}))
