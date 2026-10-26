"""Frozen Wuju Style particle definitions and their complete native asset closure."""
from pathlib import Path
import json
import re
from masteryi_q_particles import (
    MODEL, MODEL_SHA256, PARSER_SHA256, checked, strings, require,
    cache_path, check_files, verify_native,
)

PIN = Path('docs/reference/masteryi/e-particles.json')
PIN_SHA256 = '5137067c8206b7db14075d29816e08bd5281c25f8ec959f8e1b13ee5c305d9d2'
SOURCE_ROOT = Path('.cache/masteryi-e-particles-cloud/sources')
SYSTEM_EMITTERS = {'MasterYi_E_Sword1_buf': 2, 'MasterYi_E_SuperChraged_Sword1_buf': 2, 'MasterYi_E_SuperChraged_Sword4_buf': 1, 'MasterYi_E_buff': 4, 'MasterYi_E_SuperChraged_buf': 4, 'MasterYi_E_Sword4_buf': 1}


def validate(pin, model):
    require(pin['modelSha256'] == MODEL_SHA256 and pin['parserSha256'] == PARSER_SHA256,
            'Wuju Style provenance changed')
    resources = model['skin']['data']['Characters/MasterYi/Skins/Skin0/Resources']['resourceMap']
    require(set(pin['resources']) == set(SYSTEM_EMITTERS) ==
            {k for k in resources if k.startswith('MasterYi_E_')},
            'Incomplete Wuju Style resource closure')
    linked = {p.lower() for p in model['skin']['data']['__linked']}
    bins = {'data/characters/masteryi/skins/skin0.bin'}
    for key, row in pin['resources'].items():
        require(row['record'] == resources[key] and row['sourceBin'] in linked,
                'Wuju Style binding differs')
        definition = row['definition']
        require(definition['objectPath'] == row['record'] and
                definition['__type'] == 'VfxSystemDefinitionData',
                'Wuju Style record identity differs')
        require(len(definition['complexEmitterDefinitionData']) == SYSTEM_EMITTERS[key],
                'Wuju Style emitter closure differs')
        require(not any(name.lower().startswith('sound')for name in definition), 'Wuju Style omitted sounds acquired a default')
        require('flags' not in definition, 'Wuju Style omitted flags acquired a default')
        bins.add(row['sourceBin'])
    assets = {s.lower() for row in pin['resources'].values()
              for s in strings(row['definition']) if s.lower().startswith('assets/')}
    require(len(bins) == 4 and len(assets) == 9 and
            sum(p.endswith('.tex') for p in assets) == 9 and
            sum(p.endswith('.scb') for p in assets) == 0,
            'Wuju Style dependency closure differs')
    require(not [s for row in pin['resources'].values() for s in strings(row['definition'])
                 if re.fullmatch(r'\{[0-9a-f]{16}\}', s)],
            'Unresolved native Wuju Style PATH dependency')
    rows = pin['extraction']['files']
    require(pin['extraction']['archive'] == 'DATA/FINAL/Champions/MasterYi.wad.client' and
            pin['extraction']['referenceVersion'] == '16.18.8175716',
            'Wuju Style archive/version changed')
    require(len(rows) == 13 and len({r['path'] for r in rows}) == 13 and
            {r['path'] for r in rows} == bins | assets,
            'Missing/duplicate/extra Wuju Style dependency')
    by_path = {r['path']: r for r in rows}
    for row in pin['resources'].values():
        require(row['nativeSha256'] == by_path[row['sourceBin']]['sha256'],
                'Wuju Style BIN identity differs')
    return bins, assets


def load(pin_path=PIN, model_path=MODEL):
    pin = json.loads(checked(pin_path, PIN_SHA256))
    model = json.loads(checked(model_path, MODEL_SHA256))
    validate(pin, model)
    for row in pin['nameSources']: checked(row['path'], row['sha256'])
    return pin, model
