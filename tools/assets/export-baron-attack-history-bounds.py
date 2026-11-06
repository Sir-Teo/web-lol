"""Bound local source-visible histories from all original Baron attack declarations."""
import argparse
import json
import math
from pathlib import Path
from baron_attack_decode import require
from baron_attack_fields import label_maps
from baron_attack_program import profiles
from masteryi_q_decode import sha

SOURCE = Path('docs/reference/baron-attack-source.json')
SOURCE_SHA = '4b300f952b2a768e1eaa5c5f9eda3dd397e457ba1ead19c10fbd9aaa02c3543a'


def build():
    require(sha(SOURCE.read_bytes()) == SOURCE_SHA, 'Baron attack source differs')
    source = json.loads(SOURCE.read_bytes())
    labels_path = Path('docs/reference/baron-attack-field-reading.json')
    decoded_path = Path('docs/reference/baron-attack-decoded.json')
    require(sha(labels_path.read_bytes()) == '9861875a3e9539b42ea61f95f7539c98f88eef7d077296e4ab293b3e8e3e3040' and
            sha(decoded_path.read_bytes()) == 'ab8f06fee053cd0b2f89759f99f53c5abb1986c9c32e977812ae9129e306da20', 'Baron bound inputs differ')
    decoded = json.loads(decoded_path.read_bytes())
    compiled = profiles(source, label_maps(json.loads(labels_path.read_bytes())['tables']),
        {r['source']['path']: r['source']['wadPathHash'] for r in decoded['textures']},
        {r['source']['path']: r['source']['wadPathHash'] for r in decoded['meshes']})
    rows = []
    for p in compiled:
        life = p['curves']['particleLifetime']
        values = [life['constant'][0], *[v[0] for v in life['values']]]
        require(all(v >= 0 for v in values), 'Unbounded Baron source life')
        probability = life['probabilities'][0] if life['probabilities'] else dict(single=1, values=[])
        peak = max(values) * max([probability['single'], *probability['values']])
        settings = p['settings']
        delay, emitter_life, grace = (settings.get('timeBeforeFirstEmission', 0), settings['lifetime'], settings.get('emitterLinger', 0))
        require(all(math.isfinite(v) and v >= 0 for v in [peak, delay, emitter_life, grace]), 'Unbounded Baron source ownership')
        bound = peak + grace + (delay + emitter_life if p['role'] == 'hit' else 0)
        rows.append(dict(role=p['role'], index=p['index'], name=p['name'], lifePeak=peak,
                         emitterLife=emitter_life, delay=delay, emitterLinger=grace, boundSeconds=bound))
    flight = math.ceil(max(r['boundSeconds'] for r in rows if r['role'] == 'missile') * 60) + 2
    hit = math.ceil(max(r['boundSeconds'] for r in rows if r['role'] == 'hit') * 60) + 2
    require((flight, hit) == (87, 125), 'Baron history bounds differ')
    text = ('// Conservative local source-visible bounds, including two interpolation intervals.\n'
            '// Native particle stop/linger dispatch remains an independent acceptance gate.\n'
            f'export const BARON_ATTACK_FLIGHT_TAIL_TICKS = {flight};\n'
            f'export const BARON_ATTACK_HIT_HISTORY_TICKS = {hit};\n'
            f'export const BARON_ATTACK_PATH_FRAMES = {flight + 3};\n')
    record = dict(sourcePinSha256=SOURCE_SHA, tickRate=60, interpolationMarginTicks=2,
        flightTailTicks=flight, hitHistoryTicks=hit, pathFrames=flight + 3, rows=rows,
        limits=['Conservative local visible-life/absolute emitter-wait envelope, not native ownership/stop certification.',
                'Source particleLinger is retained in the program; this bound does not reinterpret it as an extension of finite natural visible life.'])
    return text.encode(), (json.dumps(record, indent=2) + '\n').encode()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    text, record = build()
    outputs = [(Path('src/content/baron-attack-presentation.ts'), text),
               (Path('docs/reference/baron-attack-history-bounds.json'), record)]
    for path, raw in outputs:
        require(not path.exists() or path.read_bytes() == raw, 'Baron history bound output differs')
        require(not args.check or path.exists(), 'Missing Baron history bound output')
    if not args.check:
        for path, raw in outputs:
            if not path.exists():
                with path.open('xb') as stream: stream.write(raw)
    print(json.dumps(dict(status='passed', flightTailTicks=87, hitHistoryTicks=125, pathFrames=90)))
