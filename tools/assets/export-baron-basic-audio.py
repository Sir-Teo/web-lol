"""Export verified candidate profiles and unchanged float masters for local preview."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess


def sha(data):
    return hashlib.sha256(data).hexdigest()


def require(ok, message):
    if not ok:
        raise ValueError(message)


def build():
    pins = {
        'docs/reference/baron-basic-audio-properties.json': '0143cb43ed1ac011726985b73ee45541a985bc201256f6d4b896e22a17e2c968',
        'docs/reference/baron-basic-audio-decoded.json': 'ce3dbe0278046a10a2899e41416f260e62fe96a98e1356e809f20879b137d908',
        'docs/reference/baron-audio-candidate-reading.json': 'a6e058c208a15a0c0b11f22781dc077d2b4ed5bf4204a5130f1b07ed85838afe',
    }
    values = []
    for path, expected in pins.items():
        raw = Path(path).read_bytes()
        require(sha(raw) == expected, 'Frozen audio input differs: ' + path)
        values.append(json.loads(raw))
    properties, decoded, reading = values
    nodes = {n['id']: n for n in properties['nodes']}
    masters = {m['id']: m for m in decoded['media']}

    def parameter(identity, suffix):
        rows = [p for p in nodes[identity]['parameters'] if p[0].endswith('/' + suffix)]
        require(len(rows) == 1, 'Ambiguous/missing parameter: ' + suffix)
        return rows[0][2]

    def props(identity):
        rows = nodes[identity]['parameters']
        result = {}
        for path, kind, value, label in rows:
            if path.endswith('/pID') and 'RANGED_MODIFIERS' not in path:
                key = label.split('[')[-1].removesuffix(']')
                matches = [p for p in rows if p[0] == path[:-3] + 'pValue']
                require(key not in result and len(matches) == 1, 'Ambiguous property')
                result[key] = float(matches[0][2])
        return result

    def ranges(identity):
        rows = nodes[identity]['parameters']
        result = {}
        for path, kind, value, label in rows:
            if 'RANGED_MODIFIERS' in path and path.endswith('/pID'):
                key = label.split('[')[-1].removesuffix(']')
                bounds = []
                for suffix in ['min', 'max']:
                    matches = [p for p in rows if p[0] == path[:-3] + suffix]
                    require(len(matches) == 1, 'Missing random modifier bound')
                    bounds.append(float(matches[0][2]))
                require(key not in result and bounds[0] <= bounds[1], 'Invalid random modifier')
                result[key] = bounds
        return result

    outputs, profiles = {}, []
    for phase, role in reading['roles'].items():
        for action in role['actions']:
            container = action['target']
            ap, cp = props(action['id']), props(container)
            require(not ranges(action['id']) and set(ranges(container)).issubset({'Pitch'}), 'Unexpected random modifier')
            require(set(ap).issubset({'DelayTime', 'Probability'}) and set(cp).issubset({'MakeUpGain', 'Pitch'}),
                    'Unexpected attack action/container property')
            require(int(parameter(container, 'DirectParentID')) == 312946903, 'Changed mixer')
            variants = []
            for index in range(int(parameter(container, 'ulPlayListItem'))):
                sound = int(parameter(container, f'AkPlaylistItem:{index}/ulPlayID'))
                require(int(parameter(container, f'AkPlaylistItem:{index}/weight')) == 50000 and
                        int(parameter(sound, 'DirectParentID')) == container, 'Changed playlist')
                sp = props(sound)
                require(set(sp).issubset({'Priority'}) and not ranges(sound), 'Unexpected sound gain/pitch')
                identity = int(parameter(sound, 'sourceID'))
                master = masters[identity]
                raw = Path(f'.cache/baron-basic-audio-decoded-v1/{identity}.wav').read_bytes()
                require(sha(raw) == master['wavSha256'] and len(raw) == master['wavBytes'], 'Decoded master differs')
                url = f'assets/audio/baron-basic/{identity}.wav'
                outputs['public/' + url] = raw
                variants.append(dict(id=identity, soundId=sound, url=url, sha256=master['wavSha256'],
                                     frames=master['frames'], sampleRate=master['sampleRate'],
                                     durationSeconds=master['durationSeconds'], peak=master['peak']))
            profiles.append(dict(phase=phase, eventId=role['id'], actionId=action['id'], containerId=container,
                                 delaySeconds=ap.get('DelayTime', 0) / 1000,
                                 probability=ap.get('Probability', 100) / 100,
                                 gainDb=cp.get('MakeUpGain', 0), pitchCents=cp.get('Pitch', 0),
                                 pitchRangeCents=ranges(container).get('Pitch', [0, 0]),
                                 variants=variants))
    require(len(outputs) == 8 and len(profiles) == 3, 'Changed candidate closure')
    require(not ranges(312946903), 'Unexpected mixer modifier')
    require(props(312946903) == {'Priority': 57, 'AttenuationID': 298947283} and
            int(parameter(312946903, 'OverrideBusId')) == 2770764924, 'Changed mixer routing')
    require(int(parameter(298947283, 'eScaling')) == 2, 'Changed attenuation scaling')
    attenuation = [dict(distance=float(parameter(298947283, f'AkRTPCGraphPoint:{i}/From')),
                        storedValue=float(parameter(298947283, f'AkRTPCGraphPoint:{i}/To')),
                        interpolation=int(parameter(298947283, f'AkRTPCGraphPoint:{i}/Interp'))) for i in range(3)]
    target = 'src/content/baron-basic-audio.ts'
    source = ('// Generated candidate profiles. Local release timing/selection; native dispatch/shuffle/bus remain open.\n'
              'export const BARON_BASIC_AUDIO = ' + json.dumps(profiles, indent=2) + ' as const;\n'
              'export const BARON_BASIC_ATTENUATION = ' + json.dumps(attenuation, indent=2) + ' as const;\n')
    outputs[target] = subprocess.check_output(['node_modules/.bin/prettier', '--stdin-filepath', target], input=source.encode())
    return outputs


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    outputs = build()
    # Preflight the whole closure before publishing anything. Existing differences
    # require an explicit versioned migration, never a silent master replacement.
    for name, raw in outputs.items():
        path = Path(name)
        require(not path.is_symlink(), 'Output cannot be a symlink: ' + name)
        require(not path.exists() or path.read_bytes() == raw, 'Existing output differs: ' + name)
        require(not args.check or path.exists(), 'Missing output: ' + name)
    if not args.check:
        for name, raw in outputs.items():
            path = Path(name)
            path.parent.mkdir(parents=True, exist_ok=True)
            if not path.exists():
                with path.open('xb') as stream:
                    stream.write(raw)
    print(json.dumps(dict(status='passed', files=len(outputs), bytes=sum(map(len, outputs.values())))))
