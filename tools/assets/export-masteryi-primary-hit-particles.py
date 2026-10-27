"""Export complete primary hit profiles and reuse exact verified Yi mip transports."""
from pathlib import Path
import argparse,json,runpy
from masteryi_audio_graph import write_outputs
from masteryi_primary_hits import checked,require
from masteryi_q_decode import sha
PREPARE=runpy.run_path('tools/assets/prepare-masteryi-primary-hit-profiles.py')
def json_bytes(x):return(json.dumps(x,indent=2,allow_nan=False)+'\n').encode()
def build():
 _,reading=PREPARE['generate_outputs']();require(Path('docs/reference/masteryi/primary-hit-profile-reading.json').read_bytes()==json_bytes(reading),'Primary hit private profile differs')
 existing={}
 for p in sorted(Path('src/content').glob('masteryi-*-particles.json')):
  if p.name=='masteryi-primary-hit-particles.json':continue
  for row in json.loads(p.read_text()).get('textures',[]):
   source=row.get('source',{}).get('path')
   if source and'url'in row:existing.setdefault(source,row)
 outputs=[];textures=[];names={};reused=[]
 for row in reading['privateTextures']:
  source=row['source']['path'];old=existing.get(source)
  if old:
   require(all(old[k]==row[k]for k in ['source','bytes','sha256','width','height','rectangles','rgbaSha256']),'Shared primary hit texture differs')
   url=old['url'];checked(Path('public')/url,row['sha256'],row['bytes']);reused.append(url)
  else:url='assets/effects/masteryi-primary-hit-'+row['source']['wadPathHash']+'.png'
  names[source]=url;textures.append({**row,'key':row['source']['wadPathHash'],'url':url});outputs.append((Path('public')/url,checked(row['path'],row['sha256'],row['bytes'])))
 profiles=[]
 for p in reading['profiles']:
  profiles.append({**p,'texture':names[p['texture']],'lookup':names[p['lookup']]if p['lookup']else None})
 content={'textures':textures,'profiles':profiles};outputs.append((Path('src/content/masteryi-primary-hit-particles.json'),json_bytes(content)))
 outputs.append((Path('src/content/masteryi-primary-hit-timing.ts'),b'// Conservative complete source life-probability bound on the local first-update grid.\nexport const PRIMARY_HIT_HISTORY_TICKS = 75;\n'))
 runtime={'format':1,'sourceProfile':{'path':'docs/reference/masteryi/primary-hit-profile-reading.json','sha256':sha(json_bytes(reading))},'sourceBindings':reading['bindings'],'profileSha256':sha(json_bytes(content)),'historyTicks':75,'localAdapter':{'admission':'accepted primary contact only','firstBirthOffsetTicks':1,'sourceFrame':'captured attacker Y heading with source-X reflection and 0.01 units','attachment':'independent saved target chest position; no inherited target rotation or scale','fallback':'shared root plus 0.9 for procedural targets, wards and missing structure bones; missing mobile bones reject','forceCadenceHz':60,'forceEndpoints':'Float32, fractional position interpolation','spatialDrag':'hard radius at captured birth root; no distance falloff','visibility':'positive creation audience and both birth endpoints; fully bound particles also require current endpoints','texturelessLookup':'constant white','omittedFluidNumFrames':1,'censorModulation':'raw source retained; no global censorship mode or quality omission inferred'},'reusedTextureUrls':reused,'newTextureUrls':[t['url']for t in textures if t['url']not in reused],'limits':reading['limits'][1:]+["Runtime admission is the game's accepted primary contact. No additional particle events or sounds are inferred.","The local adapter uses saved independent target poses, source-X reflection, 0.01 units, captured source facing and explicit procedural/missing-structure fallback. Native transform inheritance remains uncalibrated."]}
 outputs.append((Path('docs/reference/masteryi/primary-hit-runtime-reading.json'),json_bytes(runtime)))
 return outputs,content,runtime
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--check',action='store_true');args=p.parse_args();outputs,content,reading=build();write_outputs(outputs,args.check);print(json.dumps({'profiles':len(content['profiles']),'textures':len(content['textures']),'mips':93,'reusedTextures':len(reading['reusedTextureUrls']),'newTextures':len(reading['newTextureUrls']),'historyTicks':75}))
