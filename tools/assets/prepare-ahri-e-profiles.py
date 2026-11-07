"""Prepare all 29 E profiles privately, or verify their portable reading."""
import argparse
import hashlib
import json
from pathlib import Path
from collections import Counter
from ahri_e_particles import load, checked, require
from ahri_e_additional_particles import load as load_additional
from ahri_e_profiles import profiles, DEFAULTS, ALLOWED

PINS = {'docs/reference/ahri/e-texture-transports.json': 'dfb6d42c52ef5fc1d920a437f53932a8e01c4e55ff373d44c0d9d75c1cbc008e', 'docs/reference/ahri/e-mesh-transports.json': '8502caf25953bb2a5a7dfa530fd3a5a274fa514000cf4877605718845a30960b', 'docs/reference/ahri/e-particle-bindings.json': '9c22449fe2b42efb615469b1e1aeb56e8ca9489578754d4a6814528d4ada29e2', 'docs/reference/ahri/e-native-types.json': '5d4c130ee021e19fd934762373ebab11a6a28ae64ff5ed453b918a154177530b'}
OUTPUT = Path('.cache/ahri-e-profiles-v1/profiles.json')
READING = Path('docs/reference/ahri/e-profile-reading.json')
HELPERS = ['ahri_e_profiles.py','ahri_e_additional_particles.py','ahri_q_projectile.py','ahri_e_particles.py','ahri_q_particles.py','masteryi_w_cast.py','masteryi_w_buff.py','masteryi_w_particles.py','masteryi_q_particles.py']

def sha(raw): return hashlib.sha256(raw).hexdigest()
def encode(value): return (json.dumps(value,indent=2,allow_nan=False)+'\n').encode()
def safe(path):
    require(not any(p.is_symlink() for p in [path,*path.parents]),'Profile output cannot contain symlinks')
    return path

def build():
    pin,_ = load(); additional,_ = load_additional()
    pin = {**pin,'resources':{**pin['resources'],**additional['resources']}}
    raw = {name:checked(name,digest) for name,digest in PINS.items()}
    textures = json.loads(raw['docs/reference/ahri/e-texture-transports.json'])
    meshes = json.loads(raw['docs/reference/ahri/e-mesh-transports.json'])
    bindings = json.loads(raw['docs/reference/ahri/e-particle-bindings.json'])
    t = {r['source']['path']:r['path'] for r in textures['textures']}
    m = {r['source']['path']:r['glb']['path'] for r in meshes['meshes']}
    compiled = profiles(pin,t,m)
    data = encode(dict(adapterDefaults=DEFAULTS,profiles=compiled))
    counts = dict(sorted(Counter(p['kind'] for p in compiled).items()))
    source_fields = sorted({f for p in compiled for f in p['explicitFields']})
    require(set(source_fields)==ALLOWED,'Unaccounted or obsolete E projector field')
    reading = dict(
        format=1,
        producerSha256=sha(Path(__file__).read_bytes()),
        helpers=[dict(path='tools/assets/'+name,sha256=sha(Path(__file__).with_name(name).read_bytes())) for name in HELPERS],
        inputs=[dict(path=name,sha256=digest,bytes=len(raw[name])) for name,digest in PINS.items()],
        systems=[dict(resourceKey=k,role=v[0],emitters=v[1]) for k,v in __import__('ahri_e_profiles').SYSTEMS.items()],
        bindingRequirements=dict(sorted(Counter(n for p in compiled for n in p['bindingRequirements']).items())),
        profile=dict(path=str(OUTPUT),bytes=len(data),sha256=sha(data)),
        uvNormalizationReference=dict(path='rendering/utils/uvTransform.ts',sha256='7d213bad1f7a4d443c0f136fedd21c433be8bc4b6822d2a2f410209efb370d0d',rule='max(round(value), 1)',nativeConstructorVerified=False),
        counts=counts,
        authoredFields=source_fields,
        adapterDefaults=DEFAULTS,
        limits=[
            'Private profile projection only; no public asset, renderer, simulation, save schema or ruleset changes.',
            'All 55 authored emitter fields and all 29 emitters are projected. Nested source types, authored key counts, explicit fields and probability metadata remain separate from local fallback values.',
            'All explicit spell, persistent-buff and directional animation joins are retained separately. Native scripts, callback chronology, frame conversion, attachment transforms, post-rotation arithmetic, stop policy, material bindings and pixels remain unbound.',
            'Emitter UV scroll remains separate from integrated particle-age UV scroll. Camera-facing/arbitrary trails retain mode, tiling and omitted smoothing/cutoff.',
            'Missing emitter lifetimes, unnamed palette inputs, attached selectors, raw native flags and post-rotation fields remain explicit. Unresolved binding requirements prevent treating this projection as runtime acceptance.',
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
    print(json.dumps(dict(result='passed',profiles=29,authoredFields=len(record['authoredFields']),bytes=len(data),sha256=sha(data),counts=record['counts'],runtimeChanged=False)))
if __name__=='__main__':main()
