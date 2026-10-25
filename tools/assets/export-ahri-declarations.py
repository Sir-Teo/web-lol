"""Project retained Ahri declarations offline; no runtime rules are generated.

--check compares exact output bytes without writing. Existing differing output
is never overwritten. All guards remain active under Python optimization.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/reference/ahri'
PINS = {
    'character.json': 'aa7ec5f710aa818c2ecc98a516bb1542bb52261c7ce89649ef0b2b8e8cc5ec5e',
    'character.bin': '121997c9c4ef2ff0f671b659d64d2e22cb71208216ddcc3c4f552a17f196d2cb',
    'names.json': '770a7e5b7bdaf1d1de42b7d33a09912a8e56a3244bb0ab2b5d00d94e8b0013a2',
    'ddragon-16.18.1.json': '81d9f3d8e34d14e6d916af330c0e624aa0e7fabb12d8b900429c076fc56a7364',
}
MODEL_SHA = '74d0b55f5aad08646fbd24f660ed533bc8fd5798e8a60dc0983d97960b47a377'
ROOT_RECORD = 'Characters/Ahri/CharacterRecords/Root'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def fnv(value):
    result = 2166136261
    for byte in value.lower().encode('ascii'):
        result = ((result ^ byte) * 16777619) & 0xffffffff
    return result


def load(source=SOURCE):
    for name, digest in PINS.items():
        require(hashlib.sha256((source / name).read_bytes()).hexdigest() == digest,
                f'Frozen source changed: {name}')
    pin = json.loads((source / 'character.json').read_text())
    records = pin['records']
    require(records == json.loads((source / 'names.json').read_text()), 'Naming export differs')
    require(len(records) == 65 and records['__linked'] == [], 'Expected 64 records and __linked')
    require(pin['sha256'] == PINS['names.json'], 'Naming provenance differs')
    require(pin['url'] == 'https://raw.communitydragon.org/16.18/game/data/characters/ahri/ahri.bin.json',
            'Naming URL differs')
    require(pin['extraction']['referenceVersion'] == '16.18.8175716', 'Unexpected archive cohort')
    require(pin['extraction']['files'] == [{
        'path': 'data/characters/ahri/ahri.bin', 'wadPathHash': 'a847c7a46bc6730e',
        'sha256': PINS['character.bin'], 'bytes': 30475,
    }], 'Archive provenance differs')
    model_bytes = (ROOT / 'docs/reference/ahri-model.json').read_bytes()
    require(hashlib.sha256(model_bytes).hexdigest() == MODEL_SHA, 'Frozen model reference changed')
    model = json.loads(model_bytes)
    for field in ['referenceVersion', 'manifest', 'archive']:
        require(pin['extraction'][field] == model['extraction'][field], f'Model cohort differs: {field}')
    dd = json.loads((source / 'ddragon-16.18.1.json').read_text())
    require(dd['version'] == '16.18.1', 'Unexpected Data Dragon version')
    return pin, dd['data']['Ahri']


def finite(value):
    require(type(value) in (int, float) and math.isfinite(value), 'Nonfinite declaration')
    return value


def calculation_links(calculations, values):
    links = []

    def walk(value, path):
        if isinstance(value, dict):
            for key, child in value.items():
                if key == 'mDataValue':
                    matches = [name for name in values if fnv(name) == fnv(child)]
                    require(len(matches) == 1, f'Ambiguous or missing data-value link: {child}')
                    links.append(dict(path=path + [key], spelling=child,
                                      dataValue=matches[0], lowercaseFNV=f'{fnv(child):08x}'))
                else:
                    walk(child, path + [key])
        elif isinstance(value, list):
            for index, child in enumerate(value):
                walk(child, path + [index])

    walk(calculations, [])
    return links


def project(pin, dd):
    records, stats = pin['records'], []
    root = records[ROOT_RECORD]
    fields = {
        'hp': ('baseHPModifiable', 'hp', 1),
        'hpGrowth': ('hpPerLevelModifiable', 'hpperlevel', 1),
        'damage': ('baseDamageModifiable', 'attackdamage', 1),
        'damageGrowth': ('damagePerLevelModifiable', 'attackdamageperlevel', 1),
        'armor': ('baseArmorModifiable', 'armor', 1),
        'armorGrowth': ('armorPerLevelModifiable', 'armorperlevel', 1),
        'magicResist': ('baseMR', 'spellblock', 1),
        'magicResistGrowth': ('mrPerLevel', 'spellblockperlevel', 1),
        'attackSpeed': ('attackSpeedModifiable', 'attackspeed', 1),
        'attackSpeedGrowth': ('attackSpeedPerLevelModifiable', 'attackspeedperlevel', 1),
        'healthRegen': ('baseStaticHPRegenModifiable', 'hpregen', 5),
        'healthRegenGrowth': ('hpRegenPerLevelModifiable', 'hpregenperlevel', 5),
        'speed': ('baseMoveSpeedModifiable', 'movespeed', 1),
        'range': ('attackRangeModifiable', 'attackrange', 1),
    }

    def stat(name, field, dd_field, factor, value):
        value, external = finite(value), finite(dd['stats'][dd_field])
        stats.append(dict(name=name, field=field, sourceValue=value,
                          dataDragonField=dd_field, dataDragonValue=external,
                          sourceToDataDragonFactor=factor,
                          agreesWithinFloat32Tolerance=abs(value * factor - external) <= 1e-6))

    for name, (field, dd_field, factor) in fields.items():
        stat(name, field + '.baseValue', dd_field, factor, root[field]['baseValue'])
    for name, field, dd_field, factor in [
        ('mana', '{726ee5cd}', 'mp', 1), ('manaGrowth', '{6216bf7b}', 'mpperlevel', 1),
        ('manaRegen', '{c4ab3550}', 'mpregen', 5),
        ('manaRegenGrowth', '{3a509002}', 'mpregenperlevel', 5),
    ]:
        stat(name, f'primaryAbilityResource.{field}.baseValue', dd_field, factor,
             root['primaryAbilityResource'][field]['baseValue'])
    require([s['name'] for s in stats if not s['agreesWithinFloat32Tolerance']] == ['damageGrowth'],
            'Stat disagreements changed')
    require(root['damagePerLevelModifiable']['baseValue'] == 3
            and dd['stats']['attackdamageperlevel'] == 0, 'Expected AD-growth conflict changed')
    spells = []
    for index, spell_id in enumerate(['AhriQ', 'AhriW', 'AhriE', 'AhriR']):
        record = f'Characters/Ahri/Spells/{spell_id}Ability/{spell_id}'
        spell, external = records[record]['mSpell'], dd['spells'][index]
        ranks = spell['mClientData']['mTooltipData']['mLists']['LevelUp']['levelCount']
        require(external['id'] == spell_id and ranks == external['maxrank'] == (3 if index == 3 else 5),
                f'Rank identity differs: {spell_id}')
        arrays = dict(cooldownSecondsByRank=spell['cooldownTime'][1:ranks + 1],
                      manaByRank=spell['mana'][:ranks],
                      displayRangeByRank=spell['castRangeDisplayOverride'][:ranks])
        for key, external_key in [('cooldownSecondsByRank', 'cooldown'), ('manaByRank', 'cost'),
                                  ('displayRangeByRank', 'range')]:
            require(arrays[key] == external[external_key], f'Rank array differs: {spell_id}.{key}')
        named = {value['name']: value['values'] for value in spell['DataValues']}
        require(len(named) == len(spell['DataValues']), 'Duplicate named data value')
        values = []
        for name, raw in named.items():
            require(len(raw) >= ranks + 1, f'Short named rank array: {spell_id}.{name}')
            for value in raw:
                finite(value)
            values.append(dict(name=name, raw=raw, rankValues=raw[1:ranks + 1]))
        spells.append(dict(id=spell_id, record=record, maxRanks=ranks, **arrays,
                           dataValues=values, calculationLinks=calculation_links(
                               spell.get('mSpellCalculations', {}), named),
                           declaration=spell))
    return dict(
        scope='Source declarations only; no runtime kit or gameplay policy is generated.',
        inputs=[dict(file=name, bytes=(SOURCE / name).stat().st_size, sha256=digest)
                for name, digest in PINS.items()],
        modelReference=dict(file='docs/reference/ahri-model.json', sha256=MODEL_SHA),
        extraction=pin['extraction'], sourceRecordCount=64,
        normalization='Cooldown/DataValues slots 1..N; mana/display slots 0..N-1. '
                      'Rank counts and public arrays match Data Dragon exactly. '
                      'All raw spell fields and floats are retained; no rounding or default injection.',
        stats=stats, character=dict(record=ROOT_RECORD, declaration=root), spells=spells,
        missiles={key: value['mSpell'] for key, value in records.items()
                  if isinstance(value, dict) and value.get('mSpell', {}).get('mMissileSpec')},
        passive={key: value for key, value in records.items()
                 if key.startswith('Characters/Ahri/Spells/AhriPassiveAbility')},
        conflicts=[dict(field='damageGrowth', archive=3, dataDragon=0, resolution='Unresolved'),
                   dict(field='Q damage declarations',
                        root='Named BaseDamage and TotalDamage coefficient 0.5',
                        children='Different legacy effect arrays and coefficients 0.4/0.6',
                        resolution='No damage caller or leg category established; preserve all fields'),
                   dict(field='R distance', display=450, namedDashDistance=500,
                        resolution='Distinct declarations; no terrain or endpoint policy inferred')],
        acceptance=dict(playable=False, productionRosterExpanded=False,
                        nativeBehaviorVerified=False, runtimePolicyGenerated=False))


def generate(source=SOURCE):
    pin, dd = load(source)
    return (json.dumps(project(pin, dd), indent=2, ensure_ascii=True, allow_nan=False) + '\n').encode()


def publish(content, output, check=False):
    if output.exists():
        require(output.read_bytes() == content, 'Generated output differs; refusing overwrite')
    else:
        require(not check, 'Generated output is missing')
        with output.open('xb') as handle:
            handle.write(content)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    publish(generate(), SOURCE / 'declarations.json', args.check)
    print('Verified Ahri declarations: 64 records, 18 stat comparisons, four spell rank tables; '
          'AD growth unresolved, no runtime kit generated.')
