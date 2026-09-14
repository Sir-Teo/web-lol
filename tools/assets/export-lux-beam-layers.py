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
audit = {
 'record': pin['record'],
 'sourceBin': pin['sourceBin'],
 'sourceBinSha256': hashlib.sha256((root/pin['sourceBin']).read_bytes()).hexdigest(),
 'selectedNames': [e['emitterName'] for e in pin['emitters']],
 'emitters': [{
  'name': e['emitterName'],
  'disabled': bool(e.get('disabled', e.get('{33f36f05}', False))),
  'primitive': e.get('primitive', {}).get('__type'),
  'implemented': e['emitterName'] in names,
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
 assert set(raw) <= {'__type','{c6fbacd5}','{34bee0ea}','{2244caa3}','{5da05f9b}','erosionDriveCurve','erosionFeatherIn','erosionFeatherOut','erosionMapName'}, 'Unsupported erosion fields need explicit interpretation'
 def field(name,h):return raw.get(name,raw.get('{'+h+'}'))
 return {'texture':lookup[field('erosionMapName','5da05f9b').lower()],
  'drive':field('erosionDriveCurve','c6fbacd5')['dynamics'],
  'featherIn':field('erosionFeatherIn','34bee0ea'),
  'featherOut':field('erosionFeatherOut','2244caa3'),
  'sliceWidth':1.5,'mixer':[0,0,0,1],'addressMode':2}
profiles=[]
for e in pin['emitters']:
 assert e['primitive']['__type']=='VfxPrimitiveBeam' and e['blendMode'] in [1,4]
 profiles.append({'erosion':erosion(e),'emitterIndex':next(i for i,x in enumerate(record['complexEmitterDefinitionData']) if x['emitterName']==e['emitterName']),'birthOffset':birth_offset(e),'texDiv':e.get('texDiv',e.get('{86a84509}',[1,1])),'texDivMult':e['textureMult'].get('texDivMult',e['textureMult'].get('{164b5733}',[1,1])),'miscRenderFlags':e.get('miscRenderFlags',0),'name':e['emitterName'],'delay':e.get('timeBeforeFirstEmission',0),'life':e['particleLifetime']['constantValue'],'blend':e['blendMode'],'pass':e.get('pass',0),'width':e['birthScale0']['constantValue'][0],'sourceOffset':e['primitive']['mBeam'].get('mLocalSpaceSourceOffset',[0,0,0]),'targetOffset':e['primitive']['mBeam'].get('mLocalSpaceTargetOffset',[0,0,0]),'scale':e['scale0']['dynamics'],'color':e.get('Color',{'constantValue':[1,1,1,1]}),'birthColor':e.get('birthColor',{}).get('constantValue',[1,1,1,1]),'texture':lookup[e['texture'].lower()],'mult':lookup[e['textureMult']['textureMult'].lower()],'scroll':e.get('birthUvScrollRate',{}).get('constantValue',[0,0]),'scrollCurve':e.get('particleUVScrollRate',{}),'multScroll':e['textureMult'].get('birthUvScrollRateMult',{}).get('constantValue',[0,0]),'multOffset':e['textureMult'].get('birthUVOffsetMult',{}).get('constantValue',[0,0]),'multAddress':e['textureMult'].get('texAddressModeMult',0)})
Path('src/content/lux-beam-layers.ts').write_text('// Generated by tools/assets/export-lux-beam-layers.py.\nexport const LUX_BEAM_LAYERS = '+json.dumps(profiles,indent=2)+' as const;\n')
print(f"Verified {len(profiles)} native emitters, {len(paths)} original files and {len(pin['textures'])} lossless texture exports")
