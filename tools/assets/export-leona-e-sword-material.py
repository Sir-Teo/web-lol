#!/usr/bin/env python3
"""Export explicit conditional sword material inputs and local adapter policies."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def sha(raw): return hashlib.sha256(raw).hexdigest()


def main():
    cli = argparse.ArgumentParser(description=__doc__); cli.add_argument('--check', action='store_true')
    args = cli.parse_args()
    path = ROOT / 'docs/reference/leona-native-scb-material.json'; raw = path.read_bytes(); pin = json.loads(raw)
    verifier = pin['verifier']; script = ROOT / verifier['path']
    if sha(script.read_bytes()) != verifier['sha256']: raise ValueError('Native material verifier differs')
    spec = importlib.util.spec_from_file_location('material_reading', script)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module); module.verify(path)
    cpu_bytes = (ROOT / pin['inputPin']['path']).read_bytes(); cpu = json.loads(cpu_bytes)
    profiles = json.loads((ROOT / 'src/content/leona-e-particles.json').read_text())['profiles']; p = profiles[18]
    source = cpu['sourceWire']['effectiveValuesAfterGenericConstructorAndSerializedFields']; mapping = cpu['uniformMapping']['fresnel']
    if not (p['name'] == 'sword2' and p['kind'] == 'mesh' and p['reflection']['power'] == source['fresnel']
            and p['reflection']['color'] == source['fresnelColor'] and p['alphaRef'] == 5 / 255
            and p['blend'] == 0 and not pin['sourceColor']['authoredVertexBGRA']):
        raise ValueError('Unsupported sword profile inputs')
    result = dict(profileIndex=18, name='sword2', sourceModel=p['mesh'],
        fresnel=source['fresnelColor'][:3] + [mapping['packedPower']], alphaRef=5 / 255, depthPushPull=0,
        colorPacking=dict(binding='kColorFactor', premultiplyRgb=True, outputAlpha=1, conditionalBlendMode=0),
        vertexColors=False, shaderPrograms=dict(vertex=1, fragment=24),
        nativeReadings=dict(cpu=dict(path=pin['inputPin']['path'], sha256=sha(cpu_bytes)),
                            material=dict(path=str(path.relative_to(ROOT)), sha256=sha(raw))),
        localPolicies=dict(resourceRoute='Use the retained source SCB with fresh empty reflection-map/no-cube arithmetic.',
                           lookup='Empty particle lookup borrows the existing white source fallback.',
                           remap='Explicit zero-alpha local remap bypass; native global remap binding remains unobserved.',
                           fog='Saved audience plus current world visibility; shader fog disabled.',
                           raster='Borrow the existing local particle double-sided raster/blend adapter.',
                           placement='Existing saved E missile-root/source-X-reflected surface frame.'),
        nativeDispatchVerified=False, nativeRenderingVerified=False)
    content=(json.dumps(result, indent=2)+'\n').encode(); output=ROOT/'src/content/leona-e-sword-material.json'
    if args.check or output.exists():
        if output.read_bytes()!=content: raise ValueError('Sword material export differs')
    else: output.write_bytes(content)
    print('PASS: conditional VS1/PS24 inputs, mapped fresnel, alphaRef5/255 and explicit local policies; check='+str(args.check))


if __name__ == '__main__': main()
