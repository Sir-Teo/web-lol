"""Publish complete Q projectile profiles and checked assets; runtime dispatch stays unbound."""
import argparse
import importlib.util
import json
from pathlib import Path
from ahri_q_particles import checked, require

PROFILE_READING_SHA = '3ad747d07fd2c2420be2d84562846824e2677740dba96d6b02396220c51de525'
CAST_CONTENT_SHA = '80220cb7c8ff6a140e93cdc66b051221320f664845c20f03d6600f5697088d6e'
CAST_MESH_SHA = 'c07c5a1cb7bbe1100894a686b6beb349b10307ed2ccada4e4ddd5f285c6390cf'

def prepare():
    spec=importlib.util.spec_from_file_location('q_projectile_profile_preparer',Path(__file__).with_name('prepare-ahri-q-projectile-profiles.py'))
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module

def build():
    module=prepare()
    private_data,reading,_=module.build()
    require(checked(module.READING,PROFILE_READING_SHA)==reading,'Projectile private profile reading differs')
    old=json.loads(checked('src/content/ahri-q-cast-particles.json',CAST_CONTENT_SHA))
    old_mesh=json.loads(checked('docs/reference/ahri/q-cast-mesh-transport.json',CAST_MESH_SHA))
    tex=json.loads(checked('docs/reference/ahri/q-projectile-texture-transport.json',module.PINS['docs/reference/ahri/q-projectile-texture-transport.json']))
    mesh=json.loads(checked('docs/reference/ahri/q-projectile-mesh-transports.json',module.PINS['docs/reference/ahri/q-projectile-mesh-transports.json']))
    outputs={};textures=[];meshes=[];replacement={};shared=[]
    by_source={r['source']['path']:r for r in old['textures']}
    for row in tex['textures']:
        previous=by_source.get(row['source']['path'])
        if previous:
            for key in ['source','bytes','sha256','width','height','rectangles']:
                require(previous[key]==row[key],'Shared projectile/cast texture differs')
            url=previous['url']
            checked(Path('public')/url,row['sha256'],row['bytes'])
            shared.append(url)
        else:
            url='assets/effects/ahri-q-projectile-'+row['source']['wadPathHash']+'.png'
            outputs[Path('public')/url]=checked(row['path'],row['sha256'],row['bytes'])
        replacement[row['path']]=url
        textures.append({**row,'url':url,'textureOwner':'ahri-q-cast'if previous else'ahri-q-projectile'})
    for row in mesh['meshes']:
        reused=row['source']['path']==old_mesh['source']['path']
        if reused:
            require(row['source']==old_mesh['source'] and row['sourceVertices']==old_mesh['sourceVertices'] and row['sourceTriangles']==old_mesh['sourceTriangles'],'Shared swirls source differs')
            for key in ['triangleReplayExact','uvReplayExact','vertexColorReplayExact']:
                require(row[key]is True and old_mesh[key]is True,'Shared swirls source replay is not exact')
            require(not row['sourceCoordinateTransformApplied'] and not old_mesh['sourceCoordinateTransformApplied'] and not row['normalAttributeGenerated'] and not old_mesh['normalAttributeGenerated'],'Shared swirls coordinate/normal representation differs')
            previous=old['meshes'][0]
            require(previous['sha256']==old_mesh['glb']['sha256'] and previous['bytes']==old_mesh['glb']['bytes'],'Shared swirls transport identity differs')
            url=previous['url'];extent=previous['bytes'];digest=previous['sha256']
            checked(Path('public')/url,digest,extent);shared.append(url)
        else:
            url='assets/effects/ahri-q-projectile-'+row['source']['wadPathHash']+'.glb'
            extent=row['glb']['bytes'];digest=row['glb']['sha256']
            outputs[Path('public')/url]=checked(row['glb']['path'],digest,extent)
        replacement[row['glb']['path']]=url
        meshes.append(dict(source=row['source'],url=url,bytes=extent,sha256=digest,vertices=row['transportVertices'],triangles=row['sourceTriangles'],hasVertexColors=row['hasVertexColors'],sourceCoordinateTransformApplied=False,normalAttributeGenerated=False,geometryOwner='ahri-q-cast'if reused else'ahri-q-projectile'))
    def replace(value):
        if isinstance(value,dict):return{k:replace(v)for k,v in value.items()}
        if isinstance(value,list):return[replace(v)for v in value]
        return replacement.get(value,value)if isinstance(value,str)else value
    private=json.loads(private_data)
    content=dict(textures=textures,meshes=meshes,adapterDefaults=private['adapterDefaults'],profiles=replace(private['profiles']))
    public=module.encode(content)
    require(len(content['profiles'])==36 and len(textures)==17 and len(meshes)==3 and len(shared)==3,'Incomplete projectile publication')
    outputs[Path('src/content/ahri-q-projectile-particles.json')]=public
    record=dict(format=1,producerSha256=module.sha(Path(__file__).read_bytes()),privateProfileReadingSha256=PROFILE_READING_SHA,privateProfileSha256=module.sha(private_data),publicProfileSha256=module.sha(public),sharedCastContentSha256=CAST_CONTENT_SHA,sharedCastMeshTransportSha256=CAST_MESH_SHA,profiles=36,textures=17,authoredMips=sum(len(r['rectangles'])for r in textures),meshes=3,newPublicAssetFiles=17,newPublicAssetBytes=sum(len(v)for k,v in outputs.items()if str(k).startswith('public/')),sharedAssets=shared,limits=['Complete public asset/profile staging only. No simulation observer, renderer or runtime dispatch is added.','All profile fields match the checked private projection apart from explicit asset-path substitutions.','Two textures reuse byte-identical cast transports. The existing swirls transport and new private transport both replay the same complete native triangle/UV/color data without coordinate changes.','Shared cast geometry is already adapted to scene units by its page owner. Newly loaded source geometry requires its own explicit source-to-scene conversion.','Native callbacks, height/trail frames, cylinder/linger/visibility policies, material bindings and pixels remain unbound.'])
    outputs[Path('docs/reference/ahri/q-projectile-publication.json')]=module.encode(record)
    return outputs,record

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args()
    outputs,record=build()
    for path,raw in outputs.items():
        require(not any(p.is_symlink()for p in [path,*path.parents]),'Publication output cannot contain symlinks')
        require(not path.exists()or path.read_bytes()==raw,'Conflicting projectile output: '+str(path))
        require(not args.check or path.exists(),'Missing projectile output: '+str(path))
    if not args.check:
        for path,raw in outputs.items():
            if not path.exists():
                path.parent.mkdir(parents=True,exist_ok=True)
                with path.open('xb')as stream:stream.write(raw)
    print(json.dumps(dict(result='passed',outputs=len(outputs),profiles=36,newPublicAssetFiles=record['newPublicAssetFiles'],newPublicAssetBytes=record['newPublicAssetBytes'],sharedAssets=len(record['sharedAssets']),runtimeDispatchBound=False)))
if __name__=='__main__':main()
