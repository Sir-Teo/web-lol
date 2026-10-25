"""Export all four authored Eclipse attached-skin material descriptions."""
from pathlib import Path
import hashlib,json,sys
sha=lambda b:hashlib.sha256(b).hexdigest()
pin_path=Path('docs/reference/leona-w-particles.json')
pin=json.loads(pin_path.read_text())
decoded=json.loads(Path('docs/reference/leona-w-particles-decoded.json').read_text())
assert decoded['sourcePinSha256']==sha(pin_path.read_bytes())
textures={t['source']['path']:t for t in decoded['textures']}
def texture(path):
    t=textures[path.lower()]
    assert sha(Path(t['path']).read_bytes())==t['sha256']
    return t['path'].removeprefix('public/')
allowed=set('rate particleLifetime particleLinger lifetime isSingleParticle emitterName bindWeight primitive blendMode birthColor Color alphaRef alphaErosionDefinition reflectionDefinition depthBiasFactors disableBackfaceCull particleIsLocalOrientation isUniformScale texture __type'.split())
powers={p['source']:p['power'] for p in json.loads(Path('src/content/leona-w-skin-fresnel.json').read_text())['profiles']}
profiles=[]
for key,r in pin['resources'].items():
    for index,e in enumerate(r['definition']['complexEmitterDefinitionData']):
        if e.get('primitive',{}).get('__type')!='VfxPrimitiveAttachedMesh':continue
        assert not e.get('disabled',False) and set(e)<=allowed
        assert e['blendMode']==4 and e['alphaRef']==0
        assert e['depthBiasFactors']==[-1,-1] and e['bindWeight']['constantValue']==1
        assert e['disableBackfaceCull'] and e['isSingleParticle']
        assert set(e['reflectionDefinition'])=={'fresnel','fresnelColor','__type'}
        reflection=e['reflectionDefinition']
        assert e['birthColor'].keys()=={'constantValue','__type'}
        color=e.get('Color',{}).get('dynamics')
        if color:assert set(color)=={'times','values','__type'}
        erosion=e.get('alphaErosionDefinition')
        if erosion:
            assert set(erosion)<=set('erosionDriveCurve erosionFeatherIn erosionFeatherOut erosionMapName __type'.split())
            drive=erosion['erosionDriveCurve']['dynamics']
            assert set(drive)=={'times','values','__type'}
            erosion=dict(texture=texture(erosion['erosionMapName']),mixer=[0,0,0,1],
                featherIn=erosion.get('erosionFeatherIn',0.1),featherOut=erosion.get('erosionFeatherOut',0.1),
                sliceWidth=1.5,drive=dict(times=drive['times'],values=drive['values']))
        profiles.append(dict(system=key,index=index,name=e['emitterName'],texture=texture(e['texture']),
            fresnel=reflection['fresnel'],fresnelPower=powers[reflection['fresnel']],fresnelColor=reflection['fresnelColor'][:3],
            birthColor=e['birthColor']['constantValue'],color=dict(times=color['times'],values=color['values']) if color else dict(times=[0],values=[[1,1,1,1]]),
            erosion=erosion,particleLife=e['particleLifetime']['constantValue'],particleLinger=e['particleLinger'],
            birthCount=e['rate']['constantValue'],sourceFields=sorted(e)))
assert [(p['system'],p['index']) for p in profiles]==[('Leona_W_buf_1',4),('Leona_W_buf_1',5),('Leona_W_buf_1',6),('Leona_W_buf_2',2)]
sources=['src/content/leona-w-skin-fresnel.json','docs/reference/leona-attached-skin-reflection-inputs.json','docs/reference/leona-w-particles.json','docs/reference/leona-w-particles-decoded.json','docs/reference/leona-w-skin-shaders.json','docs/reference/lux-beam-erosion.json','public/assets/models/leona-base.glb','public/assets/models/leona-base.json']
result=dict(profiles=profiles,sources=[dict(path=p,sha256=sha(Path(p).read_bytes())) for p in sources],
    defaults=dict(erosionMixer=[0,0,0,1],erosionFeather=0.1,erosionSliceWidth=1.5,
        evidence='docs/reference/lux-beam-erosion.json',nativeCpuDefaultsVerified=False),
    status='All four source attached-skin material descriptions. Shader arithmetic is separately checked; native dispatch/global remap/samplers and complete W playback remain unverified.')
raw=(json.dumps(result,indent=2)+'\n').encode();out=Path('docs/reference/leona-w-skin-materials.json')
if '--check' in sys.argv:assert out.read_bytes()==raw
elif not out.exists() or out.read_bytes()!=raw:out.write_bytes(raw)
print(json.dumps(dict(result='passed',materials=len(profiles),erosionMaterials=sum(p['erosion'] is not None for p in profiles),nativeCpuDefaultsVerified=False)))
