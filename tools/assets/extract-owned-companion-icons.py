"""Extract/decode four original upgraded Smite icons from the frozen DATA archive."""
import io
import json
from pathlib import Path

from PIL import Image
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive, sha

pin = Path('docs/reference/owned-companion-icons.json')
previous = json.loads(pin.read_text()) if pin.exists() else None
files = [f'data/spells/icons2d/{name}.dds' for name in [
    '1101_smite', '1102_smite', '1103_smite', 'avatarsmite_firstupgrade',
]]
archive = RiotArchive(
    {f'{xxh64_intdigest(path):016x}': path
     for path in files + ['data/final/data.wad.subchunktoc']},
    previous['extraction'] if previous else None,
    archive_name='DATA/FINAL/DATA.wad.client',
)
root = Path('.cache/owned-companion/icons')
archive.extract(files, root)
icons = []
for path, name in zip(files, [
    'SummonerSmiteAvatarOffensive', 'SummonerSmiteAvatarUtility',
    'SummonerSmiteAvatarDefensive', 'S5_SummonerSmitePlayerGanker',
]):
    raw = (root / path).read_bytes()
    target = Path('public/assets/icons') / (name + '.png')
    Image.open(io.BytesIO(raw)).convert('RGBA').save(target)
    icons.append(dict(
        path=str(target), sourcePath=path,
        sourceSha256=sha(raw), sha256=sha(target.read_bytes()),
    ))
result = dict(
    extraction=archive.provenance(), icons=icons,
    conversion='Pillow DDS decoding to RGBA PNG; no painted or generated pixels.',
)
if previous:
    assert result == previous, 'Owned companion icons changed'
else:
    pin.write_text(json.dumps(result, indent=2) + '\n')
print('Four original upgraded Smite icons decoded and pinned')
