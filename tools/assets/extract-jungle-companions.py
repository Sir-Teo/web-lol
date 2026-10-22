"""Pin all three companion rigs, item/counter records and original metadata scripts."""
import io
import json
from pathlib import Path
from cdtb import binfile
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive, sha
from lua51 import read_chunk, named_functions, instruction

ROOT = Path('.cache/jungle-companions')
PIN = Path('docs/reference/jungle-companions-source.json')
old = json.loads(PIN.read_text()) if PIN.exists() else None
parents = {k:Path('docs/reference/'+k+'.json') for k in ['jungle-character-source','jungle-script-source','summoner-smite-source']}
parent = {k:json.loads(v.read_text()) for k,v in parents.items()}
items_path = Path('.cache/jungle-quest/items.json')
dd_path = Path('.cache/jungle-quest/dd-items.json')
items = json.loads(items_path.read_text())
dd = json.loads(dd_path.read_text())['data']
baseline_items = json.loads(Path('docs/reference/mage-items.json').read_text())
assert sha(dd_path.read_bytes()) == baseline_items['sha256']
strings_path = Path('.cache/smite/strings.json')
strings = json.loads(strings_path.read_text())['entries']
item_keys = ['Items/'+str(i) for i in [1101,1102,1103]]
item_keys += sorted({g for key in item_keys for g in items[key]['mItemGroups']})
item_records = {k:items[k] for k in item_keys if k in items}
shared_path = Path('.cache/smite/shared.json')
shared = json.loads(shared_path.read_text())
assert sha(shared_path.read_bytes()) == parent['summoner-smite-source']['shared']['sha256']
assert sha(strings_path.read_bytes()) == parent['summoner-smite-source']['strings']['sha256']
shared_keys = ['Shared/Spells/SummonerSmite','Shared/Spells/S5_SummonerSmitePlayerGanker',
               'Shared/Spells/SummonerSmiteAvatarOffensive','Shared/Spells/SummonerSmiteAvatarUtility',
               'Shared/Spells/SummonerSmiteAvatarDefensive','Shared/Spells/JungleItemFirstUpgrade',
               'Shared/Spells/JungleItemSecondUpgrade', 'Shared/Spells/Monster_Heal_Mis']
shared_records = {k:shared[k]for k in shared_keys if k in shared}
fields, types, names, assets = {},{},{},{}
def collect(v):
    if isinstance(v,dict):
        for k,x in v.items():
            if not k.startswith('{'): fields[binfile.compute_binhash(k)] = k
            if k=='__type' and not x.startswith('{'): types[binfile.compute_binhash(x)] = x
            collect(x)
    elif isinstance(v,list):
        for x in v: collect(x)
    elif isinstance(v,str) and v.isascii() and not v.startswith('{'):
        names[binfile.compute_binhash(v)] = v
        assets[xxh64_intdigest(v.lower())] = v.lower()
collect(parent['jungle-character-source']['records'])
collect(item_records);collect(shared_records)
if old:
    collect(old['records'])
    label_evidence = old['labelEvidence']
    for f in old['extraction']['files']: assets[int(f['wadPathHash'],16)] = f['path']
else:
    dictionary = Path('.cache/jungle-characters/hashes.game.txt')
    for line in dictionary.open():
        h,_,p = line.rstrip('\n').partition(' ')
        if p.startswith('assets/characters/sru_jungle_companions/'):
            assert xxh64_intdigest(p.lower()) == int(h,16)
            assets[int(h,16)] = p.lower()
    label_evidence = dict(url='https://raw.communitydragon.org/data/hashes/lol/hashes.game.txt',sha256=sha(dictionary.read_bytes()),scope='Discovery labels only; retained paths checked by xxh64. Reproduction uses the finite pin.')
character = 'SRU_Jungle_Companions'
for skin in range(3):
    key=f'Characters/{character}/Skins/Skin{skin}'
    names[binfile.compute_binhash(key)] = key
key=f'Characters/{character}/CharacterRecords/Root';names[binfile.compute_binhash(key)] = key
for table,values in [(binfile.hashfile_binfields,fields),(binfile.hashfile_bintypes,types),
                     (binfile.hashfile_binentries,names),(binfile.hashfile_binhashes,names),(binfile.hashfile_binpaths,assets)]:table.hashes=values
files = ['data/characters/sru_jungle_companions/sru_jungle_companions.bin']+[f'data/characters/sru_jungle_companions/{folder}/skin{i}.bin'for i in range(3)for folder in ['skins','animations']]
paths=json.loads(Path('docs/reference/map-wad-paths.json').read_text())
paths.update({f'{xxh64_intdigest(p):016x}':p for p in files});paths.update({f'{h:016x}':p for h,p in assets.items()})
a=RiotArchive(paths,old['extraction']if old else None);a.extract(files,ROOT)
def align(actual,expected):
    if isinstance(actual,str) and isinstance(expected,str) and expected.startswith('{') and expected in (f'{{{binfile.compute_binhash(actual):08x}}}',f'{{{xxh64_intdigest(actual.lower()):016x}}}'):return expected
    if isinstance(actual,dict) and isinstance(expected,dict):
        result={}
        for k,v in actual.items():
            h=f'{{{binfile.compute_binhash(k):08x}}}';key=h if k not in expected and h in expected else k
            result[key]=align(v,expected.get(key))
        return result
    if isinstance(actual,list) and isinstance(expected,list) and len(actual)==len(expected):return [align(v,e)for v,e in zip(actual,expected)]
    return actual
