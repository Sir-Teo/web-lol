"""Project retained MasterYi declarations offline; no runtime rules are generated.

--check compares exact output bytes without writing. Existing differing output
is never overwritten. All guards remain active under Python optimization.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/reference/masteryi'
PINS = {
    'character.json': '3f100c1148e1006766060822298c87aed02e86e359c385fbc2c248e4255d12fa',
    'character.bin': 'a4e05e2f6eee68116478fd56893ee320ac4955645d45e887860c88e67e4547f1',
    'names.json': '8bbd5b957d668f668ca4f99e1484d7e9e1faa7ffa108f853e6975ef2d22daf06',
    'ddragon-16.18.1.json': '3033f20c6b3ca69c0d56cdd55231e93971c7123e1a56dc8611bb7367b95a974a',
}
ROOT_RECORD = 'Characters/MasterYi/CharacterRecords/Root'


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
    require(len(records) == 61 and records['__linked'] == [], 'Expected 60 records and __linked')
    require(pin['sha256'] == PINS['names.json'], 'Naming provenance differs')
    require(pin['url'] == 'https://raw.communitydragon.org/16.18/game/data/characters/masteryi/masteryi.bin.json',
            'Naming URL differs')
    require(pin['extraction']['referenceVersion'] == '16.18.8175716', 'Unexpected archive cohort')
    require(pin['extraction']['files'] == [{
        'path': 'data/characters/masteryi/masteryi.bin', 'wadPathHash': 'c9cfa6948a4079ef',
        'sha256': PINS['character.bin'], 'bytes': 27930,
    }], 'Archive provenance differs')
    require(pin['extraction']['manifest'] == {
        'url': 'https://lol.dyn.riotcdn.net/channels/public/releases/29CE6E781C3B6368.manifest',
        'sha256': '564984ff169e7554607cae96d3cdca7812dfc5978736e889f347def39142a0cb',
    }, 'Unexpected manifest cohort')
    require(pin['extraction']['archive'] == 'DATA/FINAL/Champions/MasterYi.wad.client',
            'Unexpected archive')
    dd = json.loads((source / 'ddragon-16.18.1.json').read_text())
    require(dd['version'] == '16.18.1', 'Unexpected Data Dragon version')
    return pin, dd['data']['MasterYi']


def finite(value):
    require(type(value) in (int, float) and math.isfinite(value), 'Nonfinite declaration')
    return value


def reference_hash(value):
    if value.startswith('{') and value.endswith('}') and len(value) == 10:
        return int(value[1:-1], 16)
    return fnv(value)


def calculation_links(calculations, values):
    links = []

    def walk(value, path):
        if isinstance(value, dict):
            for key, child in value.items():
                if key in ['mDataValue', 'mModifiedGameCalculation']:
                    candidates = values if key == 'mDataValue' else calculations
                    matches = [name for name in candidates
                               if reference_hash(name) == reference_hash(child)]
                    require(len(matches) == 1,
                            f'Ambiguous or missing calculation link: {child}')
                    links.append(dict(path=path + [key], spelling=child,
                                      kind='namedDataValue' if key == 'mDataValue' else 'calculation',
                                      target=matches[0], lowercaseFNV=f'{reference_hash(child):08x}'))
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
    require(root['damagePerLevelModifiable']['baseValue'] == 2.5
            and dd['stats']['attackdamageperlevel'] == 0, 'Expected AD-growth conflict changed')
    require(root['spells'] == [f'Characters/MasterYi/Spells/{name}Ability/{name}'
                              for name in ['AlphaStrike', 'Meditate', 'WujuStyle', 'Highlander']],
            'Character spell bindings changed')
    reposition = '{6ae04a15}'
    require(records[reposition]['ObjectName'] == 'MasterYi_Q_Reposition'
            and reposition not in records['Characters/MasterYi/Spells/AlphaStrikeAbility']['mChildSpells']
            and reposition not in root['extraSpellsList'], 'Reposition relation changed')
    require('mSpellCalculations' not in records[root['spells'][3]]['mSpell'],
            'Highlander calculation omission changed')
    spells = []
    for index, spell_id in enumerate(['AlphaStrike', 'Meditate', 'WujuStyle', 'Highlander']):
        record = f'Characters/MasterYi/Spells/{spell_id}Ability/{spell_id}'
        spell, external = records[record]['mSpell'], dd['spells'][index]
        ranks = spell['mClientData']['mTooltipData']['mLists']['LevelUp']['levelCount']
        require(external['id'] == spell_id and ranks == external['maxrank'] == (3 if index == 3 else 5),
                f'Rank identity differs: {spell_id}')
        arrays = {}
        for field, external_key, start in [('cooldownTime', 'cooldown', 1),
                                            ('mana', 'cost', 0), ('castRange', 'range', 0)]:
            present = field in spell
            expected_omission = (spell_id, field) in [('Meditate', 'cooldownTime'),
                                                     ('WujuStyle', 'mana')]
            require(present != expected_omission, f'Rank field presence changed: {spell_id}.{field}')
            if expected_omission:
                expected_client = [10] * ranks if spell_id == 'Meditate' else [0] * ranks
                require(external[external_key] == expected_client,
                        f'Client value for omitted field changed: {spell_id}.{field}')
            raw = spell.get(field)
            normalized = raw[start:start + ranks] if present else None
            if present:
                require(len(normalized) == ranks, f'Short rank array: {spell_id}.{field}')
                for value in raw:
                    finite(value)
                require(normalized == external[external_key],
                        f'Rank array differs: {spell_id}.{field}')
            arrays[field] = dict(present=present, raw=raw, rankValues=normalized,
                                 dataDragonField=external_key, dataDragonValues=external[external_key],
                                 agreesWithinExactNumericComparison=True if present else None,
                                 absencePolicy='No default inferred' if not present else None)
        require('castRangeDisplayOverride' not in spell,
                f'Display override presence changed: {spell_id}')
        named = {value['name']: value['values'] for value in spell['DataValues']}
        require(len(named) == len(spell['DataValues']), 'Duplicate named data value')
        values = []
        for name, raw in named.items():
            require(len(raw) >= ranks + 1, f'Short named rank array: {spell_id}.{name}')
            for value in raw:
                finite(value)
            values.append(dict(name=name, raw=raw, rankValues=raw[1:ranks + 1]))
        spells.append(dict(id=spell_id, record=record, maxRanks=ranks, rankArrays=arrays,
                           dataValues=values, calculationLinks=calculation_links(
                               spell.get('mSpellCalculations', {}), named),
                           declaration=spell))
    return dict(
        scope='Source declarations only; no runtime kit or gameplay policy is generated.',
        inputs=[dict(file=name, bytes=(SOURCE / name).stat().st_size, sha256=digest)
                for name, digest in PINS.items()],
        extraction=pin['extraction'], sourceRecordCount=60,
        normalization='Cooldown/DataValues slots 1..N; mana/castRange slots 0..N-1. '
                      'Present rank arrays match Data Dragon exactly. Omitted fields stay absent, '
                      'with null derived arrays; public values are retained separately. '
                      'All raw spell fields and floats are retained; no rounding or default injection.',
        stats=stats, character=dict(record=ROOT_RECORD, declaration=root), spells=spells,
        missiles={key: value['mSpell'] for key, value in records.items()
                  if isinstance(value, dict) and value.get('mSpell', {}).get('mMissileSpec')},
        passive={key: value for key, value in records.items()
                 if key.startswith('Characters/MasterYi/Spells/MasterYiPassiveAbility')},
        abilities={key: value for key, value in records.items()
                   if isinstance(value, dict) and value.get('__type') == 'AbilityObject'},
        unboundReposition=dict(record='{6ae04a15}', declaration=records['{6ae04a15}'],
                               relation='Not in Alpha Strike child bindings or root extraSpellsList; '
                                        'native invocation is unverified. Permissions are not inherited.'),
        conflicts=[dict(field='damageGrowth', archive=2.5, dataDragon=0, resolution='Unresolved'),
                   dict(field='Meditate cooldownTime', archive='Omitted', dataDragon=[10]*5,
                        resolution='No BIN default inferred from absence'),
                   dict(field='WujuStyle mana', archive='Omitted', dataDragon=[0]*5,
                        resolution='No BIN default inferred from absence'),
                   dict(field='Highlander mSpellCalculations', archive='Omitted',
                        resolution='Do not fabricate a formula table from named values')],
        acceptance=dict(playable=False, productionRosterExpanded=False, fullKit=False,
                        modelAccepted=False, nativeBehaviorVerified=False, runtimePolicyGenerated=False))


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
    print('Verified MasterYi declarations: 60 records, 18 stat comparisons, four spell rank tables; omissions retained, '
          'AD growth unresolved, no runtime kit generated.')
