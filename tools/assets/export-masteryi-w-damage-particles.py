"""Deliver both Meditate damage emitters using existing Q contact texture transports."""
from pathlib import Path
import argparse,json,math,runpy
from masteryi_w_particles import SOURCE_ROOT,load,checked,require
from masteryi_w_damage import profiles
from masteryi_q_decode import sha
from masteryi_audio_graph import write_outputs
TRANSPORT=Path('docs/reference/masteryi/w-particle-texture-transport.json')
TRANSPORT_SHA256='66ce933143a662f0f2506b96520d2d4f6e7ab206a1cb58d8da6b3b94e01e5cfd'
def json_bytes(x):return(json.dumps(x,indent=2,allow_nan=False)+'\n').encode()
def generate_outputs():
 pin,_=load();raw=checked(TRANSPORT,TRANSPORT_SHA256);transport=json.loads(raw);packer=runpy.run_path('tools/assets/pack-masteryi-w-textures.py');packer['verify'](transport,SOURCE_ROOT);require((packer['OUTPUT']/'textures.json').read_bytes()==raw,'Meditate texture staging differs')
 definitions=pin['resources']['MasterYi_W_Dmg']['definition'];paths={e[k].lower()for e in definitions['complexEmitterDefinitionData']for k in ['texture','particleColorTexture']};known=json.loads(Path('src/content/masteryi-q-contact-particles.json').read_text())['textures'];assets=[];urls={};outputs={}
 for t in transport['textures']:
  if t['source']['path']not in paths:continue
  shared=next((k for k in known if(k['sha256'],k['bytes'])==(t['sha256'],t['bytes'])),None);require(shared is not None,'Meditate damage transport no longer reuses Q contacts');urls[t['source']['path']]=shared['url'];assets.append({**t,'key':t['source']['wadPathHash'],'url':shared['url']});outputs[Path('public')/shared['url']]=checked(t['path'],t['sha256'],t['bytes'])
 require(len(assets)==4 and sum(len(t['rectangles'])for t in assets)==32,'Meditate damage texture closure differs')
 defaults_path=Path('docs/reference/garen-spin-defaults.json');defaults_raw=checked(defaults_path,'51aaa77125b84ae77e05586d31c7e45de3037028345222a0addd1ed188debefb');compiled=profiles(pin,urls,json.loads(defaults_raw)['defaults']);ends=[]
 for p in compiled:
  rate=p['rate']['values'][0][0];count=max(1,math.trunc(rate))if p['single']else max(1,math.floor(math.floor(p['emitterLife']*60)*rate/60));last=1 if p['single']or count==1 else math.ceil(count*60/rate);ends.append(last+math.ceil(max(v[0]for v in p['life']['values'])*60)+1)
 retention=max(ends);require(retention==15,'Meditate damage retention differs');content={'textures':assets,'profiles':compiled};outputs[Path('src/content/masteryi-w-damage-particles.json')]=json_bytes(content);outputs[Path('src/content/masteryi-w-damage-timing.ts')]=f'// Complete finite source emission/life bound on the local first-update grid.\nexport const MEDITATE_DAMAGE_HISTORY_TICKS = {retention};\n'.encode()
 reading={'format':1,'sourcePinSha256':sha(Path('docs/reference/masteryi/w-particles.json').read_bytes()),'transport':{'path':str(TRANSPORT),'sha256':TRANSPORT_SHA256},'profileSha256':sha(json_bytes(content)),'historyTicks':retention,'readerDefaults':{'path':str(defaults_path),'sha256':sha(defaults_raw)},'limits':['Complete two-emitter W_Dmg only; local admission follows positive physical/magic damage actually reduced by Meditate, including linger, shields and lethal hits, coalesced once per owner/tick. Native trigger/coalescing remain unverified.','All four texture URLs reuse existing exact Q contact transports; no public PNG or geometry is added.','Hit retains miscRenderFlags=1 and root bind; omitted flash bind remains a distinct explicit local default. Source pass, scale, rotation probability and lookup controls remain exact.','The system omits sound declarations; it adds no audio.','First-update emission, fixed cosmetic draws, default blend/lookup controls, root reflection and visibility are local reconstruction choices. Source linger does not extend visible lives.']};outputs[Path('docs/reference/masteryi/w-damage-runtime-reading.json')]=json_bytes(reading)
 return list(outputs.items()),content,reading
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args();outputs,content,reading=generate_outputs();write_outputs(outputs,args.check);print(json.dumps({'profiles':2,'textures':4,'mips':32,'newPublicAssets':0,'historyTicks':reading['historyTicks']}))
