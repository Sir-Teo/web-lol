"""Extract active impact ring/flash profiles; keep source float precision."""
import json
from pathlib import Path
p = json.loads(Path('docs/reference/lux-attack-impact.json').read_text())
normal, critical = [p['records']['Characters/Lux/Skins/Skin0/Particles/'+n]['complexEmitterDefinitionData'] for n in ['Lux_Base_BA_tar','Lux_Base_BA_tar_crit']]
textures = {t['path'].lower(): t['output'].removeprefix('public/') for t in p['textures']}
profiles = []
for e in critical:
    if e['emitterName'] == 'sparks': continue
    assert not e.get('{33f36f05}', False) and e['isUniformScale'] == 1
    assert e['rate']['constantValue'] == 1
    assert e.get('blendMode',0) in [0,4]
    assert all(e.get(name, default) in [0,1] for name,default in [('colorLookUpTypeX',1),('colorLookUpTypeY',0)])
    if e['emitterName'] in ['blastring','outerring']:
        n = next(n for n in normal if n['emitterName'] == ('outerring1' if e['emitterName']=='outerring' else 'blastring'))
        assert {k:v for k,v in n.items() if k!='emitterName'} == {k:v for k,v in e.items() if k!='emitterName'}
    scale = e['scale0']['dynamics']
    color = e.get('Color', {}).get('dynamics', {'times':[0], 'values':[[1,1,1,1]]})
    rotation = e.get('birthRotation0', {'constantValue':[0,0,0]})
    chance = rotation.get('dynamics', {}).get('probabilityTables', [{}])[0]
    if chance: assert chance['keyTimes'] == [0,1] and chance['keyValues'] == [0,360]
    lookup_scale = e.get('{f02bd44d}', [1,.5])
    lookup_offset = e.get('{cd5a323e}', [0,0])
    profiles.append(dict(name=e['emitterName'], criticalOnly=e['emitterName'] in ['flash','ring'],
        life=e['particleLifetime']['constantValue'], blend=e.get('blendMode',0),
        source=textures[e['texture'].lower()], lookup=textures.get(e.get('particleColorTexture','').lower()),
        scale=e['birthScale0']['constantValue'][0], scaleTimes=scale['times'], scales=[v[0] for v in scale['values']],
        colorTimes=color['times'], colors=color['values'], rotation=rotation['constantValue'][0], randomRotation=bool(chance),
        lookupTypes=[e.get('colorLookUpTypeX',1),e.get('colorLookUpTypeY',0)], lookupScale=lookup_scale, lookupOffset=lookup_offset,
        atlas=[*e.get('texDiv',[1,1]),e.get('{76f8ad24}',0)]))
assert len(profiles)==4
Path('src/content/lux-impact-rings.json').write_text(json.dumps(profiles,indent=2)+'\n')
print('Exported four active ring/flash profiles; spark motion excluded')
