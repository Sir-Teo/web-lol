"""Frozen passive composite cues, secondary omissions and two material-hit actions."""
from pathlib import Path
import json,math,runpy
from masteryi_audio_decode import GRAPH,GRAPH_SHA256,DECODED,DECODED_SHA256,MASTER_ROOT,check_masters
from masteryi_audio_source import checked_bytes
from masteryi_audio_graph import event_hash
from masteryi_q_audio import parameter,properties,ancestors,POLICY_KEYS,expected_policy
source=runpy.run_path(str(Path(__file__).with_name('export-masteryi-declarations.py')));require=source['require']
PARENT='Characters/MasterYi/Spells/MasterYiPassiveAbility/MasterYiPassive'
SECONDARY='Characters/MasterYi/Spells/MasterYiPassiveAbility/MasterYiDoubleStrike'
CAST_MEDIA=[425476853,271120929,860189031]
BRANCHES=[('Flesh',1022689189,[112126905,16380216,33081959,7394909],0),('Metal',139790345,[142894910,789302,52272044,95976721],-1),('Stone',1030627532,[84648135,204395837,33473320,21301409],0),('Wood',700954476,[126775659,31491481,116463815,19763561],0)]
def inputs():
 character,_=source['load']();graph=json.loads(checked_bytes(GRAPH,GRAPH_SHA256));checked_bytes(DECODED,DECODED_SHA256)
 return character,graph,check_masters()
