"""Join authored W attached selectors to retained native SKN and GLB draws."""
import argparse
import hashlib
import json
from pathlib import Path
import runpy

PINS = {
    'docs/reference/ahri/w-particles.json': 'c1226324a728137c05062dafc7d4a102a0799a371d233d58e3f81558c26dbb47',
    'docs/reference/ahri/mesh-submeshes.bin': '787b1b497a7a70af39e8f4bf3ce191c3d17d3bf8a44deee12c018692e036756f',
    'docs/reference/ahri-materials.json': 'a825153c16fec391e2b6f45e72f838fba84e3931dfd199618110e1fe9cb3eb08',
    'public/assets/models/ahri-base.glb': '587c1741a908e23874a87d069505e0e233d4f88c22a828c9d7edda195328e202',
    'tools/assets/export-ahri-materials.py': 'c52025dac7625b1c212a4deba2875bdbe71b7e53cf6f73e2194c509deec5c420',
}
TARGET = Path('docs/reference/ahri/w-attached-bindings.json')
def require(ok, message):
    if not ok: raise ValueError(message)
def sha(raw): return hashlib.sha256(raw).hexdigest()
def name_hash(name):
    value = 0x811c9dc5
    for byte in name.lower().encode('ascii'): value = ((value ^ byte) * 0x01000193) & 0xffffffff
    return '{%08x}' % value

def read():
    raw = {}
    for name,digest in PINS.items():
        raw[name] = Path(name).read_bytes()
        require(sha(raw[name]) == digest, 'Changed W attachment input: '+name)
    helper = runpy.run_path('tools/assets/export-ahri-materials.py')
    draws = helper['submeshes'](raw['docs/reference/ahri/mesh-submeshes.bin'])
    glb = helper['glb_json'](raw['public/assets/models/ahri-base.glb'])
    materials = json.loads(raw['docs/reference/ahri-materials.json'])
    source = json.loads(raw['docs/reference/ahri/w-particles.json'])
    rows = []
    for key,resource in source['resources'].items():
        for index,e in enumerate(resource['definition'].get('complexEmitterDefinitionData',[])):
            primitive = e.get('primitive',{})
            if primitive.get('__type') != 'VfxPrimitiveAttachedMesh': continue
            candidates = []
            for selector in primitive['mMesh']['mSubmeshesToDraw']:
                matches = [d for d in draws if name_hash(d['name']) == selector]
                require(len(matches)==1,'Missing or ambiguous retained W selector')
                draw = matches[0]
                transports = []
                for mesh_index,mesh in enumerate(glb['meshes']):
                    for primitive_index,p in enumerate(mesh['primitives']):
                        material = glb['materials'][p['material']]
                        if material.get('extras',{}).get('sourceSubmesh') != draw['name']: continue
                        count = glb['accessors'][p['indices']]['count']
                        require(count == draw['indices'],'W source/transport index count differs')
                        transports.append(dict(meshIndex=mesh_index,primitiveIndex=primitive_index,
                            materialIndex=p['material'],indexCount=count,
                            defaultHidden=material['extras']['defaultHidden']))
                require(len(transports)==1,'Missing or ambiguous W transport draw')
                candidates.append(dict(selector=selector,nativeDraw=draw,transportDraw=transports[0]))
            rows.append(dict(resourceKey=key,emitterIndex=index,emitterName=e['emitterName'],
                primitive=primitive,reflection=e.get('reflectionDefinition'),candidates=candidates))
    require(len(rows)==1 and rows[0]['resourceKey']=='Ahri_W_cas','Changed W attached emitter closure')
    require([r['nativeDraw']['name'] for r in rows[0]['candidates']]==['Tails','Tail_Large'],
            'Changed W selector mapping')
    return dict(format=1,producerSha256=sha(Path(__file__).read_bytes()),
        inputs=[dict(path=name,sha256=digest,bytes=len(raw[name])) for name,digest in PINS.items()],
        sourceMeshTable=materials['sourceMeshTable'],attachedMeshes=rows,
        summary=dict(attachedEmitters=1,selectors=2,nativeMatches=2,transportMatches=2,defaultHiddenMatches=1),
        limits=['Verified lowercase FNV-1a selector joins to retained native SKN names and current GLB material extras.',
            'Tail_Large is hidden in the base preview; this does not establish VFX visibility or fallback policy.',
            'The W cast resource still has no retained animation or spell producer join.',
            'Lock-to-attachment, native skin sampling, root transforms, fresnel and pixels remain unverified.',
            'This reading changes no runtime behavior, assets or particle profile defaults.'])

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true')
    parser.add_argument('--output',type=Path,default=TARGET)
    args=parser.parse_args()
    data=read();raw=(json.dumps(data,indent=2,allow_nan=False)+'\n').encode();path=args.output
    require(not any(p.is_symlink() for p in [path,*path.parents]),'W attachment output cannot contain symlinks')
    require(not path.exists() or path.read_bytes()==raw,'Conflicting W attachment output')
    require(not args.check or path.exists(),'Missing W attachment output')
    if not args.check and not path.exists():
        path.parent.mkdir(parents=True,exist_ok=True)
        with path.open('xb') as stream:stream.write(raw)
    print(json.dumps(dict(result='passed',bytes=len(raw),sha256=sha(raw),**data['summary'])))
if __name__=='__main__':main()
