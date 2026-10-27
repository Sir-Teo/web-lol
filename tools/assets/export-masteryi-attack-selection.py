"""Retain declared ordinary weights and validated rendered clip bindings."""
from pathlib import Path
import argparse,hashlib,json,runpy
from masteryi_attack_trails import load as load_trails,checked,GLB,GLB_SHA256,require
from masteryi_audio_graph import write_outputs
DECLARATIONS=runpy.run_path(str(Path(__file__).with_name('export-masteryi-declarations.py')))
BINDINGS=(('MasterYi_BA1_Trail','Attack1',5.),('MasterYi_BA2_Trail','Attack2',5.),('MasterYi_Crit_Trail','Crit',8.))
def generate():
 pin,_=DECLARATIONS['load']();records=pin['records'];root=records['Characters/MasterYi/CharacterRecords/Root'];base=root['basicAttack'];extra=root['extraAttacks'];critical=root['critAttacks']
 require(base.get('__type')=='AttackSlotData'and set(base)=={'mAttackDelayCastOffsetPercent','mAttackProbability','__type'}and type(base['mAttackProbability'])is float and base['mAttackProbability']==.5,'Default ordinary slot differs')
 require(len(extra)==3 and [s.get('mAttackName')for s in extra]==['MasterYiBasicAttack2','MasterYiBasicAttack','MasterYiDoubleStrike']and all(s.get('__type')=='AttackSlotData'for s in extra),'Extra attack slot closure differs')
 require(set(extra[0])=={'mAttackProbability','mAttackName','__type'}and type(extra[0]['mAttackProbability'])is float and extra[0]['mAttackProbability']==.5,'Second ordinary source weight differs')
 require(all(set(s)=={'mAttackName','__type'}for s in extra[1:]),'Unweighted extra attack slots acquired inferred weights')
 require(len(critical)==1 and critical[0].get('mAttackName')=='MasterYiCritAttack'and set(critical[0])=={'mAttackDelayCastOffsetPercent','mAttackName','__type'},'Critical slot differs')
 spells={kind:records['Characters/MasterYi/Spells/'+name]['mSpell']for kind,name in [('attack1','MasterYiBasicAttack'),('attack2','MasterYiBasicAttack2'),('crit','MasterYiCritAttack')]}
 require('mAnimationName'not in spells['attack1']and spells['attack2']['mAnimationName']=='Attack2'and spells['crit']['mAnimationName']=='Crit','Primary animation declarations differ')
 _,model=load_trails();markers=runpy.run_path(str(Path(__file__).with_name('export-masteryi-primary-trails.py')))['markers'](model,checked(GLB,GLB_SHA256),BINDINGS)
 clips={kind:m['clip']for kind,m in zip(spells,markers)}
 selection={'attack1':{'probability':base['mAttackProbability'],'clip':clips['attack1']},'attack2':{'probability':extra[0]['mAttackProbability'],'clip':clips['attack2']}}
 raw='// Declared weights; indexed selection remains an explicit local cosmetic policy.\nexport const MASTER_YI_ORDINARY_ATTACKS = {\n'+''.join("  "+kind+": { probability: 0.5, clip: '"+row['clip']+"' },\n"for kind,row in selection.items())+"} as const;\nexport const MASTER_YI_CRITICAL_ATTACK_CLIP = '"+clips['crit']+"';\n"
 reading={'format':1,'characterRecordSha256':hashlib.sha256(Path('docs/reference/masteryi/character.json').read_bytes()).hexdigest(),'modelGlbSha256':GLB_SHA256,'rawBasicAttack':base,'rawExtraAttacks':extra,'rawCritAttacks':critical,'selection':selection,'criticalClip':clips['crit'],'markers':markers,'limits':['Only the two explicit .5 weights feed the current local ordinary choice. Missing probabilities on other extra slots stay missing; no additional selection weight is inferred.','Default ordinary slot omits mAttackName and its spell omits mAnimationName. Existing Attack1/default aliases remain explicit local bindings. Attack2 and Crit names are declared.','Indexed cosmetic selection by actor/start tick and critical override are local policies, not native PRNG, graph transition or dispatch parity. No gameplay RNG, IDs, contact timing, damage or passive scheduling is added.','Rendered event sample indexing, full joint frame, native scale inheritance and callback calibration limits remain in the trail readings.']}
 return [(Path('src/content/masteryi-attack-selection.ts'),raw.encode()),(Path('docs/reference/masteryi/attack-selection-reading.json'),(json.dumps(reading,indent=2,allow_nan=False)+'\n').encode())],reading
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--check',action='store_true');args=p.parse_args();outputs,reading=generate();write_outputs(outputs,args.check);print(json.dumps({'ordinaryWeights':[.5,.5],'clips':3,'markers':3}))
