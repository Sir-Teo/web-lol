"""Preserve the complete bounded launch prefix needed for composed Baron replay."""
import argparse
import importlib.util
import json
import math
from pathlib import Path
from baron_attack_decode import require
from masteryi_q_decode import sha

original = Path('tools/assets/export-baron-attack-history-bounds.py')
spec = importlib.util.spec_from_file_location('baron_original_bounds', original)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
_, historical = module.build()
require(Path('docs/reference/baron-attack-history-bounds.json').read_bytes() == historical,
        'Historical Baron source envelope differs')
source_path = Path('src/content/baron.json')
require(sha(source_path.read_bytes()) == 'e927b8a2c3a879553b797dbb9d4d4b764055656c86aebfbfaa812ed16aefff32',
        'Baron missile source facts differ')
source = json.loads(source_path.read_bytes())
max_travel, tick_rate = 4000, 60  # Existing local projectile range, not native range certification.
flight_ticks = math.ceil(max_travel / source['basicAttack']['missileSpeed'] * tick_rate)
prior = json.loads(historical)
frames = flight_ticks + max(prior['flightTailTicks'], prior['hitHistoryTicks']) + 2
require((flight_ticks, frames) == (185, 312), 'Baron full-prefix bound differs')
text = """import source from './baron.json';
import { TICK_RATE } from './rules';

// Conservative local source-visible bounds, including two interpolation intervals.
// Native particle stop/linger dispatch remains an independent acceptance gate.
export const BARON_ATTACK_FLIGHT_TAIL_TICKS = 87;
export const BARON_ATTACK_HIT_HISTORY_TICKS = 125;
// The composed emitter RNG and surface odometer depend on the full launch prefix.
// Bound all 4,000 source units of flight plus the longer retained presentation tail.
export const BARON_ATTACK_MAX_FLIGHT_TICKS = Math.ceil(
  (4000 / source.basicAttack.missileSpeed) * TICK_RATE
);
export const BARON_ATTACK_PATH_FRAMES =
  BARON_ATTACK_MAX_FLIGHT_TICKS +
  Math.max(BARON_ATTACK_FLIGHT_TAIL_TICKS, BARON_ATTACK_HIT_HISTORY_TICKS) +
  2;
""".encode()
record = dict(format=2, sourceEnvelopeSha256=sha(historical), sourceFactsSha256=sha(source_path.read_bytes()),
              originalGeneratorSha256=sha(original.read_bytes()), helperSha256=sha(Path(__file__).read_bytes()),
              tickRate=tick_rate, localMaxTravel=max_travel, maxFlightTicks=flight_ticks,
              flightTailTicks=prior['flightTailTicks'], hitHistoryTicks=prior['hitHistoryTicks'], pathFrames=frames,
              policy='Complete contiguous launch prefix; bounds existing local range plus longest retained tail. No native ownership or random-stream certification.')
encoded = (json.dumps(record, indent=2) + '\n').encode()
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
outputs = [(Path('src/content/baron-attack-presentation.ts'), text),
           (Path('docs/reference/baron-full-history-bounds.json'), encoded)]
for path, raw in outputs:
    require(not path.exists() or path.read_bytes() == raw, 'Baron full-prefix output differs: ' + str(path))
    require(not args.check or path.exists(), 'Missing Baron full-prefix output')
if not args.check:
    for path, raw in outputs:
        if not path.exists():
            with path.open('xb') as stream:
                stream.write(raw)
print(json.dumps(dict(status='passed', maxFlightTicks=flight_ticks, pathFrames=frames)))
