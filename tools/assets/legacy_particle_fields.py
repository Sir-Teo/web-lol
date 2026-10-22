"""Shared legacy scalar/vector curve and probability extraction; no renderer defaults."""
def vec(value, size):
    return value if isinstance(value, list) else [value] * size


def curve(fields, prefix, size):
    entries = [value for key, value in fields.items()
               if key.startswith(prefix) and key[len(prefix):].isdigit()]
    entries.sort(key=lambda value: value[0])
    assert all(len(entry) in [2, size + 1] for entry in entries)
    return [dict(time=v[0], value=vec(v[1:] if len(v) > 2 else v[1], size)) for v in entries]


def probability(fields, prefix, axis=None):
    if axis is None:
        candidates = [prefix + 'P', prefix + 'XP']
    else:
        candidates = [prefix + axis + 'P', prefix + 'P'] if axis == 'X' else [prefix + axis + 'P']
    found = []
    for candidate in candidates:
        points = [v for k, v in fields.items() if k.startswith(candidate) and k[len(candidate):].isdigit()]
        if points:
            points.sort(key=lambda p: p[0])
            assert all(len(p) == 2 for p in points)
            found.append(dict(times=[p[0] for p in points], values=[p[1] for p in points]))
    assert len(found) <= 1, 'Ambiguous scalar/axis probability declaration'
    return found[0] if found else dict(times=[], values=[], single=1)
