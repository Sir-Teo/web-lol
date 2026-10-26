"""Frozen ordinary/critical/passive attack trail systems and literal animation events."""
from pathlib import Path
import copy,hashlib,json,runpy,struct
import masteryi_q_particles as particle_source
from masteryi_q_particles import MODEL,MODEL_SHA256,PARSER_SHA256,checked,require,verify_native
PIN=Path('docs/reference/masteryi/attack-trail-particles.json')
PIN_SHA256='66516333b70c1557feab0b1b69a29bc119dd3675d3b04df36484cd842100c7e1'
SOURCE_ROOT=Path('.cache/masteryi-attack-trail-source-cloud/sources')
RESOURCES_SHA256='6bad039458ed2e86fc57e54903a08db8124ddc4bbcc94ed2be5e4bb27b795877'
ENTRIES_SHA256='e6d632934449bf1d7f2cf86014ef1243936d18b58ccbc7c5c9183781981e7818'
FILES_SHA256='8e3bbdb9ceed1a7018d396267d2f37ed67eefce332e87abf267745c0f2223884'
GLB=Path('public/assets/models/masteryi-base.glb')
GLB_SHA256='7aae9e8e486c34d780113349c4a4d06830a5498a906ff291a49263090da471cc'
PARENTS=['Attack1','Attack2','Crit','Passive']
def canonical(value):return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),allow_nan=False).encode()).hexdigest()
def cache_path(root,row):
 h=row['wadPathHash'];suffix=Path(row['path']).suffix
 require(isinstance(h,str)and len(h)==16 and all(c in '0123456789abcdef'for c in h)and suffix in {'.bin','.tex','.scb','.anm'},'Invalid attack trail source cache path')
 return Path(root)/f'{h}{suffix}'
def validate(pin,model):
 require(pin['modelSha256']==MODEL_SHA256 and pin['parserSha256']==PARSER_SHA256,'Attack trail provenance differs')
 require(canonical(pin['resources'])==RESOURCES_SHA256,'Complete attack trail source definitions differ')
 require(canonical(pin['animationEntries'])==ENTRIES_SHA256 and pin['animationParents']==PARENTS,'Complete attack trail animation entries differ')
 require(canonical(pin['extraction']['files'])==FILES_SHA256,'Attack trail native file closure differs')
 require(pin['extraction']['referenceVersion']=='16.18.8175716'and pin['extraction']['archive']=='DATA/FINAL/Champions/MasterYi.wad.client','Attack trail patch/archive differs')
 clips=model['animations']['data']['Characters/MasterYi/Animations/Skin0']['mClipDataMap'];selected={name:clips[name]for name in PARENTS}
 for parent in PARENTS:
  require(clips[parent]['__type']=='ParallelClipData','Attack parent is not parallel')
  for child in clips[parent]['mClipNameList']:selected[child]=clips[child]
 require(canonical(selected)==ENTRIES_SHA256,'Model attack trail graph differs')
 skin=model['skin']['data'];resources=skin['Characters/MasterYi/Skins/Skin0/Resources']['resourceMap'];linked={p.lower()for p in skin['__linked']};rows={r['path']:r for r in pin['extraction']['files']}
 for key,row in pin['resources'].items():
  require(resources.get(key)==row['record']and row['sourceBin']in linked and rows[row['sourceBin']]['sha256']==row['nativeSha256'],'Attack trail skin/native source binding differs')
 return clips

def load(pin_path=PIN,model_path=MODEL):
 pin=json.loads(checked(pin_path,PIN_SHA256));model=json.loads(checked(model_path,MODEL_SHA256));validate(pin,model)
 for row in pin['nameSources']:checked(row['path'],row['sha256'])
 return pin,model

