"""Complete current ordinary/critical trail profiles with explicit local joint adapters."""
from masteryi_attack_trails import require
from masteryi_w_cast import value,uv
SYSTEMS=('MasterYi_BA1_Trail','MasterYi_Crit_Trail')
ALLOWED=set('rate particleLifetime lifetime isSingleParticle emitterName bindWeight EmitterPosition primitive particleColorTexture blendMode disableBackfaceCull birthRotation0 birthScale0 texture birthUvScrollRate __type'.split())
def profiles(pin,textures,mesh_url,defaults,*,systems=SYSTEMS,role='primary-attack-trail'):
 out=[]
 for system in systems:
  definition=pin['resources'][system]['definition'];require(not any(k.lower().startswith('sound')for k in definition),'Primary trail sound omission differs');emitters=definition['complexEmitterDefinitionData'];require(len(emitters)==1,'Primary trail emitter closure differs');e=emitters[0]
  require(not set(e)-ALLOWED,'Unhandled primary trail emitter field')
  require(e['primitive']=={'mMesh':{'mSimpleMeshName':'ASSETS/Characters/MasterYi/Skins/Base/Particles/common_Hecarim_WeaponTrail_1.scb','__type':'VfxMeshDefinitionData'},'__type':'VfxPrimitiveMesh'},'Primary trail mesh differs')
  require(type(e['isSingleParticle'])is int and e['isSingleParticle']==1 and e['disableBackfaceCull']is True,'Primary trail single/no-cull source differs')
  require(e['bindWeight']=={'constantValue':1.0,'__type':'ValueFloat'}and type(e['bindWeight']['constantValue'])is float,'Primary trail requires authored full bind')
  require('blendMode'not in e or(type(e['blendMode'])is int and e['blendMode']in(0,4)),'Unhandled primary trail blend')
  p={'system':system,'role':role,'index':0,'name':e['emitterName'],'kind':'mesh','mesh':mesh_url,'texture':textures[e['texture'].lower()],'lookup':textures[e['particleColorTexture'].lower()],'rate':value(e['rate'],0),'single':True,'delay':0,'emitterLife':e['lifetime'],'emitterLinger':None,'linger':None,'life':value(e['particleLifetime'],3),'bind':value(e['bindWeight'],0),'position':value(e['EmitterPosition'],[0,0,0]),'shape':{'offset':value({},[0,0,0])},'velocity':value({},[0,0,0]),'worldAcceleration':value({},[0,0,0]),'rotation':value(e.get('birthRotation0',{}),[0,0,0]),'spin':value({},[0,0,0]),'size':value(e.get('birthScale0',{}),defaults['birthScale']),'scale':value({},defaults['scale']),'uniform':False,'birthColor':value({},defaults['color']),'color':value({},defaults['color']),'uv':uv(e),'uvMode':0,'multiplier':None,'lookupTypes':defaults['lookupTypes'],'lookupScales':defaults['lookupScales'],'lookupOffsets':defaults['lookupOffsets'],'local':True,'particleLocal':True,'directionOriented':False,'directionVelocityScale':0,'ground':False,'navmesh':False,'blend':e.get('blendMode',0),'renderOrder':0,'miscRenderFlags':0,'meshRenderFlags':0,'noCull':True,'depthBias':[0,0],'alphaRef':5/255,'erosion':None,'distortion':None,'soft':None,'palette':None,'explicitFields':sorted(e),'rawFlags':{'blendMode':e.get('blendMode'),'isLocalOrientation':None,'particleIsLocalOrientation':None},'jointFramePolicy':'local current named full joint frame; adapter flags are not authored source controls'}
  for name in ['rate','life','bind','position','velocity','worldAcceleration','rotation','spin','size','scale','birthColor','color']:
   v=p[name];require(v['times']==[0]and len(v['values'])==1 and not v['probabilities'],'Unsupported primary trail value dynamics')
  require(p['rate']['values']==[[1.0]]and 0<p['life']['values'][0][0]<=.3 and type(p['emitterLife'])is float and p['emitterLife']==1.0,'Primary trail finite source bounds differ');out.append(p)
 return out
