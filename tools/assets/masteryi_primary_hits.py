"""Complete frozen primary contact particles and explicit spell hit bindings."""
from pathlib import Path
import hashlib,json,re,runpy
from masteryi_q_particles import MODEL,MODEL_SHA256,PARSER_SHA256,checked,strings,require,cache_path,check_files,verify_native
PIN=Path('docs/reference/masteryi/primary-hit-particles.json')
PIN_SHA256='30e017180fd0778afec27ba6f2ea03f83317040e4ec51992e51472a211417301'
SOURCE_ROOT=Path('.cache/masteryi-primary-hit-source-cloud/sources')
DISCOVERY_SHA256='b19eff1f3e46f051bed9c34f0ae690f3b9ac4c54e113b25dbbca3424b4caa872'
RESOURCE_SHA256='9d5b40aeee85d4f4a340ca80bc31b90f371d572888fcd460ab50e2bf490d7f7a'
SYSTEMS={'MasterYi_BA_Tar_01':4,'MasterYi_BA_Tar_02':4,'MasterYi_Crit_tar':3}
SPELLS=['MasterYiBasicAttack','MasterYiBasicAttack2','MasterYiCritAttack']
DECLARATIONS=runpy.run_path(str(Path(__file__).with_name('export-masteryi-declarations.py')))
def canonical(value):return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),allow_nan=False).encode()).hexdigest()
def validate(pin,model,character):
 require(pin['modelSha256']==MODEL_SHA256 and pin['parserSha256']==PARSER_SHA256 and pin['discoverySha256']==DISCOVERY_SHA256,'Primary hit provenance differs')
 require(canonical(pin['resources'])==RESOURCE_SHA256 and set(pin['resources'])==set(SYSTEMS),'Complete primary hit definitions differ')
 expected_character={'path':'docs/reference/masteryi/character.json','sha256':DECLARATIONS['PINS']['character.json'],'binPath':'docs/reference/masteryi/character.bin','binSha256':DECLARATIONS['PINS']['character.bin']}
 require(pin['characterSource']==expected_character,'Primary hit character source differs')
 expected=[]
 for kind,spell,key in zip(['attack1','attack2','crit'],SPELLS,SYSTEMS):
  data=character['records']['Characters/MasterYi/Spells/'+spell]['mSpell']
  require(data['mHitEffectKey']==key and data['bHaveHitEffect']is True and data['bHaveHitBone']is True and data['mHitBoneName']=='C_BUFFBONE_GLB_CHEST_LOC','Primary spell hit declaration differs')
  expected.append({'kind':kind,'spell':'Characters/MasterYi/Spells/'+spell,'rawFields':{k:data[k]for k in ['mHitEffectKey','bHaveHitEffect','bHaveHitBone','mHitBoneName']}})
 require(pin['bindings']==expected and canonical(pin['bindings'])==canonical(expected),'Primary hit binding closure differs')
 skin=model['skin']['data'];resources=skin['Characters/MasterYi/Skins/Skin0/Resources']['resourceMap'];linked={p.lower()for p in skin['__linked']};bins={'data/characters/masteryi/skins/skin0.bin'}
 for key,row in pin['resources'].items():
  require(row['record']==resources[key]and row['sourceBin']in linked,'Primary hit skin binding differs')
  d=row['definition'];require(d['objectPath']==row['record']and d['__type']=='VfxSystemDefinitionData'and len(d['complexEmitterDefinitionData'])==SYSTEMS[key],'Primary hit record/emitter identity differs')
  require(not any(k.lower().startswith('sound')for k in d)and'flags'not in d,'Primary hit omitted system fields acquired defaults');bins.add(row['sourceBin'])
 assets={s.lower()for row in pin['resources'].values()for s in strings(row['definition'])if s.lower().startswith('assets/')}
 require(len(bins)==2 and len(assets)==11 and all(s.endswith('.tex')for s in assets),'Primary hit dependency closure differs')
 require(not[s for row in pin['resources'].values()for s in strings(row['definition'])if re.fullmatch(r'\{[0-9a-f]{16}\}',s)],'Unresolved primary hit PATH dependency')
 rows=pin['extraction']['files'];require(len(rows)==13 and len({r['path']for r in rows})==13 and {r['path']for r in rows}==bins|assets,'Missing/extra/duplicate primary hit file')
 require(pin['extraction']['archive']=='DATA/FINAL/Champions/MasterYi.wad.client'and pin['extraction']['referenceVersion']=='16.18.8175716'and pin['extraction']['manifest']==character['extraction']['manifest']==model['extraction']['manifest'],'Primary hit archive/manifest cohort differs')
 by_path={r['path']:r for r in rows}
 for row in pin['resources'].values():require(row['nativeSha256']==by_path[row['sourceBin']]['sha256'],'Primary hit BIN identity differs')
 return bins,assets

def load(pin_path=PIN,model_path=MODEL):
 pin=json.loads(checked(pin_path,PIN_SHA256));model=json.loads(checked(model_path,MODEL_SHA256));character,_=DECLARATIONS['load']();validate(pin,model,character)
 for row in pin['nameSources']:checked(row['path'],row['sha256'])
 return pin,model,character

def verify(pin,model,character,root=SOURCE_ROOT):
 validate(pin,model,character);result=verify_native(pin,model,root)
 runpy.run_path(str(Path(__file__).with_name('verify-masteryi-character.py')))['verify'](checked(pin['characterSource']['binPath'],pin['characterSource']['binSha256']),character['records'])
 return {**result,'primarySpells':3,'characterRecords':60,'nativeParticleBytes':sum(r['bytes']for r in pin['extraction']['files']),'characterBinBytes':27930}

def project(pin,model,character):
 bins,assets=validate(pin,model,character);systems=[]
 for key,row in pin['resources'].items():
  d=row['definition'];emitters=[]
  for index,e in enumerate(d['complexEmitterDefinitionData']):
   emitters.append({'index':index,'name':e.get('emitterName'),'completeFields':sorted(e),'rawBlendMode':e.get('blendMode'),'rawBindWeight':e.get('bindWeight'),'rawLocalOrientation':e.get('isLocalOrientation'),'rawParticleLocalOrientation':e.get('particleIsLocalOrientation'),'primitive':e.get('primitive'),'lifetime':e.get('lifetime'),'particleLifetime':e.get('particleLifetime')})
  systems.append({'key':key,'record':row['record'],'sourceBin':row['sourceBin'],'nativeSha256':row['nativeSha256'],'sourceFlags':d.get('flags'),'soundOnCreateDefault':d.get('soundOnCreateDefault'),'soundPersistentDefault':d.get('soundPersistentDefault'),'emitters':emitters})
 return {'format':1,'sourcePinSha256':PIN_SHA256,'completeResourcesSha256':RESOURCE_SHA256,'bindings':pin['bindings'],'systems':systems,'sourceFiles':{'particleBins':len(bins),'textures':len(assets),'meshes':0,'nativeParticleBytes':sum(r['bytes']for r in pin['extraction']['files']),'characterBinBytes':27930},'limits':pin['limits']+['Blend3 fluid, blend1 blood/soft, authored full-bind flashes and omitted bind/local controls remain distinct. Emitter names such as ground_glow do not establish native terrain projection.','This reading preserves complete definitions separately from the selected field summary. It does not drop unsupported fields or certify target-bone transforms, fallback, material filtering, sampler state or shader parity.']}
