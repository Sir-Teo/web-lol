"""Check the private Baron profile against frozen character, model and published-rule pins."""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    character = ROOT / 'docs/reference/epic-character-source.json'
    root = json.loads(character.read_text())['records']['data/characters/sru_baron/sru_baron.bin']['Characters/SRU_Baron/CharacterRecords/Root']
    model = json.loads((ROOT / 'public/assets/models/sru-baron-base.json').read_text())
    assert sha(ROOT / 'public/assets/models/sru-baron-base.glb') == model['output']['sha256']
    by_name = {row['name']: row for row in model['clips']}
    rules_path = ROOT / 'docs/reference/baron-rules-source.json'
    rules = json.loads(rules_path.read_text())
    assert rules['mode'] == "Standard Summoner's Rift"
    assert any(row['text'] == 'Minimum level: 11' for row in rules['baseline']['rows'])
    assert any('16,300 + 170 Growth' in row['text'] for row in rules['baseline']['rows'])
    scalar = lambda key: root[key]['baseValue']
    aliases = dict(idle1='entry_6c2b2ee6', run='entry_6c2b2ee6', attack1='entry_5ab94841', death='entry_bd28bd4d', spawn='entry_e4cb0f58')
    result = dict(characterSourceSha256=sha(character), modelSha256=model['output']['sha256'],
        rulesSourceSha256=sha(rules_path), name='Baron Nashor', rig='sru-baron-base', minimumLevel=11,
        baseStats=dict(maxHp=scalar('baseHPModifiable'), damage=scalar('baseDamageModifiable'),
            armor=scalar('baseArmorModifiable'), magicResist=scalar('baseMR'), range=scalar('attackRangeModifiable'),
            speed=scalar('baseMoveSpeedModifiable'), attackSpeed=scalar('attackSpeedModifiable')),
        growth=dict(maxHp=scalar('hpPerLevelModifiable'), damage=scalar('damagePerLevelModifiable'),
            armor=scalar('armorPerLevelModifiable'), magicResist=scalar('mrPerLevel')),
        radius=root['overrideGameplayCollisionRadius'], selectionRadius=root['selectionRadius'],
        castSeconds=root['basicAttack']['mAttackCastTime'],
        clips={key: dict(name=name, durationSeconds=by_name[name]['durationSeconds']) for key, name in aliases.items()},
        policy=dict(stationary=True, rewards='disabled in controlled fixture', leashRadius=1100,
            resetHealthFractionPerSecond=0.2, sightRadius=1100,
            scope='Local stationary basic-combat fixture. Idle substitutes for an unused run alias. Native spells, CC immunity, audio, team rewards, buffs, calendar and timing calibration remain unfinished.'),
        monsterTags=[tag.strip() for tag in root['unitTagsString'].split('|')])
    output = ROOT / 'src/content/baron.json'
    if args.write:
        output.write_text(json.dumps(result, indent=2) + '\n')
    assert result == json.loads(output.read_text()), 'Private Baron source profile differs'
    print(json.dumps(dict(status='passed', profile=str(output.relative_to(ROOT)), sourceRootExact=True, modelExact=True, publishedMinimumLevel=11)))

if __name__ == '__main__':
    main()
