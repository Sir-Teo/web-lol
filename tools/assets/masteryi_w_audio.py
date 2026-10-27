"""Frozen Meditate spell/particle bindings and complete bank event policies."""
from pathlib import Path
import json,math,runpy
from masteryi_audio_decode import GRAPH,GRAPH_SHA256,DECODED,DECODED_SHA256,MASTER_ROOT,check_masters
from masteryi_audio_source import checked_bytes
from masteryi_audio_graph import event_hash
from masteryi_q_audio import parameter,properties,ancestors,POLICY_KEYS,expected_policy
from masteryi_w_particles import load as particle_source,require,PIN_SHA256 as PARTICLE_SHA256
source=runpy.run_path(str(Path(__file__).with_name('export-masteryi-declarations.py')))

def inputs():
 character,_=source['load']();particles,_=particle_source()
 graph=json.loads(checked_bytes(GRAPH,GRAPH_SHA256));checked_bytes(DECODED,DECODED_SHA256)
 return character,particles,graph,check_masters()

def generate():return project(*inputs())

def project(character,particles,graph,decoded):
 nodes={n['id']:n for n in graph['nodes']};masters={m['id']:m for m in decoded['media']}
 require({e['name']for e in graph['events']if 'MasterYi_Meditate'in e['name']}=={'Play_sfx_MasterYi_Meditate_OnCast','Play_sfx_MasterYi_Meditate_OnBuffActivate','Stop_sfx_MasterYi_Meditate_OnBuffActivate','Play_sfx_MasterYi_Meditate_OnBuffDeactivate','Play_sfx_MasterYi_Meditate_foley'},'W bank event closure differs')
 spell=character['records']['Characters/MasterYi/Spells/MeditateAbility/Meditate']['mSpell']
 bindings=spell['SpellEventToAudioEventSuffix']
 require(bindings=={'12':'Play_sfx_MasterYi_Meditate_OnCast\n','18':'Stop_sfx_MasterYi_Meditate_OnBuffActivate\n','19':'Play_sfx_MasterYi_Meditate_OnBuffDeactivate\n'},'W suffix closure differs')
 require(all('soundOnCreateDefault'not in r['definition']for r in particles['resources'].values()),'W particle audio omission differs')
 profiles=[];used=set()
 for kind,name,layers in [
 ('cast','Play_sfx_MasterYi_Meditate_OnCast',[(9222,-9,2,[637673445])]),
 ('deactivate','Play_sfx_MasterYi_Meditate_OnBuffDeactivate',[(9224,-13,4,[584858889])]),
 ('unbound-activate','Play_sfx_MasterYi_Meditate_OnBuffActivate',[(9223,-12,4,[610915723]),(449614214,-19,4,[795081856,501197314])]),
 ('unbound-foley','Play_sfx_MasterYi_Meditate_foley',[(242685979,-10,1,[136213286])])]:
  events=[e for e in graph['events']if e['name']==name];require(len(events)==1,'W event closure differs');event=events[0]
  require(event['id']==event_hash(name)and len(event['actions'])==len(layers),'W event identity/action count differs')
  for layer,(action,(container,gain,cap,media_ids))in enumerate(zip(event['actions'],layers)):
   looping=kind=='unbound-activate';expected_action={'TransitionTime':2000}if looping else {}
   require(action['type']=='CAkActionPlay'and action['target']==container,'W play target/type differs')
   require(properties(nodes,action['id'])==expected_action and properties(nodes,action['id'],True)=={},'W play modifiers differ')
   require(int(parameter(nodes,action['id'],'eFadeCurve'))==(5 if looping else 4),'W play fade curve differs')
   require(int(parameter(nodes,action['id'],'ulActionType'))==1027,'W play action type differs')
   require(nodes[container]['type']=='CAkRanSeqCntr'and properties(nodes,container)=={'MakeUpGain':gain}and properties(nodes,container,True)=={},'W container modifiers differ')
   require(ancestors(nodes,container)==[container,9221,1056413114],'W parent hierarchy differs')
   policy={k:int(parameter(nodes,container,k))for k in POLICY_KEYS};require(policy==expected_policy(cap,0),'W container policy differs')
   require(int(parameter(nodes,container,'ulPlayListItem'))==len(media_ids),'W playlist extent differs')
   variants=[];sounds=[]
   for index,identity in enumerate(media_ids):
    sound=int(parameter(nodes,container,f'AkPlaylistItem:{index}/ulPlayID'));sounds.append(sound)
    require(int(parameter(nodes,container,f'AkPlaylistItem:{index}/weight'))==50000,'W playlist weight differs')
    require(nodes[sound]['type']=='CAkSound'and int(parameter(nodes,sound,'DirectParentID'))==container and int(parameter(nodes,sound,'sourceID'))==identity,'W leaf identity differs')
    require(properties(nodes,sound)==({'Loop':0}if looping else {})and properties(nodes,sound,True)=={},'W leaf modifiers differ')
    require(int(parameter(nodes,sound,'u16MaxNumInstance'))==0 and int(parameter(nodes,sound,'OverrideBusId'))==0,'W leaf routing/limit differs')
    master=masters[identity];require(master['sampleRate']==44100 and master['channels']==1 and master['decoderMetadata']['loopingInfo']is None,'W float master format differs')
    path=MASTER_ROOT/f'{identity}.wav';checked_bytes(path,master['wavSha256'],master['wavBytes']);used.add(identity)
    variants.append({'id':identity,'soundId':sound,'privatePath':str(path),**{k:master[k]for k in ['wavSha256','pcmSha256','wavBytes','frames','sampleRate','channels','durationSeconds','peak']},'leafProperties':properties(nodes,sound),'encodedLoopingInfo':None})
   require(set(action['targetNodes'])=={container,*sounds}and set(action['affectedMediaIds'])==set(media_ids),'W play node/media closure differs')
   profiles.append({'kind':kind,'layer':layer,'eventName':name,'eventId':event['id'],'actionId':action['id'],'containerId':container,'gainDb':gain,'policy':policy,'actionProperties':expected_action,'fadeCurve':5 if looping else 4,'variants':variants})
 events=[e for e in graph['events']if e['name']=='Stop_sfx_MasterYi_Meditate_OnBuffActivate'];require(len(events)==1,'W stop event closure differs');event=events[0]
 require(event['id']==event_hash(event['name'])and len(event['actions'])==2,'W stop event differs')
 stops=[]
 for action,target in zip(event['actions'],[449614214,9223]):
  require(action['type']=='CAkActionStop'and action['target']==target,'W stop target/type differs')
  require(properties(nodes,action['id'])=={'TransitionTime':500}and properties(nodes,action['id'],True)=={},'W stop modifiers differ')
  required={'ulActionType':259,'eFadeCurve':4,'bIsBus':0,'bApplyToStateTransitions':1,'bApplyToDynamicSequence':1,'ulExceptionListSize':0}
  require(all(int(parameter(nodes,action['id'],key))==value for key,value in required.items()),'W stop scope/fade differs')
  linked=next(p for p in profiles if p['containerId']==target)
  require(set(action['targetNodes'])=={target,*[v['soundId']for v in linked['variants']]}and set(action['affectedMediaIds'])=={v['id']for v in linked['variants']},'W stop node/media closure differs')
  stops.append({'eventName':event['name'],'eventId':event['id'],'actionId':action['id'],'targetContainerId':target,'properties':{'TransitionTime':500},'parameters':required,'targetNodes':action['targetNodes'],'affectedMediaIds':action['affectedMediaIds']})
 require(properties(nodes,9221)=={}and properties(nodes,9221,True)=={}and properties(nodes,1056413114)=={'Priority':60,'AttenuationID':339248780}and properties(nodes,1056413114,True)=={},'W inherited modifiers differ')
 require(all(int(parameter(nodes,n,'OverrideBusId'))==0 for n in [9221,9222,9223,9224,242685979,449614214])and int(parameter(nodes,1056413114,'OverrideBusId'))==1259461568,'W inherited routing differs')
 require(all(int(parameter(nodes,n,'u16MaxNumInstance'))==0 for n in [9221,1056413114]),'W inherited limits differ')
 attenuation={'id':339248780,'scaling':int(parameter(nodes,339248780,'eScaling')),'unresolvedOutputBusId':1259461568,'priority':60,
  'points':[{'distance':float(parameter(nodes,339248780,f'AkRTPCGraphPoint:{i}/From')),'storedValue':float(parameter(nodes,339248780,f'AkRTPCGraphPoint:{i}/To')),'interpolation':int(parameter(nodes,339248780,f'AkRTPCGraphPoint:{i}/Interp'))}for i in range(6)]}
 require(attenuation['scaling']==2 and len([p for p in nodes[339248780]['parameters']if p[0].endswith('/From')])==6,'W attenuation curve differs')
 require(len(profiles)==5 and len(used)==6,'W audio closure differs')
 tails={p['kind']:math.ceil(max(v['durationSeconds']for v in p['variants'])*60)for p in profiles if p['kind']in ['cast','deactivate']}
 require(tails=={'cast':151,'deactivate':155},'W finite recording bounds differ')
 return {'format':1,'characterSource':{'path':'docs/reference/masteryi/character.json','sha256':source['PINS']['character.json']},'particleSourceSha256':PARTICLE_SHA256,'finiteTailTicks':tails,'audioGraphSha256':GRAPH_SHA256,'decodedRecordSha256':DECODED_SHA256,'rawSpellSuffixes':bindings,'particleOnCreateBindings':[{'system':name,'present':False}for name in particles['resources']], 'profiles':profiles,'stops':stops,'attenuation':attenuation,'media':6,'wavBytes':sum(masters[i]['wavBytes']for i in used),'peaksAboveOne':sum(masters[i]['peak']>1 for i in used),'peak':max(masters[i]['peak']for i in used),'limits':['Source-only audit; no public media, runtime dispatch, state/schema or app identity changes.','Slot18 binds Stop, not Play. The bank Play activation event and foley have no binding in these retained spell/particle declarations. Native script/animation callbacks remain unverified.','Three leaves explicitly author Loop=0 while encoded files omit loop-point metadata. Keep Wwise playback policy separate from source float masters; no loop expansion or seam repair.','Two activation play actions retain 2000ms SCurve transitions; two object stop actions retain 500ms linear transitions. No linear fade substitutes the source curve.','Headroom above one is retained without normalization, clipping, resampling or mixing. No native bus/listening certificate.']}
