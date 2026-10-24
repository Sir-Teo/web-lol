"""Pin selected frozen native skin-particle shaders and inspect AIR without execution.

The selected permutations establish arithmetic, not Leona's native CPU variant
selection, uniform binding, sampler setup, draw order or client pixels.
"""
import hashlib,itertools,json,struct,subprocess
from pathlib import Path
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive

def decode_toc(data):
    """TOC3.0 layout from the pinned LeagueToolkit ShaderToc reader."""
    offset = 0

    def unpack(fmt):
        nonlocal offset
        values = struct.unpack_from('<' + fmt, data, offset)
        offset += struct.calcsize('<' + fmt)
        return values[0] if len(values) == 1 else values

    def string():
        nonlocal offset
        size = unpack('I')
        value = data[offset:offset + size].decode('ascii')
        assert len(data[offset:offset + size]) == size
        offset += size
        return value

    assert string() == 'TOC3.0'
    count, define_count, bundled_count, stage = unpack('4I')
    assert stage in (0, 1)
    assert string() == 'baseDefines'
    defines = [(string(), string()) for _ in range(define_count)]
    assert string() == 'shaders'
    hashes = [unpack('Q') for _ in range(count)]
    ids = [unpack('I') for _ in range(count)]
    assert offset == len(data)
    assert len(set(hashes)) == count
    # Multiple define combinations can share one program (mesh VS does).
    assert count == 2 ** define_count
    assert set(ids) == set(range(bundled_count))
    assert len({k for k, _ in defines}) == define_count
    # Check every combination against the stored hashes, not just chosen samples.
    expected = set()
    for bits in itertools.product((False, True), repeat=define_count):
        selected = sorted(d for d, enabled in zip(defines, bits) if enabled)
        expected.add(xxh64_intdigest(''.join(f'{k}={v}' for k, v in selected)))
    assert expected == set(hashes)
    return defines, dict(zip(hashes, ids)), stage, bundled_count

def programs(data):
    offset, result = 0, []
    while offset < len(data):
        size, = struct.unpack_from('<I', data, offset)
        offset += 4
        program = data[offset:offset + size]
        assert size > 0 and len(program) == size and program[:4] == b'MTLB'
        result.append(program)
        offset += size
    assert offset == len(data) and 1 <= len(result) <= 100
    return result

sha=lambda b:hashlib.sha256(b).hexdigest()
root=Path('.cache/leona-w-skin-shaders');root.mkdir(exist_ok=True)
pin_path=Path('docs/reference/leona-w-skin-shaders.json')
pin=json.loads(pin_path.read_text()) if pin_path.exists() else None
base='assets/shaders/hlsl/skinnedmesh/'
requests={base+'particle_ps.ps-metal':[
    {'DISABLE_FOW':'1'}, {'DISABLE_FOW':'1','REFLECTIVE':'1'},
    {'DISABLE_FOW':'1','REFLECTIVE':'1','ALPHA_EROSION':'1'},
    {'DISABLE_FOW':'1','ALPHA_EROSION':'1'},
    {'DISABLE_FOW':'1','REFLECTIVE':'1','MULT_PASS':'1'},
    {'DISABLE_FOW':'1','REFLECTIVE':'1','ALPHA_TEST':'1'}, {'REFLECTIVE':'1'}],
    base+'particle_vs.vs-metal':[{}, {'REFLECTIVE':'1'}, {'REFLECTIVE':'1','USE_VERTEX_COLORS':'1'}]}
paths=list(requests)+[p+'_'+str(i) for p in requests for i in range(0,1100,100)]
a=RiotArchive({f'{xxh64_intdigest(p):016x}':p for p in paths},pin['extraction'] if pin else None,
    archive_name='DATA/FINAL/ShaderCache.metal.wad.client')
a.extract(list(requests),root/'native')
selections,tables,bundles=[],[],set()
for path,variants in requests.items():
    defines,lookup,stage,count=decode_toc((root/'native'/path).read_bytes())
    tables.append(dict(path=path,stage=stage,defines=dict(defines),variantCount=len(lookup),programs=count))
    for selected in variants:
        assert set(selected.items())<=set(defines)
        key=xxh64_intdigest(''.join(f'{k}={v}' for k,v in sorted(selected.items())))
        program_id=lookup[key];bundle=path+'_'+str(program_id//100*100);bundles.add(bundle)
        selections.append(dict(table=path,defines=selected,programId=program_id,bundle=bundle,index=program_id%100))
a.extract(sorted(bundles),root/'native')
parsed={p:programs((root/'native'/p).read_bytes()) for p in sorted(bundles)}
compiler=subprocess.check_output(['clang','--version'],text=True)
for s in selections:
    raw=parsed[s['bundle']][s['index']]
    name=Path(s['table']).name+'-'+str(s['programId'])
    path=root/(name+'.metallib');path.write_bytes(raw)
    i=raw.index(bytes.fromhex('dec0170b'));_,v,offset,size,cpu=struct.unpack_from('<5I',raw,i)
    assert v==0 and offset==20 and cpu==4294967295
    bitcode=raw[i+offset:i+offset+size];assert len(bitcode)==size
    bc=root/(name+'.bc');bc.write_bytes(bitcode)
    ll=root/(name+'.ll')
    proc=subprocess.run(['clang','-S','-emit-llvm','-Xclang','-disable-llvm-passes',str(bc),'-o',str(ll)],capture_output=True,text=True,check=True)
    s.update(metallib=dict(path=str(path),bytes=len(raw),sha256=sha(raw)),
        bitcode=dict(path=str(bc),bytes=len(bitcode),offset=i+offset,sha256=sha(bitcode)),
        disassembly=dict(path=str(ll),sha256=sha(ll.read_bytes())),compilerStderr=proc.stderr)
result=dict(scope='Ten selected native skin-particle Metal permutations, statically decoded; no native shader/client executed.',
    limits=['Selected permutations do not establish Leona native CPU dispatch, uniforms, samplers, fog, blending or client-frame parity.',
    'Canonical Metal and AIR bitcode bytes are retained. Clang retargets textual IR to the host with LLVM passes disabled.'],
    tables=tables,selections=selections,extraction=a.provenance(),compiler=compiler,
    disassemblyCommand=['clang','-S','-emit-llvm','-Xclang','-disable-llvm-passes','INPUT.bc','-o','OUTPUT.ll'])
if pin:assert result==pin,'Native skin shader provenance or disassembly changed'
else:pin_path.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(dict(result='passed',programs=len(selections),sourceFiles=len(a.outputs),nativeExecuted=False)))
