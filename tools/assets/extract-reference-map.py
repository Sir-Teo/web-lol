"""Rebuild the pinned Summoner's Rift sources without downloading the full WAD.

Run with the CDTB environment documented in docs/ASSETS.md, from the repo root.
Both cached and downloaded chunks and every extracted file are hash checked.
"""
import json
from pathlib import Path

from riot_archive import RiotArchive

pinned = json.loads(Path("docs/reference/map-extraction.json").read_text())
paths = json.loads(Path("docs/reference/map-wad-paths.json").read_text())
archive = RiotArchive(paths, pinned)
archive.extract([item["path"] for item in pinned["files"]], ".cache/map-sources")
print(f"Verified {len(archive.outputs)} source files from {len(archive.reads)} patch chunks")
