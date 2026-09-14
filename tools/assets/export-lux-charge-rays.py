"""Verify and export the rotating Final Spark charge quad's source curves."""
import json,runpy
from pathlib import Path
v=runpy.run_path('tools/assets/export-lux-beam-layers.py');record=v['record']
e=next(e for e in record['complexEmitterDefinitionData'] if e['emitterName']=='END_Beam_ROTATING')
assert 'primitive' not in e and e['{8d2e2474}'] and e['isSingleParticle']
assert e['rate']['constantValue']==10

def birth(raw):
 d=raw['dynamics'];assert d['times']==[0] and len(d['values'])==1
 return {'value':d['values'][0],'probabilities':[{'single':t.get('singleValue',t.get('{ad345dd6}',1)), 'times':t.get('{40c351da}',[]),'values':t.get('{e44b7382}',[])} for t in d['{a7084719}']]}
profile={'name':e['emitterName'],'emitterIndex':record['complexEmitterDefinitionData'].index(e),'count':10,'life':e['particleLifetime']['constantValue'],
 'offset':e['{3bf0b4ed}']['{e5f268dd}'],'birthRotation':birth(e['{5932ff9c}']),
 'birthAngularVelocity':e['{1d779e6a}']['constantValue'],'rotationRate':e['{712b01bd}']['dynamics'],
 'birthSize':birth(e['birthScale0']),'scale':e['scale0']['dynamics'],'birthColor':e['birthColor']['constantValue'],'color':e['Color']['dynamics'],
 'multBirth':birth(e['textureMult']['birthUVOffsetMult']),'multScrollRate':e['textureMult']['{22c3cf3e}']['dynamics'],
 'texture':v['lookup'][e['texture'].lower()],'mult':v['lookup'][e['textureMult']['textureMult'].lower()],
 'baseRotation':e['{968279e0}']['constantValue'],'multScale':e['textureMult']['{cd124686}']['constantValue'],'pass':e['pass'],'miscRenderFlags':e['miscRenderFlags']}
Path('src/content/lux-charge-rays.json').write_text(json.dumps(profile,indent=2)+'\n')
print('Verified rotating charge profile for ten particles')
