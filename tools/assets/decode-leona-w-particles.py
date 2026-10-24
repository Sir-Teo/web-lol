"""Decode all Eclipse TEX/SCB inputs without resizing or welding face corners."""
from pathlib import Path
from io import BytesIO
import hashlib
import json
import subprocess
from PIL import Image
from cdtb.export import TexConverter
from leona_w_source import decode_mesh

sha = lambda raw: hashlib.sha256(raw).hexdigest()
layout = dict(repository='https://github.com/LeagueToolkit/LeagueToolkit',
    revision='76bf57bf4fd195343dec610bf0f912a06b910914',
    files={'StaticMesh.cs': 'eab04b1454081c56f86d93f568f804b812b8e3dbe44f99caea9efd2eff9272da',
           'StaticMeshFace.cs': '053418afb28e627ff0709975ef4d5b363e0e44508a6efba27c5243064fb45a37'})
readers = Path('.cache/leona-w-particle-readers')
readers.mkdir(exist_ok=True)
for name, expected in layout['files'].items():
    path = readers / name
    if not path.exists():
        url = f"{layout['repository']}/raw/{layout['revision']}/src/LeagueToolkit/Core/Mesh/{name}"
        subprocess.run(['curl', '-fLsS', '--max-time', '60', url, '-o', str(path)], check=True)
    assert sha(path.read_bytes()) == expected, name
pin_path = Path('docs/reference/leona-w-particles.json')
pin = json.loads(pin_path.read_text())
root = Path('.cache/leona-w-particle-sources')
meshes, textures = [], []
for source in pin['extraction']['files']:
    suffix = Path(source['path']).suffix
    raw = (root / (source['wadPathHash'] + suffix)).read_bytes()
    assert len(raw) == source['bytes'] and sha(raw) == source['sha256']
    if suffix == '.bin':
        continue
    if suffix == '.tex':
        image = Image.open(BytesIO(TexConverter.tex_to_dds(raw))).convert('RGBA')
        output = Path('public/assets/effects') / (Path(source['path']).stem + '.png')
        if output.exists():
            existing = Image.open(output).convert('RGBA')
            assert existing.size == image.size and existing.tobytes() == image.tobytes(), output
        else:
            image.save(output)
        textures.append(dict(source=source, path=str(output), width=image.width, height=image.height,
            bytes=output.stat().st_size, sha256=sha(output.read_bytes()), rgbaSha256=sha(image.tobytes())))
        continue
    assert suffix == '.scb'
    meshes.append(decode_mesh(raw, source))
assert len(textures) == 36 and len(meshes) == 6
result = dict(sourcePinSha256=sha(pin_path.read_bytes()), layoutReference=layout,
    texDecoder=dict(path='.tools/cdtb/cdtb/export.py', sha256=sha(Path('.tools/cdtb/cdtb/export.py').read_bytes())),
    meshes=meshes, textures=textures)
Path('.cache/leona-w-particles-decoded.json').write_text(json.dumps(result) + '\n')
print(json.dumps(dict(meshes=[dict(name=Path(m['source']['path']).stem,
    vertices=m['sourceVertices'], triangles=m['triangles'], vertexColors=bool(m['sourceVertexBGRA']),
    faceColors=bool(m['sourceFaceRGB'])) for m in meshes], textures=len(textures),
    pngBytes=sum(t['bytes'] for t in textures))))
