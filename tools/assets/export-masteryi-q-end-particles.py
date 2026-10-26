"""Deliver complete Q reappearance emitters and exact authored mip transports."""
from pathlib import Path
import argparse,json,runpy,math
from masteryi_q_particles import SOURCE_ROOT,load,checked,require
from masteryi_q_decode import sha
from masteryi_q_end import profiles
from masteryi_audio_graph import write_outputs
TRANSPORT=Path('docs/reference/masteryi/q-end-texture-transport.json')
TRANSPORT_SHA256='4dd2ab7ec55069934bb1a15889bcb24dfcce0825680f85263fb70067047c1b0d'
def json_bytes(x):return (json.dumps(x,indent=2,allow_nan=False)+'\n').encode()
def generate_outputs():
 pin,_=load();raw=checked(TRANSPORT,TRANSPORT_SHA256);transport=json.loads(raw)
 packer=runpy.run_path(str(Path(__file__).with_name('pack-masteryi-q-end-textures.py')));packer['verify'](transport,SOURCE_ROOT)
 require((packer['OUTPUT']/'textures.json').read_bytes()==raw,'Q reappearance staging differs')
 known=json.loads(Path('src/content/masteryi-q-cast-particles.json').read_text())['textures']+json.loads(Path('src/content/masteryi-q-contact-particles.json').read_text())['textures']+json.loads(Path('src/content/masteryi-w-cast-particles.json').read_text())['textures']+json.loads(Path('src/content/masteryi-w-buff-particles.json').read_text())['textures']
 outputs={};assets=[];urls={}
 for t in transport['textures']:
  shared=next((k for k in known if k['sha256']==t['sha256']and k['bytes']==t['bytes']),None)
  url=shared['url']if shared else f"assets/effects/masteryi-q-end-{t['source']['wadPathHash']}.png";urls[t['source']['path']]=url;assets.append({**t,'key':t['source']['wadPathHash'],'url':url});outputs[Path('public')/url]=checked(t['path'],t['sha256'],t['bytes'])
 defaults_path=Path('docs/reference/garen-spin-defaults.json');defaults_raw=checked(defaults_path,'51aaa77125b84ae77e05586d31c7e45de3037028345222a0addd1ed188debefb')
 compiled=profiles(pin,urls,json.loads(defaults_raw)['defaults']);ends=[]
 for p in compiled:
  rate=p['rate']['values'][0][0];count=max(1,math.trunc(rate))if p['single']else max(1,math.floor(math.floor(p['emitterLife']*60)*rate/60));last=1 if p['single']else math.ceil(count*60/rate);ends.append(last+math.ceil(max(v[0]for v in p['life']['values'])*60)+1)
 retention=max(ends);require(retention==18 and len(assets)==5 and sum(len(t['rectangles'])for t in assets)==41,'Q reappearance delivery/retention differs')
 content={'textures':assets,'profiles':compiled};outputs[Path('src/content/masteryi-q-end-particles.json')]=json_bytes(content);outputs[Path('src/content/masteryi-q-end-timing.ts')]=f'// Complete finite source emission/life bound on the local first-update grid.\nexport const ALPHA_END_HISTORY_TICKS = {retention};\n'.encode()
 reading={'format':1,'sourcePinSha256':sha(Path('docs/reference/masteryi/q-particles.json').read_bytes()),'transport':{'path':str(TRANSPORT),'sha256':TRANSPORT_SHA256},'profileSha256':sha(json_bytes(content)),'historyTicks':retention,'readerDefaults':{'path':str(defaults_path),'sha256':sha(defaults_raw)},'frameRateCandidate':{'name':'frameRate','rawHash':'{9b111ae4}','hashMatches':True,'value':10},'limits':['Complete two-emitter Q_End only. Local accepted reappearance transition creates this system; death/victory cancellation does not.','Raw frame-rate hash remains in source. Atlas random start plus local age-times-rate seek is an explicit local adapter, not a native update/RNG certificate.','Accepted Q and actor-root attachment, source-X reflection, first-update grid, cosmetic hashes and shader defaults are local reconstruction policies. Known unbound particles retain their birth root; bound particles follow saved visible actor roots.','Source particle linger values remain retained without extending finite visible lives. Q_End omits an on-create sound field; this renderer adds none. Source mode 2 uses the existing local early-copy distortion route with raw strength; native CPU phase/power mapping remains unverified.']};outputs[Path('docs/reference/masteryi/q-end-runtime-reading.json')]=json_bytes(reading)
 return list(outputs.items()),content,reading
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args();outputs,content,reading=generate_outputs();write_outputs(outputs,args.check);print(json.dumps({'profiles':len(content['profiles']),'textures':len(content['textures']),'mips':41,'historyTicks':reading['historyTicks']}))
