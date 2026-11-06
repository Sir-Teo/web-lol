"""Stage all authored W profiles and checked assets without binding a renderer."""
import argparse
import importlib.util
import json
from pathlib import Path
from ahri_w_particles import checked, require

PROFILE_READING_SHA = 'db6204032ff94d03b3fc1de6e94b19262791fd548c60d6b168aa977acf6cc08b'
SHARED_CONTENT = {
    'src/content/ahri-q-cast-particles.json': '80220cb7c8ff6a140e93cdc66b051221320f664845c20f03d6600f5697088d6e',
    'src/content/ahri-q-projectile-particles.json': '1d37eeacf199ff19cdf1563eec4dab0e8bfcf394140ebc72c7a014b226069e6b',
}

def prepare():
    spec=importlib.util.spec_from_file_location('w_profile_preparer',Path(__file__).with_name('prepare-ahri-w-profiles.py'))
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module

def build():
    module=prepare()
    private_data,reading,_=module.build()
    require(checked(module.READING,PROFILE_READING_SHA)==reading,'W private profile reading differs')
    by_source={}
    for name,digest in SHARED_CONTENT.items():
        old=json.loads(checked(name,digest))
        owner='ahri-q-cast' if 'q-cast' in name else 'ahri-q-projectile'
        for row in old['textures']:by_source.setdefault(row['source']['path'],(row.get('textureOwner',owner),row))
    tex=json.loads(checked('docs/reference/ahri/w-texture-transports.json',module.PINS['docs/reference/ahri/w-texture-transports.json']))
    mesh=json.loads(checked('docs/reference/ahri/w-mesh-transports.json',module.PINS['docs/reference/ahri/w-mesh-transports.json']))
    outputs={};textures=[];meshes=[];replacement={};shared=[]
    for row in tex['textures']:
        previous=by_source.get(row['source']['path'])
        if previous:
            owner,old=previous
            for key in ['source','bytes','sha256','width','height','rectangles']:
                require(old[key]==row[key],'Shared W texture differs: '+row['source']['path'])
            url=old['url'];checked(module.safe(Path('public')/url),row['sha256'],row['bytes']);shared.append(url)
        else:
            owner='ahri-w';url='assets/effects/ahri-w-'+row['source']['wadPathHash']+'.png'
            outputs[Path('public')/url]=checked(row['path'],row['sha256'],row['bytes'])
        replacement[row['path']]=url
        textures.append({**row,'url':url,'textureOwner':owner})
    for row in mesh['meshes']:
        require(row['triangleReplayExact'] and row['uvReplayExact'] and row['vertexColorReplayExact'],
                'W mesh source replay is not exact')
        require(not row['sourceCoordinateTransformApplied'] and not row['normalAttributeGenerated'],
                'W source mesh coordinates/normals differ')
        url='assets/effects/ahri-w-'+row['source']['wadPathHash']+'.glb'
        transport=row['glb'];outputs[Path('public')/url]=checked(transport['path'],transport['sha256'],transport['bytes'])
        replacement[transport['path']]=url
        meshes.append(dict(source=row['source'],url=url,bytes=transport['bytes'],sha256=transport['sha256'],
            vertices=row['transportVertices'],triangles=row['sourceTriangles'],hasVertexColors=row['hasVertexColors'],
            sourceCoordinateTransformApplied=False,normalAttributeGenerated=False,geometryOwner='ahri-w'))
    def replace(value):
        if isinstance(value,dict):return {k:replace(v) for k,v in value.items()}
        if isinstance(value,list):return [replace(v) for v in value]
        return replacement.get(value,value) if isinstance(value,str) else value
    private=json.loads(private_data)
    content=dict(textures=textures,meshes=meshes,adapterDefaults=private['adapterDefaults'],profiles=replace(private['profiles']))
    public=module.encode(content)
    require(len(content['profiles'])==30 and len(textures)==35 and len(meshes)==2 and len(shared)==6,
            'Incomplete W publication')
    outputs[Path('src/content/ahri-w-particles.json')]=public
    asset_outputs={p:b for p,b in outputs.items() if str(p).startswith('public/')}
    record=dict(format=1,producerSha256=module.sha(Path(__file__).read_bytes()),
        privateProfileReadingSha256=PROFILE_READING_SHA,privateProfileSha256=module.sha(private_data),
        publicProfileSha256=module.sha(public),sharedContentPins=SHARED_CONTENT,
        profiles=30,textures=35,authoredMips=sum(len(r['rectangles']) for r in textures),meshes=2,
        newPublicAssetFiles=len(asset_outputs),newPublicAssetBytes=sum(len(b) for b in asset_outputs.values()),
        sharedAssets=shared,limits=[
            'Public asset/profile staging only; no renderer or new simulation behavior is connected.',
            'All 66 authored emitter fields remain projected. Only explicit private asset paths are substituted.',
            'Six byte-identical texture atlases borrow their existing Q owner; no duplicate texture is published.',
            'Both W GLBs remain in native source coordinates and require an explicit scene-unit conversion at load.',
            'All five resources remain represented; cast and empty weapon resources remain unjoined.',
            'Missing lifetimes, palette textures and unresolved binding requirements remain explicit. No native pixel equivalence is claimed.'])
    outputs[Path('docs/reference/ahri/w-publication.json')]=module.encode(record)
    return outputs,record

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args()
    outputs,record=build()
    for path,raw in outputs.items():
        require(not any(p.is_symlink() for p in [path,*path.parents]),'W publication output cannot contain symlinks')
        require(not path.exists() or path.read_bytes()==raw,'Conflicting W publication output: '+str(path))
        require(not args.check or path.exists(),'Missing W publication output: '+str(path))
    if not args.check:
        for path,raw in outputs.items():
            if not path.exists():
                path.parent.mkdir(parents=True,exist_ok=True)
                with path.open('xb') as stream:stream.write(raw)
    print(json.dumps(dict(result='passed',outputs=len(outputs),profiles=30,newPublicAssetFiles=record['newPublicAssetFiles'],
        newPublicAssetBytes=record['newPublicAssetBytes'],sharedAssets=len(record['sharedAssets']),runtimeDispatchBound=False)))
if __name__=='__main__':main()
