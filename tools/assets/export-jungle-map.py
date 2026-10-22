"""Export inspection coordinates without assigning spawn/AI behavior or defaults."""
import hashlib
import json
from pathlib import Path

pin = json.loads(Path('docs/reference/jungle-map-source.json').read_text())
records = pin['records']
assert pin['extraction']['referenceVersion'] == '16.18.8175716'
assert records['mode']['JungleRecommendationMapInformation'] == records['locationKey']
assert records['mode']['DefaultJunglePathRecommendation'] == records['routeKey']


def point(position):
    return dict(x=position[0] - 7425, y=7425 - position[2])


camps = []
for entity in records['campEntities']:
    raw = entity['record']
    component = raw['NeutralCamp']
    key = component['CampIdentifier']
    camps.append(dict(key=entity['key'], container=entity['container'], identifier=key,
        name=records['identifiers'][key]['CampName'], identifierDefinition=records['identifiers'][key],
        position=raw['transform'][3][:3], point=point(raw['transform'][3]),
        component=component))
objects = []
for entity in records['neutralCharacterEntities']:
    raw = entity['record']
    objects.append(dict(key=entity['key'], container=entity['container'], sourceType=raw['__type'],
        name=raw.get('name'), character=raw['Character']['CharacterRecord'],
        skin=raw['Character'].get('Skin'), position=raw['transform'][3][:3],
        point=point(raw['transform'][3]), tags=raw.get('tags')))
locations = []
for raw in records['locations']['JungleLocationInformation']:
    locations.append(dict(name=raw['name'], position=raw['Position'], point=point(raw['Position']),
        index=raw.get('Index'), location=raw.get('Location')))
routes = {team: [dict(kind=step['__type'], camp=step.get('Camp')) for step in steps]
          for team, steps in records['routes'].items() if team != '__type'}
result = dict(sourcePin='docs/reference/jungle-map-source.json',
    sourcePinSha256=hashlib.sha256(Path('docs/reference/jungle-map-source.json').read_bytes()).hexdigest(),
    camps=camps, neutralObjects=objects, recommendations=locations, routes=routes,
    status='Inspection only; recommendation coordinates and neutral templates are not a live spawn roster.')
path = Path('src/content/jungle-map-inspection.json')
text = json.dumps(result, indent=2) + '\n'
if not path.exists() or path.read_text() != text:
    path.write_text(text)
print(f'Exported {len(camps)} camp anchors, {len(objects)} neutral character objects, {len(locations)} recommendations; absent fields remain null')
