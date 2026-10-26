"""Retain complete Q_End fields, private textures and explicit reconstruction defaults."""
from pathlib import Path
import argparse,json,runpy,math
from masteryi_q_particles import SOURCE_ROOT,load,checked,require
from masteryi_q_decode import sha
from masteryi_q_end import profiles
from masteryi_audio_graph import write_outputs
TRANSPORT=Path('docs/reference/masteryi/q-end-texture-transport.json')
TRANSPORT_SHA256='4dd2ab7ec55069934bb1a15889bcb24dfcce0825680f85263fb70067047c1b0d'
def json_bytes(x):return (json.dumps(x,indent=2,allow_nan=False)+'\n').encode()
def generate_outputs(transport_path=TRANSPORT):
 pin,_=load();raw=checked(transport_path,TRANSPORT_SHA256);transport=json.loads(raw)
 packer=runpy.run_path('tools/assets/pack-masteryi-q-end-textures.py');packer['verify'](transport,SOURCE_ROOT)
 require((packer['OUTPUT']/'textures.json').read_bytes()==raw,'Q reappearance staging differs')
 defaults_path=Path('docs/reference/garen-spin-defaults.json');defaults_raw=checked(defaults_path,'51aaa77125b84ae77e05586d31c7e45de3037028345222a0addd1ed188debefb')
 compiled=profiles(pin,{t['source']['path']:t['source']['path']for t in transport['textures']},json.loads(defaults_raw)['defaults']);ends=[]
 for p in compiled:
  rate=p['rate']['values'][0][0];count=max(1,math.trunc(rate))if p['single']else max(1,math.floor(math.floor(p['emitterLife']*60)*rate/60));last=1 if p['single']else math.ceil(count*60/rate);ends.append(last+math.ceil(max(v[0]for v in p['life']['values'])*60)+1)
 require(max(ends)==18 and len(transport['textures'])==5 and sum(len(t['rectangles'])for t in transport['textures'])==41,'Q reappearance finite closure differs')
 reading={'format':1,'sourcePinSha256':sha(Path('docs/reference/masteryi/q-particles.json').read_bytes()),'transport':{'path':str(TRANSPORT),'sha256':TRANSPORT_SHA256},'system':'MasterYi_Q_End','flags':pin['resources']['MasterYi_Q_End']['definition']['flags'],'onCreateSoundAuthored':False,'profiles':compiled,'privateTextures':transport['textures'],'historyTicks':18,'readerDefaults':{'path':str(defaults_path),'sha256':sha(defaults_raw)},'frameRateCandidate':{'name':'frameRate','rawHash':'{9b111ae4}','hashMatches':True,'value':10},'limits':['Source reading and private transport only; no runtime dispatch or public assets.','Raw distortionMode 2 and strength 0.09000000357627869 remain explicit; native CPU mode/phase/power binding is not proven by shader arithmetic.','Frame-rate hash matches a name candidate. Local atlas seek, first-update grid, cosmetic random draws, root attachment and source defaults remain separate reconstruction choices.','Source linger and emitter linger stay recorded without extending finite visible life. No on-create sound field is authored.','Reappearance-system naming and resource binding alone do not prove native script creation timing. Gameplay integration must declare its lifecycle adapter.']}
 return [(Path('docs/reference/masteryi/q-end-particle-reading.json'),json_bytes(reading))],reading
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args();outputs,reading=generate_outputs();write_outputs(outputs,args.check);print(json.dumps({'profiles':len(reading['profiles']),'textures':5,'authoredMips':41,'historyTicks':18,'runtimeChanged':False}))
