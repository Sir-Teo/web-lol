"""Extract the shared active Lux impact spark birth and lifetime curves."""
import json
from pathlib import Path
p=json.loads(Path('docs/reference/lux-attack-impact.json').read_text())
sparks=[next(e for e in r['complexEmitterDefinitionData'] if e['emitterName']=='sparks') for r in p['records'].values()]
a,b=sparks
assert a==b and a['isSingleParticle']==1 and a['rate']['constantValue']==5 and not a.get('{33f36f05}',False)
def birth(name):
    v=a[name]; d=v.get('dynamics')
    if d:
        assert d['times']==[0] and d['values'][0]==v['constantValue']
    return {'value':v['constantValue'],'probabilities':d['probabilityTables'] if d else None}
profile={'count':5,'life':birth('particleLifetime'),'velocity':birth('birthVelocity'),'scale':birth('birthScale0'),
 'drag':a['birthDrag']['constantValue'],'color':a['Color']['dynamics'],'relativeScale':a['scale0']['dynamics'],
 'binding':a['bindWeight']['dynamics'],'directionScale':a['{7ad984a5}'],'directionMin':a['{ebd44083}']}
Path('src/content/lux-impact-sparks.json').write_text(json.dumps(profile,indent=2)+'\n')
print('Exported identical normal/critical five-spark burst')
