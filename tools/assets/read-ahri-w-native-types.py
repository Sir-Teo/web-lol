"""Retain emitter field types directly from the verified original W BINs."""
import argparse
import io
import json
from pathlib import Path
import hashlib
from ahri_w_particles import load, checked, cache_path, verify_native, PARSER_SHA256

TARGET=Path('docs/reference/ahri/w-native-types.json')
def require(ok,message):
    if not ok: raise ValueError(message)
def sha(raw): return hashlib.sha256(raw).hexdigest()
def read(root):
    from cdtb import binfile
    pin,model=load()
    verify_native(pin,model,root)
    files={row['path']:row for row in pin['extraction']['files']}
    parsed={};resources=[];types={}
    for key,resource in pin['resources'].items():
        row=files[resource['sourceBin']]
        if row['path'] not in parsed:
            raw=checked(cache_path(root,row),row['sha256'],row['bytes'])
            parsed[row['path']]=binfile.BinFile(io.BytesIO(raw))
        matches=[e for e in parsed[row['path']].entries if e.path.h==binfile.compute_binhash(resource['record'])]
        require(len(matches)==1,'Missing or ambiguous W native entry')
        field=matches[0].get('complexEmitterDefinitionData')
        emitters=[]
        for index,e in enumerate(field.value.values if field else []):
            expected=resource['definition']['complexEmitterDefinitionData'][index]
            require(set(expected)-{'__type'}=={f.name.to_serializable() for f in e.fields},'Native emitter field closure differs')
            rows=[]
            for f in e.fields:
                name=f.name.to_serializable()
                types.setdefault(name,set()).add(f.type.name)
                rows.append(dict(name=name,type=f.type.name,typeCode=int(f.type)))
            emitters.append(dict(index=index,name=expected['emitterName'],nativeType=e.type.to_serializable(),fields=rows))
        resources.append(dict(resourceKey=key,sourceBin=resource['sourceBin'],sourceBinSha256=row['sha256'],
            record=resource['record'],emitterListPresent=field is not None,
            emitterListType=field.type.name if field else None,
            emitterElementType=field.value.vtype.name if field else None,emitters=emitters))
    require(sum(len(r['emitters']) for r in resources)==30,'Incomplete W typed emitter closure')
    shared=[(r,e,f) for r in resources for e in r['emitters'] for f in e['fields'] if f['name']=='ParticlesShareRandomValue']
    require(len(shared)==1 and shared[0][0]['resourceKey']=='Ahri_W_mis_02' and shared[0][2]['type']=='FLAG',
            'Shared-random native type differs')
    return dict(format=1,producerSha256=sha(Path(__file__).read_bytes()),
        sourceHelperSha256=sha(Path(__file__).with_name('ahri_w_particles.py').read_bytes()),
        parserSha256=PARSER_SHA256,sourcePinSha256=sha(Path('docs/reference/ahri/w-particles.json').read_bytes()),
        modelPinSha256=sha(Path('docs/reference/ahri-model.json').read_bytes()),resources=resources,
        fieldTypes={k:sorted(v) for k,v in sorted(types.items())},
        summary=dict(resources=len(resources),emitters=30,uniqueFields=len(types),
            flagFields=sum(f['type']=='FLAG' for r in resources for e in r['emitters'] for f in e['fields'])),
        limits=['Field types come from the verified original BIN field tags, not JSON value inference.',
            'CDTB retains FLAG payloads as integers. In particular ParticlesShareRandomValue is FLAG (0x87), value 1; its JSON integer is not an inferred numeric parameter.',
            'Nested values, complete declarations and omissions remain in the original source pin.',
            'This reading does not certify native random streams, callback dispatch or rendered pixels.'])

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true')
    parser.add_argument('--root',type=Path,default=Path('.cache/ahri-w-particles/sources'))
    parser.add_argument('--output',type=Path,default=TARGET)
    args=parser.parse_args();data=read(args.root);raw=(json.dumps(data,indent=2,allow_nan=False)+'\n').encode();path=args.output
    require(not any(p.is_symlink() for p in [path,*path.parents]),'Native type output cannot contain symlinks')
    require(not path.exists() or path.read_bytes()==raw,'Conflicting W native type output')
    require(not args.check or path.exists(),'Missing W native type output')
    if not args.check and not path.exists():
        path.parent.mkdir(parents=True,exist_ok=True)
        with path.open('xb') as stream:stream.write(raw)
    print(json.dumps(dict(result='passed',bytes=len(raw),sha256=sha(raw),**data['summary'])))
if __name__=='__main__':main()
