"""Pin the original Sweeper preload and its declared audio-only Troy system."""
import json
import subprocess
from pathlib import Path
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive, sha
from legacy_troy import read, decode, ihash
from lua51 import read_chunk, named_functions
assert subprocess.check_output(['git','-C','.tools/lolpytools','rev-parse','HEAD'],text=True).strip()=='cd778cb1b2ace6557bbf9f7c3395b3f6f2f5a2b9'

target=Path('docs/reference/oracle-audio-bindings.json')
old=json.loads(target.read_text()) if target.exists() else None
root=Path('.cache/oracle-audio-bindings')
scripts=['data/spells/trinketsweeperlvl3.preload','data/spells/trinketlenslvl1audio.luabin64']
script=RiotArchive({f'{xxh64_intdigest(p):016x}':p for p in scripts},old['scripts'] if old else None,
    archive_name='DATA/FINAL/Scripts.wad.client');script.extract(scripts,root)
preload=(root/scripts[0]).read_bytes().decode('ascii')
assert 'data/particles/trinketlenslvl3audio.troy' in preload
paths=['data/particles/trinketlenslvl3audio.troybin','data/particles/trinketlenslvl1audio.troybin']
data=RiotArchive({f'{xxh64_intdigest(p):016x}':p for p in paths},old['data'] if old else None,
    archive_name='DATA/FINAL/DATA.wad.client');data.extract(paths,root)
import sys
sys.path.insert(0,'.tools/lolpytools')
from lolpytools import inibin2,troybin_fix
records={}
for path in paths:
    raw=(root/path).read_bytes();parsed=read(raw)
    with (root/path).open('rb')as f: oracle=inibin2.read(f)
    assert {r['hash']:r['value']for r in parsed['rows']}=={f'{k:08x}':v for k,v in oracle['UNKNOWN_HASHES'].items()}
    troybin_fix.fix(oracle)
    labels={ihash(s,k):[s,k]for s,v in oracle['Values'].items()for k in v}
    records[path]=dict(typed=parsed,labels=labels,decoded=decode(parsed,labels))
active=records[paths[0]]['decoded']['values']['System']['SoundPersistent']
assert active=='Play_sfx_TrinketLensLvl2Audio_buffactivate'
source_path=Path('docs/reference/oracle-lens-source.json');source=json.loads(source_path.read_text())
ending=source['items']['records']['Items/3364/Particles/3364_Global_Trinket_Spotter_Death']['soundPersistentDefault']
functions=named_functions(read_chunk((root/scripts[1]).read_bytes()))
assert len(functions)==1 and functions['<main>']['constants']==[] and functions['<main>']['words']==[8388638]
result=dict(referenceSha256=sha(source_path.read_bytes()),scripts=script.provenance(),data=data.provenance(),
    preload=preload,records=records,emptyAudioScript=functions,activeEvent=active,endingEvent=ending,
    naming=dict(revision='cd778cb1b2ace6557bbf9f7c3395b3f6f2f5a2b9',files={n:sha(Path('.tools/lolpytools/lolpytools',n).read_bytes()) for n in ['inibin2.py','troybin_fix.py']}),
    limits=['Preload proves a declared resource dependency, not execution or native activation/stop timing.',
      'Lvl3 audio resource selects the Lvl2 activation event; modern child Death explicitly selects the Lvl1 deactivation event.',
      'Legacy emitter lifetimes do not replace current eight-second gameplay duration. Empty Lua script recovers no dispatch callback.'])
if old:assert old==result,'Audio bindings differ from pin'
else:target.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(dict(activeEvent=active,endingEvent=ending,files=len(scripts)+len(paths))))
