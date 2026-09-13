"""Rebuild the pinned Nexus and inhibitor source assets."""
import json
from pathlib import Path
from riot_archive import RiotArchive
pinned = json.loads(Path('docs/reference/base-structure-extraction.json').read_text())
paths = json.loads(Path('docs/reference/base-structure-wad-paths.json').read_text())
archive = RiotArchive(paths, pinned)
archive.extract([item['path'] for item in pinned['files']], '.cache/base-structure-sources')
print(f'Verified {len(archive.outputs)} base structure sources from {len(archive.reads)} patch chunks')
