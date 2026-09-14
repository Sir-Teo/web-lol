"""Re-extract the selected pinned Lux R emitters and losslessly export their textures."""
import io,json,hashlib
from pathlib import Path
from PIL import Image
from cdtb import binfile
from cdtb.export import TexConverter
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive
pin=json.loads(Path('docs/reference/lux-beam-layers.json').read_text())
skin=json.loads(Path('docs/reference/lux-model.json').read_text())['skin']['data']
assert skin['Characters/Lux/Skins/Skin0/Resources']['resourceMap']['Lux_R_mis_beam']==pin['record']
assert pin['sourceBin'] in [path.lower() for path in skin['__linked']]
paths=[f['path'] for f in pin['extraction']['files']]
a=RiotArchive({f'{xxh64_intdigest(p):016x}':p for p in paths+['data/final/champions/lux.wad.subchunktoc']},pin['extraction'],archive_name='DATA/FINAL/Champions/Lux.wad.client')
root=Path('.cache/lux-beam-sources');a.extract(paths,root)
fields,types,values,entries,assets={},{},{},{},{}
def collect(v):
 if isinstance(v,dict):
  for k,c in v.items():
   if not k.startswith('{'): fields[binfile.compute_binhash(k)]=k
   if k=='__type' and not c.startswith('{'): types[binfile.compute_binhash(c)]=c
   collect(c)
 elif isinstance(v,list):
  for c in v: collect(c)
 elif isinstance(v,str) and v.isascii() and not v.startswith('{'):
  values[binfile.compute_binhash(v)]=v
  entries[binfile.compute_binhash(v)]=v
  assets[xxh64_intdigest(v.lower())]=v
collect(pin)
fields[binfile.compute_binhash('complexEmitterDefinitionData')]='complexEmitterDefinitionData'
for obj,mapping in [(binfile.hashfile_binfields,fields),(binfile.hashfile_bintypes,types),(binfile.hashfile_binhashes,values),(binfile.hashfile_binentries,entries),(binfile.hashfile_binpaths,assets)]: obj.hashes=mapping
record=json.loads(json.dumps(binfile.BinFile(io.BytesIO((root/pin['sourceBin']).read_bytes())).to_serializable()))[pin['record']]
assert len(record['complexEmitterDefinitionData'])==pin['emitterCount']
names={e['emitterName'] for e in pin['emitters']}
assert [e for e in record['complexEmitterDefinitionData'] if e.get('emitterName') in names]==pin['emitters']
implemented = names | set(pin.get('additionalImplementedEmitters',[]))
assert implemented <= {e['emitterName'] for e in record['complexEmitterDefinitionData']}
audit = {
 'record': pin['record'],
 'sourceBin': pin['sourceBin'],
 'sourceBinSha256': hashlib.sha256((root/pin['sourceBin']).read_bytes()).hexdigest(),
 'selectedNames': [e['emitterName'] for e in record['complexEmitterDefinitionData'] if e['emitterName'] in implemented],
 'emitters': [{
  'name': e['emitterName'],
  'disabled': bool(e.get('disabled', e.get('{33f36f05}', False))),
  'primitive': e.get('primitive', {}).get('__type'),
  'implemented': e['emitterName'] in implemented,
  'blend': e.get('blendMode', 0),
  'pass': e.get('pass', 0),
  'delay': e.get('timeBeforeFirstEmission', 0),
  'constantParticleLife': e.get('particleLifetime', {}).get('constantValue'),
 } for e in record['complexEmitterDefinitionData']],
 'definition': record,
 'limitations': ['Primitive and field hashes without decoded names remain unresolved.',
                 'Selected emitter rendering does not establish complete native effect or attachment parity.'],
}
Path('docs/reference/lux-beam-complete.json').write_text(json.dumps(audit, indent=2)+'\n')
for t in pin['textures']:
 im=Image.open(io.BytesIO(TexConverter.tex_to_dds((root/t['path']).read_bytes()))).convert('RGBA')
 assert list(im.size)==[t['width'],t['height']]
 assert hashlib.sha256(im.tobytes()).hexdigest()==t['rgbaSha256']
 im.save(t['output'])
 assert Image.open(t['output']).convert('RGBA').tobytes()==im.tobytes()
lookup={t['path']:t['output'].removeprefix('public/') for t in pin['textures']}
def birth_offset(e):
 raw=e.get('birthUVOffset',e.get('{b9198a2a}',{}))
 dynamics=raw.get('dynamics')
 if not dynamics:return {'value':raw.get('constantValue',[0,0]),'probabilities':None}
 assert dynamics['times']==[0] and len(dynamics['values'])==1
 tables=dynamics.get('probabilityTables',dynamics.get('{a7084719}'))
 return {'value':dynamics['values'][0], 'probabilities':[
  {'times':t.get('keyTimes',t.get('{40c351da}',[])), 'values':t.get('keyValues',t.get('{e44b7382}',[]))}
  for t in tables] if tables is not None else None}
