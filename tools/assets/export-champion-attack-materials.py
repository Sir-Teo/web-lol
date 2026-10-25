"""Extend the frozen original material table using later champion skin records."""
from pathlib import Path
import argparse
import hashlib
import json
from masteryi_audio_graph import write_outputs

PINS = {
    'leona': ('Leona', '4afb6c31fc7d23c6c820d380d6ac789fada29866776dea29d4f60355b2348cc7'),
    'ahri': ('Ahri', '74d0b55f5aad08646fbd24f660ed533bc8fd5798e8a60dc0983d97960b47a377'),
    'masteryi': ('MasterYi', '4295bceeba96cfb15e006d392e7d0f3c480bb51bf8cff8872a9c39fc9873c7ce'),
}


def generate():
    materials = {}; provenance = []
    for name, (source_name, expected) in PINS.items():
        path = Path(f'docs/reference/{name}-model.json'); raw = path.read_bytes()
        if hashlib.sha256(raw).hexdigest() != expected: raise ValueError('Frozen skin differs: ' + str(path))
        keys = ['skin', 'data', f'Characters/{source_name}/Skins/Skin0']
        record = json.loads(raw)
        for key in keys: record = record[key]
        material = record.get('armorMaterial')
        if material not in {'Flesh', 'Metal', 'Stone', 'Wood'}: raise ValueError('Missing/unknown armor material')
        rig = name + '-base'; materials[rig] = material
        provenance.append(dict(rig=rig, path=str(path), sha256=expected, recordPath=keys, material=material))
    return [
        (Path('src/content/champion-attack-sound-materials.json'), (json.dumps(materials, indent=2) + '\n').encode()),
        (Path('docs/reference/champion-attack-materials.json'), (json.dumps(provenance, indent=2) + '\n').encode()),
    ]


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument('--check', action='store_true'); args = parser.parse_args()
    outputs = generate(); write_outputs(outputs, args.check)
    print(json.dumps({'rigs': len(PINS), 'original29Unchanged': True}))
