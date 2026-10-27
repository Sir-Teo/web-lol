"""Complete three-emitter Highlander takedown; source omissions stay distinct from adapters."""
import math
from masteryi_r_particles import require
from masteryi_w_cast import value,ALLOWED as W_ALLOWED
from masteryi_w_buff import layer
ALLOWED=W_ALLOWED|{'particleIsLocalOrientation','timeBeforeFirstEmission','distortionDefinition'}
TRAIL='assets/characters/masteryi/skins/base/particles/common_hecarim_qtrail.scb'
def profiles(pin,textures,meshes,defaults):
 definition=pin['resources']['MasterYi_R_OnBuffKill']['definition'];emitters=definition['complexEmitterDefinitionData']
 require(len(emitters)==3 and not any(k.lower().startswith('sound')for k in definition)and'flags'not in definition,'Highlander takedown closure/omissions differ')
 out=[]
 for i,e in enumerate(emitters):
  require(not set(e)-ALLOWED and not e.get('fieldCollectionDefinition')and not e.get('textureMult'),'Unhandled Highlander takedown field')
  primitive=e.get('primitive',{});kind=primitive.get('__type','billboard')
  require(kind==['billboard','VfxPrimitiveMesh','billboard'][i],'Highlander takedown primitive differs')
  mesh=None
  if kind=='VfxPrimitiveMesh':
   path=TRAIL
   raw_name=primitive.get('mMesh',{}).get('mSimpleMeshName')
   require(isinstance(raw_name,str)and raw_name.lower()==path and primitive=={'mMesh':{'mSimpleMeshName':raw_name,'__type':'VfxMeshDefinitionData'},'__type':'VfxPrimitiveMesh'},'Highlander takedown mesh differs');mesh=meshes[path]
  else:require(not set(primitive)-{'__type'},'Unhandled Highlander primitive field')
  shape=e.get('SpawnShape',{});require(not set(shape)-{'emitOffset','__type'}and shape.get('__type','{ee39916f}')=='{ee39916f}','Unhandled Highlander shape')
  distortion=e.get('distortionDefinition')
  require(distortion is None,'Unexpected Highlander takedown distortion')
  require(e.get('blendMode',0)in(0,1,4)and e.get('meshRenderFlags',0)==0 and e.get('uvMode',0)==0,'Unhandled Highlander render mode')
  p={'system':'MasterYi_R_OnBuffKill','role':'takedown','index':i,'name':e['emitterName'],'kind':{'VfxPrimitiveMesh':'mesh','VfxPrimitiveArbitraryQuad':'quad','billboard':'billboard'}[kind],'mesh':mesh,'texture':textures[e['texture'].lower()],'lookup':textures[e['particleColorTexture'].lower()]if'particleColorTexture'in e else None,
   'rate':value(e['rate'],0),'single':bool(e.get('isSingleParticle',False)),'delay':e.get('timeBeforeFirstEmission',0),'emitterLife':e.get('lifetime'),'emitterLinger':e.get('emitterLinger'),'linger':e.get('particleLinger'),'life':value(e['particleLifetime'],3),'bind':value(e.get('bindWeight',{}),0),'position':value(e.get('EmitterPosition',{}),[0,0,0]),'shape':{'offset':value(shape.get('emitOffset',{}),[0,0,0])},'velocity':value(e.get('birthVelocity',{}),[0,0,0]),'worldAcceleration':value({},[0,0,0]),'rotation':value(e.get('birthRotation0',{}),[0,0,0]),'spin':value(e.get('birthRotationalVelocity0',{}),[0,0,0]),'size':value(e.get('birthScale0',{}),defaults['birthScale']),'scale':value(e.get('scale0',{}),defaults['scale']),'uniform':bool(e.get('isUniformScale',False)),'birthColor':value({},defaults['color']),'color':value(e.get('Color',{}),defaults['color']),
   'uv':layer(e),'uvMode':0,'multiplier':None,'lookupTypes':defaults['lookupTypes'],'lookupScales':defaults['lookupScales'],'lookupOffsets':defaults['lookupOffsets'],'local':True,'particleLocal':bool(e.get('particleIsLocalOrientation',False)),'directionOriented':False,'directionVelocityScale':0,'ground':False,'navmesh':False,'blend':e.get('blendMode',0),'renderOrder':e.get('pass',0),'miscRenderFlags':0,'meshRenderFlags':0,'noCull':bool(e.get('disableBackfaceCull',False)),'depthBias':[0,0],'alphaRef':5/255,'erosion':None,'distortion':None,'soft':None,'palette':None,'explicitFields':sorted(e)}
  require(type(p['delay'])in(int,float)and math.isfinite(p['delay'])and p['delay']>=0,'Invalid Highlander emission delay')
  require(p['emitterLife']is None or(type(p['emitterLife'])in(int,float)and math.isfinite(p['emitterLife'])and p['emitterLife']>0),'Invalid Highlander emitter life')
  require(p['rate']['times']==[0]and len(p['rate']['values'])==1 and(p['single']or p['emitterLife']is not None),'Unsupported Highlander emission profile');out.append(p)
 return out
