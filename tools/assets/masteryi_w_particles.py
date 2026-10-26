"""Frozen Meditate particle definitions and their complete native asset closure."""
from pathlib import Path
import json
import re
from masteryi_q_particles import (
    MODEL, MODEL_SHA256, PARSER_SHA256, checked, strings, require,
    cache_path, check_files, verify_native,
)

PIN = Path('docs/reference/masteryi/w-particles.json')
PIN_SHA256 = 'f2b3e3cc1759b39b8a08d75a15a43649fecaa5a60c16392eff6893935e9a6517'
SOURCE_ROOT = Path('.cache/masteryi-w-particles-cloud/sources')
SYSTEM_EMITTERS = {'MasterYi_W_Buf': 4, 'MasterYi_W_Cas': 7,
                   'MasterYi_W_Dmg': 2, 'MasterYi_W_Tenacity': 2}


def validate(pin, model):
    require(pin['modelSha256'] == MODEL_SHA256 and pin['parserSha256'] == PARSER_SHA256,
            'Meditate provenance changed')
    resources = model['skin']['data']['Characters/MasterYi/Skins/Skin0/Resources']['resourceMap']
    require(set(pin['resources']) == set(SYSTEM_EMITTERS) ==
            {k for k in resources if k.startswith('MasterYi_W_')},
            'Incomplete Meditate resource closure')
    linked = {p.lower() for p in model['skin']['data']['__linked']}
    bins = {'data/characters/masteryi/skins/skin0.bin'}
    for key, row in pin['resources'].items():
        require(row['record'] == resources[key] and row['sourceBin'] in linked,
                'Meditate binding differs')
        definition = row['definition']
        require(definition['objectPath'] == row['record'] and
                definition['__type'] == 'VfxSystemDefinitionData',
                'Meditate record identity differs')
        require(len(definition['complexEmitterDefinitionData']) == SYSTEM_EMITTERS[key],
                'Meditate emitter closure differs')
        require(not any(k.lower().startswith('sound') for k in definition),
                'Meditate omitted sound binding acquired a default')
        bins.add(row['sourceBin'])
    assets = {s.lower() for row in pin['resources'].values()
              for s in strings(row['definition']) if s.lower().startswith('assets/')}
    require(len(bins) == 4 and len(assets) == 20 and
            sum(p.endswith('.tex') for p in assets) == 18 and
            sum(p.endswith('.scb') for p in assets) == 2,
            'Meditate dependency closure differs')
    require(not [s for row in pin['resources'].values() for s in strings(row['definition'])
                 if re.fullmatch(r'\{[0-9a-f]{16}\}', s)],
            'Unresolved native Meditate PATH dependency')
    rows = pin['extraction']['files']
    require(pin['extraction']['archive'] == 'DATA/FINAL/Champions/MasterYi.wad.client' and
            pin['extraction']['referenceVersion'] == '16.18.8175716',
            'Meditate archive/version changed')
    require(len(rows) == 24 and len({r['path'] for r in rows}) == 24 and
            {r['path'] for r in rows} == bins | assets,
            'Missing/duplicate/extra Meditate dependency')
    by_path = {r['path']: r for r in rows}
    for row in pin['resources'].values():
        require(row['nativeSha256'] == by_path[row['sourceBin']]['sha256'],
                'Meditate BIN identity differs')
    return bins, assets


def load(pin_path=PIN, model_path=MODEL):
    pin = json.loads(checked(pin_path, PIN_SHA256))
    model = json.loads(checked(model_path, MODEL_SHA256))
    validate(pin, model)
    for row in pin['nameSources']: checked(row['path'], row['sha256'])
    return pin, model
