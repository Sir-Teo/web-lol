"""Frozen hashed resource referenced by Charm's persistent buff declaration."""
from pathlib import Path
import json
import re
from ahri_e_particles import (MODEL, MODEL_SHA256, PARSER_SHA256, checked, require,
    strings, cache_path, check_files, verify_native)

PIN = Path('docs/reference/ahri/e-additional-particles.json')
PIN_SHA256 = 'd16b06cc12bfd2016dc07f048d1b031ff6da346f3dbb2ab7dfdb7aa407086c90'
SOURCE_ROOT = Path('.cache/ahri-e-additional-particles/sources')
SYSTEMS = {'{44fc6ec4}'}

def validate(pin, model):
    require(pin['modelSha256'] == MODEL_SHA256 and pin['parserSha256'] == PARSER_SHA256,
            'Particle provenance changed')
    resources = model['skin']['data']['Characters/Ahri/Skins/Skin0/Resources']['resourceMap']
    require(set(pin['resources']) == SYSTEMS, 'Incomplete additional Charm resource closure')
    linked = {p.lower() for p in model['skin']['data']['__linked']}
    bins = {'data/characters/ahri/skins/skin0.bin'}
    for key, row in pin['resources'].items():
        require(row['record'] == resources[key] and row['sourceBin'] in linked,
                'Particle binding differs')
        require(row['definition']['objectPath'] == row['record'] and
                row['definition']['__type'] == 'VfxSystemDefinitionData', 'Particle record identity differs')
        bins.add(row['sourceBin'])
    assets = {s.lower() for row in pin['resources'].values() for s in strings(row['definition'])
              if s.lower().startswith('assets/')}
    require(len(bins) == 2 and len(assets) == 2 and all(p.endswith('.tex') for p in assets),
            'Additional Charm dependency closure changed')
    require(not [s for row in pin['resources'].values() for s in strings(row['definition'])
                 if re.fullmatch(r'\{[0-9a-f]{16}\}', s)], 'Unresolved native PATH dependency')
    rows = pin['extraction']['files']
    require(pin['extraction']['archive'] == 'DATA/FINAL/Champions/Ahri.wad.client' and
            pin['extraction']['referenceVersion'] == '16.18.8175716', 'Particle archive/version changed')
    require(len(rows) == 4 and len({r['path'] for r in rows}) == 4 and
            {r['path'] for r in rows} == bins | assets, 'Missing/duplicate/extra particle files')
    by_path = {r['path']: r for r in rows}
    for row in pin['resources'].values():
        require(row['nativeSha256'] == by_path[row['sourceBin']]['sha256'], 'Particle BIN identity differs')
    require(sum(len(r['definition'].get('complexEmitterDefinitionData', []))
                for r in pin['resources'].values()) == 3, 'Emitter count changed')
    return bins, assets

def load(pin_path=PIN, model_path=MODEL):
    pin = json.loads(checked(pin_path, PIN_SHA256))
    model = json.loads(checked(model_path, MODEL_SHA256))
    validate(pin, model)
    return pin, model
