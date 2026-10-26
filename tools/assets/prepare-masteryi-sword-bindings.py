"""Preserve authored E/R persistent sword conditions and exact attachment names."""
from pathlib import Path
import argparse,copy,hashlib,json,struct
from masteryi_e_particles import load,checked,require,MODEL_SHA256,PIN_SHA256
from masteryi_audio_graph import write_outputs
CONDITIONS_SHA256='75f9c6c153d28627d76f23f86f471562afeea94be68b1deefa1ffc27a62e859e'
CHARACTER=Path('docs/reference/masteryi/character.json')
CHARACTER_SHA256='3f100c1148e1006766060822298c87aed02e86e359c385fbc2c248e4255d12fa'
GLB=Path('public/assets/models/masteryi-base.glb')
GLB_SHA256='7aae9e8e486c34d780113349c4a4d06830a5498a906ff291a49263090da471cc'
def sha(b):return hashlib.sha256(b).hexdigest()
def project(pin,model,character,glb):
 skin=model['skin']['data']['Characters/MasterYi/Skins/Skin0'];conditions=skin['PersistentEffectConditions'];require(sha(json.dumps(conditions,sort_keys=True,separators=(',',':'),allow_nan=False).encode())==CONDITIONS_SHA256,'Persistent sword conditions differ')
 require(glb[:4]==b'glTF'and struct.unpack_from('<II',glb,4)==(2,len(glb))and glb[16:20]==b'JSON','Invalid sword attachment GLB')
 doc=json.loads(glb[20:20+struct.unpack_from('<I',glb,12)[0]]);nodes=doc['nodes'];joints={i for s in doc['skins']for i in s['joints']};bindings=[]
 for condition_index,condition in enumerate(conditions):
  for index,vfx in enumerate(condition['PersistentVfxs']):
   key=vfx['effectKey'];require(key in pin['resources'],'Persistent sword resource missing')
   matches=[i for i,n in enumerate(nodes)if n.get('name','').lower()==vfx['boneName'].lower()];require(len(matches)==1 and matches[0]in joints,'Missing/ambiguous/non-joint sword attachment');node=matches[0]
   require(all(e.get('bindWeight')=={'constantValue':1.0,'__type':'ValueFloat'}and type(e['bindWeight']['constantValue'])is float and type(e.get('particleIsLocalOrientation'))is int and e.get('particleIsLocalOrientation')==1 for e in pin['resources'][key]['definition']['complexEmitterDefinitionData']),'Sword full-bind/local-orientation profile differs')
   bindings.append({'conditionIndex':condition_index,'index':index,'spell':condition['OwnerCondition']['Spell'],'effectKey':key,'sourceBone':vfx['boneName'],'glbNode':node,'glbBone':nodes[node]['name'],'record':pin['resources'][key]['record'],'emitters':len(pin['resources'][key]['definition']['complexEmitterDefinitionData'])})
 records=character['records'];active='Characters/MasterYi/Spells/WujuStyleAbility/WujuStyleSuperCharged';ability=records['Characters/MasterYi/Spells/WujuStyleAbility'];require(active in ability['mChildSpells']and records[active]['mBuff']['mDescription']=='game_buff_tooltip_Wuju_Style_Active','Wuju active child declaration differs')
 require([len(c['PersistentVfxs'])for c in conditions]==[4,1]and len(bindings)==5 and sum(b['emitters']for b in bindings)==13,'Persistent sword closure differs');require(skin['skinMeshProperties']['skinScale']==1.5,'Authored skin scale differs')
 return{'format':1,'modelSha256':MODEL_SHA256,'particleSourceSha256':PIN_SHA256,'characterSha256':CHARACTER_SHA256,'glb':{'path':str(GLB),'sha256':GLB_SHA256,'bytes':len(glb)},'conditionsSha256':CONDITIONS_SHA256,'conditions':copy.deepcopy(conditions),'bindings':bindings,'activeChild':{'record':active,'mBuff':copy.deepcopy(records[active]['mBuff'])},'sourceSkinScale':1.5,'glbBakedUnitScale':.015,'declaredEKeysNotBoundByThisTable':sorted(set(pin['resources'])-{b['effectKey']for b in bindings}),'limits':['Source-only declarations and rig-name bridge; no runtime or public-asset change.','The first condition tests the WujuStyleSuperCharged buff and declares four bone-bound instances. The second tests Highlander and binds MasterYi_E_buff on sword bone one.','HasBuff declarations establish these client conditions; native server buff creation/removal callbacks, component restart and tail behavior remain separate.','Names match the existing rig case-insensitively, with one unique skin joint per source name. Source spelling and GLB spelling are both retained.','All referenced emitters author bindWeight=1 and local orientation; current full joint transforms are available, but native inheritance/reflection/scale/shader behavior still needs calibration.','The GLB bakes source skinScale=1.5 into .015 translations. This does not by itself establish VFX size/offset inheritance.','Unbound-by-table keys are retained resources, rather than inferred globally unused effects.']}
def generate_outputs():
 pin,model=load();character=json.loads(checked(CHARACTER,CHARACTER_SHA256));glb=checked(GLB,GLB_SHA256);reading=project(pin,model,character,glb);return[(Path('docs/reference/masteryi/sword-persistent-bindings.json'),(json.dumps(reading,indent=2,allow_nan=False)+'\n').encode())],reading
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--check',action='store_true');a=p.parse_args();outputs,r=generate_outputs();write_outputs(outputs,a.check);print(json.dumps({'conditions':2,'instances':5,'uniqueEffects':4,'emitterInstances':13,'uniqueBones':len({b['glbNode']for b in r['bindings']}),'runtimeChanged':False}))
