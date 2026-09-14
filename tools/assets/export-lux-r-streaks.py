"""Verify the pinned full Lux R binary and export Streaks_Linger birth/motion data."""
import json,runpy
from pathlib import Path
verified=runpy.run_path('tools/assets/export-lux-beam-layers.py')
record=verified['record']
e=next(e for e in record['complexEmitterDefinitionData'] if e['emitterName']=='Streaks_Linger')
assert record['{9c677a2c}'] & 0x100 == 0, 'Analytic drag needs a different integrator'
assert e['isSingleParticle'] and e['rate']['constantValue']==45

def birth(raw):
 dynamics=raw['dynamics']
 assert dynamics['times']==[0] and len(dynamics['values'])==1
 value=dynamics['values'][0]
 return {'value':value if isinstance(value,list) else [value], 'probabilities':[
  {'times':t.get('{40c351da}',[]),'values':t.get('{e44b7382}',[])}
  for t in dynamics['{a7084719}']]}

profile={'name':e['emitterName'],'emitterIndex':record['complexEmitterDefinitionData'].index(e),'count':45,'delay':e['timeBeforeFirstEmission'],
 'life':birth(e['particleLifetime']),'velocity':birth(e['{fa41ab8d}']),
 'offset':birth(e['{3bf0b4ed}']['{e5f268dd}']),'halfSize':birth(e['birthScale0']),
 'multOffset':birth(e['textureMult']['birthUVOffsetMult']),
 'drag':e['{8275da98}']['constantValue'],'emitterPosition':e['{563d4a22}']['constantValue'],
 'rotation':e['{5932ff9c}']['constantValue'],'scale':e['scale0']['dynamics'],'color':e['Color']['dynamics'],
 'multScroll':e['textureMult']['birthUvScrollRateMult']['constantValue'],
 'texture':e['texture'],'textureMult':e['textureMult']['textureMult'],'erosion':e['{c4663005}'],
 'pass':e['pass'],'miscRenderFlags':e['miscRenderFlags']}
Path('src/content/lux-r-streaks.json').write_text(json.dumps(profile,indent=2)+'\n')
print('Verified 45-particle Streaks_Linger source profile; rendering remains separate')
