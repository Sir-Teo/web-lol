"""Deliver complete sword source transports and authored E/R attachment bindings."""
from pathlib import Path
import argparse,json,runpy
from masteryi_e_particles import SOURCE_ROOT,load,checked,require
from masteryi_sword_particles import profiles
from masteryi_audio_graph import write_outputs
from masteryi_q_decode import sha
TRANSPORT=Path('docs/reference/masteryi/e-texture-transport.json')
TRANSPORT_SHA256='52b94f42a2bbac40c4fd8b7037566138d2f3a979af67193e60049c4fc3e0255f'
BINDINGS=Path('docs/reference/masteryi/sword-persistent-bindings.json')
BINDINGS_SHA256='0ea42eebba35d04152a78696b5cce02050f1d50ab6dd4cf2b2c79aaba3456c1c'
def jb(x):return(json.dumps(x,indent=2,allow_nan=False)+'\n').encode()
def generate_outputs():
 pin,_=load();transport=json.loads(checked(TRANSPORT,TRANSPORT_SHA256));runpy.run_path('tools/assets/pack-masteryi-e-textures.py')['verify'](transport,SOURCE_ROOT);bindings=json.loads(checked(BINDINGS,BINDINGS_SHA256));known=[t for path in Path('src/content').glob('masteryi-*-particles.json')if path.name!='masteryi-sword-particles.json'for t in json.loads(path.read_text()).get('textures',[])];outputs={};assets=[];urls={}
 for t in transport['textures']:
  shared=next((k for k in known if(k['sha256'],k['bytes'])==(t['sha256'],t['bytes'])),None);url=shared['url']if shared else f"assets/effects/masteryi-sword-{t['source']['wadPathHash']}.png";urls[t['source']['path']]=url;assets.append({**t,'url':url,'key':t['source']['wadPathHash']});outputs[Path('public')/url]=checked(t['path'],t['sha256'],t['bytes'])
 defaults_path=Path('docs/reference/garen-spin-defaults.json');defaults_raw=checked(defaults_path,'51aaa77125b84ae77e05586d31c7e45de3037028345222a0addd1ed188debefb');compiled=profiles(pin,urls,json.loads(defaults_raw)['defaults']);content={'textures':assets,'profiles':compiled,'bindings':bindings['bindings'],'conditions':bindings['conditions']};require(len(assets)==9 and sum(len(t['rectangles'])for t in assets)==78,'Sword mip closure differs');outputs[Path('src/content/masteryi-sword-particles.json')]=jb(content);outputs[Path('src/content/masteryi-sword-timing.ts')]=b'// Maximum authored one-second particle life plus conservative update/interpolation bound.\nexport const SWORD_GLOW_TAIL_TICKS = 62;\n'
 reading={'format':1,'sourcePinSha256':sha(Path('docs/reference/masteryi/e-particles.json').read_bytes()),'transportSha256':TRANSPORT_SHA256,'bindingSha256':BINDINGS_SHA256,'profileSha256':sha(jb(content)),'tailTicks':62,'limits':['All 14 source profiles remain complete; runtime dispatch follows only the five skin-declared instances/four unique systems, rather than inferred resource-name selection.','Named full-bind/local-orientation attachments use the current posed joint frame; source-X reflection and .01 VFX units remain explicit local adapters, separate from the rig\'s baked .015 translations and uncalibrated native inheritance.','All nine textures retain 78 authored mip levels. The omitted lookup uses an explicit local neutral product.','Flares retain numFrames=4 with omitted texDiv; local default grid [1,1] stays separate from the beams\' authored [2,2] grid. Native atlas/sampler semantics remain unverified.','Local persistent clocks advance during Q/W buff pauses, stop at actual local buff removal, and allow finite one-second tails. Native creation/removal, tail/destruction and reveal callbacks remain unverified.','Fixed cosmetic samples, first-update emission and UV_MODE=2 shader mapping retain existing local policies; no audio is added.']};outputs[Path('docs/reference/masteryi/sword-runtime-reading.json')]=jb(reading);return list(outputs.items()),content,reading
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--check',action='store_true');a=p.parse_args();outputs,c,r=generate_outputs();write_outputs(outputs,a.check);print(json.dumps({'profiles':14,'bindings':5,'textures':9,'mips':78,'tailTicks':62}))
