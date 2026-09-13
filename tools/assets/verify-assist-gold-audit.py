"""Verify cross-version/mode bounty evidence without inventing field semantics."""
import hashlib
import json
from pathlib import Path

pin = json.loads(Path('docs/reference/assist-gold-audit.json').read_text())
for source in pin['sources']:
    raw = Path(source['cache']).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == source['sha256']
    data = json.loads(raw)
    for mode, config in source['modeLinks'].items():
        assert config in data[mode]['Configs']
        assert data[config] == source['configs'][config]
    record = data[source['modeLinks']['Maps/Shipping/Map11/Modes/CLASSIC']]
    expected = (90, 210) if source['version'] == '15.24' else (55, 175)
    assert (record['{11f10a40}'], record['{937cc95a}']) == expected
    assert [record[key] for key in pin['fields'][2:]] == [0.25, 0.5, 1]
    if source['version'] == '16.18':
        for mode in ['URF', 'SWIFTPLAY', 'ULTBOOK']:
            alternate = data[source['modeLinks'][f'Maps/Shipping/Map11/Modes/{mode}']]
            assert (alternate['{11f10a40}'], alternate['{937cc95a}']) == (90, 210)
dictionary = pin['dictionary']
raw = Path(dictionary['cache']).read_bytes()
assert hashlib.sha256(raw).hexdigest() == dictionary['sha256']
names = {line.split(' ', 1)[0].lower() for line in raw.decode().splitlines()}
assert all(field.strip('{}') not in names for field in dictionary['unresolvedFields'])
print('Verified bounty records and mode links; five candidate assist-gold fields remain unnamed')
