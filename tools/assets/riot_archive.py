"""Selective reader for the pinned Riot patch manifest and Map11 archive."""
import bisect
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import struct
import subprocess

from cdtb.patcher import PatcherManifest
from cdtb.tools import zstd_decompress
from cdtb.wad import Wad

BASE = "https://lol.dyn.riotcdn.net/channels/public/"
MANIFEST_ID = "29CE6E781C3B6368"
CACHE = Path(".cache/riot-reference")


def sha(data):
    return hashlib.sha256(data).hexdigest()


def download_range(url, start, end):
    data = subprocess.check_output([
        "curl", "-fLsS", "--retry", "2", "--max-time", "60", "--range", f"{start}-{end}", url
    ])
    if len(data) != end - start + 1:
        raise ValueError("CDN did not return the requested range")
    return data


class RiotArchive:
    def __init__(self, paths, pinned=None):
        CACHE.mkdir(parents=True, exist_ok=True)
        self.pinned = pinned
        manifest_path = CACHE / f"{MANIFEST_ID}.manifest"
        manifest_url = f"{BASE}releases/{MANIFEST_ID}.manifest"
        if not manifest_path.exists():
            subprocess.check_call(["curl", "-fLsS", "--max-time", "45", manifest_url, "-o", str(manifest_path)])
        self.manifest = {"url": manifest_url, "sha256": sha(manifest_path.read_bytes())}
        reference = json.loads(Path("docs/reference/minion-extraction.json").read_text())
        if self.manifest != reference["manifest"]:
            raise ValueError("Patch manifest changed")
        self.file = PatcherManifest(str(manifest_path)).files["DATA/FINAL/Maps/Shipping/Map11.wad.client"]
        self.offsets = [0]
        for chunk in self.file.chunks:
            self.offsets.append(self.offsets[-1] + chunk.target_size)
        assert self.offsets[-1] == self.file.size
        self.position = 0
        self.reads = {}
        self.outputs = []
        header = self.read_at(0, 272)
        if header[:4] != b"RW\x03\x04":
            raise ValueError("Unexpected WAD version")
        count = struct.unpack_from("<I", header, 268)[0]
        header += self.read_at(272, count * 32)
        path = CACHE / "map11-header.wad.client"
        path.write_bytes(header)
        self.wad = Wad(str(path), hashes={})
        self.wad.resolve_paths({int(h, 16): p for h, p in paths.items()})
        self.entries = {e.path: e for e in self.wad.files if e.path}
        toc = next(e for e in self.wad.files if e.path and e.path.endswith(".subchunktoc"))
        self.toc = toc.read_data(self)

    def chunks_for(self, offset, size):
        end = offset + size
        if offset < 0 or end > self.file.size:
            raise ValueError("Read outside archive")
        i = bisect.bisect_right(self.offsets, offset) - 1
        while i < len(self.file.chunks) and self.offsets[i] < end:
            yield i, self.file.chunks[i]
            i += 1

    def prefetch(self, ranges):
        needed = {}
        for offset, size in ranges:
            for _, chunk in self.chunks_for(offset, size):
                if not (CACHE / f"{chunk.chunk_id:016X}.chunk").exists():
                    needed[chunk.chunk_id] = chunk
        groups = []
        for chunk in sorted(needed.values(), key=lambda c: (c.bundle.bundle_id, c.offset)):
            if groups:
                last = groups[-1]
                if (last[0].bundle.bundle_id == chunk.bundle.bundle_id and
                    chunk.offset - (last[-1].offset + last[-1].size) <= 16384 and
                    chunk.offset + chunk.size - last[0].offset <= 8 * 1024 * 1024):
                    last.append(chunk)
                    continue
            groups.append([chunk])

        def fetch(group):
            first, last = group[0], group[-1]
            url = f"{BASE}bundles/{first.bundle.bundle_id:016X}.bundle"
            data = download_range(url, first.offset, last.offset + last.size - 1)
            for chunk in group:
                local = chunk.offset - first.offset
                raw = data[local:local + chunk.size]
                self.verify_chunk(chunk, raw)
                (CACHE / f"{chunk.chunk_id:016X}.chunk").write_bytes(raw)
        with ThreadPoolExecutor(max_workers=6) as pool:
            list(pool.map(fetch, groups))

    def verify_chunk(self, chunk, data):
        if len(data) != chunk.size:
            raise ValueError("Truncated cached chunk")
        if self.pinned:
            expected = self.pinned["chunks"].get(f"{chunk.chunk_id:016X}")
            if not expected or sha(data) != expected["sha256"]:
                raise ValueError("Patch chunk differs from provenance")

    def read_at(self, start, size):
        self.prefetch([(start, size)])
        end = start + size
        result = []
        for i, chunk in self.chunks_for(start, size):
            raw = (CACHE / f"{chunk.chunk_id:016X}.chunk").read_bytes()
            self.verify_chunk(chunk, raw)
            data = zstd_decompress(raw)
            if len(data) != chunk.target_size:
                raise ValueError("Wrong decompressed chunk length")
            self.reads[f"{chunk.chunk_id:016X}"] = {
                "url": f"{BASE}bundles/{chunk.bundle.bundle_id:016X}.bundle",
                "offset": chunk.offset, "bytes": chunk.size, "sha256": sha(raw),
            }
            result.append(data[max(0, start - self.offsets[i]):min(chunk.target_size, end - self.offsets[i])])
        return b"".join(result)

    def seek(self, position):
        self.position = position

    def read(self, size):
        data = self.read_at(self.position, size)
        self.position += size
        return data

    def extract(self, paths, output):
        selected = [self.entries[path.lower()] for path in paths]
        self.prefetch([(e.offset, e.compressed_size) for e in selected])
        for entry in selected:
            data = entry.read_data(self, self.toc)
            if data is None or len(data) != entry.size:
                raise ValueError(f"Failed extraction: {entry.path}")
            item = {"path": entry.path, "wadPathHash": f"{entry.path_hash:016x}", "sha256": sha(data), "bytes": len(data)}
            if self.pinned and item not in self.pinned["files"]:
                raise ValueError(f"Source file differs: {entry.path}")
            target = Path(output) / entry.path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            self.outputs.append(item)
        return selected

    def provenance(self):
        return {"referenceVersion": "16.18.8175716", "manifest": self.manifest,
                "archive": self.file.name, "chunks": self.reads, "files": self.outputs}
