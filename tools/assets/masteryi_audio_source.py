"""Immutable Master Yi base SFX inputs; no voice bank or runtime policy inference."""
from pathlib import Path
import hashlib
import json

REFERENCE_SHA256 = '4295bceeba96cfb15e006d392e7d0f3c480bb51bf8cff8872a9c39fc9873c7ce'
EXTRACTION_SHA256 = '579c704813d156d4dddefc8c27fc66070c50d4f5997e615c62a446532b6a098a'
REFERENCE = Path('docs/reference/masteryi-model.json')
EXTRACTION = Path('docs/reference/masteryi/audio-extraction.json')
BANK_ROOT = Path('.cache/masteryi-audio-sources')
ARCHIVE = 'DATA/FINAL/Champions/MasterYi.wad.client'
TOC = 'data/final/champions/masteryi.wad.subchunktoc'
BANKS = (
    ('assets/sounds/wwise2016/sfx/characters/masteryi/skins/base/masteryi_base_sfx_audio.bnk', 738923, '88f1e27c0d42dac80be948f82909ded4e208a28c34db35bb361caa3fc980c2c5'),
    ('assets/sounds/wwise2016/sfx/characters/masteryi/skins/base/masteryi_base_sfx_events.bnk', 13053, 'af6aebc07d4759770ae01e047a14bfc7a55c602291acacd8fbb13c6be87389e5'),
)


def checked_bytes(path, expected_sha256, expected_bytes=None):
    path = Path(path)
    data = path.read_bytes()
    if expected_bytes is not None and len(data) != expected_bytes:
        raise ValueError(f'Source length differs: {path}')
    if hashlib.sha256(data).hexdigest() != expected_sha256:
        raise ValueError(f'Source SHA-256 differs: {path}')
    return data


def inputs(reference=REFERENCE, extraction=EXTRACTION, banks=BANK_ROOT, require_banks=True):
    model = json.loads(checked_bytes(reference, REFERENCE_SHA256))
    pin = json.loads(checked_bytes(extraction, EXTRACTION_SHA256))
    skin = model['skin']['data']['Characters/MasterYi/Skins/Skin0']
    unit = next(u for u in skin['skinAudioProperties']['bankUnits'] if u['name'] == 'MasterYi_Base_SFX')
    paths = [p.lower() for p in unit['bankPath']]
    if paths != [row[0] for row in BANKS] or pin['archive'] != ARCHIVE:
        raise ValueError('Unexpected base SFX declarations or archive')
    expected = [(f['path'], f['bytes'], f['sha256']) for f in pin['files']]
    if expected != list(BANKS):
        raise ValueError('Extraction does not contain the exact two frozen SFX banks')
    for name, size, digest in BANKS:
        path = Path(banks) / name
        if require_banks or path.exists():
            checked_bytes(path, digest, size)
    return pin, unit