def generate():return project(*inputs())
def project(character,graph,decoded):
 nodes={n['id']:n for n in graph['nodes']};masters={m['id']:m for m in decoded['media']}
 parent=character['records'][PARENT]['mSpell'];secondary=character['records'][SECONDARY]['mSpell']
 suffixes={'12':'Play_sfx_MasterYi_MasterYiDoubleStrike_OnCast\n','13':'Play_sfx_MasterYi_MasterYiDoubleStrike_OnHit\n'}
 require(parent.get('SpellEventToAudioEventSuffix')==suffixes and 'mApplyMaterialOnHitSound'not in parent,'Passive audio binding/omission differs')
 require('SpellEventToAudioEventSuffix'not in secondary and secondary.get('mApplyMaterialOnHitSound')is True and secondary.get('mAnimationName')=='Passive','Secondary audio omission/material/animation differs')
 require({e['name']for e in graph['events']if 'DoubleStrike'in e['name']}=={s.strip()for s in suffixes.values()},'Composite event closure differs')
 profiles=[];used=set()
 def variants(container,media_ids):
  require(nodes[container]['type']=='CAkRanSeqCntr'and int(parameter(nodes,container,'ulPlayListItem'))==len(media_ids),'Composite playlist extent/type differs')
  out=[];sounds=[]
  for index,identity in enumerate(media_ids):
   sound=int(parameter(nodes,container,f'AkPlaylistItem:{index}/ulPlayID'));sounds.append(sound)
   require(int(parameter(nodes,container,f'AkPlaylistItem:{index}/weight'))==50000 and nodes[sound]['type']=='CAkSound'and int(parameter(nodes,sound,'DirectParentID'))==container and int(parameter(nodes,sound,'sourceID'))==identity,'Composite playlist order/leaf identity differs')
   require(properties(nodes,sound)=={}and properties(nodes,sound,True)=={}and int(parameter(nodes,sound,'u16MaxNumInstance'))==0 and int(parameter(nodes,sound,'OverrideBusId'))==0,'Composite leaf modifiers/routing differ')
   m=masters[identity];require(m['sampleRate']==44100 and m['channels']==1 and m['decoderMetadata']['loopingInfo']is None,'Composite master format/loop differs')
   path=MASTER_ROOT/f'{identity}.wav';checked_bytes(path,m['wavSha256'],m['wavBytes']);used.add(identity)
   out.append({'id':identity,'soundId':sound,'privatePath':str(path),**{k:m[k]for k in ['wavSha256','pcmSha256','wavBytes','frames','sampleRate','channels','durationSeconds','peak']}})
  return out,sounds
 switch=391185571;materials={name:event_hash(name)for name,_,_,_ in BRANCHES}
 require(nodes[switch]['type']=='CAkSwitchCntr'and properties(nodes,switch)=={'MakeUpGain':-11}and properties(nodes,switch,True)=={}and int(parameter(nodes,switch,'ulGroupID'))==1559186049 and int(parameter(nodes,switch,'ulDefaultSwitch'))==materials['Flesh']and int(parameter(nodes,switch,'ulNumSwitchGroups'))==4 and int(parameter(nodes,switch,'u16MaxNumInstance'))==0 and int(parameter(nodes,switch,'bKillNewest'))==0,'Composite material switch differs')
 for index,(name,container,_,_)in enumerate(BRANCHES):
  require(int(parameter(nodes,switch,f'CAkSwitchPackage:{index}/ulSwitchID'))==materials[name]and int(parameter(nodes,switch,f'CAkSwitchPackage:{index}/ulNumItems'))==1 and int(parameter(nodes,switch,f'CAkSwitchPackage:{index}/NodeList/NodeID'))==container,'Composite switch branch/order differs')
 for phase,slot,target,delays in [('cast','12',3840,[0]),('hit','13',switch,[0,.2])]:
  name=suffixes[slot].strip();events=[e for e in graph['events']if e['name']==name];require(len(events)==1,'Composite event membership differs');event=events[0]
  require(event['id']==event_hash(name)and len(event['actions'])==len(delays),'Composite event identity/action count differs')
  for index,(action,delay)in enumerate(zip(event['actions'],delays)):
   require(action['type']=='CAkActionPlay'and action['target']==target and properties(nodes,action['id'])==({'DelayTime':200}if delay else {})and properties(nodes,action['id'],True)=={}and int(parameter(nodes,action['id'],'eFadeCurve'))==4,'Composite action target/delay/modifier differs')
   expected_nodes={target};expected_media=set()
   for material,container,media_ids,gain in [(None,3840,CAST_MEDIA,-11)]if phase=='cast'else BRANCHES:
    expected_props={'MakeUpGain':gain}if gain else {}
    require(properties(nodes,container)==expected_props and properties(nodes,container,True)==({'Pitch':[-100,100]}if phase=='cast'else {}),'Composite container gain/pitch differs')
    policy={k:int(parameter(nodes,container,k))for k in POLICY_KEYS};require(policy==expected_policy(2 if phase=='cast'else 4,0),'Composite finite/global voice policy differs')
    require(ancestors(nodes,container)==([3840,3839,1056413114]if phase=='cast'else[container,switch,3839,1056413114]),'Composite ancestry differs')
    clips,sounds=variants(container,media_ids);expected_nodes.update([container,*sounds]);expected_media.update(media_ids)
    profiles.append({'phase':phase,'actionIndex':index,'eventName':name,'eventId':event['id'],'actionId':action['id'],'targetId':target,'containerId':container,'material':material,'gainDb':gain if phase=='cast'else -11+gain,'pitchCents':0,'pitchModifiers':[{'nodeId':3840,'property':'Pitch','minimum':-100,'maximum':100}]if phase=='cast'else[],'delaySeconds':delay,'policy':policy,'variants':clips})
   require(set(action['targetNodes'])==expected_nodes and set(action['affectedMediaIds'])==expected_media,'Composite action node/media closure differs')
 require(properties(nodes,3839)=={}and properties(nodes,3839,True)=={}and properties(nodes,1056413114)=={'Priority':60,'AttenuationID':339248780}and properties(nodes,1056413114,True)=={},'Composite inherited modifiers differ')
 require(all(int(parameter(nodes,n,'OverrideBusId'))==0 for n in [3839,3840,switch,*[r[1]for r in BRANCHES]])and int(parameter(nodes,1056413114,'OverrideBusId'))==1259461568 and all(int(parameter(nodes,n,'u16MaxNumInstance'))==0 for n in [3839,1056413114]),'Composite parent routing/limits differ')
 attenuation={'id':339248780,'scaling':int(parameter(nodes,339248780,'eScaling')),'unresolvedOutputBusId':1259461568,'priority':60,'points':[{'distance':float(parameter(nodes,339248780,f'AkRTPCGraphPoint:{i}/From')),'storedValue':float(parameter(nodes,339248780,f'AkRTPCGraphPoint:{i}/To')),'interpolation':int(parameter(nodes,339248780,f'AkRTPCGraphPoint:{i}/Interp'))}for i in range(6)]}
 require(attenuation['scaling']==2 and len([p for p in nodes[339248780]['parameters']if p[0].endswith('/From')])==6,'Composite attenuation differs')
 require(len(profiles)==9 and len(used)==19,'Composite profile/media closure differs')
 tails={phase:math.ceil(max(p['delaySeconds']+v['durationSeconds']/2**(sum(m['minimum']for m in p['pitchModifiers'])/1200)for p in profiles if p['phase']==phase for v in p['variants'])*60)for phase in ['cast','hit']}
 bindings=[{'record':PARENT,'suffixesPresent':True,'rawSuffixes':suffixes,'materialFlagPresent':False,'materialFlag':None},{'record':SECONDARY,'suffixesPresent':False,'rawSuffixes':None,'materialFlagPresent':True,'materialFlag':True}]
 return {'format':1,'characterSource':{'path':'docs/reference/masteryi/character.json','sha256':source['PINS']['character.json']},'audioGraphSha256':GRAPH_SHA256,'decodedRecordSha256':DECODED_SHA256,'bindings':bindings,'profiles':profiles,'materialSwitch':{'id':switch,'groupId':1559186049,'defaultSwitch':materials['Flesh'],'branchLabels':materials,'limit':0},'attenuation':attenuation,'finiteTailTicks':tails,'media':19,'wavBytes':sum(masters[i]['wavBytes']for i in used),'peaksAboveOne':sum(masters[i]['peak']>1 for i in used),'peak':max(masters[i]['peak']for i in used),'limits':['Source-only projection; no public WAVs, runtime dispatch, save state or application identity changes.','Composite audio suffixes belong to MasterYiPassive; MasterYiDoubleStrike omits them. The parent omits the material flag while the secondary explicitly enables it. Native script callback timing and material propagation remain unverified.','Both hit actions retain their shared four branch containers/caps and independent zero/200ms action delays. Do not collapse them or silently dispatch the composite once per physical hit.','Native global shuffle, pitch, voice arbitration, default material routing and unresolved bus mix remain declarations, separate from any local runtime adapter.','Canonical private float masters retain source samples/headroom without clipping, normalization, resampling, mixing or loop expansion. No official decoder/bus/listening certificate.']}
