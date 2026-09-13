"""Freeze authored spawns, lane splines, barracks, turrets, and minimap art."""
import hashlib
import io
import json
import math
import re
from pathlib import Path
import struct
import subprocess
from PIL import Image

def sha(data):
    return hashlib.sha256(data).hexdigest()

material_path = Path(".cache/map-materials.json")
definition_path = Path(".cache/map11-definition.json")
for path, url, expected in [
    (material_path, "https://raw.communitydragon.org/16.18/game/data/maps/mapgeometry/map11/base_srx.materials.bin.json", "b2ba02f51824f5d2a1a3a6101d0bfa989d37aae1b91a90335cd4cbc6d551505b"),
    (definition_path, "https://raw.communitydragon.org/16.18/game/data/maps/shipping/map11/map11.bin.json", "ad684528be94c3f6981daa2c1ff3e32724596a24e8c4f21ab8df8c291ca980f7"),
]:
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        subprocess.check_call(["curl", "-fLsS", "--max-time", "60", url, "-o", str(path)])
    assert sha(path.read_bytes()) == expected, f"Reference JSON changed: {path}"
materials = json.loads(material_path.read_bytes())
definitions = json.loads(definition_path.read_bytes())
nodes = []
for container, value in materials.items():
    if not isinstance(value, dict) or value.get("__type") != "MapPlaceableContainer":
        continue
    for key, item in value.get("items", {}).items():
        if not isinstance(item, dict):
            continue
        character = item.get("Character", {}).get("CharacterRecord", "")
        if (item.get("name") in ("__Spawn_T1", "__Spawn_T2", "MinionPath_Top", "MinionPath_Mid", "MinionPath_Bot")
            or item.get("__type") == "{ba138ae3}" or any(character.startswith(f"Characters/{kind}/CharacterRecords/") for kind in ["Turret", "Nexus", "Inhibitor"])):
            nodes.append({"container": container, "key": key, **item})

def position(matrix, local=(0, 0, 0)):
    xyz = [matrix[3][axis] + sum(local[i] * matrix[i][axis] for i in range(3)) for axis in range(3)]
    return {"x": xyz[0] - 7425, "y": 7425 - xyz[2]}

spawns = {"blue" if item["name"] == "__Spawn_T1" else "red": position(item["transform"]) for item in nodes if item.get("name", "").startswith("__Spawn")}
lanes = []
for lane_id, suffix in [(2, "Top"), (1, "Mid"), (0, "Bot")]:
    path = next(item for item in nodes if item["name"] == "MinionPath_" + suffix)
    barracks = {}
    for item in nodes:
        config = item.get("{d1ed70fe}", {})
        if config.get("lane") == lane_id:
            barracks["red" if item.get("Team", {}).get("Team") == 200 else "blue"] = position(item["transform"])
    assert len(barracks) == 2
    lanes.append({"name": suffix.lower(), "points": [position(path["transform"], segment) for segment in path["Segments"]], "spawns": barracks})
rules_bytes = Path("docs/reference/structure-rules-source.json").read_bytes()
assert sha(rules_bytes) == "f1768cc3fc00d3b397f36be48ae75d128067a2d6b3ffe25ffa29c3e5c4d50952", "Structure reference changed"
rules = json.loads(rules_bytes)
def stats(character):
    record = rules["records"][character]["record"]
    def value(key, default=0):
        return record.get(key, {}).get("baseValue", default)
    return {"maxHp": value("baseHPModifiable"), "damage": value("baseDamageModifiable"),
            "armor": value("baseArmorModifiable"), "magicResist": value("baseMR"),
            "range": value("attackRangeModifiable"),
            "radius": record.get("overrideGameplayCollisionRadius", record["pathfindingCollisionRadius"]),
            "attackPeriod": round(60 / value("attackSpeedModifiable")) if value("attackSpeedModifiable") else 0}
def structure(character, item):
    record = rules["records"][character]["record"]
    kind = character.split("/")[1].lower()
    role = character.rsplit("/",1)[1].removeprefix("SR_").lower() + "-turret" if kind == "turret" else kind
    lane_id = item.get("AttackableUnit", {}).get("LaneDefinition", {}).get("lane")
    return {"role": role, "lane": ["bot", "mid", "top"][lane_id] if kind != "nexus" and role != "nexus-turret" else None,
            "healthBarHeight": record["healthBarHeight"],
            "regenPerSecond": record.get("baseStaticHPRegenModifiable", {}).get("baseValue", 0) / 5}
