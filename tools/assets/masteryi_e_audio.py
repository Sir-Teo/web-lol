"""Frozen Wuju Style spell suffixes, finite bank profiles and original playlists."""
from pathlib import Path
import json,math,runpy
from masteryi_audio_decode import GRAPH,GRAPH_SHA256,DECODED,DECODED_SHA256,MASTER_ROOT,check_masters
from masteryi_audio_source import checked_bytes
from masteryi_audio_graph import event_hash
from masteryi_q_audio import parameter,properties,ancestors,POLICY_KEYS,expected_policy
source=runpy.run_path(str(Path(__file__).with_name('export-masteryi-declarations.py')));require=source['require']
def inputs():
 character,_=source['load']();graph=json.loads(checked_bytes(GRAPH,GRAPH_SHA256));checked_bytes(DECODED,DECODED_SHA256)
 return character,graph,check_masters()
def generate():return project(*inputs())
def project(character,graph,decoded):
 nodes={n['id']:n for n in graph['nodes']};masters={m['id']:m for m in decoded['media']}
 bindings=character['records']['Characters/MasterYi/Spells/WujuStyleAbility/WujuStyle']['mSpell']['SpellEventToAudioEventSuffix']
 specs=[('cast','12','Play_sfx_MasterYi_WujuStyle_OnCast',9318,-11,[289182248,975357315]),('activate','18','Play_sfx_MasterYi_WujuStyleSuperCharged_OnBuffActivate',344121187,-9,[418795702,209385861]),('deactivate','19','Play_sfx_MasterYi_WujuStyleSuperCharged_OnBuffDeactivate',195063349,-14,[418782952,63363042])]
 require(bindings=={slot:name+'\n'for _,slot,name,*_ in specs},'E suffix closure differs')
 require({e['name']for e in graph['events']if 'WujuStyle'in e['name']}=={s[2]for s in specs},'E bank event closure differs')
 profiles=[];used=set()
 for kind,slot,name,container,gain,media_ids in specs:
  events=[e for e in graph['events']if e['name']==name];require(len(events)==1,'E event membership differs');event=events[0]
  require(event['id']==event_hash(name)and len(event['actions'])==1,'E event identity/action closure differs');action=event['actions'][0]
  require(action['type']=='CAkActionPlay'and action['target']==container,'E action target/type differs')
  require(properties(nodes,action['id'])=={}and properties(nodes,action['id'],True)=={}and int(parameter(nodes,action['id'],'eFadeCurve'))==4,'E action modifiers differ')
  expected={'MakeUpGain':gain,**({'Priority':60}if kind=='cast'else {})}
  require(nodes[container]['type']=='CAkRanSeqCntr'and properties(nodes,container)==expected and properties(nodes,container,True)=={},'E container modifiers differ')
  policy={k:int(parameter(nodes,container,k))for k in POLICY_KEYS};require(policy==expected_policy(4,0),'E container policy differs')
  require(ancestors(nodes,container)==[container,210632701,1056413114],'E parent hierarchy differs')
  require(int(parameter(nodes,container,'ulPlayListItem'))==2,'E playlist extent differs')
  variants=[];sounds=[]
  for index,identity in enumerate(media_ids):
   sound=int(parameter(nodes,container,f'AkPlaylistItem:{index}/ulPlayID'));sounds.append(sound)
   require(int(parameter(nodes,container,f'AkPlaylistItem:{index}/weight'))==50000,'E playlist weight differs')
   require(nodes[sound]['type']=='CAkSound'and int(parameter(nodes,sound,'DirectParentID'))==container and int(parameter(nodes,sound,'sourceID'))==identity,'E leaf identity differs')
   require(properties(nodes,sound)=={}and properties(nodes,sound,True)=={}and int(parameter(nodes,sound,'OverrideBusId'))==0 and int(parameter(nodes,sound,'u16MaxNumInstance'))==0,'E leaf modifiers/routing differ')
   m=masters[identity];require(m['sampleRate']==44100 and m['channels']==1 and m['decoderMetadata']['loopingInfo']is None,'E master format/loop differs')
   path=MASTER_ROOT/f'{identity}.wav';checked_bytes(path,m['wavSha256'],m['wavBytes']);used.add(identity)
   variants.append({'id':identity,'soundId':sound,'privatePath':str(path),**{k:m[k]for k in ['wavSha256','pcmSha256','wavBytes','frames','sampleRate','channels','durationSeconds','peak']}})
  require(set(action['targetNodes'])=={container,*sounds}and set(action['affectedMediaIds'])==set(media_ids),'E node/media closure differs')
  profiles.append({'kind':kind,'slot':slot,'eventName':name,'eventId':event['id'],'actionId':action['id'],'containerId':container,'sourceProperties':expected,'gainDb':gain,'policy':policy,'variants':variants})
 require(properties(nodes,210632701)=={}and properties(nodes,210632701,True)=={}and properties(nodes,1056413114)=={'Priority':60,'AttenuationID':339248780}and properties(nodes,1056413114,True)=={},'E inherited modifiers differ')
 require(all(int(parameter(nodes,n,'OverrideBusId'))==0 for n in [210632701,9318,344121187,195063349])and int(parameter(nodes,1056413114,'OverrideBusId'))==1259461568,'E inherited routing differs')
 require(all(int(parameter(nodes,n,'u16MaxNumInstance'))==0 for n in [210632701,1056413114]),'E inherited limits differ')
 attenuation={'id':339248780,'scaling':int(parameter(nodes,339248780,'eScaling')),'unresolvedOutputBusId':1259461568,'priority':60,'points':[{'distance':float(parameter(nodes,339248780,f'AkRTPCGraphPoint:{i}/From')),'storedValue':float(parameter(nodes,339248780,f'AkRTPCGraphPoint:{i}/To')),'interpolation':int(parameter(nodes,339248780,f'AkRTPCGraphPoint:{i}/Interp'))}for i in range(6)]}
 require(attenuation['scaling']==2 and len([p for p in nodes[339248780]['parameters']if p[0].endswith('/From')])==6,'E attenuation differs')
 tails={p['kind']:math.ceil(max(v['durationSeconds']for v in p['variants'])*60)for p in profiles};require(tails=={'cast':69,'activate':127,'deactivate':67},'E finite source bounds differ')
 require(len(profiles)==3 and len(used)==6,'E profile/media closure differs')
 return {'format':1,'characterSource':{'path':'docs/reference/masteryi/character.json','sha256':source['PINS']['character.json']},'audioGraphSha256':GRAPH_SHA256,'decodedRecordSha256':DECODED_SHA256,'rawSpellSuffixes':bindings,'profiles':profiles,'attenuation':attenuation,'finiteTailTicks':tails,'media':6,'wavBytes':sum(masters[i]['wavBytes']for i in used),'peaksAboveOne':sum(masters[i]['peak']>1 for i in used),'peak':max(masters[i]['peak']for i in used),'limits':['Source-only audit; no public masters, runtime dispatch, state/schema or application identity change.','Three explicit spell suffixes remain separate from unobserved native callbacks. No particle, contact or other cue inferred.','Original playlists, raw policies and source priority retained; native random state, global shuffle and admission remain unverified.','Existing float masters retain headroom without clipping, normalization, resampling, mixing or loop expansion.','No native bus/listening or official-client decoder certificate.']}
