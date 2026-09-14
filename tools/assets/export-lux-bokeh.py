"""Verify pinned Lux R source and export Bokeh birth, motion and atlas data."""
import json,runpy
from cdtb.binfile import compute_binhash
from pathlib import Path
v=runpy.run_path('tools/assets/export-lux-beam-layers.py');r=v['record']
e=next(e for e in r['complexEmitterDefinitionData'] if e['emitterName']=='Bokeh')
assert r['{9c677a2c}'] & 0x100 == 0
assert 'primitive' not in e and e['isSingleParticle'] and e['rate']['constantValue']==45
assert e['{3559e15b}'] and e['{e09d5ebb}']
assert e['{86a84509}']==[2,2] and e['{1e67b0f1}']==4
assert e['{5932ff9c}']['constantValue']==[90,90,0]
# These absent fields supply defaults used by the static atlas and normal retirement.
for name in ['frameRate','startFrame','particleLingerType','isRotationEnabled']:
 assert name not in e and '{%08x}' % compute_binhash(name) not in e, name
assert e['{2431d42c}']==2 and e['lifetime'] > 1
assert e['{c4663005}']['{b0794a80}']['constantValue']==[1,0,0,0]
def birth(raw):
 d=raw['dynamics'];assert d['times']==[0] and len(d['values'])==1
 value=d['values'][0]
 return {'value':value if isinstance(value,list) else [value],'probabilities':[
  {'single':t.get('singleValue',t.get('{ad345dd6}',1)), 'times':t.get('{40c351da}',[]),'values':t.get('{e44b7382}',[])} for t in d['{a7084719}']]}
p={'name':'Bokeh','emitterIndex':r['complexEmitterDefinitionData'].index(e),'count':45,'delay':e['timeBeforeFirstEmission'],
 'life':birth(e['particleLifetime']),'velocity':birth(e['{fa41ab8d}']),'offset':birth(e['{3bf0b4ed}']['{e5f268dd}']),
 'halfSize':birth(e['birthScale0']),'birthColor':birth(e['birthColor']),'multOffset':birth(e['textureMult']['birthUVOffsetMult']),
 'drag':e['{8275da98}']['constantValue'],'emitterPosition':e['{563d4a22}']['constantValue'],
 'rotation':e['{5932ff9c}']['constantValue'][0],'uniformScale':True,'scale':e['scale0']['dynamics'],'color':e['Color']['dynamics'],
 'multScroll':e['textureMult']['birthUvScrollRateMult']['constantValue'],
 'atlas':{'divisions':e['{86a84509}'],'frames':e['{1e67b0f1}'],'randomStart':True,'rate':0,'start':0},
 'emitterLifetime':e['lifetime'],'particleLinger':e['{2431d42c}'],'lingerType':0,
 'render':{'texture':v['lookup'][e['texture'].lower()],'mult':v['lookup'][e['textureMult']['textureMult'].lower()],
 'erosion':v['lookup'][e['{c4663005}']['{5da05f9b}'].lower()], 'multScale':e['textureMult']['{cd124686}']['constantValue'],
 'erosionMixer':e['{c4663005}']['{b0794a80}']['constantValue'],'erosionDrive':0,'featherIn':0.1,'featherOut':0.1,'sliceWidth':1.5,
 'pass':e['pass'],'blend':e['blendMode'],'miscRenderFlags':e['miscRenderFlags']}}
assert e['{c4663005}']['{c6fbacd5}']['dynamics']['values']==[0,0]
Path('src/content/lux-bokeh.json').write_text(json.dumps(p,indent=2)+'\n')
print('Verified Bokeh profile and pinned atlas texture')
