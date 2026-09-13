"""Repackage original BC1/BC3 blocks and mip levels as gzip-wrapped DDS.

No recompression or pixel resampling. TEX stores mip levels smallest first;
DDS stores largest first. Layout follows the pinned LeagueToolkit Texture.cs.
"""
import gzip
import hashlib
import json
import math
from pathlib import Path
import struct
from PIL import Image

root = Path("public/assets/maps")
gltf = json.loads((root / "rift.gltf").read_text())
source_records = json.loads(Path("docs/reference/map-extraction.json").read_text())["files"]
records = {}
for image in gltf["images"] + [{"name": "grasstint_srx"}]:
    name = image["name"]
    candidates = [x for x in source_records if Path(x["path"]).stem == name and x["path"].endswith(".tex")]
    assert len(candidates) == 1, f"Ambiguous texture source: {name}"
    record = candidates[0]
    data = (Path(".cache/map-sources") / record["path"]).read_bytes()
    assert hashlib.sha256(data).hexdigest() == record["sha256"]
    magic, width, height, extended, fmt, resource_type, flags = struct.unpack_from("<4sHHBBBB", data)
    assert magic == b"TEX\0" and fmt in (10, 11, 12) and resource_type == 0 and flags in (0, 1)
    block_size = 16 if fmt == 12 else 8
    fourcc = b"DXT5" if fmt == 12 else b"DXT1"
    count = int(math.log2(max(width, height))) + 1 if flags & 1 else 1
    mips, offset = [], len(data)
    for level in range(count):
        size = max(1, (max(1, width >> level) + 3) // 4) * max(1, (max(1, height >> level) + 3) // 4) * block_size
        offset -= size
        mips.append(data[offset:offset + size])
    assert offset == 12, "Unexpected TEX payload layout"
    fields = [124, 0x81007 | (0x20000 if count > 1 else 0), height, width, len(mips[0]), 0, count]
    fields += [0] * 11
    fields += [32, 4, int.from_bytes(fourcc, "little"), 0, 0, 0, 0, 0]
    fields += [0x1000 | (0x400008 if count > 1 else 0), 0, 0, 0, 0]
    dds = b"DDS " + struct.pack("<31I", *fields) + b"".join(mips)
    assert dds[128:] == b"".join(mips)
    assert b"".join(reversed(mips)) == data[12:], "Original compression blocks changed"
    target = root / "textures" / f"{name}.dds.gz"
    target.parent.mkdir(parents=True, exist_ok=True)
    packed = gzip.compress(dds, compresslevel=9, mtime=0)
    target.write_bytes(packed)
    if name == "grasstint_srx":
        import io
        with Image.open(io.BytesIO(dds)) as im:
            im.save(target.with_name(f"{name}.webp"), "WEBP", lossless=True, exact=True)
    records[name] = {"uri": f"textures/{name}.dds.gz", "width": width, "height": height,
                     "mipLevels": count, "format": fourcc.decode(), "gpuBytes": len(dds) - 128,
                     "source": record["path"], "sourceSha256": record["sha256"],
                     "bytes": len(packed), "sha256": hashlib.sha256(packed).hexdigest()}
(root / "rift-dxt.json").write_text(json.dumps(records, indent=2) + "\n")
print(f"Packed {len(records)} original DXT textures: {sum(x['bytes'] for x in records.values()):,} transfer bytes, {sum(x['gpuBytes'] for x in records.values()):,} GPU bytes")
