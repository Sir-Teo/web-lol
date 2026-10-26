"""All primary hit controls, with source fields separate from local defaults."""
from pathlib import Path
import json
from masteryi_w_cast import value,binhash
from masteryi_w_buff import layer
from masteryi_primary_hits import SYSTEMS,require,checked
ALLOWED=set('Color EmitterPosition FlexShapeDefinition SpawnShape __type alphaRef bindWeight birthDrag birthRotation0 birthScale0 birthVelocity blendMode colorLookUpTypeY emitterName fieldCollectionDefinition importance isDirectionOriented isRandomStartFrame isSingleParticle isUniformScale lifetime meshRenderFlags miscRenderFlags numFrames particleColorTexture particleLifetime particleLinger pass primitive rate scale0 startFrame texDiv texture worldAcceleration {08b52819} {9b111ae4}'.split())
CANDIDATES={'fieldAccelerationDefinitions':'{5d60e987}','VfxFieldAccelerationDefinitionData':'{0a94f3d4}','acceleration':'{2fa0ba9d}','fieldDragDefinitions':'{b639c899}','VfxFieldDragDefinitionData':'{e750fae2}','strength':'{e07a18b0}','censorModulateValue':'{08b52819}','frameRate':'{9b111ae4}'}

def fields(raw):
 if not raw:return {'acceleration':value({},[0,0,0]),'drag':None}
 require(set(raw)=={'{5d60e987}','{b639c899}','__type'}and raw['__type']=='VfxFieldCollectionDefinitionData','Unhandled primary hit field collection')
 require(len(raw['{5d60e987}'])==len(raw['{b639c899}'])==1,'Primary hit field counts differ')
 accel=raw['{5d60e987}'][0];drag=raw['{b639c899}'][0]
 require(set(accel)=={'isLocalSpace','{2fa0ba9d}','__type'}and accel['isLocalSpace']is False and accel['__type']=='{0a94f3d4}','Unhandled primary hit acceleration field')
 require(set(drag)=={'Position','radius','{e07a18b0}','__type'}and drag['__type']=='{e750fae2}','Unhandled primary hit drag field')
 return {'acceleration':value(accel['{2fa0ba9d}'],[0,0,0]),'drag':{'position':value(drag['Position'],[0,0,0]),'radius':value(drag['radius'],0),'strength':value(drag['{e07a18b0}'],0)}}

CONSTRUCTOR=Path('docs/reference/native-constructor-witness.json')
CONSTRUCTOR_SHA256='613708926130a286adc8ad170d2769ee5cbf56b012c8815fa771a934564f5c97'
SCALAR_DEFAULTS=Path('docs/reference/native-emitter-scalar-defaults.json')
SCALAR_DEFAULTS_SHA256='a6c381afaed4c5a680276794d8fa613d988d710eca0683ed8ee91cde494de6cf'

