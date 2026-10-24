"""Conservative local history bounds, not native lifetime/default certification."""
from pathlib import Path
import hashlib
import json
import math
import sys

source = Path('docs/reference/leona-r-particles.json')
pin = json.loads(source.read_text())
roles = dict(Leona_R_buf='buff', Leona_R_cas='cast', Leona_R_tar='contact',
    Leona_R_hit_aoe_green='area', Leona_R_hit_aoe_red='area', Leona_R_hit_impact='impact')


def life_upper(value):
    # The local omitted-particle-lifetime binding is one second. Native default
    # and negative/phase-owned scheduling remain separate reconstruction work.
    if value is None:
        return 1.0
    assert set(value) <= {'constantValue', 'dynamics', '__type'}
    d = value.get('dynamics', {})
    assert set(d) <= {'times', 'values', 'probabilityTables', '__type'}
    values = [value.get('constantValue', 1), *d.get('values', [])]
    assert all(isinstance(v, (int, float)) and math.isfinite(v) for v in values)
    tables = d.get('probabilityTables', [])
    assert len(tables) <= 1
    scale = 1.0
    for table in tables:
        assert set(table) <= {'keyTimes', 'keyValues', 'singleValue', '__type'}
        samples = table.get('keyValues', []) or [table.get('singleValue', 1)]
        assert all(math.isfinite(v) and v >= 0 for v in samples)
        scale = max(samples)
    return max(0, *values) * scale


records = []
bounds = {}
for system, r in pin['resources'].items():
    role = roles[system]
    for i, e in enumerate(r['definition']['complexEmitterDefinitionData']):
        if e.get('disabled', False):
            continue
        particle = life_upper(e.get('particleLifetime'))
        parts = {k: max(0, e.get(k) or 0) for k in [
            'lifetime', 'particleLinger', 'emitterLinger', 'timeBeforeFirstEmission']}
        assert all(math.isfinite(v) for v in parts.values())
        # Sum authored positive windows even if their actual native overlap
        # would permit shorter retention; add two local settlement updates.
        ticks = math.ceil((particle + sum(parts.values())) * 60) + 2
        bounds[role] = max(bounds.get(role, 0), ticks)
        records.append(dict(system=system, index=i, name=e['emitterName'],
            particleLifeUpper=particle, windows=parts, historyTicks=ticks))
bounds['history'] = max(bounds.values())
bounds['sourceWindow'] = bounds['history'] + 1
result = dict(sourcePinSha256=hashlib.sha256(source.read_bytes()).hexdigest(),
    scope='Conservative local saved-history retention. Not native dispatch/default/update evidence.',
    localOmittedParticleLifetimeSeconds=1, settlementTicks=2, bounds=bounds, records=records)
raw = (json.dumps(result, indent=2) + '\n').encode()
target = Path('src/content/leona-r-history-bounds.json')
if '--check' in sys.argv:
    assert target.read_bytes() == raw
else:
    assert not target.exists()
    target.write_bytes(raw)
print(json.dumps(dict(result='passed', checkOnly='--check' in sys.argv, bounds=bounds)))
