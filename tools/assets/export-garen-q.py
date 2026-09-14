"""Export named Garen Q values, retaining separate activation/attack records."""
import json
from pathlib import Path
pin=json.loads(Path('docs/reference/garen-character.json').read_text())
r=pin['records']; key='Characters/Garen/Spells/GarenQAbility/'
q=r[key+'GarenQ']['mSpell']; attack=r[key+'GarenQAttack']['mSpell']
assert q['mClientData']['mTooltipData']['mLists']['LevelUp']['levelCount']==5
values={v['name']:v['values'] for v in q['DataValues']}
def ranks(name):
    assert len(values[name])==7
    return values[name][1:6]
def scalar(name):
    assert len(set(values[name]))==1
    return values[name][0]
assert 'Trait_AttackReset' in q['mSpellTags']
assert q['mTargetingTypeData']['__type']=='Self'
assert len(set(q['cooldownTime']))==1
out=dict(baseDamageByRank=ranks('BaseDamage'),movementSecondsByRank=ranks('MovementSpeedDuration'),
 silenceSeconds=scalar('SilenceDuration'),movementSpeedBonus=scalar('MovementSpeedAmount'),
 attackWindowSeconds=scalar('AttackWindow'),totalAttackDamageRatio=scalar('tADRatio'),
 cooldownSeconds=q['cooldownTime'][0],attackReset=True,
 attackCannotCancelWindup=attack['mCantCancelWhileWindingUp'],
 attackCanCastWhileDisabled=attack['canCastWhileDisabled'])
Path('src/content/garen-q.ts').write_text('// Generated from pinned GarenQ named values; full attack state machine remains separate.\nexport const GAREN_Q = '+json.dumps(out,indent=2)+' as const;\n')
print('Exported Garen Q named rank values and attack flags.')
