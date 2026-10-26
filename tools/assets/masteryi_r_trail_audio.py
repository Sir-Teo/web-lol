"""Authored Highlander persistent sound and complete retained bank controls."""
import json
from masteryi_r_particles import load,require,PIN_SHA256
from masteryi_audio_decode import GRAPH,GRAPH_SHA256,DECODED,DECODED_SHA256,MASTER_ROOT,check_masters
from masteryi_audio_source import checked_bytes
from masteryi_audio_graph import event_hash
from masteryi_q_audio import parameter,properties,ancestors,POLICY_KEYS,expected_policy
EVENT='Play_sfx_MasterYi_Highlander_trail'
def inputs():
 particles,_=load();graph=json.loads(checked_bytes(GRAPH,GRAPH_SHA256));checked_bytes(DECODED,DECODED_SHA256)
 return particles,graph,check_masters()
def generate():return project(*inputs())
def project(particles,graph,decoded):
 nodes={n['id']:n for n in graph['nodes']};bindings=[]
 for name,row in particles['resources'].items():
  definition=row['definition'];present='soundPersistentDefault'in definition
  require(present==name.startswith('MasterYi_R_Buf')and(not present or definition['soundPersistentDefault']==EVENT),'R persistent binding/omission differs')
  require({k for k in definition if k.lower().startswith('sound')}==({'soundPersistentDefault'}if present else set()),'R sound fields differ');bindings.append({'system':name,'record':row['record'],'persistentPresent':present,'soundPersistentDefault':definition.get('soundPersistentDefault'),'onCreatePresent':False})
 require(len(bindings)==5 and sum(b['persistentPresent']for b in bindings)==3,'R persistent system closure differs')
 retained_events={e['name']for e in graph['events']if'MasterYi_Highlander'in e['name']}
 require(retained_events=={EVENT,'Play_sfx_MasterYi_Highlander_OnBuffActivate','Play_sfx_MasterYi_Highlander_OnBuffDeactivate'},'R bank event closure differs')
 events=[e for e in graph['events']if e['name']==EVENT];require(len(events)==1,'R trail event closure differs');event=events[0]
 require(event['id']==event_hash(EVENT)and len(event['actions'])==1,'R trail event identity/action count differs');action=event['actions'][0]
 require(action['id']==1036814976 and action['type']=='CAkActionPlay'and action['target']==9115 and set(action['targetNodes'])=={9115,802209755}and action['affectedMediaIds']==[560618281],'R trail action/node/media closure differs')
 require(properties(nodes,action['id'])=={}and properties(nodes,action['id'],True)=={}and int(parameter(nodes,action['id'],'eFadeCurve'))==4 and int(parameter(nodes,action['id'],'ulActionType'))==1027,'R trail play modifiers differ')
 require(nodes[9115]['type']=='CAkRanSeqCntr'and properties(nodes,9115)=={'MakeUpGain':-13}and properties(nodes,9115,True)=={}and ancestors(nodes,9115)==[9115,9114,1056413114],'R trail container hierarchy/modifiers differ')
 policy={k:int(parameter(nodes,9115,k))for k in POLICY_KEYS};require(policy==expected_policy(4,0),'R trail voice policy differs')
 require(int(parameter(nodes,9115,'ulPlayListItem'))==1 and int(parameter(nodes,9115,'AkPlaylistItem:0/ulPlayID'))==802209755 and int(parameter(nodes,9115,'AkPlaylistItem:0/weight'))==50000,'R trail playlist differs')
 require(nodes[802209755]['type']=='CAkSound'and int(parameter(nodes,802209755,'sourceID'))==560618281 and int(parameter(nodes,802209755,'DirectParentID'))==9115 and properties(nodes,802209755)=={'Loop':0}and properties(nodes,802209755,True)=={},'R trail leaf identity/loop differs')
 for n in [9114,1056413114,802209755]:require(int(parameter(nodes,n,'u16MaxNumInstance'))==0 and int(parameter(nodes,n,'uNumCurves'))==0,'R trail inherited/leaf limits or RTPC differ')
 require(properties(nodes,9114)=={}and properties(nodes,9114,True)=={}and properties(nodes,1056413114)=={'Priority':60,'AttenuationID':339248780}and properties(nodes,1056413114,True)=={},'R trail inherited modifiers differ')
 require(all(int(parameter(nodes,n,'OverrideBusId'))==0 for n in [9115,9114,802209755])and int(parameter(nodes,1056413114,'OverrideBusId'))==1259461568,'R trail routing differs')
 rtpc={key:int(parameter(nodes,9115,'RTPC:0/'+key))for key in ['RTPCID','rtpcType','rtpcAccum','ParamID','rtpcCurveID','eScaling','ulSize']}
 require(int(parameter(nodes,9115,'uNumCurves'))==1 and rtpc=={'RTPCID':745018932,'rtpcType':0,'rtpcAccum':2,'ParamID':0,'rtpcCurveID':751387390,'eScaling':2,'ulSize':5},'R trail RTPC binding differs')
 points=[{'input':float(parameter(nodes,9115,f'AkRTPCGraphPoint:{i}/From')),'storedValue':float(parameter(nodes,9115,f'AkRTPCGraphPoint:{i}/To')),'interpolation':int(parameter(nodes,9115,f'AkRTPCGraphPoint:{i}/Interp'))}for i in range(5)]
 require(points==[{'input':x,'storedValue':y,'interpolation':c}for x,y,c in [(0,-0.5533164143562317,5),(0.6000000238418579,0,9),(8,0,5),(10,-0.5533164143562317,9),(20,-0.5533164143562317,4)]],'R trail RTPC points differ')
 require(745018932 not in nodes,'R trail game parameter now has a retained definition; review semantics')
 master=next(m for m in decoded['media']if m['id']==560618281);path=MASTER_ROOT/'560618281.wav';checked_bytes(path,master['wavSha256'],master['wavBytes'])
 require(master['sampleRate']==44100 and master['channels']==1 and master['decoderMetadata']['loopingInfo']is None,'R trail master format/loop metadata differs')
 attenuation={'id':339248780,'scaling':int(parameter(nodes,339248780,'eScaling')),'points':[{'distance':float(parameter(nodes,339248780,f'AkRTPCGraphPoint:{i}/From')),'storedValue':float(parameter(nodes,339248780,f'AkRTPCGraphPoint:{i}/To')),'interpolation':int(parameter(nodes,339248780,f'AkRTPCGraphPoint:{i}/Interp'))}for i in range(6)],'priority':60,'unresolvedOutputBusId':1259461568}
 return {'format':1,'particleSourceSha256':PIN_SHA256,'audioGraphSha256':GRAPH_SHA256,'decodedRecordSha256':DECODED_SHA256,'bindings':bindings,'event':event,'retainedHighlanderEvents':sorted(retained_events),'containerId':9115,'parentChain':[9115,9114,1056413114],'gainDb':-13,'policy':policy,'actionProperties':{},'playFadeCurve':4,'leafProperties':{'Loop':0},'volumeRtpc':{**rtpc,'points':points,'gameParameterDefinitionPresent':False,'inputMeaning':None},'attenuation':attenuation,'master':{'privatePath':str(path),**master},'media':1,'wavBytes':master['wavBytes'],'peak':master['peak'],'limits':['Source-only reading; no runtime audio, public WAV, save/ruleset or production-pack change.','The three retained buff systems explicitly bind the same persistent event; cast and takedown systems omit it. This does not prove native rank-selection or client start/stop callbacks.','Leaf Loop=0 stays separate from encoded loopingInfo=None. No loop expansion, seam repair, normalization, clipping or resampling is applied.','Volume retains its raw RTPC scaling/accumulation codes and ordinates; stored values are not literal decibels. The retained graph has no definition/default for parameter 745018932; its meaning and live input cannot be inferred from curve shape.','Native source-to-output-bus processing, scheduling, callback fade and physical listening remain unverified.']}
