#!/usr/bin/env python3
"""Verify the bounded Activate omission audit without fetching or executing targets."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def load(path):
    return json.loads((ROOT / path).read_text())


def require(condition, message):
    if not condition:
        raise ValueError(message)


def main():
    record = load('docs/reference/leona-r-activate-reading.json')
    for item in record['evidence']:
        data = (ROOT / item['path']).read_bytes()
        require(len(data) == item['bytes'], item['path'])
        require(hashlib.sha256(data).hexdigest() == item['sha256'], item['path'])
    source = record['source']
    raw = load(source['raw'])['resources'][source['system']]['definition'][
        'complexEmitterDefinitionData'][source['complexIndex']]
    compiled = load(source['compiled'])['profiles'][source['profileIndex']]
    snapshot = load(record['evidence'][2]['path'])
    require(raw == snapshot['raw'] and compiled == snapshot['compiled'], 'Source/profile changed')
    require(raw['emitterName'] == compiled['name'] == 'Activate', 'Wrong emitter')
    require(raw['particleColorTexture'] == '', 'Lookup is no longer empty')
    require(not any(key in raw for key in (
        'primitive', 'texture', 'CustomMaterial', 'materialOverrideDefinitions',
        'childParticleSetDefinition', 'emissionMeshName', 'disabled')), 'Authored resource/primitive changed')
    require(raw['birthScale0']['constantValue'] == [200, 150, 50], 'Source size changed')
    require(compiled['primitive'] == {} and compiled['kind'] == 'billboard', 'Primitive policy changed')
    require(compiled['texture'] is None and compiled['lookup'] is None, 'Resource policy changed')
    require(compiled['mesh'] is None and compiled['blend'] == 4, 'Mesh/blend policy changed')
    require(record['nativeExecuted'] is False, 'Unexpected execution claim')
    print(f"PASS Activate: {len(record['evidence'])} retained files; omitted resources and source/profile correspondence")


if __name__ == '__main__':
    main()
