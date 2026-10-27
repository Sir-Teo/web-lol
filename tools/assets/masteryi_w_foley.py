"""Frozen W entry animation -> particle -> persistent foley declaration."""
from pathlib import Path
import masteryi_q_particles as particle_source
import copy,hashlib,json,runpy
from masteryi_q_particles import MODEL,MODEL_SHA256,PARSER_SHA256,checked,require,verify_native
from masteryi_audio_decode import GRAPH,GRAPH_SHA256,DECODED,DECODED_SHA256,inspect_wave
from masteryi_q_audio import parameter,properties,ancestors,POLICY_KEYS
PIN=Path('docs/reference/masteryi/w-foley-particles.json')
PIN_SHA256='cbf93c100aaa635dbee9511ff8e548155309f59860d1c090e016fdf12a38ac18'
SOURCE_ROOT=Path('.cache/masteryi-w-foley-source-cloud/sources')
AUDIO=Path('docs/reference/masteryi/w-audio-reading.json')
AUDIO_SHA256='3c49d4a653422133b7a23f4a250dd5c5d7c7b3a366683f91d4c611c4c830c7bc'
KEY='MasterYi_w_foley_sound'
CLIP_SHA256='3eb3b77a216552766552ba3fe884f15b31ae7c62b72f71e65b2e043e1d3f40cb'
DEFINITION_SHA256='a5d4a47e1a405e7afcf5045599c5bef066d4aa0ebea535973aac9ce190877c61'
PROFILE_SHA256='db2e53d295fb1ebeae51d2d8d1ebf2a2092871a670c8501ce564498e4380294e'
FILES_SHA256='787bf24daf32001d5ee06219c8067f267d9189392b71048b35850bd7fa336cfa'
def canonical(value):return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),allow_nan=False).encode()).hexdigest()
def cache_path(root,row):
 h=row['wadPathHash'];suffix=Path(row['path']).suffix
 require(isinstance(h,str)and len(h)==16 and all(c in '0123456789abcdef' for c in h)and suffix in {'.bin','.tex','.anm'},'Invalid foley source cache path')
 return Path(root)/f'{h}{suffix}'
def validate(pin,model):
 require(pin['modelSha256']==MODEL_SHA256 and pin['parserSha256']==PARSER_SHA256,'Foley source provenance differs')
 require(set(pin['resources'])=={KEY},'Foley resource closure differs')
 resource=pin['resources'][KEY]
 require(canonical(resource['definition'])==DEFINITION_SHA256,'Complete foley particle definition differs')
 require(resource['record']==model['skin']['data']['Characters/MasterYi/Skins/Skin0/Resources']['resourceMap'][KEY],'Foley skin binding differs')
 require(resource['sourceBin'] in {p.lower() for p in model['skin']['data']['__linked']},'Foley BIN is not linked')
 require(canonical(pin['extraction']['files'])==FILES_SHA256,'Foley native file closure differs')
 require(pin['extraction']['referenceVersion']=='16.18.8175716'and pin['extraction']['archive']=='DATA/FINAL/Champions/MasterYi.wad.client','Foley patch/archive differs')
 require(resource['nativeSha256']==next(r['sha256']for r in pin['extraction']['files']if r['path']==resource['sourceBin']),'Foley native record source differs')
 clip=model['animations']['data']['Characters/MasterYi/Animations/Skin0']['mClipDataMap']['Spell2_In']
 require(canonical(clip)==CLIP_SHA256,'Complete W entry clip/event differs')
 return resource,clip

def load(pin_path=PIN,model_path=MODEL):
 pin=json.loads(checked(pin_path,PIN_SHA256));model=json.loads(checked(model_path,MODEL_SHA256));validate(pin,model)
 for row in pin['nameSources']:checked(row['path'],row['sha256'])
 return pin,model

def verify(pin,model,root=SOURCE_ROOT):
 validate(pin,model)
 for row in pin['extraction']['files']:checked(cache_path(root,row),row['sha256'],row['bytes'])
 # The shared particle verifier deliberately rejects ANM paths. Keep that
 # guard intact and verify the separately pinned clip bytes above.
 particle={**pin,'extraction':{**pin['extraction'],'files':[r for r in pin['extraction']['files']if not r['path'].endswith('.anm')]}}
 result=verify_native(particle,model,root)
 parser=runpy.run_path(str(Path(particle_source.__file__).with_name('verify-masteryi-model.py')))['parse']
 animation=next(r for r in pin['extraction']['files']if r['path']=='data/characters/masteryi/animations/skin0.bin')
 parser(cache_path(root,animation).read_bytes(),model['animations']['data'])
 return {**result,'animations':1,'nativeFiles':5,'nativeBytes':43548}

