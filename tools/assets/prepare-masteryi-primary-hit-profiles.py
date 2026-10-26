"""Prepare eleven complete private hit profiles; no runtime dispatch or public files."""
from pathlib import Path
import argparse,json,math,runpy
from masteryi_primary_hits import load,SOURCE_ROOT,PIN_SHA256,checked,require
from masteryi_primary_hit_profiles import profiles,CANDIDATES
from masteryi_q_decode import sha
from masteryi_audio_graph import write_outputs
TRANSPORT=Path('docs/reference/masteryi/primary-hit-texture-transport.json')
TRANSPORT_SHA256='6aa657899684411475571d7aa20d83a5a6d591244c4291f0f0590193a9e7f83a'
DEFAULTS=Path('docs/reference/garen-spin-defaults.json')
DEFAULTS_SHA256='51aaa77125b84ae77e05586d31c7e45de3037028345222a0addd1ed188debefb'
def json_bytes(x):return(json.dumps(x,indent=2,allow_nan=False)+'\n').encode()
def generate_outputs(transport_path=TRANSPORT):
 pin,model,char=load();raw=checked(transport_path,TRANSPORT_SHA256);transport=json.loads(raw);packer=runpy.run_path('tools/assets/pack-masteryi-primary-hit-textures.py');packer['verify'](transport,SOURCE_ROOT)
 require((packer['OUTPUT']/'textures.json').read_bytes()==raw,'Primary hit staging differs')
 defaults=json.loads(checked(DEFAULTS,DEFAULTS_SHA256))['defaults'];compiled=profiles(pin,{t['source']['path']:t['source']['path']for t in transport['textures']},defaults)
 # Conservative local first-update grid includes every authored life-probability endpoint.
 peak=max(max(v[0]for v in p['life']['values'])*max([1,*[v for t in p['life']['probabilities']for v in t['values']]])for p in compiled)
 retention=1+math.ceil(peak*60)+1
 require(len(compiled)==11 and len(transport['textures'])==11 and sum(len(t['rectangles'])for t in transport['textures'])==93 and retention==75,'Primary hit finite closure differs')
 reading={'format':1,'sourcePinSha256':PIN_SHA256,'transport':{'path':str(TRANSPORT),'sha256':TRANSPORT_SHA256},'bindings':pin['bindings'],'profiles':compiled,'privateTextures':transport['textures'],'historyTicks':retention,'readerDefaults':{'path':str(DEFAULTS),'sha256':DEFAULTS_SHA256},'candidateLabels':[{'name':n,'rawHash':h,'hashMatches':True}for n,h in CANDIDATES.items()],'limits':['Private complete profile preparation only; no runtime creation, public assets or save changes.','Compiled bind zero, local true, particle-local false, omitted blend zero and other defaults are explicit reconstruction policies, not authored values. Raw presences and complete source remain separately retained.','Blend 3 is the pinned reader none mode and requires unblended/alpha-tested rendering; do not pass it through an additive renderer. Native GPU shader/sampler/CPU parity remains uncalibrated.','Field label hashes match candidates; stepped 60 Hz force order, spatial drag falloff, target attachment and source frame integration require an explicit local adapter and acceptance tests.','Fluid has random-start and a 2x2 grid but omits numFrames; compiled one-frame default is not a proven native frame-count recovery. Blood declares startFrame 15, 16 frames, 4x4 grid and raw frame-rate 1.','Censor modulation and importance values are retained without inventing global censorship switches or quality filtering. All eleven emitter profiles remain present.','Critical ground_glow stays an arbitrary quad at the declared target attachment; its name does not authorize terrain projection.','The 75-tick retention is a conservative local first-update bound including the float32 1.2000000476837158 life multiplier. Source linger does not extend finite visible life.']}
 return[(Path('docs/reference/masteryi/primary-hit-profile-reading.json'),json_bytes(reading))],reading
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--check',action='store_true');args=p.parse_args();outputs,reading=generate_outputs();write_outputs(outputs,args.check);print(json.dumps({'profiles':len(reading['profiles']),'textures':11,'mips':93,'historyTicks':reading['historyTicks'],'runtimeChanged':False}))
