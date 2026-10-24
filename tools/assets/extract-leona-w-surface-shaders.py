"""Retain native W surface arithmetic samples; no native shader is executed.

TOC and bundle parsing reuse the pinned repository reader. --check verifies the
retained program/bitcode/disassembly bytes without regenerating or downloading.
"""
import argparse, ast, hashlib, itertools, json, struct, subprocess
from pathlib import Path
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive

sha=lambda b:hashlib.sha256(b).hexdigest()
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check',action='store_true')
args=parser.parse_args()
root=Path('.cache/leona-w-surface-shaders-v1-20261023')
pin_path=Path('docs/reference/leona-w-surface-shaders.json')
reader=Path('tools/assets/export-particle-shaders.py')
if args.check:
    pin=json.loads(pin_path.read_text())
    assert sha(reader.read_bytes())==pin['tocReaderSha256']
    for s in pin['selections']:
        for k in ['metallib','bitcode','disassembly']:
            p=s[k];b=Path(p['path']).read_bytes();assert sha(b)==p['sha256']
            if 'bytes' in p:assert len(b)==p['bytes']
    for p in pin['extraction']['files']:
        assert sha((root/'native'/p['path']).read_bytes())==p['sha256']
    print(json.dumps(dict(result='passed',programs=len(pin['selections']),nativeExecuted=False)))
    raise SystemExit
root.mkdir()
namespace=dict(globals())
tree=ast.parse(reader.read_text())
for name in ['decode_toc','programs']:
    definition=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name==name)
    exec(compile(ast.Module(body=[definition],type_ignores=[]),str(reader),'exec'),namespace)
decode_toc,programs=namespace['decode_toc'],namespace['programs']
base='assets/shaders/hlsl/particlesystem/'
requests={
 base+'mesh_ps.ps-metal':[
  ['DISABLE_FOW'],['DISABLE_FOW','MULT_PASS'],
  ['DISABLE_FOW','ALPHA_EROSION','MULT_PASS'],
  ['DISABLE_FOW','SOFT_PARTICLES'],
  ['DISABLE_FOW','SOFT_PARTICLES','ALPHA_EROSION','MULT_PASS'],
  ['DISABLE_FOW','SEPARATE_ALPHA_UV'],
  ['DISABLE_FOW','SEPARATE_ALPHA_UV','MULT_PASS'],
 ],
 base+'mesh_vs.vs-metal':[
  ['DISABLE_FOW'],['DISABLE_FOW','MULT_PASS'],
  ['DISABLE_FOW','SEPARATE_ALPHA_UV'],
  ['DISABLE_FOW','USE_VERTEX_COLORS'],
  ['DISABLE_FOW','SEPARATE_ALPHA_UV','MULT_PASS','USE_VERTEX_COLORS'],
 ],
 base+'quad_ps.ps-metal':[
  ['DISABLE_FOW'],['DISABLE_FOW','MULT_PASS'],
  ['DISABLE_FOW','MASKED'],['DISABLE_FOW','MASKED','MULT_PASS'],
  ['DISABLE_FOW','SOFT_PARTICLES'],['DISABLE_FOW','SOFT_PARTICLES','MULT_PASS'],
 ],
 base+'quad_vs.vs-metal':[
  ['DISABLE_FOW'],['DISABLE_FOW','MULT_PASS'],
  ['DISABLE_FOW','MASKED'],['DISABLE_FOW','MASKED','MULT_PASS'],
 ],
}
paths=list(requests)+[p+'_'+str(i) for p in requests for i in range(0,2100,100)]
a=RiotArchive({f'{xxh64_intdigest(p):016x}':p for p in paths},archive_name='DATA/FINAL/ShaderCache.metal.wad.client')
a.extract(list(requests),root/'native')
old=json.loads(Path('docs/reference/particle-shaders.json').read_text())
for p in old['extraction']['files']:
    if p['path'] in requests:assert sha((root/'native'/p['path']).read_bytes())==p['sha256']
selections,tables,bundles=[],[],set()
for path,variants in requests.items():
    defines,lookup,stage,count=decode_toc((root/'native'/path).read_bytes())
    tables.append(dict(path=path,stage=stage,defines=dict(defines),variants=len(lookup),programs=count))
    for names in variants:
        selected=sorted((k,v) for k,v in defines if k in names)
        assert len(selected)==len(names)
        key=xxh64_intdigest(''.join(f'{k}={v}' for k,v in selected))
        program_id=lookup[key];bundle=path+'_'+str(program_id//100*100);bundles.add(bundle)
        selections.append(dict(table=path,defines=dict(selected),programId=program_id,bundle=bundle,index=program_id%100))
a.extract(sorted(bundles),root/'native')
parsed={p:programs((root/'native'/p).read_bytes()) for p in sorted(bundles)}
for s in selections:
    raw=parsed[s['bundle']][s['index']]
    name=Path(s['table']).name+'-'+str(s['programId'])
    path=root/(name+'.metallib');path.write_bytes(raw)
    marker=bytes.fromhex('dec0170b');i=raw.index(marker);assert raw.find(marker,i+1)==-1
    _,v,offset,size,cpu=struct.unpack_from('<5I',raw,i)
    assert v==0 and offset==20 and cpu==4294967295
    bitcode=raw[i+offset:i+offset+size];assert len(bitcode)==size and bitcode[:4]==b'BC\xc0\xde'
    bc=root/(name+'.bc');bc.write_bytes(bitcode)
    ll=root/(name+'.ll')
    proc=subprocess.run(['clang','-S','-emit-llvm','-Xclang','-disable-llvm-passes',str(bc),'-o',str(ll)],capture_output=True,text=True,check=True)
    assert '@wrapped_main' in ll.read_text()
    s.update(metallib=dict(path=str(path),bytes=len(raw),sha256=sha(raw)),
      bitcode=dict(path=str(bc),bytes=len(bitcode),offset=i+offset,sha256=sha(bitcode)),
      disassembly=dict(path=str(ll),bytes=ll.stat().st_size,sha256=sha(ll.read_bytes())),compilerStderr=proc.stderr)
result=dict(scope='Twenty-two selected static Metal/AIR surface permutations; no native CPU dispatch, sampler setup or shader/client execution certified.',
 limits=['Variant selection is exploratory and does not prove W native dispatch or global uniforms.',
 'Clang retargets textual IR to the host with LLVM passes disabled; original Metal/AIR bytes are preserved.'],
 tocReader=str(reader),tocReaderSha256=sha(reader.read_bytes()),tables=tables,selections=selections,
 extraction=a.provenance(),compiler=subprocess.check_output(['clang','--version'],text=True))
pin_path.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(dict(result='passed',programs=len(selections),sourceFiles=len(a.outputs),nativeExecuted=False)))