def project(pin,model,audio,graph,decoded,master):
 resource,clip=validate(pin,model)
 profiles=[p for p in audio['profiles']if p['eventName']==resource['definition']['soundPersistentDefault']]
 require(len(profiles)==1 and canonical(profiles[0])==PROFILE_SHA256,'Foley bank profile differs');profile=profiles[0];variant=profile['variants'][0]
 events=[e for e in graph['events']if e['name']==profile['eventName']]
 require(len(events)==1 and events[0]['id']==profile['eventId']and len(events[0]['actions'])==1,'Foley bank event differs');action=events[0]['actions'][0]
 require(action['id']==profile['actionId']and action['type']=='CAkActionPlay'and action['target']==profile['containerId']and set(action['targetNodes'])=={242685979,553860281}and action['affectedMediaIds']==[136213286],'Foley action closure differs')
 nodes={n['id']:n for n in graph['nodes']}
 require(properties(nodes,profile['actionId'])=={} and properties(nodes,profile['containerId'])=={'MakeUpGain':-10} and properties(nodes,variant['soundId'])=={},'Foley bank modifiers differ')
 require(ancestors(nodes,profile['containerId'])==[242685979,9221,1056413114],'Foley parent graph differs')
 require({key:int(parameter(nodes,profile['containerId'],key))for key in POLICY_KEYS}==profile['policy'],'Foley playlist policy differs')
 require(int(parameter(nodes,profile['containerId'],'ulPlayListItem'))==1 and int(parameter(nodes,profile['containerId'],'AkPlaylistItem:0/ulPlayID'))==variant['soundId'] and int(parameter(nodes,profile['containerId'],'AkPlaylistItem:0/weight'))==50000,'Foley playlist extent differs')
 require(int(parameter(nodes,variant['soundId'],'sourceID'))==variant['id'],'Foley source media differs')
 masters=[m for m in decoded['media']if m['id']==variant['id']];require(len(masters)==1,'Foley float master missing');metadata=masters[0]['decoderMetadata']
 stats=inspect_wave(master,metadata)
 require(all(stats[key]==variant[key]for key in ['wavSha256','pcmSha256','wavBytes','frames','sampleRate','channels','durationSeconds','peak'])and metadata['loopingInfo']is None,'Foley float master differs')
 bank=copy.deepcopy(profile);bank['originalReadingKind']=bank.pop('kind')
 return {'format':1,'sourcePin':{'path':str(PIN),'sha256':PIN_SHA256},'modelSha256':MODEL_SHA256,'audioReadingSha256':AUDIO_SHA256,'audioGraphSha256':GRAPH_SHA256,'decodedRecordSha256':DECODED_SHA256,'animation':{'graphRecord':'Characters/MasterYi/Animations/Skin0','clipName':'Spell2_In','definition':copy.deepcopy(clip),'tickDuration':{'present':False}},'skinBinding':{'effectKey':KEY,'record':resource['record']},'particle':copy.deepcopy(resource),'bankProfile':bank,'floatMaster':stats,'inheritedAttenuation':copy.deepcopy(audio['attenuation']),'retainedSpellSuffixes':copy.deepcopy(audio['rawSpellSuffixes']),'limits':['Source-only expanded closure establishes an authored W entry animation event, exact base-skin particle binding and persistent sound declaration. No public media, runtime dispatch, schema or application identity changes.','mStartFrame remains the literal float 1.0; Spell2_In omits mTickDuration. No seconds, simulation-tick offset, native frame sampling or callback timing is inferred.','The animation event authors mIsLoop=false and an otherwise empty ParticleEventDataPair. No attachment is inferred. The particle uses soundPersistentDefault, not soundOnCreateDefault. Native component creation, lifetime, tail and destruction/voice-stop behavior remain separate.','The emitter named empty retains particleLinger=10.0, rate=1.0 and other omissions. Those fields do not establish audio repetition, animation duration or an invisible rendering default.','The prior unbound-foley label describes the earlier spell/four-system W audit scope; this expanded animation/skin/particle closure supplies the missing declaration chain. Slot18 still binds Stop; the bank-only OnBuffActivate Play remains unbound by these records.','The retained bank leaf has no explicit Loop property and the encoded master has no loop-point metadata. The finite 0.699-second recording does not certify persistent component playback or native listening/bus parity.']}

def generate(pin_path=PIN):
 pin,model=load(pin_path);audio=json.loads(checked(AUDIO,AUDIO_SHA256));graph=json.loads(checked(GRAPH,GRAPH_SHA256));decoded=json.loads(checked(DECODED,DECODED_SHA256))
 variant=next(p for p in audio['profiles']if p['kind']=='unbound-foley')['variants'][0]
 return project(pin,model,audio,graph,decoded,checked(variant['privatePath'],variant['wavSha256'],variant['wavBytes']))
