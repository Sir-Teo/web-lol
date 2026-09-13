"""Rebuild the pinned tower meshes, rigs, textures and animation sources."""
import json
from pathlib import Path
from riot_archive import RiotArchive

pinned = json.loads(Path('docs/reference/turret-extraction.json').read_text())
paths = json.loads(Path('docs/reference/turret-wad-paths.json').read_text())
archive = RiotArchive(paths, pinned)
archive.extract([item['path'] for item in pinned['files']], '.cache/turret-sources')
print(f'Verified {len(archive.outputs)} tower sources from {len(archive.reads)} patch chunks')
