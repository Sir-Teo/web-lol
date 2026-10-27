"""Complete Q reappearance projection; raw frame-rate and distortion mode stay explicit."""
from masteryi_w_cast import value,binhash
from masteryi_w_buff import layer
from masteryi_q_particles import require
ALLOWED=set('rate particleLifetime particleLinger lifetime isSingleParticle emitterName birthVelocity bindWeight SpawnShape particleColorTexture isRandomStartFrame birthRotation0 birthScale0 scale0 texture {9b111ae4} numFrames texDiv __type meshRenderFlags isUniformScale birthRotationalVelocity0 blendMode distortionDefinition emitterLinger'.split())
def profiles(pin,textures,defaults):
 definition=pin['resources']['MasterYi_Q_End']['definition'];emitters=definition['complexEmitterDefinitionData']
 require(len(emitters)==2 and definition.get('flags')==198 and 'soundOnCreateDefault' not in definition,'Q reappearance system closure differs')
 require(binhash('frameRate')=='{9b111ae4}','Q frame-rate candidate hash differs')
 out=[]
 for index,e in enumerate(emitters):
  require(not set(e)-ALLOWED and e.get('meshRenderFlags',0)==0,'Unhandled Q reappearance field/render flags')
  shape=e.get('SpawnShape',{});require(not set(shape)-{'emitOffset','__type'}and shape.get('__type','{ee39916f}')=='{ee39916f}','Unhandled Q reappearance shape')
  require(e.get('blendMode',0)==(0 if index==0 else 1),'Q reappearance blend differs')
  distortion=e.get('distortionDefinition')
  if index==0:require(distortion is None,'Disappear gained distortion')
  else:require(isinstance(distortion,dict)and set(distortion)=={'distortion','distortionMode','normalMapTexture','__type'}and distortion['__type']=='VfxDistortionDefinitionData'and distortion['distortionMode']==2 and distortion['distortion']==0.09000000357627869,'Q reappearance distortion differs')
  uv=layer(e);uv['frameRate']=e.get('{9b111ae4}',0)
  require(uv['frameRate']==(10 if index==0 else 0)and uv['divisions']==([2,2]if index==0 else[1,1])and uv['frames']==(4 if index==0 else 1),'Q reappearance atlas differs')
  p={'system':'MasterYi_Q_End','role':'reappear','index':index,'name':e['emitterName'],'kind':'billboard','mesh':None,'texture':textures[e['texture'].lower()],'lookup':textures[e['particleColorTexture'].lower()],
   'rate':value(e['rate'],0),'single':bool(e.get('isSingleParticle',False)),'emitterLife':e['lifetime'],'emitterLinger':e.get('emitterLinger'),'linger':e.get('particleLinger'),'life':value(e['particleLifetime'],3),'bind':value(e.get('bindWeight',{}),0),'position':value({},[0,0,0]),'shape':{'offset':value(shape.get('emitOffset',{}),[0,0,0])},'velocity':value(e.get('birthVelocity',{}),[0,0,0]),'worldAcceleration':value({},[0,0,0]),'rotation':value(e.get('birthRotation0',{}),[0,0,0]),'spin':value(e.get('birthRotationalVelocity0',{}),[0,0,0]),'size':value(e.get('birthScale0',{}),defaults['birthScale']),'scale':value(e.get('scale0',{}),defaults['scale']),'uniform':bool(e.get('isUniformScale',False)),'birthColor':value({},defaults['color']),'color':value({},defaults['color']),
   'uv':uv,'uvMode':0,'multiplier':None,'lookupTypes':defaults['lookupTypes'],'lookupScales':defaults['lookupScales'],'lookupOffsets':defaults['lookupOffsets'],'local':True,'particleLocal':False,'directionOriented':False,'directionVelocityScale':0,'ground':False,'navmesh':False,'blend':e.get('blendMode',0),'renderOrder':0,'miscRenderFlags':0,'meshRenderFlags':0,'noCull':False,'depthBias':[0,0],'alphaRef':5/255,'erosion':None,'distortion':{'mode':distortion['distortionMode'],'texture':textures[distortion['normalMapTexture'].lower()],'strength':distortion['distortion']}if distortion else None,'soft':None,'palette':None,'explicitFields':sorted(e)}
  require(p['rate']['times']==[0]and len(p['rate']['values'])==1,'Animated Q reappearance rate unsupported');out.append(p)
 return out