def verify(pin,model,root=SOURCE_ROOT):
 validate(pin,model)
 for row in pin['extraction']['files']:checked(cache_path(root,row),row['sha256'],row['bytes'])
 particle={**pin,'extraction':{**pin['extraction'],'files':[r for r in pin['extraction']['files']if not r['path'].endswith('.anm')]}}
 result=verify_native(particle,model,root)
 parser=runpy.run_path(str(Path(particle_source.__file__).with_name('verify-masteryi-model.py')))['parse'];row=next(r for r in pin['extraction']['files']if r['path']=='data/characters/masteryi/animations/skin0.bin')
 parser(cache_path(root,row).read_bytes(),model['animations']['data'])
 return {**result,'animations':4,'nativeFiles':12,'nativeBytes':549752}

def project(pin,model,glb):
 clips=validate(pin,model)
 require(glb[:4]==b'glTF'and struct.unpack_from('<II',glb,4)==(2,len(glb))and glb[16:20]==b'JSON','Invalid attack trail attachment GLB')
 doc=json.loads(glb[20:20+struct.unpack_from('<I',glb,12)[0]]);nodes=doc['nodes'];joints={i for skin in doc['skins']for i in skin['joints']};bindings=[]
 for parent in PARENTS:
  for child in clips[parent]['mClipNameList']:
   clip=clips[child]
   for event_key,event in clip.get('mEventDataMap',{}).items():
    require(event['__type']=='ParticleEventData'and event['mEffectKey']in pin['resources'],'Attack trail particle event binding differs')
    pairs=[]
    for pair in event['mParticleEventDataPairList']:
     matches=[i for i,node in enumerate(nodes)if node.get('name','').lower()==pair['mBoneName'].lower()]
     require(len(matches)==1 and matches[0]in joints,'Missing/ambiguous/non-joint attack trail attachment');index=matches[0]
     pairs.append({'sourcePair':copy.deepcopy(pair),'glbNode':index,'glbBone':nodes[index]['name']})
    bindings.append({'parent':parent,'parentDefinition':copy.deepcopy(clips[parent]),'atomicClip':child,'clipDefinition':copy.deepcopy(clip),'eventKey':event_key,'event':copy.deepcopy(event),'pairs':pairs,'resource':event['mEffectKey']})
 require(len(bindings)==5 and len({b['resource']for b in bindings})==5,'Attack trail event closure differs')
 omitted_blend=[key for key,row in pin['resources'].items()if 'blendMode'not in row['definition']['complexEmitterDefinitionData'][0]]
 return {'format':1,'sourcePin':{'path':str(PIN),'sha256':PIN_SHA256},'modelSha256':MODEL_SHA256,'glb':{'path':str(GLB),'bytes':len(glb),'sha256':GLB_SHA256},'bindings':bindings,'resources':copy.deepcopy(pin['resources']),'omittedBlendMode':omitted_blend,'sourceFiles':copy.deepcopy(pin['extraction']['files']),'limits':['Source-only complete ordinary, critical and passive trail closure with four parallel parent definitions, eight atomic entries and five particle events. No public asset, renderer, gameplay, schema or app identity change.','Literal event start frames are 5.0, 5.0, 8.0, 6.0 and 9.0. These clips omit mTickDuration; no seconds, tick offsets, attack-speed scaling, callback ordering or cancellation policy is inferred.','Opaque animation mask/track hashes remain literal; two passive trail events do not establish two spell-audio callbacks or the secondary Double Strike suffix dispatch.','Each event names C_Buffbone_Glb_Center_Loc. The unique case-insensitive GLB joint bridge retains both spellings; native transform inheritance, reflection and VFX scale remain uncalibrated.','All five systems omit soundOnCreateDefault and soundPersistentDefault. No audio is inferred from animation or resource names.','First ordinary and critical trail emitters omit blendMode, while BA2 and both passive trails author 4. Bind=1, no-cull Boolean, lifetime, offsets, rotations, scales and scrolling are retained without filling omitted defaults.','All five emitters share one native SCB and use four TEX assets. Mesh flags/tail, face streams, sampler behavior and shader dispatch require their own byte-preserving transport and native calibration.']}

def generate(pin_path=PIN):
 pin,model=load(pin_path);return project(pin,model,checked(GLB,GLB_SHA256))
