"""Read hash-checked candidate labels without rewriting the original Baron source pin."""
import argparse
import json
import re
from pathlib import Path
from masteryi_q_decode import sha
from baron_attack_decode import require
from baron_attack_fields import binhash, label_maps, relabel

SOURCE = Path('docs/reference/baron-attack-source.json')
SOURCE_SHA = '4b300f952b2a768e1eaa5c5f9eda3dd397e457ba1ead19c10fbd9aaa02c3543a'
REVISION = 'e53e58f7760fd1be3f3e34383e4efedfffd3fd57'
TABLES = {'binfields': ('64dec2657a42964b91153fc3aa6c4280038c664d37ca118a8eb789bb99183e3f', 262924),
          'bintypes': ('c6aea31bb2ebeeaf668f449babf7a1616b7a0e7fec247e75ebce5bc093547477', 127271)}
OUTPUT = Path('docs/reference/baron-attack-field-reading.json')


def generate():
    raw = SOURCE.read_bytes()
    require(sha(raw) == SOURCE_SHA, 'Original Baron source pin differs')
    source = json.loads(raw)
    used = {kind: set() for kind in TABLES}
    def visit(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if re.fullmatch(r'\{[0-9a-f]{8}\}', key):
                    used['binfields'].add(key[1:-1])
                if key == '__type' and isinstance(child, str) and re.fullmatch(r'\{[0-9a-f]{8}\}', child):
                    used['bintypes'].add(child[1:-1])
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)
    visit(source['systems'])
    rows = {}
    for kind, (digest, size) in TABLES.items():
        path = Path('.cache/baron-attack-field-labels') / f'hashes.{kind}.txt'
        raw = path.read_bytes()
        require(len(raw) == size and sha(raw) == digest, 'Candidate label table differs')
        selected = {}
        for line in raw.decode('utf8').splitlines():
            key, _, name = line.partition(' ')
            if key not in used[kind]:
                continue
            require(key not in selected or selected[key] == name, 'Ambiguous table hash')
            require(binhash(name) == '{' + key + '}', 'Table candidate hash differs')
            selected[key] = name
        rows[kind] = dict(url=f'https://raw.githubusercontent.com/CommunityDragon/Data/{REVISION}/hashes/lol/hashes.{kind}.txt',
                          bytes=size, sha256=digest, labels=dict(sorted(selected.items())),
                          unresolved=sorted(used[kind] - selected.keys()))
    maps = label_maps(rows)
    systems = relabel(source['systems'], maps)
    require(relabel(systems, maps, reverse=True) == source['systems'], 'Candidate labels are not reversible')
    inventory = []
    for role, system in systems.items():
        for index, emitter in enumerate(system['definition']['complexEmitterDefinitionData']):
            inventory.append(dict(role=role, index=index, name=emitter['emitterName'],
                primitive=emitter.get('primitive'), emissionMesh=emitter.get('emissionMeshName'),
                shape=emitter.get('SpawnShape'), explicitFields=sorted(emitter),
                audio=emitter.get('Audio'), period=emitter.get('period'),
                timeActiveDuringPeriod=emitter.get('timeActiveDuringPeriod')))
    require(len(inventory) == 21, 'Emitter inventory differs')
    return dict(sourcePinSha256=SOURCE_SHA, candidateRepositoryRevision=REVISION, tables=rows,
                helpers=[dict(path=str(path), sha256=sha(path.read_bytes())) for path in
                         [Path(__file__), Path('tools/assets/baron_attack_fields.py')]],
                exactReverseLabels=True, emitters=inventory,
                limits=['Candidate names are hash-checked against a pinned community dictionary, not native behavior/default evidence.',
                        'Original hashed source definitions remain unchanged; no omitted fields or primitive defaults are invented.',
                        'Trail extrusion, emission-mesh sampling, attachment, periods, random sharing and native materials remain open.',
                        'No runtime/public media/simulation changes.'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    record = generate()
    encoded = (json.dumps(record, indent=2, allow_nan=False) + '\n').encode()
    require(not args.check or OUTPUT.exists(), 'Missing field reading')
    require(not OUTPUT.exists() or OUTPUT.read_bytes() == encoded, 'Existing field reading differs')
    if not OUTPUT.exists():
        with OUTPUT.open('xb') as stream:
            stream.write(encoded)
    print(json.dumps(dict(status='passed', fields=len(record['tables']['binfields']['labels']),
                          types=len(record['tables']['bintypes']['labels']), emitters=21,
                          exactReverseLabels=True, runtimeChanged=False)))


if __name__ == '__main__':
    main()
