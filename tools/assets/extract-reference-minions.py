"""Extract matching 16.18 minion sources using byte ranges from Riot's public CDN.

Requires the pinned CDTB checkout and Python environment documented in ASSETS.md.
Only the selected WAD header, subchunk table, and minion entries are downloaded.
The full 2.49 GB map archive is never materialized.
"""
import bisect
import hashlib
import json
import re
import struct
import subprocess
from pathlib import Path

from cdtb.patcher import PatcherManifest
from cdtb.tools import zstd_decompress
from cdtb.wad import Wad

MANIFEST_ID = "29CE6E781C3B6368"
BASE = "https://lol.dyn.riotcdn.net/channels/public/"
CACHE = Path(".cache/riot-reference")
OUT = Path(".cache/minion-sources")
CACHE.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
PINNED = json.loads(Path("docs/reference/minion-extraction.json").read_text())


def fetch(url, path, byte_range=None):
    if path.exists():
        return path.read_bytes()
    args = ["curl", "-fLsS", "--retry", "2", "--max-time", "45"]
    if byte_range:
        args += ["--range", f"{byte_range[0]}-{byte_range[1]}"]
    data = subprocess.check_output(args + [url])
    if byte_range and len(data) != byte_range[1] - byte_range[0] + 1:
        raise ValueError("CDN returned an unexpected byte range")
    path.write_bytes(data)
    return data


manifest_path = CACHE / f"{MANIFEST_ID}.manifest"
manifest_bytes = fetch(f"{BASE}releases/{MANIFEST_ID}.manifest", manifest_path)
if hashlib.sha256(manifest_bytes).hexdigest() != PINNED["manifest"]["sha256"]:
    raise ValueError("Manifest differs from pinned reference")
manifest = PatcherManifest(str(manifest_path))
archive = manifest.files["DATA/FINAL/Maps/Shipping/Map11.wad.client"]


class RemoteArchive:
    def __init__(self, file):
        self.file = file
        self.offsets = [0]
        self.position = 0
        self.reads = {}
        for chunk in file.chunks:
            self.offsets.append(self.offsets[-1] + chunk.target_size)
        if self.offsets[-1] != file.size:
            raise ValueError("Manifest chunk lengths do not match WAD length")

    def seek(self, position):
        self.position = position

    def read(self, size):
        start, end = self.position, self.position + size
        self.position = end
        if start < 0 or end > self.file.size:
            raise ValueError("Read outside WAD")
        result = []
        for i in range(bisect.bisect_right(self.offsets, start) - 1, len(self.file.chunks)):
            if self.offsets[i] >= end:
                break
            chunk = self.file.chunks[i]
            url = f"{BASE}bundles/{chunk.bundle.bundle_id:016X}.bundle"
            raw = fetch(url, CACHE / f"{chunk.chunk_id:016X}.chunk",
                        (chunk.offset, chunk.offset + chunk.size - 1))
            expected = PINNED["chunks"].get(f"{chunk.chunk_id:016X}")
            if expected is None or hashlib.sha256(raw).hexdigest() != expected["sha256"]:
                raise ValueError("CDN chunk differs from pinned reference")
            data = zstd_decompress(raw)
            if len(data) != chunk.target_size:
                raise ValueError("Decompressed chunk has wrong length")
            self.reads[f"{chunk.chunk_id:016X}"] = {
                "url": url, "offset": chunk.offset, "bytes": chunk.size,
                "sha256": hashlib.sha256(raw).hexdigest(),
            }
            lo = max(start - self.offsets[i], 0)
            hi = min(end - self.offsets[i], chunk.target_size)
            result.append(data[lo:hi])
        return b"".join(result)


remote = RemoteArchive(archive)
header = remote.read(272)
if header[:4] != b"RW\x03\x04":
    raise ValueError(f"Unexpected WAD format: {header[:4]!r}")
entries = struct.unpack_from("<I", header, 268)[0]
header += remote.read(entries * 32)
header_path = CACHE / "map11-header.wad.client"
header_path.write_bytes(header)
wad = Wad(str(header_path), hashes={})

# The selected path hashes are checked in; no mutable 224 MB hash list is needed.
hashes = {int(value, 16): path for value, path in json.loads(
    Path("docs/reference/minion-wad-paths.json").read_text()
).items()}
wad.resolve_paths(hashes)
toc = next(entry for entry in wad.files if entry.path and entry.path.endswith(".subchunktoc"))
subchunk_toc = toc.read_data(remote)
selected = [entry for entry in wad.files if entry.path and re.match(
    r"assets/characters/sru_(?:order|chaos)minion(?:melee|ranged|siege)/skins/base/", entry.path
) and entry.ext in ("skn", "skl", "anm", "tex", "dds")]
if not selected or sum(entry.size for entry in selected) > 100_000_000:
    raise ValueError("Unexpected extraction selection")
print(f"Extracting {len(selected)} matching files ({sum(e.size for e in selected)/1e6:.2f} MB)", flush=True)
outputs = []
for entry in selected:
    data = entry.read_data(remote, subchunk_toc)
    if data is None or len(data) != entry.size:
        raise ValueError(f"Invalid extraction: {entry.path}")
    expected = next(f for f in PINNED["files"] if f["path"] == entry.path)
    if hashlib.sha256(data).hexdigest() != expected["sha256"]:
        raise ValueError(f"Source differs from pinned reference: {entry.path}")
    target = OUT / entry.path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    outputs.append({"path": entry.path, "wadPathHash": f"{entry.path_hash:016x}",
                    "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)})
    print(entry.path, flush=True)
provenance = {
    "referenceVersion": "16.18.8175716",
    "manifest": {"url": f"{BASE}releases/{MANIFEST_ID}.manifest",
                 "sha256": hashlib.sha256(manifest_bytes).hexdigest()},
    "archive": archive.name, "chunks": remote.reads, "files": outputs,
}
(OUT / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")
print(f"Read {len(remote.reads)} CDN chunks ({sum(c['bytes'] for c in remote.reads.values())/1e6:.2f} MB)")
