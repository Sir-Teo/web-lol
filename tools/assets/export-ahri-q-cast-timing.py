"""Preserve the native ANM header and define an explicit local event-grid adapter."""
import argparse,hashlib,json,math,struct
from pathlib import Path
PINS={
 'public/assets/models/ahri-base.json':'c6a42818e2b02c8e4f4e2db7a313beb439521934d083e4262b79210bef27eca4',
 'docs/reference/ahri-model.json':'74d0b55f5aad08646fbd24f660ed533bc8fd5798e8a60dc0983d97960b47a377',
 'docs/reference/ahri/q-particles.json':'613f21651105761810963a32275a52b073189ccdea7286af78980d558b3db2c3',
 'docs/reference/ahri/q-particle-bindings.json':'6fb85f6b743e0a662d45a923c93900ce3b45777f34692cc8dbdb07922e6ccf78',
 'docs/reference/ahri/q-cast-animation-header.bin':'65975b5a38b56d99dc7d746b07810cf48fb94c11cda383e3728ea2710546311b',
}
def require(ok,message):
 if not ok:raise ValueError(message)
def sha(raw):return hashlib.sha256(raw).hexdigest()
def f32(x):return struct.unpack('<f',struct.pack('<f',x))[0]
def build():
 data={}
 for name,digest in PINS.items():
  raw=Path(name).read_bytes();require(sha(raw)==digest,'Frozen cast timing input differs');data[name]=raw
 model=json.loads(data['docs/reference/ahri-model.json']);pin=json.loads(data['docs/reference/ahri/q-particles.json']);binding=json.loads(data['docs/reference/ahri/q-particle-bindings.json'])
 header=data['docs/reference/ahri/q-cast-animation-header.bin'];require(len(header)==40 and header[:8]==b'r3d2anmd' and struct.unpack_from('<I',header,8)[0]==5,'Changed native animation header')
 source=next(r for r in model['extraction']['files'] if r['path'].endswith('/spell1.anm'));require(struct.unpack_from('<I',header,12)[0]+12==source['bytes'],'Native animation resource size differs')
 tracks,frames,step=struct.unpack_from('<IIf',header,28);require((tracks,frames)==(211,14) and math.isfinite(step) and step>0,'Changed native sample header')
 metadata=json.loads(data['public/assets/models/ahri-base.json']);sampled=next(c for c in metadata['clips'] if c['name']=='spell1');require(sampled['durationSeconds']==f32((frames-1)/f32(1/step)),'Shipped animation last sample differs from native header')
 event=next(r for r in binding['animationEvents'] if r['resourceKey']=='Ahri_Q_Cas');frame=event['declaration']['mStartFrame'];fps=f32(1/step);seconds=f32(frame/fps);offset=math.floor(seconds*60+0.5)
 emitters=pin['resources']['Ahri_Q_Cas']['definition']['complexEmitterDefinitionData'];require(len(emitters)==3 and all(e['isSingleParticle']==1 for e in emitters),'Changed finite cast emission closure')
 lives=[e['particleLifetime']['constantValue'] for e in emitters];require(lives==[0.5,0.4000000059604645,4.0] and offset==10,'Changed finite cast/grid profile')
 maximum=math.ceil(max(lives)*60)
 record=dict(format=1,sourceInputs=[dict(path=n,sha256=s) for n,s in PINS.items()],nativeAnimation=source,header=dict(tracks=tracks,frames=frames,frameDuration=step,fpsFloat32=fps,lastSampleSeconds=f32((frames-1)/fps)),animationEvent=event['declaration'],nativeFrameSampleSeconds=seconds,localAdapter=dict(tickRate=60,rounding='nearest integer simulation tick',delayTicks=offset,maximumParticleTicks=maximum,historyTicks=offset+maximum),particleLifetimes=lives,reader=dict(revision='76bf57bf4fd195343dec610bf0f912a06b910914',path='src/LeagueToolkit/Core/Animation/UncompressedAnimationAsset.cs',sha256='61a08ed77e11b4d4fb7ce70d02c1fd75f62a02cc3bec83e1756ac8856a9ec9af'),limits=['Native header/sample calculation is retained; event dispatch on the simulation grid is an explicit local adapter, not native callback certification.','Only the three-emitter Ahri_Q_Cas is timed; the separate Orb_Cast end-frame declaration remains unbound.','Finite visible lifetime excludes raw particle linger. Born particles finish naturally; unborn dispatch may cancel before the local trigger.'])
 text=f'// Explicit local frame-grid adapter; native callbacks remain unverified.\nexport const AHRI_Q_CAST_TIMING = {{ delayTicks: {offset}, maximumParticleTicks: {maximum}, historyTicks: {offset+maximum} }} as const;\n'
 return [(Path('src/content/ahri-q-cast-timing.ts'),text.encode()),(Path('docs/reference/ahri/q-cast-timing.json'),(json.dumps(record,indent=2)+'\n').encode())]
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--check',action='store_true');a=p.parse_args();outputs=build()
 for path,raw in outputs:
  require(not any(p.is_symlink() for p in [path,*path.parents]),'Timing output cannot contain symlinks');require(not path.exists() or path.read_bytes()==raw,'Conflicting timing output');require(not a.check or path.exists(),'Missing timing output')
 if not a.check:
  for path,raw in outputs:
   if not path.exists():
    path.parent.mkdir(parents=True,exist_ok=True)
    with path.open('xb') as out:out.write(raw)
 print(json.dumps(dict(result='passed',files=len(outputs),delayTicks=10,maximumParticleTicks=240)))
