"""Stage all prepared R profiles and byte-checked assets without renderer dispatch."""
import argparse
import importlib.util
import json
from pathlib import Path
from ahri_r_particles import checked, require

PROFILE_READING_SHA = '0f4bd493394c03cd4d372ef83898d5bfc0793ff6b1924c7828fe010ba8c6d3c3'
SHARED_CONTENT = {'src/content/ahri-q-cast-particles.json': '80220cb7c8ff6a140e93cdc66b051221320f664845c20f03d6600f5697088d6e', 'src/content/ahri-q-projectile-particles.json': '1d37eeacf199ff19cdf1563eec4dab0e8bfcf394140ebc72c7a014b226069e6b', 'src/content/ahri-w-particles.json': 'f8a4c153046a70237c4c2d563e45f1b523c29e464ed3789eb0170eeedebef832', 'src/content/ahri-e-particles.json': '3e354d6e8b9eea49a3522949754eab573625856b4804b5474ea3ed25765d003f'}

def prepare():
    spec = importlib.util.spec_from_file_location('r_profile_preparer', Path(__file__).with_name('prepare-ahri-r-profiles.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def build():
    module = prepare()
    for name in ['docs/reference/ahri-model.json', 'docs/reference/ahri/r-particles.json', str(module.READING), *module.PINS, *SHARED_CONTENT]:
        module.safe(Path(name))
    private_data, reading, _ = module.build()
    require(checked(module.READING, PROFILE_READING_SHA) == reading, 'R private profile reading differs')
    by_source = {'textures': {}, 'meshes': {}}
    for name, digest in SHARED_CONTENT.items():
        content = json.loads(checked(name, digest))
        owner = Path(name).stem.removesuffix('-particles')
        for kind in by_source:
            for row in content.get(kind, []):
                if 'source' in row:
                    by_source[kind].setdefault(row['source']['path'], (row.get('textureOwner' if kind == 'textures' else 'geometryOwner', owner), row))
    tex = json.loads(checked('docs/reference/ahri/r-texture-transports.json', module.PINS['docs/reference/ahri/r-texture-transports.json']))
    mesh = json.loads(checked('docs/reference/ahri/r-mesh-transports.json', module.PINS['docs/reference/ahri/r-mesh-transports.json']))
    outputs = {}
    textures, meshes, shared = [], [], []
    replacement = {}
    for kind, rows in [('textures', tex['textures']), ('meshes', mesh['meshes'])]:
        for row in rows:
            transport = row if kind == 'textures' else row['glb']
            # Validate retained inputs even when an identical published asset can be reused.
            raw = checked(module.safe(Path(transport['path'])), transport['sha256'], transport['bytes'])
            previous = by_source[kind].get(row['source']['path'])
            if previous:
                owner, old = previous
                for key in ['source', 'bytes', 'sha256']:
                    require(old[key] == (row if key == 'source' else transport)[key], 'Shared R transport differs: ' + key)
                if kind == 'textures':
                    for key in ['width', 'height', 'rectangles', 'rgbaSha256']:
                        require(old[key] == row[key], 'Shared R mip transport differs: ' + key)
                url = old['url']
                checked(module.safe(Path('public') / url), transport['sha256'], transport['bytes'])
                shared.append(url)
            else:
                owner = 'ahri-r'
                url = 'assets/effects/ahri-r-' + row['source']['wadPathHash'] + ('.png' if kind == 'textures' else '.glb')
                outputs[Path('public') / url] = raw
            replacement[transport['path']] = url
            if kind == 'textures':
                textures.append({**row, 'url': url, 'textureOwner': owner})
            else:
                require(row['triangleReplayExact'] is True and row['uvReplayExact'] is True and type(row['hasVertexColors']) is bool and row['vertexColorReplayExact'] is row['hasVertexColors'], 'R mesh replay differs')
                require(row['sourceCoordinateTransformApplied'] is False and row['normalAttributeGenerated'] is False, 'R mesh transform or normals changed')
                meshes.append(dict(source=row['source'], url=url, bytes=transport['bytes'], sha256=transport['sha256'], vertices=row['transportVertices'], triangles=row['sourceTriangles'], hasVertexColors=row['hasVertexColors'], sourceCoordinateTransformApplied=False, normalAttributeGenerated=False, geometryOwner=owner))
    def replace(value):
        if isinstance(value, dict): return {key: replace(item) for key, item in value.items()}
        if isinstance(value, list): return [replace(item) for item in value]
        return replacement.get(value, value) if isinstance(value, str) else value
    private = json.loads(private_data)
    content = dict(textures=textures, meshes=meshes, adapterDefaults=private['adapterDefaults'], profiles=replace(private['profiles']))
    public = module.encode(content)
    require(len(content['profiles']) == 55 and len(textures) == 51 and len(meshes) == 4 and len(shared) == 30, 'Incomplete R publication')
    assets = {path: raw for path, raw in outputs.items()}
    outputs[Path('src/content/ahri-r-particles.json')] = public
    record = dict(format=1, producerSha256=module.sha(Path(__file__).read_bytes()), privateProfileReadingSha256=PROFILE_READING_SHA, privateProfileSha256=module.sha(private_data), publicProfileSha256=module.sha(public), sharedContentPins=SHARED_CONTENT, profiles=55, textures=51, authoredMips=sum(len(row['rectangles']) for row in textures), meshes=4, newPublicAssetFiles=len(assets), newPublicAssetBytes=sum(map(len, assets.values())), sharedAssets=shared, limits=[
        'Asset/profile staging only; no R particle renderer or simulation behavior is connected.',
        'All raw declarations, native tags, constructor omissions and unresolved binding requirements remain represented.',
        'Thirty byte-identical transports reuse existing Q/W/E assets; 25 new files preserve the remaining prepared transports.',
        'Null Transform_Out, empty TextureSwaps and unjoined resource keys do not acquire invented renderer dispatch.',
        'Source mesh coordinates remain unchanged; native pixel equivalence is unverified.'])
    outputs[Path('docs/reference/ahri/r-publication.json')] = module.encode(record)
    return outputs, record

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    outputs, record = build()
    for path, raw in outputs.items():
        require(not any(parent.is_symlink() for parent in [path, *path.parents]), 'R publication output cannot contain symlinks')
        require(not path.exists() or path.read_bytes() == raw, 'Conflicting R publication output: ' + str(path))
        require(not args.check or path.exists(), 'Missing R publication output: ' + str(path))
    if not args.check:
        for path, raw in outputs.items():
            if not path.exists():
                path.parent.mkdir(parents=True, exist_ok=True)
                with path.open('xb') as stream: stream.write(raw)
    print(json.dumps(dict(result='passed', outputs=len(outputs), profiles=55, newPublicAssetFiles=record['newPublicAssetFiles'], newPublicAssetBytes=record['newPublicAssetBytes'], sharedAssets=len(record['sharedAssets']), runtimeDispatchBound=False)))
if __name__ == '__main__': main()