base_structures = []
for item in nodes:
    character = item.get("Character", {}).get("CharacterRecord", "")
    if any(character.startswith(f"Characters/{kind}/CharacterRecords/") for kind in ["Nexus", "Inhibitor"]):
        base_structures.append({"kind": character.split("/")[1].lower(),
            "point": position(item["transform"]), "transform": [value for row in item["transform"] for value in row],
            "team": "red" if item.get("Team", {}).get("Team") == 200 else "blue",
            "structure": structure(character,item), "stats": stats(character), "sourceKey":item["key"]})
assert len(base_structures) == 8
turrets = []
for item in nodes:
    character = item.get("Character", {}).get("CharacterRecord", "")
    if character.startswith("Characters/Turret/CharacterRecords/"):
        turrets.append({"point": position(item["transform"]), "stats": stats(character), "structure": structure(character,item), "height": item["transform"][3][1], "transform": [value for row in item["transform"] for value in row],
                        "team": "red" if item.get("Team", {}).get("Team") == 200 else "blue",
                        "tier": character.rsplit("/", 1)[1].removeprefix("SR_"),
                        "lane": item.get("AttackableUnit", {}).get("LaneDefinition", {}).get("lane"),
                        "sourceKey": item["key"], "skin": item["Character"]["Skin"]})
assert len(spawns) == 2 and len(lanes) == 3 and len(turrets) == 22
wave = definitions["{147211fb}"]
super_bytes = Path('docs/reference/super-minion-definitions.json').read_bytes()
super_pin = json.loads(Path('docs/reference/super-minion-extraction.json').read_text())
assert sha(super_bytes) == super_pin['definitionsSha256'], 'Super-minion reference changed'
super_definitions = json.loads(super_bytes)
super_stats = {}
super_templates = {}
for team, barracks_key in [('blue', '{147211fb}'), ('red', '{e61e55a3}')]:
    unit = next(u for u in definitions[barracks_key]['units'] if u['MinionType'] == 7)
    template = definitions[unit['{fee040bc}']]
    super_templates[team] = template
    key = template['Character']['CharacterRecord']
    record = super_definitions[key.split('/')[1].lower()]['character']['data'][key]
    model = json.loads(Path(f'public/assets/models/{team}-super.json').read_text())
    def value(field):
        return record[field]['baseValue']
    super_stats[team] = {
        'maxHp': value('baseHPModifiable'), 'damage': value('baseDamageModifiable'),
        'armor': value('baseArmorModifiable'), 'magicResist': value('baseMR'),
        'speed': value('baseMoveSpeedModifiable'), 'range': value('attackRangeModifiable'),
        'radius': record['overrideGameplayCollisionRadius'],
        'attackPeriod': round(60 / value('attackSpeedModifiable')),
        'windupTicks': round(60 * record['basicAttack']['mAttackCastTime']),
        'missileSpeed': 0, 'experienceBounty': record['expGivenOnDeath'],
        # 26.1 notes specify 50 initial gold. The raw CharacterRecord stores 49;
        # initialization/upgrades are separate from that base record.
        'goldBounty': 50,
        'corpseLifetimeTicks': max(240, math.ceil(60 * (0.2 + max(
            clip['durationSeconds'] for clip in model['clips'] if clip['name'].startswith('death')
        )))),
    }