def erosion(e):
 raw=e.get('alphaErosionDefinition',e.get('{c4663005}'))
 if raw is None:return None
 assert set(raw) <= {'__type','{c6fbacd5}','{34bee0ea}','{2244caa3}','{5da05f9b}','erosionDriveCurve','erosionFeatherIn','erosionFeatherOut','erosionMapName','{b0794a80}','erosionMapChannelMixer'}, 'Unsupported erosion fields need explicit interpretation'
 def field(name,h):return raw.get(name,raw.get('{'+h+'}'))
 mixer=field('erosionMapChannelMixer','b0794a80') or {'constantValue':[0,0,0,1]}
 assert 'dynamics' not in mixer, 'Animated erosion mixers need explicit playback support'
 return {'texture':lookup[field('erosionMapName','5da05f9b').lower()],
  'drive':field('erosionDriveCurve','c6fbacd5')['dynamics'],
  'featherIn':field('erosionFeatherIn','34bee0ea'),
  'featherOut':field('erosionFeatherOut','2244caa3'),
  'sliceWidth':1.5,'mixer':mixer['constantValue'],'addressMode':2}
def static_uvscale(raw):
 assert 'dynamics' not in raw, 'Animated UV scale needs explicit playback support'
 return raw.get('constantValue',[1,1])
profiles=[]
for e in pin['emitters']:
 assert e['primitive']['__type'] in ['VfxPrimitiveBeam','{4beb81fd}'] and e['blendMode'] in [1,4]
 quad=None
 if e['primitive']['__type']=='{4beb81fd}':
  assert e['emitterName'] in ['WOOSH','RainbowGlow'] and e['{5932ff9c}']['constantValue']==[90,0,0]
  assert e['{3bf0b4ed}']['{e5f268dd}'][:2]==[0,0] and e.get('{fa41ab8d}',{'constantValue':[0,0,0]})['constantValue'][:2]==[0,0]
  quad={'offset':e['{3bf0b4ed}']['{e5f268dd}'],'velocity':e.get('{fa41ab8d}',{'constantValue':[0,0,0]})['constantValue'],'halfSize':e['birthScale0']['constantValue'],'rotation':e['{5932ff9c}']['constantValue']}
 mult=e.get('textureMult',{})
 profiles.append({'uvScale':static_uvscale(e.get('{eddebb48}',e.get('uvScale',{}))),'uvScaleMult':static_uvscale(mult.get('{cd124686}',mult.get('uvScaleMult',{}))),'count':max(int(e['rate']['constantValue']) & 0xffff,1),'quad':quad,'erosion':erosion(e),'emitterIndex':next(i for i,x in enumerate(record['complexEmitterDefinitionData']) if x['emitterName']==e['emitterName']),'birthOffset':birth_offset(e),'texDiv':e.get('texDiv',e.get('{86a84509}',[1,1])),'texDivMult':mult.get('texDivMult',mult.get('{164b5733}',[1,1])),'miscRenderFlags':e.get('miscRenderFlags',0),'name':e['emitterName'],'delay':e.get('timeBeforeFirstEmission',0),'life':e['particleLifetime']['constantValue'],'blend':e['blendMode'],'pass':e.get('pass',0),'width':e['birthScale0']['constantValue'][0],'sourceOffset':e['primitive'].get('mBeam',{}).get('mLocalSpaceSourceOffset',[0,0,0]),'targetOffset':e['primitive'].get('mBeam',{}).get('mLocalSpaceTargetOffset',[0,0,0]),'scale':e.get('scale0',{'dynamics':{'times':[0,1],'values':[[1,1,1],[1,1,1]]}})['dynamics'],'color':e.get('Color',{'constantValue':[1,1,1,1]}),'birthColor':e.get('birthColor',{}).get('constantValue',[1,1,1,1]),'texture':lookup[e['texture'].lower()],'mult':lookup[mult['textureMult'].lower()] if mult else '','scroll':e.get('birthUvScrollRate',{}).get('constantValue',[0,0]),'scrollCurve':e.get('particleUVScrollRate',{}),'multScroll':mult.get('birthUvScrollRateMult',{}).get('constantValue',[0,0]),'multOffset':mult.get('birthUVOffsetMult',{}).get('constantValue',[0,0]),'multAddress':mult.get('texAddressModeMult',0)})
Path('src/content/lux-beam-layers.ts').write_text('// Generated by tools/assets/export-lux-beam-layers.py.\nexport const LUX_BEAM_LAYERS = '+json.dumps(profiles,indent=2)+' as const;\n')
print(f"Verified {len(profiles)} native emitters, {len(paths)} original files and {len(pin['textures'])} lossless texture exports")
