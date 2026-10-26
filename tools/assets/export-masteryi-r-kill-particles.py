"""Deliver complete Highlander takedown source particles and reuse the native Q trail."""
from pathlib import Path
import argparse,json,math,runpy
from masteryi_r_particles import SOURCE_ROOT,load,checked,require
from masteryi_r_kill import profiles
from masteryi_q_decode import sha
from masteryi_audio_graph import write_outputs
TRANSPORT=Path('docs/reference/masteryi/r-kill-texture-transport.json')
TRANSPORT_SHA256='40f89c39c27eec6127a9f32991bcad52e0cfa7d8832ab1969363d134aca6189f'
def json_bytes(x):return(json.dumps(x,indent=2,allow_nan=False)+'\n').encode()
def generate_outputs():
 pin,_=load();raw=checked(TRANSPORT,TRANSPORT_SHA256);transport=json.loads(raw);packer=runpy.run_path(str(Path(__file__).with_name('pack-masteryi-r-kill-textures.py')));packer['verify'](transport,SOURCE_ROOT)
 require((packer['OUTPUT']/'textures.json').read_bytes()==raw,'Highlander takedown staging differs')
 known=[t for name in ['q-cast','q-contact','q-end','w-cast','w-buff','r-cast']for t in json.loads(Path('src/content/masteryi-'+name+'-particles.json').read_text())['textures']]
 outputs={};assets=[];urls={}
 for t in transport['textures']:
  shared=next((k for k in known if(k['sha256'],k['bytes'])==(t['sha256'],t['bytes'])),None);url=shared['url']if shared else f"assets/effects/masteryi-r-kill-{t['source']['wadPathHash']}.png";urls[t['source']['path']]=url;assets.append({**t,'key':t['source']['wadPathHash'],'url':url});outputs[Path('public')/url]=checked(t['path'],t['sha256'],t['bytes'])
 mesh=json.loads(Path('src/content/masteryi-q-contact-particles.json').read_text())['mesh'];outputs[Path('public')/mesh['url']]=checked(Path('public')/mesh['url'],mesh['sha256'],mesh['bytes'])
 defaults_path=Path('docs/reference/garen-spin-defaults.json');defaults_raw=checked(defaults_path,'51aaa77125b84ae77e05586d31c7e45de3037028345222a0addd1ed188debefb');compiled=profiles(pin,urls,{'assets/characters/masteryi/skins/base/particles/common_hecarim_qtrail.scb':mesh['url']},json.loads(defaults_raw)['defaults']);ends=[]
 for p in compiled:
  rate=p['rate']['values'][0][0];count=max(1,math.trunc(rate))if p['single']else max(1,math.floor(math.floor(p['emitterLife']*60)*rate/60));last=1 if p['single']or count==1 else math.ceil(count*60/rate);ends.append(last+math.ceil(max(v[0]for v in p['life']['values'])*60)+1)
 retention=max(ends);require(retention==88 and len(assets)==5 and sum(len(t['rectangles'])for t in assets)==42,'Highlander takedown closure/retention differs')
 content={'textures':assets,'mesh':mesh,'profiles':compiled};outputs[Path('src/content/masteryi-r-kill-particles.json')]=json_bytes(content);outputs[Path('src/content/masteryi-r-kill-timing.ts')]=f'// Complete finite source emission/life bound on the local first-update grid.\nexport const HIGHLANDER_KILL_HISTORY_TICKS = {retention};\n'.encode()
 reading={'format':1,'sourcePinSha256':sha(Path('docs/reference/masteryi/r-particles.json').read_bytes()),'transport':{'path':str(TRANSPORT),'sha256':TRANSPORT_SHA256},'profileSha256':sha(json_bytes(content)),'historyTicks':retention,'readerDefaults':{'path':str(defaults_path),'sha256':sha(defaults_raw)},'sharedMesh':mesh,'limits':['Complete three-emitter R_OnBuffKill only; local creation follows an actually awarded living active-R extension, not every cooldown refund. Native script callback mapping remains unverified.','The native trail transport is exactly the existing Q contact GLB. Source corners/UV/face RGB remain separate from the explicit root/reflection/shader adapter.','Source pass -13/100, bind, velocity, spin, UV scroll and birth probabilities are retained; fixed cosmetic draws consume no gameplay RNG.','No source on-create or persistent sound is authored by this system; it adds no audio.','Local first-update/rate grid, neutral omitted lookup, defaults and actor-root visibility remain reconstruction choices. Source linger does not extend finite visible lives.']};outputs[Path('docs/reference/masteryi/r-kill-runtime-reading.json')]=json_bytes(reading)
 return list(outputs.items()),content,reading
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args();outputs,content,reading=generate_outputs();write_outputs(outputs,args.check);print(json.dumps({'profiles':3,'textures':5,'mips':42,'sharedMeshes':1,'historyTicks':reading['historyTicks']}))
