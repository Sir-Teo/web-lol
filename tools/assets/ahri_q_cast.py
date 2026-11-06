"""Project all three Q_Cas emitters; omitted fields use explicit local adapter defaults."""
from masteryi_w_cast import value
from masteryi_w_buff import layer
from ahri_q_particles import require

COMMON=set('rate particleLifetime particleLinger lifetime isSingleParticle emitterName bindWeight SpawnShape EmitterPosition primitive blendMode birthColor Color depthBiasFactors isUniformScale isLocalOrientation particleIsLocalOrientation birthScale0 scale0 texture alphaRef disableBackfaceCull uvScrollClamp birthUvScrollRate birthUVOffset texAddressModeBase uvScale uvRotation alphaErosionDefinition reflectionDefinition __type'.split())

def profiles(pin,urls,mesh_url,fresnel):
 emitters=pin['resources']['Ahri_Q_Cas']['definition']['complexEmitterDefinitionData'];require(len(emitters)==3,'Cast emitter closure differs');out=[]
 for index,e in enumerate(emitters):
  require(not(set(e)-COMMON) and e['isSingleParticle']==1 and e['rate']['constantValue']==1 and e['bindWeight']['constantValue']==1,'Unhandled Q cast field/emission/binding')
  primitive=e.get('primitive',{});kind=['billboard','mesh','skin'][index]
  require(primitive.get('__type')==[None,'VfxPrimitiveMesh','VfxPrimitiveAttachedMesh'][index],'Changed Q primitive')
  uv=layer(e);uv.update(scale=value(e.get('uvScale',{}),[1,1]),clamp=bool(e.get('uvScrollClamp',False)),address=e.get('texAddressModeBase',0),rotationDegrees=value(e.get('uvRotation',{}),0))
  shape=e.get('SpawnShape',{});require(not(set(shape)-{'emitOffset','emitRotationAngles','emitRotationAxes','__type'}),'Unhandled Q spawn shape')
  require(all(not(set(r)-{'__type'}) for r in shape.get('emitRotationAngles',[])) and all(v==[0,0,0] for v in shape.get('emitRotationAxes',[])),'Nonempty legacy rotation needs projection')
  p=dict(system='Ahri_Q_Cas',role='cast',index=index,name=e['emitterName'],kind=kind,mesh=mesh_url if index==1 else None,texture=urls[e['texture'].lower()],lookup=None,
    rate=value(e['rate'],0),single=True,emitterLife=e['lifetime'],emitterLinger=None,linger=e.get('particleLinger'),life=value(e['particleLifetime'],0),bind=value(e['bindWeight'],0),
    position=value(e.get('EmitterPosition',{}),[0,0,0]),shape=dict(offset=value(shape.get('emitOffset',{}),[0,0,0])),velocity=value({},[0,0,0]),worldAcceleration=value({},[0,0,0]),rotation=value({},[0,0,0]),spin=value({},[0,0,0]),size=value(e.get('birthScale0',{}),[1,1,1]),scale=value(e.get('scale0',{}),[1,1,1]),uniform=bool(e.get('isUniformScale',False)),birthColor=value(e['birthColor'],[1,1,1,1]),color=value(e['Color'],[1,1,1,1]),uv=uv,uvMode=0,multiplier=None,lookupTypes=[1,0],lookupScales=[1,1],lookupOffsets=[0,0],local=bool(e.get('isLocalOrientation',False)),particleLocal=bool(e.get('particleIsLocalOrientation',False)),directionOriented=False,directionVelocityScale=0,ground=False,navmesh=False,blend=e['blendMode'],renderOrder=0,miscRenderFlags=0,meshRenderFlags=0,noCull=e.get('disableBackfaceCull',False),depthBias=e.get('depthBiasFactors',[0,0]),alphaRef=e.get('alphaRef',5/255),erosion=None,reflection=None,distortion=None,soft=None,palette=None,submeshSelectors=[],matchedSubmeshes=[],unmatchedSubmeshSelectors=[],explicitFields=sorted(e))
  if index==1:require(primitive['mMesh']['mSimpleMeshName'].lower().endswith('/ahri_base_q_swirls_01.scb'),'Changed swirls mesh')
  if index==2:
   selectors=primitive['mMesh']['mSubmeshesToDraw'];require(selectors==['{07c39130}','{62579b4c}'] and primitive['mMesh']['mLockMeshToAttachment'] is True,'Changed attached selectors/locking')
   p.update(submeshSelectors=selectors,matchedSubmeshes=['Tails'],unmatchedSubmeshSelectors=['{62579b4c}'])
   erosion=e['alphaErosionDefinition'];require(not(set(erosion)-{'erosionDriveCurve','erosionFeatherIn','erosionFeatherOut','erosionMapName','__type'}),'Unhandled Q erosion field')
   p['erosion']=dict(texture=urls[erosion['erosionMapName'].lower()],mixer=value({},[0,0,0,1]),drive=value(erosion['erosionDriveCurve'],1),featherIn=erosion['erosionFeatherIn'],featherOut=erosion['erosionFeatherOut'],sliceWidth=1.5,address=1)
   reflection=e['reflectionDefinition'];powers={r['power'] for r in fresnel['profiles'] if r['source']==reflection['fresnel']};require(len(powers)==1,'Missing checked common skin Fresnel input')
   p['reflection']=dict(source=reflection['fresnel'],mappedPower=next(iter(powers)),color=reflection['fresnelColor'])
  out.append(p)
 require([p['life']['values'][0][0] for p in out]==[0.5,0.4000000059604645,4.0],'Changed visible life bounds')
 return out