lane_bytes = Path('docs/reference/lane-minion-records.json').read_bytes()
assert sha(lane_bytes) == 'e50d477e691cec02382257e67d9b501faf94a2f6f6e1be4faf000dd267f28447'
lane_records = json.loads(lane_bytes)
on_hit_bytes = Path('docs/reference/minion-on-hit-items.json').read_bytes()
assert sha(on_hit_bytes) == 'ece4a0861336267041e4760b451069007ae9456ae127614aed24ff0abc85d87a'
on_hit_items = json.loads(on_hit_bytes)['sources'][0]['records']
item_tooltips = json.loads(on_hit_bytes)['sources'][1]['records']
turret_roles = ['outer-turret', 'inner-turret', 'inhibitor-turret', 'nexus-turret']
turret_minion_health_damage = {}
for kind, item in [('melee', 1509), ('caster', 1510), ('siege', 1508), ('super', 1511)]:
    tooltip = item_tooltips[f'game_item_tooltip_{item}']
    if kind == 'siege':
        match = re.search(r'take (\d+)% of their health per outer turret shot, (\d+)% of their health per inner turret shot and (\d+)% of their health per base turret shot', tooltip)
        assert match, 'Siege turret tooltip changed'
        outer, inner, base = [int(value) / 100 for value in match.groups()]
        ratios = [outer, inner, base, base]
    else:
        match = re.search(r'takes (\d+)% of its health per turret shot', tooltip)
        assert match, f'{kind} turret tooltip changed'
        ratios = [int(match.group(1)) / 100] * 4
    turret_minion_health_damage[kind] = dict(zip(turret_roles, ratios))
siege_mid_turret_attack_speed_bonus, = [value['mValue'] for value in on_hit_items['Items/1508']['mDataValues']
                                       if value['mName'] == 'MidLaneAttackSpeedBonus']
minion_current_health_damage = {}
override_bytes = Path('docs/reference/lane-rule-overrides.json').read_bytes()
overrides = json.loads(override_bytes)
unit_stats = {'super': super_stats}
unit_health_growth = {'melee': {}}
unit_gold_growth = {'siege': {}, 'super': {}}
# FNV-1a names resolve the two fields in the pinned Barracks MinionUpgradeConfig.
def field_hash(name):
    value = 2166136261
    for byte in name.lower().encode():
        value = ((value ^ byte) * 16777619) & 0xffffffff
    return '{' + f'{value:08x}' + '}'
assert field_hash('GoldUpgrade') == '{726ae049}'
assert field_hash('GoldMax') == '{db0e9d5b}'
lane_templates = {}
for team, barracks_key in [('blue', '{147211fb}'), ('red', '{e61e55a3}')]:
    lane_templates[team] = {}
    for minion in definitions[barracks_key]['units']:
        if minion['MinionType'] in (6, 7):
            gold_kind = 'siege' if minion['MinionType'] == 6 else 'super'
            upgrade = minion['MinionUpgradeStats']
            # Red super omits GoldUpgrade; official 26.1 notes specify +1 for both kinds.
            increment = upgrade.get(field_hash('GoldUpgrade'), overrides['siegeSuperGoldIncrement'])
            assert increment == overrides['siegeSuperGoldIncrement']
            unit_gold_growth[gold_kind][team] = {
                'intervalSeconds': definitions[barracks_key]['UpgradeIntervalSecs'],
                'increment': increment, 'maxTotal': upgrade[field_hash('GoldMax')],
            }
        if minion['MinionType'] == 7:
            continue
        kind = {4: 'melee', 5: 'caster', 6: 'siege'}[minion['MinionType']]
        template = definitions[minion['{fee040bc}']]
        key = template['Character']['CharacterRecord']
        assert key.endswith('/CharacterRecords/Root')
        record = lane_records[key.split('/')[1]]['record']
        lane_templates[team][kind] = template
        item_key, = record['mClientSideItemInventory']
        ratio, = [value['mValue'] for value in on_hit_items[item_key]['mDataValues']
                  if value['mName'] == 'MinionCurrentHealthDamage']
        minion_current_health_damage.setdefault(kind, {})[team] = ratio
        unit_stats.setdefault(kind, {})[team] = {
            'speed': record['baseMoveSpeedModifiable']['baseValue'],
            'goldBounty': overrides['initialSiegeGold'] if kind == 'siege' else record['goldGivenOnDeath'],
            'experienceBounty': record['expGivenOnDeath'],
        }
        if kind == 'melee':
            unit_stats[kind][team]['maxHp'] = record['baseHPModifiable']['baseValue']
            upgrade = minion['MinionUpgradeStats']
            unit_health_growth[kind][team] = {
                'intervalSeconds': definitions[barracks_key]['UpgradeIntervalSecs'],
                'increment': upgrade['HPUpgrade'], 'maxBonus': upgrade['HpMaxBonus'],
            }
