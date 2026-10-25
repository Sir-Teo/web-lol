"""Fetch a small, pinned reference icon pack. Runtime never depends on a CDN.

Riot owns these images. Recording provenance is not a distribution license.
Public-release content authorization remains unresolved; see docs/PROGRESS.md.
"""
import hashlib
import argparse
import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/assets/icons'
OUT.mkdir(parents=True, exist_ok=True)
BASE = 'https://ddragon.leagueoflegends.com/cdn/16.18.1/img/'
FILES = {
    'ashe.png': 'champion/Ashe.png',
    'lux.png': 'champion/Lux.png',
    'garen.png': 'champion/Garen.png',
    'leona.png': 'champion/Leona.png',
    'ahri.png': 'champion/Ahri.png',
    'AhriQ.png': 'spell/AhriQ.png',
    'AhriW.png': 'spell/AhriW.png',
    'AhriE.png': 'spell/AhriE.png',
    'AhriR.png': 'spell/AhriR.png',
    'LeonaShieldOfDaybreak.png': 'spell/LeonaShieldOfDaybreak.png',
    'LeonaSolarBarrier.png': 'spell/LeonaSolarBarrier.png',
    'LeonaZenithBlade.png': 'spell/LeonaZenithBlade.png',
    'LeonaSolarFlare.png': 'spell/LeonaSolarFlare.png',
    'GarenQ.png': 'spell/GarenQ.png',
    'GarenW.png': 'spell/GarenW.png',
    'GarenE.png': 'spell/GarenE.png',
    'GarenR.png': 'spell/GarenR.png',
    'LuxLightBinding.png': 'spell/LuxLightBinding.png',
    'LuxPrismaticWave.png': 'spell/LuxPrismaticWave.png',
    'LuxLightStrikeKugel.png': 'spell/LuxLightStrikeKugel.png',
    'LuxR.png': 'spell/LuxR.png',
    'AsheQ.png': 'spell/AsheQ.png',
    'Volley.png': 'spell/Volley.png',
    'AsheSpiritOfTheHawk.png': 'spell/AsheSpiritOfTheHawk.png',
    'EnchantedCrystalArrow.png': 'spell/EnchantedCrystalArrow.png',
    'SummonerFlash.png': 'spell/SummonerFlash.png',
    'SummonerHeal.png': 'spell/SummonerHeal.png',
    '1055.png': 'item/1055.png',
    '3340.png': 'item/3340.png',
    '3364.png': 'item/3364.png',
    '1001.png': 'item/1001.png',
    '1036.png': 'item/1036.png',
    '1037.png': 'item/1037.png',
}
manifest_path = ROOT / 'public/assets/reference-manifest.json'
manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {
    'version': '16.18.1', 'owner': 'Riot Games',
    'usage': 'Local fidelity reference; redistribution permission not established.',
    'assets': [],
}
if manifest['version'] != '16.18.1':
    raise ValueError('Refusing to mix icon patches in the reference manifest')
# Other source importers also contribute item and atlas records to this manifest.
records = {record['path']: record for record in manifest['assets']}
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--only', nargs='+', choices=FILES, help='Fetch only these pinned icons')
selected = parser.parse_args().only or list(FILES)
for filename in selected:
    remote = FILES[filename]
    data = subprocess.check_output(['curl', '-fLsS', '--max-time', '30', BASE + remote])
    if not data.startswith(b'\x89PNG\r\n\x1a\n'):
        raise ValueError(f'{filename} did not contain a PNG')
    (OUT / filename).write_bytes(data)
    path = f'/assets/icons/{filename}'
    records[path] = {'path': path, 'source': BASE + remote,
                     'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}
manifest['assets'] = list(records.values())
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
print(f'Fetched and hashed {len(selected)} icons; retained {len(records)} manifest records.')
