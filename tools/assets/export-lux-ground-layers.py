"""Verify and normalize all remaining active Final Spark ground-layer source records.
No ground projection or native composition behavior is inferred by this export.
"""
import json,runpy,hashlib
from pathlib import Path
v=runpy.run_path('tools/assets/export-lux-beam-layers.py')
record=v['record'];lookup=v['lookup'];profiles=[]
for index,e in enumerate(record['complexEmitterDefinitionData']):
 if not e.get('{27d40903}') or e.get('disabled',e.get('{33f36f05}',False)): continue
 assert e['isSingleParticle'] and 'dynamics' not in e['rate']
 assert e['blendMode'] in [1,4] and e['miscRenderFlags']==1
 assert e['bindWeight']['constantValue']==1
 assert 'dynamics' not in e['particleLifetime'] and 'dynamics' not in e['birthScale0']
 assert set(e) <= {'timeBeforeFirstEmission','rate','particleLifetime','{2431d42c}','lifetime','isSingleParticle','emitterName','importance','bindWeight','{3bf0b4ed}','primitive','blendMode','birthColor','Color','pass','alphaRef','miscRenderFlags','{27d40903}','{5932ff9c}','birthScale0','texture','__type','{fa41ab8d}','scale0','{968279e0}','textureMult','{3559e15b}','particleUVScrollRate'}
 kind=e['primitive']['__type'];assert kind in ['VfxPrimitiveBeam','{4beb81fd}']
 mult=e.get('textureMult',{})
 assert set(mult) <= {'textureMult','{cd124686}','{22c3cf3e}','birthUVOffsetMult','__type','texAddressModeMult'}
 assert not e.get('birthColor',{}).get('dynamics')
 assert not e.get('{fa41ab8d}',{}).get('dynamics')
 geometry={'kind':'beam' if kind=='VfxPrimitiveBeam' else 'arbitraryQuad',
  'birthSize':e['birthScale0']['constantValue'],
  'uniformScale':bool(e.get('{3559e15b}',False)),
  'scale':e.get('scale0',{'constantValue':[1,1,1]}),
  'rotation':e.get('{5932ff9c}',{}).get('constantValue',[0,0,0]),
  'offset':e.get('{3bf0b4ed}',{}).get('{e5f268dd}',[0,0,0]),
  'velocity':e.get('{fa41ab8d}',{}).get('constantValue',[0,0,0]),
  'beam':e['primitive'].get('mBeam')}
 assert isinstance(geometry['offset'],list) and len(geometry['offset'])==3
 profiles.append({'name':e['emitterName'],'emitterIndex':index,'count':max(int(e['rate']['constantValue']) & 0xffff,1),
  'delay':e.get('timeBeforeFirstEmission',0),'life':e['particleLifetime']['constantValue'],
  'emitterLifetime':e['lifetime'],'particleLinger':e.get('{2431d42c}',0),
  'ground':True,'blend':e['blendMode'],'pass':e.get('pass',0),'miscRenderFlags':e['miscRenderFlags'],
  'geometry':geometry,'color':e['Color'],'birthColor':e.get('birthColor',{}).get('constantValue',[1,1,1,1]),
  'texture':lookup[e['texture'].lower()],'mult':lookup[mult['textureMult'].lower()] if mult else '',
  'uvRotation':v['static_uvrotation'](e.get('{968279e0}',{})),
  'multAddress':mult.get('texAddressModeMult',0),'uvScale':[1,1],'uvScaleMult':v['static_uvscale'](mult.get('{cd124686}',{})),
  'birthOffset':v['birth_offset'](e),'scrollCurve':e.get('particleUVScrollRate',{}),
  'multBirth':v['birth_offset']({'birthUVOffset':mult.get('birthUVOffsetMult',{})}),
  'multScrollCurve':mult.get('{22c3cf3e}',{}),
  'multScroll':mult.get('birthUvScrollRateMult',{}).get('constantValue',[0,0])})
for p in profiles:
 if p['name'] in ['Burnt','Burnt1']:
  assert p['count']==1 and p['delay']==1 and p['life']==1.5 and p['blend']==1
  assert p['geometry']['scale']=={'constantValue':[1,1,1]}
  assert p['geometry']['velocity']==[0,0,0] and not p['mult'] and p['uvRotation']==0
for p in profiles:
 if p['delay']==0 and p['geometry']['kind']=='arbitraryQuad':
  assert p['blend']==4 and p['mult'] and p['multAddress']==0 and p['uvRotation']==90
  assert p['geometry']['scale']['dynamics']['times']==[0,1]
  assert p['geometry']['scale']['dynamics']['values']==[[0.800000011920929,1,1],[1,1,1]]
  assert p['life']==0.949999988079071
for p in profiles:
 if p['geometry']['kind']=='beam':
  assert p['count']==1 and p['life']==1 and p['delay']==0 and p['blend']==4 and p['multAddress']==2
  assert p['geometry']['beam']=={'mLocalSpaceSourceOffset':[0,0,-150], 'mBirthTilingSize':{'constantValue':[0,-1,1],'__type':'ValueVector3'},'__type':'VfxBeamDefinitionData'}
  assert p['uvRotation']==0 and p['multScroll']==[0,0] and not p['multScrollCurve']
expected={e['emitterName'] for e in record['complexEmitterDefinitionData'] if e.get('{27d40903}') and not e.get('disabled',e.get('{33f36f05}',False))}
assert {p['name'] for p in profiles}==expected, 'Ground inventory must cover exactly the active ground source emitters'
assert len(profiles)==17 and sum(p['geometry']['kind']=='beam' for p in profiles)==2
out=Path('src/content/lux-ground-layers.json');out.write_text(json.dumps(profiles,indent=2)+'\n')
audit={'sourceBinSha256':v['audit']['sourceBinSha256'],'profile':str(out),'profileSha256':hashlib.sha256(out.read_bytes()).hexdigest(),
 'count':17,'quads':15,'beams':2,'renderedNames':[p['name'] for p in profiles if p['name'] in v['implemented']],
 'ordering':[{ 'name':p['name'],'pass':p['pass'],'sourceIndex':p['emitterIndex']} for p in sorted(profiles,key=lambda p:(p['pass'],p['emitterIndex']))],
 'maximumPostReleaseLife':max(p['delay']+p['life'] for p in profiles)-1,
 'requirements':['Ground composition must occur after terrain and before characters/default particles; source pass numbers sort within the ground display list.',
 'Native ground projection remains unresolved. Any local projection policy must be labeled and compared against native captures on flat and sloped terrain.',
 'Preserve negative source Y offsets in the profile. Do not apply them blindly to the current approximate airborne cast origin.',
 'Burnt and Burnt1 need 1.5 seconds after release; retained beam lifetime is extended to 1.5 seconds with these selected layers.',
 'Maintain arbitrary-quad rotations including [90,90,0], uniform-scale multiplication order, source-alpha blend modes, signed UV rotation and independent multiplier phases.',
 'Ground beam source/target offsets require terrain projection rather than the existing camera-facing width path.']}
Path('docs/reference/lux-ground-layers-audit.json').write_text(json.dumps(audit,indent=2)+'\n')
print('Verified all 17 active ground emitters: 15 quads and 2 beams')
