"""Candidate BIN field/type names; hash equivalence does not certify native behavior."""
import re
from baron_attack_decode import require


def binhash(name):
    require(isinstance(name, str) and name.isascii(), 'BIN label must be ASCII')
    result = 0x811c9dc5
    for byte in name.lower().encode('ascii'):
        result = ((result ^ byte) * 0x01000193) & 0xffffffff
    return f'{{{result:08x}}}'


def label_maps(rows):
    result = {}
    for kind in ('binfields', 'bintypes'):
        mapped = {}
        for raw, name in rows[kind]['labels'].items():
            require(re.fullmatch(r'[0-9a-f]{8}', raw) is not None and binhash(name) == '{' + raw + '}',
                    'Candidate name/hash differs')
            require(name not in mapped.values(), 'Ambiguous candidate label')
            mapped['{' + raw + '}'] = name
        result[kind] = mapped
    return result


def relabel(value, maps, reverse=False):
    fields, types = maps['binfields'], maps['bintypes']
    if reverse:
        fields = {name: raw for raw, name in fields.items()}
        types = {name: raw for raw, name in types.items()}
    if isinstance(value, list):
        return [relabel(child, maps, reverse) for child in value]
    if not isinstance(value, dict):
        return value
    result = {}
    for key, child in value.items():
        label = fields.get(key, key)
        require(label not in result, 'Candidate field collision')
        result[label] = types.get(child, child) if key == '__type' else relabel(child, maps, reverse)
    return result
