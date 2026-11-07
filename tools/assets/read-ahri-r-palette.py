"""Read the hashed R palette mixer identity without changing runtime bindings."""
import argparse
import hashlib
import json
from pathlib import Path

NAME = 'palleteSrcMixColor'
FIELD = '{143f06d1}'
SOURCE = 'docs/reference/ahri/r-particles.json'
SOURCE_SHA = '3f283be14704aa77c680d2c11eb67441d8376586835e43283ae7be440c956991'
CONTENT = 'src/content/ahri-r-particles.json'
CONTENT_SHA = 'c9a65a9808d3206cfbaee6dc1f9e1a5a37d6351947d997e2a5c4b8d3b290f29f'
REFERENCES = [{'path': '.cache/baron-emission-readers/engine/parsing/readSurface.ts', 'bytes': 14569, 'sha256': 'af6068c0a8247c97d3ebb52d5a6ad6b9cca110920a38bfcac9553fe13a138219'}, {'path': '.cache/baron-emission-readers/engine/parsing/readValue.ts', 'bytes': 13407, 'sha256': 'd9ae8a14ddc236b57138056e623fe922b7c1c15ffbe142cdebf6adefb2f6fed3'}, {'path': '.cache/baron-emission-readers/rendering/utils/palette.ts', 'bytes': 2008, 'sha256': 'd13b347b607a85cc079b909dc8bb25e9ce67cd4e5c8120097f99b713b852f3f9'}]
OUTPUT = 'docs/reference/ahri/r-palette-field-reading.json'

def require(ok, message):
    if not ok:
        raise ValueError(message)

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def fnv(name):
    result = 2166136261
    for byte in name.lower().encode():
        result = ((result ^ byte) * 16777619) & 0xffffffff
    return '{%08x}' % result

def checked(root, name, expected):
    path = root / name
    require(not any(p.is_symlink() for p in [path, *path.parents]), 'Linked palette input')
    raw = path.read_bytes()
    require(sha(raw) == expected, 'Pinned palette input differs: ' + name)
    return json.loads(raw)

def build(root):
    require(fnv(NAME) == FIELD, 'Palette field spelling differs')
    source = checked(root, SOURCE, SOURCE_SHA)
    content = checked(root, CONTENT, CONTENT_SHA)
    found = []
    for system, resource in source['resources'].items():
        for index, emitter in enumerate(resource['definition'].get('complexEmitterDefinitionData', [])):
            palette = emitter.get('paletteDefinition', {})
            if FIELD in palette:
                found.append((system, index, emitter, palette))
    require(len(found) == 1, 'Palette mixer occurrence count differs')
    system, index, emitter, palette = found[0]
    require(system == 'Ahri_R_mis_02' and index == 8 and emitter['emitterName'] == 'Ribbon_1', 'Palette producer identity differs')
    require(set(palette) == {'__type', FIELD, fnv('paletteTexture')}, 'Palette declarations differ')
    value = palette[FIELD]
    require(value == {'constantValue': [0.9499961733818054, 0.0, 0.0, 0.0], '__type': 'ValueColor'}, 'Palette mixer value differs')
    profiles = [(i,p) for i,p in enumerate(content['profiles']) if p['system'] == system and p['index'] == index]
    require(len(profiles) == 1, 'Published palette profile missing')
    profile_index, profile = profiles[0]
    require(profile['sourceDeclaration'] == emitter and profile['palette']['unresolvedFields'] == {FIELD: value}, 'Raw palette identity was changed')
    require(profile['palette']['count'] is None and profile['palette']['selector']['sourceType'] is None, 'Omitted palette fields were invented')
    texture = next(t for t in content['textures'] if t['url'] == profile['palette']['texture'])
    return dict(format=1, scope='Field identity and constant ValueColor reading only; no runtime/default certification',
        producerSha256=sha(Path(__file__).read_bytes()), inputs=[dict(path=SOURCE,sha256=SOURCE_SHA),dict(path=CONTENT,sha256=CONTENT_SHA)],
        fieldHash=FIELD, fnv1aLowercaseSpelling=NAME, system=system, emitterIndex=index, emitterName=profile['name'],
        publicProfileIndex=profile_index, nativePaletteDeclaration=palette, valueClass='ValueColor', constant=value['constantValue'],
        textureSource=texture['source'], textureBaseLevel=texture['rectangles'][0],
        externalReaderReferences=REFERENCES,
        limits=['Spelling matches the native field hash and the independently pinned external parser.',
                'External parser defaults are references, not native constructor certification.',
                'Palette count and selector remain omitted in the authored source.',
                'No public profile, renderer binding, ruleset or accepted pack is changed.'])

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true')
    parser.add_argument('--verify-readers',action='store_true')
    args = parser.parse_args()
    root = Path.cwd()
    if args.verify_readers:
        for row in REFERENCES:
            path = root / row['path']
            require(not path.is_symlink(), 'Linked reader reference')
            raw = path.read_bytes()
            require(len(raw) == row['bytes'] and sha(raw) == row['sha256'] and NAME.encode() in raw, 'External reader reference differs')
    record = build(root)
    raw = (json.dumps(record,indent=2)+'\n').encode()
    path = root / OUTPUT
    require(not path.is_symlink(), 'Linked palette reading output')
    require(not path.exists() or path.read_bytes() == raw, 'Conflicting palette reading')
    require(not args.check or path.exists(), 'Missing palette reading')
    if not args.check and not path.exists():
        path.write_bytes(raw)
    print(json.dumps(dict(result='passed',fieldHash=FIELD,spelling=NAME,externalReadersVerified=args.verify_readers,runtimeChanged=False)))
if __name__ == '__main__':
    main()
