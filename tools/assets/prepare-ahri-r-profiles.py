"""Prepare all 55 R profiles privately, or verify their portable reading."""
import argparse
import hashlib
import json
from pathlib import Path
from collections import Counter
from ahri_r_particles import load, checked, require
from ahri_r_profiles import profiles, DEFAULTS, ALLOWED

PINS = {'docs/reference/ahri/r-texture-transports.json': '07da366d77dafa832b89388bfc290643bfceb3388c43a2c58717b2ad5f72d366', 'docs/reference/ahri/r-mesh-transports.json': 'c60b23b806a86331cb2e91462915f382d549525e4b0463b0ee12c3b229e5fd24', 'docs/reference/ahri/r-particle-bindings.json': 'b41db6d111e161ace23ea3fe58bbda740c67129088cdf13c839aba1d428da6e9', 'docs/reference/ahri/r-native-types.json': '916507ddeb2cd0055577a915be79878442033582848e42c9bb7a3dc6d1e1b149'}
OUTPUT = Path('.cache/ahri-r-profiles-v1/profiles.json')
READING = Path('docs/reference/ahri/r-profile-reading.json')
HELPERS = ['ahri_r_profiles.py','ahri_q_projectile.py','ahri_r_particles.py','ahri_q_particles.py','masteryi_w_cast.py','masteryi_w_buff.py','masteryi_w_particles.py','masteryi_q_particles.py']

def sha(raw): return hashlib.sha256(raw).hexdigest()
def encode(value): return (json.dumps(value,indent=2,allow_nan=False)+'\n').encode()
def safe(path):
    require(not any(p.is_symlink() for p in [path,*path.parents]),'Profile output cannot contain symlinks')
    return path

def build():
    pin,_ = load()
    raw = {name:checked(name,digest) for name,digest in PINS.items()}
    textures = json.loads(raw['docs/reference/ahri/r-texture-transports.json'])
    meshes = json.loads(raw['docs/reference/ahri/r-mesh-transports.json'])
    bindings = json.loads(raw['docs/reference/ahri/r-particle-bindings.json'])
    t = {r['source']['path']:r['path'] for r in textures['textures']}
    m = {r['source']['path']:r['glb']['path'] for r in meshes['meshes']}
    compiled = profiles(pin,t,m)
    native_types=json.loads(raw['docs/reference/ahri/r-native-types.json'])
    typed={r['resourceKey']:r for r in native_types['resources']}
    for profile in compiled:
        native=typed[profile['system']]['emitters'][profile['index']]
        require(native['name']==profile['name'] and {f['name'] for f in native['fields']}==set(profile['sourceExplicitFields'])-{'__type'},'R native field projection differs')
        profile['nativeFields']=native['fields']
    data = encode(dict(adapterDefaults=DEFAULTS,profiles=compiled))
    counts = dict(sorted(Counter(p['kind'] for p in compiled).items()))
    source_fields = sorted({f for p in compiled for f in p['explicitFields']})
    require(set(source_fields)==ALLOWED,'Unaccounted or obsolete R projector field')
    reading = dict(
        format=1,
        producerSha256=sha(Path(__file__).read_bytes()),
        helpers=[dict(path='tools/assets/'+name,sha256=sha(Path(__file__).with_name(name).read_bytes())) for name in HELPERS],
        inputs=[dict(path=name,sha256=digest,bytes=len(raw[name])) for name,digest in PINS.items()],
        systems=[dict(resourceKey=k,role=v[0],emitters=v[1]) for k,v in __import__('ahri_r_profiles').SYSTEMS.items()],
        bindingRequirements=dict(sorted(Counter(n for p in compiled for n in p['bindingRequirements']).items())),
        profile=dict(path=str(OUTPUT),bytes=len(data),sha256=sha(data)),
        uvNormalizationReference=dict(path='rendering/utils/uvTransform.ts',sha256='7d213bad1f7a4d443c0f136fedd21c433be8bc4b6822d2a2f410209efb370d0d',rule='max(round(value), 1)',nativeConstructorVerified=False),
        counts=counts,
        authoredFields=source_fields,
        sourceAuthoredFields=sorted({f for p in compiled for f in p['sourceExplicitFields']}),
        aliases=__import__('ahri_r_profiles').ALIASES,
        producerSummary=bindings['summary'],
        unjoinedResourceKeys=bindings['unjoinedResourceKeys'],
        nullResources=pin['nullResources'],
        emptyEmitterResources=[k for k,v in pin['resources'].items() if 'complexEmitterDefinitionData' not in v['definition']],
        adapterDefaults=DEFAULTS,
        limits=[
            'Private projection only; no public assets, renderer, simulation, save schema or ruleset changes.',
            'All 55 emitters preserve complete raw source declarations, native field tags and explicit constructor omissions beside projected values.',
            'Hash aliases are checked by FNV-1a. Raw hashed source declarations remain unchanged; aliases alone do not certify runtime semantics.',
            'Nine explicit producer references join eight systems. Three systems remain unjoined; the null resource and empty TextureSwaps record remain explicit.',
            'Noise fields, missing box dimensions, periodic emission, UV rotation, palette inputs, distortion/soft-depth inputs and callback policies remain binding requirements.',
            'Constructor fallback values are explicit local adapters; no native defaults, random streams, shader arithmetic or GPU appearance is certified.',
        ])
    return data,encode(reading),reading

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true')
    parser.add_argument('--verify-reading',action='store_true')
    args=parser.parse_args()
    data,reading,record=build()
    if args.verify_reading:
        require(safe(READING).read_bytes()==reading,'Projectile profile reading differs')
    else:
        outputs=[(OUTPUT,data),(READING,reading)]
        for path,raw in outputs:
            safe(path)
            require(not path.exists()or path.read_bytes()==raw,'Conflicting projectile profile output')
            require(not args.check or path.exists(),'Missing projectile profile output')
        if not args.check:
            for path,raw in outputs:
                if not path.exists():
                    path.parent.mkdir(parents=True,exist_ok=True)
                    with path.open('xb')as stream:stream.write(raw)
    print(json.dumps(dict(result='passed',profiles=55,authoredFields=len(record['authoredFields']),bytes=len(data),sha256=sha(data),counts=record['counts'],runtimeChanged=False)))
if __name__=='__main__':main()
