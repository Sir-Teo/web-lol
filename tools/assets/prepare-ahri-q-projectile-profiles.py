"""Prepare all 36 projectile profiles privately, or verify their portable reading."""
import argparse
import hashlib
import json
from pathlib import Path
from collections import Counter
from ahri_q_particles import load, checked, require
from ahri_q_projectile import profiles, DEFAULTS, ALLOWED

PINS = {
    'docs/reference/ahri/q-projectile-texture-transport.json': '60023e2fb2068987f6005b29f012f1fd5b7f16c0adfbbe1341c3b18d1e5286bf',
    'docs/reference/ahri/q-projectile-mesh-transports.json': '401fe40d8accb519ea3ee6ea1806f3440c65e35f3a9bccb6e1f2c0fd1e25d9ca',
    'docs/reference/ahri/q-projectile-bindings.json': '47343562976f495270ca6b7ff2610b2d6f3ff2047d09a0fa9ca88114ddac4b5c',
}
OUTPUT = Path('.cache/ahri-q-projectile-profiles-v1/profiles.json')
READING = Path('docs/reference/ahri/q-projectile-profile-reading.json')
HELPERS = ['ahri_q_projectile.py','ahri_q_particles.py','masteryi_w_cast.py','masteryi_w_buff.py','masteryi_w_particles.py','masteryi_q_particles.py']

def sha(raw): return hashlib.sha256(raw).hexdigest()
def encode(value): return (json.dumps(value,indent=2,allow_nan=False)+'\n').encode()
def safe(path):
    require(not any(p.is_symlink() for p in [path,*path.parents]),'Profile output cannot contain symlinks')
    return path

def build():
    pin,_ = load()
    raw = {name:checked(name,digest) for name,digest in PINS.items()}
    textures = json.loads(raw['docs/reference/ahri/q-projectile-texture-transport.json'])
    meshes = json.loads(raw['docs/reference/ahri/q-projectile-mesh-transports.json'])
    bindings = json.loads(raw['docs/reference/ahri/q-projectile-bindings.json'])
    require(bindings['summary']==dict(nativeSpellBindings=2,joinedSystems=2,authoredEmitters=36,textures=17,meshes=3),'Projectile alias closure differs')
    t = {r['source']['path']:r['path'] for r in textures['textures']}
    m = {r['source']['path']:r['glb']['path'] for r in meshes['meshes']}
    compiled = profiles(pin,t,m)
    data = encode(dict(adapterDefaults=DEFAULTS,profiles=compiled))
    counts = dict(sorted(Counter(p['kind'] for p in compiled).items()))
    source_fields = sorted({f for p in compiled for f in p['explicitFields']})
    require(set(source_fields)==ALLOWED,'Unaccounted or obsolete Q projector field')
    reading = dict(
        format=1,
        producerSha256=sha(Path(__file__).read_bytes()),
        helpers=[dict(path='tools/assets/'+name,sha256=sha(Path(__file__).with_name(name).read_bytes())) for name in HELPERS],
        inputs=[dict(path=name,sha256=digest,bytes=len(raw[name])) for name,digest in PINS.items()],
        systems=[dict(resourceKey=r['resourceKey'],emitters=r['emitterCount'],nativeSpell=r['scriptName']) for r in bindings['missiles']],
        profile=dict(path=str(OUTPUT),bytes=len(data),sha256=sha(data)),
        counts=counts,
        authoredFields=source_fields,
        adapterDefaults=DEFAULTS,
        limits=[
            'Private profile projection only; no public asset, renderer, simulation, save schema or ruleset changes.',
            'All 45 authored emitter fields and all 36 emitters are projected. Nested source types, authored key counts, explicit fields and probability metadata remain separate from local fallback values.',
            'The two native spell/resource aliases are retained. Script callbacks, root frames, cylinder sampling, stop/linger policy, visibility dispatch, material bindings and pixels remain unbound.',
            'Emitter UV scroll remains separate from integrated particle-age UV scroll. Camera-facing/arbitrary trails retain mode, tiling and omitted smoothing/cutoff.',
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
    print(json.dumps(dict(result='passed',profiles=36,authoredFields=len(record['authoredFields']),bytes=len(data),sha256=sha(data),counts=record['counts'],runtimeChanged=False)))
if __name__=='__main__':main()
