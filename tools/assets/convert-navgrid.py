"""Extract the v7.1 navigation fields; retain unknown flags without guessing semantics.

Layout reference: FrankTheBoxMonster/LoL-NGRID-converter,
92943ed2b2d5e82c86d680e69f53f247c89aefee, NGridFileReader.cs.
The hint graph is validated for length but omitted from the runtime payload.
"""
import hashlib
import json
import math
from collections import Counter
from pathlib import Path
import struct

SOURCE = "assets/maps/navgrid/map11/aipath_srx_3.aimesh_ngrid"
data = (Path(".cache/map-sources") / SOURCE).read_bytes()
record = next(x for x in json.loads(Path("docs/reference/map-extraction.json").read_text())["files"] if x["path"] == SOURCE)
assert hashlib.sha256(data).hexdigest() == record["sha256"], "Source hash mismatch"
major, minor, *header = struct.unpack_from("<BH6ffII", data)
assert (major, minor) == (7, 1), "Unsupported navigation version"
minimum, maximum = header[:3], header[3:6]
cell_size, nx, nz = header[6:]
assert 0 < nx < 4096 and 0 < nz < 4096 and cell_size > 0
count = nx * nz
offset = 39
for i in range(count):
    x, z = struct.unpack_from("<hh", data, offset + i * 48 + 20)
    assert (x, z) == (i % nx, i // nx), "Unexpected cell ordering"
offset += count * 48
flags = data[offset:offset + count * 2]
regions = data[offset + count * 2:offset + count * 6]
offset += count * 6 + 1056
hx, hz, spacing_x, spacing_z = struct.unpack_from("<IIff", data, offset)
assert (hx, hz) == (nx * 2 + 1, nz * 2 + 1)
assert spacing_x > 0 and spacing_z > 0
offset += 16
height_bytes = data[offset:offset + hx * hz * 4]
heights = struct.unpack("<" + "f" * (hx * hz), height_bytes)
assert all(math.isfinite(v) for v in heights)
assert len(data) - offset - len(height_bytes) == 900 * (900 * 4 + 4), "Unexpected trailing hint table"
payload = flags + regions + height_bytes
target = Path("public/assets/maps/rift-nav.bin")
target.parent.mkdir(parents=True, exist_ok=True)
target.write_bytes(payload)
metadata = {
    "schema": 1, "source": record, "referenceVersion": "16.18.8175716",
    "format": "Little endian: uint16 flags, 4 uint8 region fields per cell, float32 height samples",
    "minimum": minimum, "maximum": maximum, "cellSize": cell_size,
    "width": nx, "height": nz, "heightWidth": hx, "heightHeight": hz,
    "heightSpacing": [spacing_x, spacing_z],
    "sections": {"flags": [0, len(flags)], "regions": [len(flags), len(regions)],
                 "heights": [len(flags) + len(regions), len(height_bytes)]},
    "heightRange": [min(heights), max(heights)],
    "flagCounts": dict(sorted(Counter(struct.unpack("<" + "H" * count, flags)).items())),
    "limitations": ["Base grid only; terrain overlays require separate application.",
                     "Unknown flag 128 is preserved; its semantics are not assumed.",
                     "Team gates and visibility flags need simulation-specific handling."],
    "output": {"bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest()},
}
target.with_suffix(".json").write_text(json.dumps(metadata, indent=2) + "\n")
print(f"Validated {nx}×{nz} cells, {hx}×{hz} height samples; wrote {len(payload):,} bytes")
