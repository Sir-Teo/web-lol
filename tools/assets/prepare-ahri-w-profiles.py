"""Prepare all 30 W profiles privately, or verify their portable reading."""
import argparse
import hashlib
import json
from pathlib import Path
from collections import Counter
from ahri_w_particles import load, checked, require
from ahri_w_profiles import profiles, DEFAULTS, ALLOWED

PINS = {
    'docs/reference/ahri/w-texture-transports.json': 'ce2c00385aabbb50e1ad29a7382a34c18c5357fc654270e7a1c04e09c1ed7be4',
    'docs/reference/ahri/w-mesh-transports.json': '35d3a2ca7f4272ee7911dbf11c0a66b8febdd0c1423ccabcdbbd3e4a4052f3ef',
    'docs/reference/ahri/w-particle-bindings.json': '8646e89b6964923abb023060397091d95ab1d04a78c57ae1944fad7e79f4aac1',
}
OUTPUT = Path('.cache/ahri-w-profiles-v1/profiles.json')
READING = Path('docs/reference/ahri/w-profile-reading.json')
HELPERS = ['ahri_w_profiles.py','ahri_q_projectile.py','ahri_w_particles.py','ahri_q_particles.py','masteryi_w_cast.py','masteryi_w_buff.py','masteryi_w_particles.py','masteryi_q_particles.py']

def sha(raw): return hashlib.sha256(raw).hexdigest()
def encode(value): return (json.dumps(value,indent=2,allow_nan=False)+'\n').encode()
def safe(path):
    require(not any(p.is_symlink() for p in [path,*path.parents]),'Profile output cannot contain symlinks')
    return path

def build():
    pin,_ = load()
    raw = {name:checked(name,digest) for name,digest in PINS.items()}
    textures = json.loads(raw['docs/reference/ahri/w-texture-transports.json'])
    meshes = json.loads(raw['docs/reference/ahri/w-mesh-transports.json'])
    bindings = json.loads(raw['docs/reference/ahri/w-particle-bindings.json'])
    t = {r['source']['path']:r['path'] for r in textures['textures']}
    m = {r['source']['path']:r['glb']['path'] for r in meshes['meshes']}
    compiled = profiles(pin,t,m)
    data = encode(dict(adapterDefaults=DEFAULTS,profiles=compiled))
    counts = dict(sorted(Counter(p['kind'] for p in compiled).items()))
    source_fields = sorted({f for p in compiled for f in p['explicitFields']})
    require(set(source_fields)==ALLOWED,'Unaccounted or obsolete W projector field')
    reading = dict(
        format=1,
        producerSha256=sha(Path(__file__).read_bytes()),
        helpers=[dict(path='tools/assets/'+name,sha256=sha(Path(__file__).with_name(name).read_bytes())) for name in HELPERS],
        inputs=[dict(path=name,sha256=digest,bytes=len(raw[name])) for name,digest in PINS.items()],
        systems=[dict(resourceKey=k,role=v[0],emitters=v[1]) for k,v in __import__('ahri_w_profiles').SYSTEMS.items()],
        bindingRequirements=dict(sorted(Counter(n for p in compiled for n in p['bindingRequirements']).items())),
        profile=dict(path=str(OUTPUT),bytes=len(data),sha256=sha(data)),
        uvNormalizationReference=dict(path='rendering/utils/uvTransform.ts',sha256='7d213bad1f7a4d443c0f136fedd21c433be8bc4b6822d2a2f410209efb370d0d',rule='max(round(value), 1)',nativeConstructorVerified=False),
        counts=counts,
        authoredFields=source_fields,
        adapterDefaults=DEFAULTS,
        limits=[
            'Private profile projection only; no public asset, renderer, simulation, save schema or ruleset changes.',
            'All 66 authored emitter fields and all 30 emitters are projected. Nested source types, authored key counts, explicit fields and probability metadata remain separate from local fallback values.',
            'The three native missile/hit resource joins are retained; cast and weapon resources remain unjoined. Script callbacks, root frames, cylinder sampling, stop/linger policy, visibility dispatch, material bindings and pixels remain unbound.',
            'Emitter UV scroll remains separate from integrated particle-age UV scroll. Camera-facing/arbitrary trails retain mode, tiling and omitted smoothing/cutoff.',
            'Eight omitted emitter lifetimes, two missing palette textures, attached selectors and authored random-sharing integers remain explicit. Unresolved binding requirements prevent treating this projection as runtime acceptance.',
            'Signed atlas dimensions remain alongside the pinned external normalization; no texture flip or native constructor behavior is inferred.',
            'Missing constructor values are explicit local adapter defaults, not native-default certification.',
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
    print(json.dumps(dict(result='passed',profiles=30,authoredFields=len(record['authoredFields']),bytes=len(data),sha256=sha(data),counts=record['counts'],runtimeChanged=False)))
if __name__=='__main__':main()
