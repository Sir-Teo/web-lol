"""Verify complete pinned champion XP records and their standard-mode links."""
import hashlib
import json
from pathlib import Path

pin = json.loads(Path('docs/reference/champion-kill-xp.json').read_text())
raw = Path('.cache/map11-definition.json').read_bytes()
assert hashlib.sha256(raw).hexdigest() == pin['sha256']
source = json.loads(raw)
mode = source[pin['mode']]
assert mode['mExperienceCurveData'] == pin['curveRecord']
assert mode['mGameModeConstants'] == pin['constantsRecord']
assert source[pin['curveRecord']] == pin['curve']
fields = {name: entry for group in source[pin['constantsRecord']]['mGroups'].values()
          for name, entry in group.get('mConstants', {}).items()
          if name in pin['constants']}
assert fields == pin['constants']
# Independent values from Riot's 13.4 release notes, still present in this patch pin.
assert pin['curve']['mExperienceGrantedForKillPerLevel'][:10] == [42, 114, 144, 174, 204, 234, 308, 392, 486, 590]
assert fields['ai_ExpRadius2']['mValue'] == 1600
assert fields['aiExp_timeForKillCreditAfterDeath']['mValue'] == 10
print('Verified map SHA, standard-mode links, full XP curve, proximity/death constants and published level 1–10 rewards.')
