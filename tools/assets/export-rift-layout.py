"""Freeze authored spawns, lane splines, barracks, turrets, and minimap art."""
import hashlib
import io
import json
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
            or item.get("__type") == "{ba138ae3}" or character.startswith("Characters/Turret/CharacterRecords/")):
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
turrets = []
for item in nodes:
    character = item.get("Character", {}).get("CharacterRecord", "")
    if character.startswith("Characters/Turret/CharacterRecords/"):
        turrets.append({"point": position(item["transform"]), "height": item["transform"][3][1],
                        "team": "red" if item.get("Team", {}).get("Team") == 200 else "blue",
                        "tier": character.rsplit("/", 1)[1].removeprefix("SR_"),
                        "lane": item.get("AttackableUnit", {}).get("LaneDefinition", {}).get("lane"),
                        "sourceKey": item["key"], "skin": item["Character"]["Skin"]})
assert len(spawns) == 2 and len(lanes) == 3 and len(turrets) == 22
wave = definitions["{147211fb}"]
layout = {"schema": 1, "referenceVersion": "16.18.8175716", "half": 7425, "spawns": spawns,
          "lanes": lanes, "turrets": turrets,
          "waves": {"initialSeconds": wave["InitialSpawnTimeSecs"], "intervalSeconds": wave["WaveSpawnIntervalSecs"],
                    "unitIntervalSeconds": wave["MinionSpawnIntervalSecs"],
                    "types": [{"kind": {4: "melee", 5: "caster", 6: "siege"}[item["MinionType"]], "behavior": item["WaveBehavior"]}
                              for item in wave["units"] if item["MinionType"] in (4, 5, 6)]}}

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
    "objects": nodes, "barracksConfigs": {key: definitions[key] for key in ["{147211fb}", "{e61e55a3}"]},
    "minimapSource": minimap_record,
    "outputs": [{"path": f"public/assets/maps/{name}", "sha256": sha((output / name).read_bytes())} for name in ["rift-layout.json", "rift-minimap.webp"]]}
Path("docs/reference/rift-layout-source.json").write_text(json.dumps(provenance, indent=2) + "\n")
print("Exported 2 spawns, 3 lane routes, 6 barracks, 22 turrets, wave configuration, and minimap")
