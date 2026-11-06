"""Stage every Baron attack emitter and verified authored asset binding privately."""
import argparse
import json
from pathlib import Path
from baron_attack_decode import require
from baron_attack_fields import label_maps
from baron_attack_program import profiles
from masteryi_q_decode import sha
from particle_mip_atlas import unpack

INPUTS = {
    'source': ('docs/reference/baron-attack-source.json', '4b300f952b2a768e1eaa5c5f9eda3dd397e457ba1ead19c10fbd9aaa02c3543a'),
    'labels': ('docs/reference/baron-attack-field-reading.json', '9861875a3e9539b42ea61f95f7539c98f88eef7d077296e4ab293b3e8e3e3040'),
    'decoded': ('docs/reference/baron-attack-decoded.json', 'ab8f06fee053cd0b2f89759f99f53c5abb1986c9c32e977812ae9129e306da20'),
    'textures': ('docs/reference/baron-attack-texture-transport.json', '0b9f4797ebe162f83843d6001eace3562eaf2faa48819a6b607c25f9d67e0c98'),
    'meshes': ('docs/reference/baron-attack-mesh-staging.json', '8a6022333bbbbda1fcc3ae687550f45daf77345dcec2b99c2393aacd496c12e8'),
}


def checked(path, digest, size=None):
    raw = Path(path).read_bytes()
    require(sha(raw) == digest and (size is None or len(raw) == size), 'Baron program input differs: ' + str(path))
    return raw


def encoded(value):
    return (json.dumps(value, indent=2, allow_nan=False) + '\n').encode()


def build():
    inputs = {key: json.loads(checked(path, digest)) for key, (path, digest) in INPUTS.items()}
    require(inputs['textures']['decodedRecordSha256'] == inputs['meshes']['decodedRecordSha256'] == INPUTS['decoded'][1],
            'Baron asset stages bind different decodes')
    texture_keys = {row['source']['path']: row['source']['wadPathHash'] for row in inputs['textures']['textures']}
    mesh_keys = {row['source']['path']: row['source']['wadPathHash'] for row in inputs['meshes']['meshes']}
    require(len(texture_keys) == 25 and len(mesh_keys) == 2, 'Baron asset stage closure differs')
    compiled = profiles(inputs['source'], label_maps(inputs['labels']['tables']), texture_keys, mesh_keys)
    decoded = {row['source']['path']: row for row in inputs['decoded']['textures']}
    for row in inputs['textures']['textures']:
        raw = checked(Path('.cache/baron-attack-textures-packed') / row['path'], row['sha256'], row['bytes'])
        pixels = unpack(raw, row)
        original = decoded[row['source']['path']]
        require(row['source'] == original['source'] and len(pixels) == len(original['levels']), 'Program texture source differs')
        require(all(sha(p) == level['rgbaSha256'] for p, level in zip(pixels, original['levels'])), 'Program authored mip differs')
    for row in inputs['meshes']['meshes']:
        checked(Path('.cache/baron-attack-packed') / row['name'], row['sha256'], row['bytes'])
        require(row['validation']['threeLoaderExact'] and row['validation']['exactAttributeRoundTrip'], 'Mesh lacks loader proof')
    emission_keys = {p['emissionMesh']['asset'] for p in compiled if p['emissionMesh']}
    emission_data = {}
    for row in inputs['decoded']['meshes']:
        key = row['source']['wadPathHash']
        if key in emission_keys:
            mesh = json.loads(checked(Path('.cache/baron-attack-decoded') / row['path'], row['sha256'], row['bytes']))
            emission_data[key] = dict(positions=[v for point in mesh['sourcePoints'] for v in point],
                                      indices=mesh['sourceIndices'], sourceSha256=row['source']['sha256'])
    require(set(emission_data) == emission_keys, 'Missing native-unit emission mesh data')
    program = dict(format=1, sourcePinSha256=INPUTS['source'][1], profiles=compiled,
                   textures=inputs['textures']['textures'], meshes=inputs['meshes']['meshes'], emissionSurfaces=emission_data)
    helpers = ['tools/assets/stage-baron-attack-program.py', 'tools/assets/baron_attack_program.py',
               'tools/assets/baron_attack_fields.py', 'tools/assets/masteryi_w_cast.py',
               'tools/assets/baron_attack_decode.py', 'tools/assets/masteryi_q_particles.py',
               'tools/assets/masteryi_w_particles.py', 'tools/assets/particle_mip_atlas.py',
               'tools/assets/masteryi_q_decode.py']
    reading = dict(inputs=[dict(role=key, path=path, sha256=digest) for key, (path, digest) in INPUTS.items()],
                   helpers=[dict(path=path, sha256=sha(Path(path).read_bytes())) for path in helpers],
                   programSha256=sha(encoded(program)), programBytes=len(encoded(program)), profiles=21,
                   textures=25, authoredMips=214, meshes=2, emissionSurfaces=len(emission_data),
                   geometryCounts={kind: sum(p['geometry']['kind'] == kind for p in compiled)
                                   for kind in sorted({p['geometry']['kind'] for p in compiled})},
                   policies=['Omitted primitive -> billboard, absent smoothing -> off, fillVolume bit 1, emission normal default true follow the pinned external reader, not native target-patch default certification.',
                             'Only declared curves/settings project; curve empty-value fallbacks retain the established reader schema and sourceType. Integrated acceleration remains distinct.',
                             'Hashed point class remains its original ID. VfxShapePointDoNotUse is an external hash-crack label, not an attested native name.',
                             'No scheduler, attachment, material dispatch, active renderer or public assets are introduced.'])
    return encoded(program), encoded(reading), reading


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, default=Path('.cache/baron-attack-program'))
    parser.add_argument('--record', type=Path, default=Path('docs/reference/baron-attack-program-reading.json'))
    parser.add_argument('--discover', action='store_true')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    require(not (args.discover and args.check), 'Discovery and check are exclusive')
    require(not args.discover or (not args.record.exists() and not args.output_dir.exists()), 'Discovery requires fresh record/output')
    require(args.record.exists() or args.discover, 'Initial program requires --discover')
    program, reading_bytes, reading = build()
    require(not args.record.exists() or args.record.read_bytes() == reading_bytes, 'Program reading/helper profile differs')
    target = args.output_dir / 'program.json'
    require(not target.is_symlink(), 'Program cannot be a symlink')
    require(not args.check or target.exists(), 'Missing staged program')
    require(not target.exists() or target.read_bytes() == program, 'Conflicting staged program')
    if not args.check:
        if not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open('xb') as stream: stream.write(program)
        if not args.record.exists():
            args.record.parent.mkdir(parents=True, exist_ok=True)
            with args.record.open('xb') as stream: stream.write(reading_bytes)
    print(json.dumps(dict(status='passed', profiles=21, textures=25, authoredMips=214, meshes=2,
                          emissionSurfaces=reading['emissionSurfaces'], programSha256=reading['programSha256'],
                          programBytes=reading['programBytes'], runtimeChanged=False)))


if __name__ == '__main__':
    main()
