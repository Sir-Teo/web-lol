#!/usr/bin/env python3
"""Export exact source-to-shader rim powers for the four Eclipse skin layers."""
import argparse
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('attached_inputs', ROOT / 'tools/assets/verify-leona-attached-skin-reflection-inputs.py')
reading = importlib.util.module_from_spec(spec); spec.loader.exec_module(reading)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    pin = reading.verify()
    powers = {r['source']: r['mappedFloat32'] for r in pin['float32RimMapping']}
    profiles = json.loads((ROOT / 'src/content/leona-w-particles.json').read_text())['profiles']
    rows = []
    for row in pin['sourceProfiles']:
        if row['spell'] != 'w': continue
        profile = profiles[row['profile']]
        reading.require(profile['kind'] == 'skin' and profile['reflection'] == row['exportedReflection'], 'Runtime profile differs')
        source = row['sourceReflection']['fresnel']
        rows.append(dict(profile=row['profile'], source=source, power=powers[source]))
    result = dict(profiles=rows, mapping='FMA32(source rim fresnel, 4.9f, 0.1f)',
                  evidence='docs/reference/leona-attached-skin-reflection-inputs.json',
                  nativeDispatchVerified=False)
    raw = (json.dumps(result, indent=2) + '\n').encode()
    path = ROOT / 'src/content/leona-w-skin-fresnel.json'
    if args.check: reading.require(path.read_bytes() == raw, 'Skin rim export differs')
    else: path.write_bytes(raw)
    print('PASS: four Eclipse skin powers exported from checked source rim inputs; check=' + str(args.check))


if __name__ == '__main__': main()
