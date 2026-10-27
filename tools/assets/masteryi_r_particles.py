"""Frozen Highlander particle definitions and their complete native asset closure."""
from pathlib import Path
import json
import re
from masteryi_q_particles import (
    MODEL, MODEL_SHA256, PARSER_SHA256, checked, strings, require,
    cache_path, check_files, verify_native,
)

PIN = Path('docs/reference/masteryi/r-particles.json')
PIN_SHA256 = 'e8630aeae0aa33c6f369bde1ac3c80aeb333a16e78924ab1417f56f75e7f1ccd'
SOURCE_ROOT = Path('.cache/masteryi-r-particles-cloud/sources')
SYSTEM_EMITTERS = {'MasterYi_R_Buf':3,'MasterYi_R_Buf_Lvl2':3,'MasterYi_R_Buf_Lvl3':4,'MasterYi_R_Cas':8,'MasterYi_R_OnBuffKill':3}


def validate(pin, model):
    require(pin['modelSha256'] == MODEL_SHA256 and pin['parserSha256'] == PARSER_SHA256,
            'Highlander provenance changed')
    resources = model['skin']['data']['Characters/MasterYi/Skins/Skin0/Resources']['resourceMap']
    require(set(pin['resources']) == set(SYSTEM_EMITTERS) ==
            {k for k in resources if k.startswith('MasterYi_R_')},
            'Incomplete Highlander resource closure')
    linked = {p.lower() for p in model['skin']['data']['__linked']}
    bins = {'data/characters/masteryi/skins/skin0.bin'}
    for key, row in pin['resources'].items():
        require(row['record'] == resources[key] and row['sourceBin'] in linked,
                'Highlander binding differs')
        definition = row['definition']
        require(definition['objectPath'] == row['record'] and
                definition['__type'] == 'VfxSystemDefinitionData',
                'Highlander record identity differs')
        require(len(definition['complexEmitterDefinitionData']) == SYSTEM_EMITTERS[key],
                'Highlander emitter closure differs')
        persistent = key in ('MasterYi_R_Buf','MasterYi_R_Buf_Lvl2','MasterYi_R_Buf_Lvl3')
        sound_fields = {name for name in definition if name.lower().startswith('sound')}
        require(sound_fields == ({'soundPersistentDefault'} if persistent else set()) and
                (not persistent or definition['soundPersistentDefault'] == 'Play_sfx_MasterYi_Highlander_trail'),
                'Highlander sound declaration differs')
        require('flags' not in definition, 'Highlander omitted flags acquired a default')
        bins.add(row['sourceBin'])
    assets = {s.lower() for row in pin['resources'].values()
              for s in strings(row['definition']) if s.lower().startswith('assets/')}
    require(len(bins) == 2 and len(assets) == 24 and
            sum(p.endswith('.tex') for p in assets) == 20 and
            sum(p.endswith('.scb') for p in assets) == 4,
            'Highlander dependency closure differs')
    require(not [s for row in pin['resources'].values() for s in strings(row['definition'])
                 if re.fullmatch(r'\{[0-9a-f]{16}\}', s)],
            'Unresolved native Highlander PATH dependency')
    rows = pin['extraction']['files']
    require(pin['extraction']['archive'] == 'DATA/FINAL/Champions/MasterYi.wad.client' and
            pin['extraction']['referenceVersion'] == '16.18.8175716',
            'Highlander archive/version changed')
    require(len(rows) == 26 and len({r['path'] for r in rows}) == 26 and
            {r['path'] for r in rows} == bins | assets,
            'Missing/duplicate/extra Highlander dependency')
    by_path = {r['path']: r for r in rows}
    for row in pin['resources'].values():
        require(row['nativeSha256'] == by_path[row['sourceBin']]['sha256'],
                'Highlander BIN identity differs')
    return bins, assets


def load(pin_path=PIN, model_path=MODEL):
    pin = json.loads(checked(pin_path, PIN_SHA256))
    model = json.loads(checked(model_path, MODEL_SHA256))
    validate(pin, model)
    for row in pin['nameSources']: checked(row['path'], row['sha256'])
    return pin, model
