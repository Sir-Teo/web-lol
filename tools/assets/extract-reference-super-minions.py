"""Rebuild the hash-pinned base super-minion source set for both teams."""
import hashlib
import json
from pathlib import Path
from riot_archive import RiotArchive
pinned = json.loads(Path('docs/reference/super-minion-extraction.json').read_text())
assert hashlib.sha256(Path('docs/reference/super-minion-definitions.json').read_bytes()).hexdigest() == pinned['definitionsSha256']
paths = json.loads(Path('docs/reference/super-minion-wad-paths.json').read_text())
archive = RiotArchive(paths, pinned)
archive.extract([item['path'] for item in pinned['files']], '.cache/super-minion-sources')
provenance = archive.provenance()
provenance['definitionsSha256'] = pinned['definitionsSha256']
Path('.cache/super-minion-sources/provenance.json').write_text(json.dumps(provenance, indent=2)+'\n')
print(f'Verified {len(archive.outputs)} super-minion sources from {len(archive.reads)} patch chunks')
