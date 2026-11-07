"""Join authored E attached selectors to retained native SKN and GLB draws."""
import argparse
import hashlib
import json
from pathlib import Path
import runpy

PINS = {
    'docs/reference/ahri/e-particles.json': 'cdf8ed963d051e9517443949c5a4b30b924d5c7ba9fed36aecccf6bdb5a1a756',
    'docs/reference/ahri/mesh-submeshes.bin': '787b1b497a7a70af39e8f4bf3ce191c3d17d3bf8a44deee12c018692e036756f',
    'docs/reference/ahri-materials.json': 'a825153c16fec391e2b6f45e72f838fba84e3931dfd199618110e1fe9cb3eb08',
    'public/assets/models/ahri-base.glb': '587c1741a908e23874a87d069505e0e233d4f88c22a828c9d7edda195328e202',
    'tools/assets/export-ahri-materials.py': 'c52025dac7625b1c212a4deba2875bdbe71b7e53cf6f73e2194c509deec5c420',
}
TARGET = Path('docs/reference/ahri/e-attached-bindings.json')
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
        require(sha(raw[name]) == digest, 'Changed E attachment input: '+name)
    helper = runpy.run_path('tools/assets/export-ahri-materials.py')
    draws = helper['submeshes'](raw['docs/reference/ahri/mesh-submeshes.bin'])
    glb = helper['glb_json'](raw['public/assets/models/ahri-base.glb'])
    materials = json.loads(raw['docs/reference/ahri-materials.json'])
    source = json.loads(raw['docs/reference/ahri/e-particles.json'])
    rows = []
    for key,resource in source['resources'].items():
        for index,e in enumerate(resource['definition'].get('complexEmitterDefinitionData',[])):
            primitive = e.get('primitive',{})
            if primitive.get('__type') != 'VfxPrimitiveAttachedMesh': continue
            candidates = []
            for selector in primitive['mMesh'].get('mSubmeshesToDraw',[]):
                matches = [d for d in draws if name_hash(d['name']) == selector]
                require(len(matches)<=1,'Ambiguous retained E selector')
                draw = matches[0] if matches else None
                transports = []
                for mesh_index,mesh in enumerate(glb['meshes']):
                    for primitive_index,p in enumerate(mesh['primitives']):
                        material = glb['materials'][p['material']]
                        if draw is None or material.get('extras',{}).get('sourceSubmesh') != draw['name']: continue
                        count = glb['accessors'][p['indices']]['count']
                        require(count == draw['indices'],'W source/transport index count differs')
                        transports.append(dict(meshIndex=mesh_index,primitiveIndex=primitive_index,
                            materialIndex=p['material'],indexCount=count,
                            defaultHidden=material['extras']['defaultHidden']))
                require(len(transports)==len(matches),'Missing or ambiguous E transport draw')
                candidates.append(dict(selector=selector,nativeDraws=matches,transportDraws=transports))
            rows.append(dict(resourceKey=key,emitterIndex=index,emitterName=e['emitterName'],
                primitive=primitive,selectorsPresent='mSubmeshesToDraw' in primitive['mMesh'],
                reflection=e.get('reflectionDefinition'),candidates=candidates))
    require(len(rows)==2 and {r['resourceKey'] for r in rows}=={'Ahri_E_buf','Ahri_E_cas'},
            'Changed E attached emitter closure')
    by_key={r['resourceKey']:r for r in rows}
    require(not by_key['Ahri_E_buf']['selectorsPresent'] and by_key['Ahri_E_buf']['candidates']==[],
            'Absent E buff selectors invented')
    cast=by_key['Ahri_E_cas']['candidates']
    require([c['selector'] for c in cast]==['{07c39130}','{62579b4c}'] and
            [d['name'] for c in cast for d in c['nativeDraws']]==['Tails'] and
            cast[1]['nativeDraws']==[] and cast[1]['transportDraws']==[],
            'Changed retained E cast selector candidates')
    return dict(format=1,producerSha256=sha(Path(__file__).read_bytes()),
        inputs=[dict(path=name,sha256=digest,bytes=len(raw[name])) for name,digest in PINS.items()],
        sourceMeshTable=materials['sourceMeshTable'],attachedMeshes=rows,
        summary=dict(attachedEmitters=2,selectorListsPresent=1,selectors=2,nativeMatches=1,transportMatches=1,unmatchedSelectors=1),
        limits=['Verified lowercase FNV-1a selector joins to retained native SKN names and current GLB material extras.',
            'The buff selector list is omitted. No whole-mesh selection or fallback draw is invented.',
            'The cast selector {62579b4c} has no match in the retained draw table; this is not evidence of global native absence.',
            'Lock-to-attachment, native skin sampling, root transforms, fresnel and pixels remain unverified.',
            'This reading changes no runtime behavior, assets or particle profile defaults.'])

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true')
    parser.add_argument('--output',type=Path,default=TARGET)
    args=parser.parse_args()
    data=read();raw=(json.dumps(data,indent=2,allow_nan=False)+'\n').encode();path=args.output
    require(not any(p.is_symlink() for p in [path,*path.parents]),'E attachment output cannot contain symlinks')
    require(not path.exists() or path.read_bytes()==raw,'Conflicting E attachment output')
    require(not args.check or path.exists(),'Missing E attachment output')
    if not args.check and not path.exists():
        path.parent.mkdir(parents=True,exist_ok=True)
        with path.open('xb') as stream:stream.write(raw)
    print(json.dumps(dict(result='passed',bytes=len(raw),sha256=sha(raw),**data['summary'])))
if __name__=='__main__':main()