def profiles(pin,textures,defaults):
 # The immutable native constructor witness supplies omitted primitive/alpha bytes.
 # Dispatch, later overrides and alpha normalization remain separate policies.
 constructor=json.loads(checked(CONSTRUCTOR,CONSTRUCTOR_SHA256))['constructorDefaults']
 scalar=json.loads(checked(SCALAR_DEFAULTS,SCALAR_DEFAULTS_SHA256));atlas=scalar['atlas']
 flags={r['candidate']:r['constructorSet']for r in scalar['flags']if r['candidate']}
 default_primitive=constructor['primitive']['candidate'];default_alpha=constructor['alphaRef']['byte']
 require(all(binhash(name)==hashed for name,hashed in CANDIDATES.items()),'Primary hit candidate hash differs')
 require(set(pin['resources'])==set(SYSTEMS),'Primary hit system closure differs');out=[]
 for kind,(system,count)in zip(['attack1','attack2','crit'],SYSTEMS.items()):
  es=pin['resources'][system]['definition']['complexEmitterDefinitionData'];require(len(es)==count,'Primary hit emitter closure differs')
  for index,e in enumerate(es):
   require(not set(e)-ALLOWED and e['__type']=='VfxEmitterDefinitionData','Unhandled primary hit emitter field')
   primitive=e.get('primitive',{});require(not set(primitive)-{'__type'}and primitive.get('__type',default_primitive)in {'VfxPrimitiveCameraQuad','VfxPrimitiveArbitraryQuad','VfxPrimitiveRay'},'Unhandled primary hit primitive')
   shape=e.get('SpawnShape',{});require(not set(shape)-{'emitOffset','emitRotationAngles','emitRotationAxes','__type'}and shape.get('__type','{ee39916f}')in {'{ee39916f}','VfxShapeLegacy'},'Unhandled primary hit shape')
   angles=shape.get('emitRotationAngles',[]);axes=shape.get('emitRotationAxes',[]);require(len(angles)==len(axes)and all(len(a)==3 for a in axes),'Primary hit spawn rotation extent differs')
   flex=e.get('FlexShapeDefinition',{});require(not set(flex)-{'scaleEmitOffsetByBoundObjectSize','__type'},'Unhandled primary hit bound size')
   require(e.get('blendMode',0)in (0,1,3,4)and e.get('meshRenderFlags',0)==0 and e.get('miscRenderFlags',0)in (0,1),'Unhandled primary hit render mode')
   require('{08b52819}'not in e or e['{08b52819}']==[0.0,0.0,0.0,1.0],'Primary hit censor modulation differs')
   uv=layer(e);uv['frameRate']=e.get('{9b111ae4}',int(atlas['frameRate']))
   # Keep the shared layer reader aligned with the native constructor witness.
   # Raw omissions remain absent from explicitFields; native runtime dispatch
   # and interpretation of local orientation remain separately unverified.
   for field,key in [('numFrames','frames'),('startFrame','startFrame')]:
    require(field in e or uv[key]==atlas[field],'Primary hit atlas fallback differs from native constructor')
   require('isRandomStartFrame'in e or uv['randomStart']==flags['isRandomStartFrame'],'Primary hit random atlas default differs')
   p={'system':system,'role':kind,'index':index,'name':e['emitterName'],'kind':{'VfxPrimitiveCameraQuad':'billboard','VfxPrimitiveArbitraryQuad':'quad','VfxPrimitiveRay':'ray'}[primitive.get('__type',default_primitive)],'mesh':None,
    'texture':textures[e['texture'].lower()],'lookup':textures[e['particleColorTexture'].lower()]if'particleColorTexture'in e else None,
    'rate':value(e['rate'],0),'single':bool(e.get('isSingleParticle',flags['isSingleParticle'])),'emitterLife':e['lifetime'],'linger':e.get('particleLinger'),'life':value(e['particleLifetime'],3),'bind':value(e.get('bindWeight',{}),0),
    'position':value(e.get('EmitterPosition',{}),[0,0,0]),'shape':{'kind':'legacy'if shape.get('__type')=='VfxShapeLegacy'else'point','offset':value(shape.get('emitOffset',{}),[0,0,0]),'angles':[value(a,0)for a in angles],'axes':axes},'boundOffset':flex.get('scaleEmitOffsetByBoundObjectSize'),
    'velocity':value(e.get('birthVelocity',{}),[0,0,0]),'birthDrag':value(e.get('birthDrag',{}),[0,0,0]),'worldAcceleration':value(e.get('worldAcceleration',{}),[0,0,0]),'fields':fields(e.get('fieldCollectionDefinition')),
    'rotation':value(e.get('birthRotation0',{}),[0,0,0]),'spin':value({},[0,0,0]),'size':value(e.get('birthScale0',{}),defaults['birthScale']),'scale':value(e.get('scale0',{}),defaults['scale']),'uniform':bool(e.get('isUniformScale',flags['isUniformScale'])),
    'birthColor':value({},defaults['color']),'color':value(e.get('Color',{}),defaults['color']),'uv':uv,'uvMode':0,'multiplier':None,
    'lookupTypes':[defaults['lookupTypes'][0],e.get('colorLookUpTypeY',defaults['lookupTypes'][1])],'lookupScales':defaults['lookupScales'],'lookupOffsets':defaults['lookupOffsets'],
    'local':flags['isLocalOrientation'],'particleLocal':flags['particleIsLocalOrientation'],'directionOriented':bool(e.get('isDirectionOriented',flags['isDirectionOriented'])),'directionVelocityScale':0,'ground':False,'navmesh':False,'blend':e.get('blendMode',0),'renderOrder':e.get('pass',0),'miscRenderFlags':e.get('miscRenderFlags',0),'meshRenderFlags':e.get('meshRenderFlags',0),'noCull':False,'depthBias':[0,0],'alphaRef':e.get('alphaRef',default_alpha)/255,'erosion':None,'distortion':None,'soft':None,'palette':None,
    'rawBlend':e.get('blendMode'),'rawBind':e.get('bindWeight'),'rawLocal':e.get('isLocalOrientation'),'rawParticleLocal':e.get('particleIsLocalOrientation'),'rawCensorModulateValue':e.get('{08b52819}'),'rawImportance':e.get('importance'),'explicitFields':sorted(e)}
   require(p['rate']['times']==[0]and len(p['rate']['values'])==1,'Unhandled primary hit animated rate');out.append(p)
 return out