records={}
for p in files:
    decoded=json.loads(json.dumps(binfile.BinFile(io.BytesIO((ROOT/p).read_bytes())).to_serializable()))
    records[p]=align(decoded,old['records'][p])if old else decoded
models={};dependencies=set()
def dependencies_in(v):
    if isinstance(v,dict):
        for x in v.values():dependencies_in(x)
    elif isinstance(v,list):
        for x in v:dependencies_in(x)
    elif isinstance(v,str)and v.lower().startswith('assets/')and v.lower().endswith(('.skn','.skl','.dds','.tex')):dependencies.add(v.lower())
for i in range(3):
    skin_key=f'Characters/{character}/Skins/Skin{i}'
    skin=records[f'data/characters/sru_jungle_companions/skins/skin{i}.bin'][skin_key]
    graph_key=skin['skinAnimationProperties']['animationGraphData']
    graph=records[f'data/characters/sru_jungle_companions/animations/skin{i}.bin'][graph_key]
    clips={k:v['mAnimationResourceData']['mAnimationFilePath'].lower()for k,v in graph['mClipDataMap'].items()if v['__type']=='AtomicClipData'}
    dependencies.update(clips.values());dependencies_in(skin['skinMeshProperties'])
    models[f'{character}/Skin{i}']=dict(skinKey=skin_key,graphKey=graph_key,atomicClips=clips)
a.wad.resolve_paths({xxh64_intdigest(p):p for p in dependencies});a.entries.update({e.path:e for e in a.wad.files if e.path});a.extract(sorted(dependencies),ROOT)
script_files=[f'data/items/{i}.luabin64'for i in [1101,1102,1103]]+['data/shared/spells/jungleitemfirstupgrade.luabin64','data/shared/spells/jungleitemsecondupgrade.luabin64','data/characters/sru_jungle_companions/charscriptsru_jungle_companions.luabin64','data/spells/puppycontrollerbuff.luabin64','data/spells/doggysnaxmissile.luabin64','data/shared/spells/monster_heal_mis.luabin64']+[f'data/characters/sru_jungle_companions/spells/{s}.luabin64'for s in ['dogdashattack','dogslashattack','dogslashattacksmall']]
b=RiotArchive({f'{xxh64_intdigest(p):016x}':p for p in script_files},old['scriptExtraction']if old else None,archive_name='DATA/FINAL/Scripts.wad.client');b.extract(script_files,ROOT/'scripts')
inventory={p:{n:dict(constants=f['constants'],codeSha256=f['codeSha256'],children=len(f['children']),instructions=[instruction(f,pc)for pc in range(1,len(f['words'])+1)])for n,f in named_functions(read_chunk((ROOT/'scripts'/p).read_bytes())).items()}for p in script_files}
text_keys=[k for k in strings if k in [f'item_{i}_name'for i in [1101,1102,1103]]or(k.startswith(('item_1101_','item_1102_','item_1103_','item_jungle_','item_junglecompanion'))and any(s in k for s in ['tooltip','counter','treat','evolution']))]
text_keys += [k for k in ['role_quest_jungle','game_item_requiressmite','item_smite_required_check'] if k in strings and k not in text_keys]
result=dict(parents={k:dict(path=str(p),sha256=sha(p.read_bytes()))for k,p in parents.items()},extraction=a.provenance(),labelEvidence=label_evidence,records=records,models=models,scriptExtraction=b.provenance(),scriptInventory=inventory,
    itemSource=dict(url='https://raw.communitydragon.org/16.18/game/items.cdtb.bin.json',sha256=sha(items_path.read_bytes()),records=item_records),dataDragon=dict(url='https://ddragon.leagueoflegends.com/cdn/16.18.1/data/en_US/item.json',sha256=sha(dd_path.read_bytes()),items={str(i):dd[str(i)]for i in [1101,1102,1103]}),shared=dict(url=parent['summoner-smite-source']['shared']['url'],sha256=sha(shared_path.read_bytes()),records=shared_records),strings=dict(url=parent['summoner-smite-source']['strings']['url'],sha256=sha(strings_path.read_bytes()),entries={k:strings[k]for k in text_keys}),
    published=dict(url='https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/',firstEvolutionKills=15,fullQuestCounters=35,smiteDamage=[600,1000,1400]),
    status='Prepared companion/item sources. Native counter events, bonus treats, active startup, model dispatch and complete quest integration remain unfinished.')
if old:
    if old!=result:(ROOT/'mismatched-pin.json').write_text(json.dumps(result,indent=2)+'\n')
    assert old==result,'Companion source differs from pin'
else:PIN.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(dict(files=len(a.outputs),clips={k:len(v['atomicClips'])for k,v in models.items()},scripts=len(b.outputs),repeatMatches=old==result)))