layout = {"schema": 1, "referenceVersion": "16.18.8175716", "half": 7425, "spawns": spawns,
          "lanes": lanes, "turrets": turrets, "structures": base_structures,
          "unitStats": unit_stats, "unitHealthGrowth": unit_health_growth, "unitGoldGrowth": unit_gold_growth, "minionTurretDamage": overrides["minionTurretDamage"],
          "minionCurrentHealthDamage": minion_current_health_damage,
          "siegeMidTurretAttackSpeedBonus": siege_mid_turret_attack_speed_bonus,
          "turretMinionHealthDamage": turret_minion_health_damage,
          "minionExperienceRadius": {team: definitions[key]['ExpRadius'] for team, key in [('blue', '{147211fb}'), ('red', '{e61e55a3}')]},
          "waves": {"initialSeconds": wave["InitialSpawnTimeSecs"], "intervalSeconds": wave["WaveSpawnIntervalSecs"],
                    "unitIntervalSeconds": wave["MinionSpawnIntervalSecs"],
                    "intervalChanges": overrides['waveIntervals'],
                    "moveSpeed": {"startSeconds": wave['MoveSpeedIncreaseInitialDelaySecs'],
                                  "intervalSeconds": wave['MoveSpeedIncreaseIntervalSecs'],
                                  "increment": wave['MoveSpeedIncreaseIncrement'],
                                  "maxUpgrades": wave['MoveSpeedIncreaseMaxTimes']},
                    "types": [{"kind": {4: "melee", 5: "caster", 6: "siege", 7: "super"}[item["MinionType"]], "behavior": item["WaveBehavior"]}
                              for item in wave["units"] if item["MinionType"] in (4, 5, 6, 7)]}}

minimap_source = "assets/maps/info/map11/2dlevelminimap_base_baron1.tex"
minimap_record = next(item for item in json.loads(Path("docs/reference/map-extraction.json").read_text())["files"] if item["path"] == minimap_source)
data = (Path(".cache/map-sources") / minimap_source).read_bytes()
assert sha(data) == minimap_record["sha256"]
magic, width, height, _, fmt, _, _ = struct.unpack_from("<4sHHBBBB", data)
assert magic == b"TEX\0" and fmt in (10, 12)
size = ((width + 3) // 4) * ((height + 3) // 4) * (8 if fmt == 10 else 16)
fourcc = int.from_bytes(b"DXT1" if fmt == 10 else b"DXT5", "little")
header = [124, 0x81007, height, width, size, 0, 1] + [0] * 11 + [32, 4, fourcc, 0, 0, 0, 0, 0] + [0x1000, 0, 0, 0, 0]
dds = b"DDS " + struct.pack("<31I", *header) + data[-size:]
output = Path("public/assets/maps")
with Image.open(io.BytesIO(dds)) as image:
    image.save(output / "rift-minimap.webp", "WEBP", lossless=True, exact=True)
(output / "rift-layout.json").write_text(json.dumps(layout, indent=2) + "\n")
provenance = {"sources": [
    {"url": "https://raw.communitydragon.org/16.18/game/data/maps/mapgeometry/map11/base_srx.materials.bin.json", "sha256": sha(material_path.read_bytes())},
    {"url": "https://raw.communitydragon.org/16.18/game/data/maps/shipping/map11/map11.bin.json", "sha256": sha(definition_path.read_bytes())}],
    "structureRulesSha256": sha(rules_bytes), "superMinionDefinitionsSha256": sha(super_bytes),
    "superMinionTemplates": super_templates,
    "laneMinionRecordsSha256": sha(lane_bytes), "laneRuleOverridesSha256": sha(override_bytes),
    "minionOnHitItemsSha256": sha(on_hit_bytes),
    "laneMinionTemplates": lane_templates,
    "objects": nodes, "barracksConfigs": {key: definitions[key] for key in ["{147211fb}", "{e61e55a3}"]},
    "minimapSource": minimap_record,
    "outputs": [{"path": f"public/assets/maps/{name}", "sha256": sha((output / name).read_bytes())} for name in ["rift-layout.json", "rift-minimap.webp"]]}
Path("docs/reference/rift-layout-source.json").write_text(json.dumps(provenance, indent=2) + "\n")
print("Exported 2 spawns, 3 lane routes, 6 barracks, 22 turrets, 8 base structures, wave configuration, and minimap")
