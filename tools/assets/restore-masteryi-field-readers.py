"""Restore/check exact pinned reconstruction readers without replacing conflicts."""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess

PIN=Path('docs/reference/masteryi/w-fields-reader.json')
PIN_SHA256='b67cb8e90ae6521816579a06ae1b4274bd6ae11befc28d75fca948fd8abff3c7'
ROOT=Path('.cache/masteryi-w-buff-cloud')

def require(value,message):
    if not value:raise ValueError(message)
def checked(raw,row):
    require(len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256'], 'Pinned field reader bytes differ')
    require(hashlib.sha1(f'blob {len(raw)}\0'.encode()+raw).hexdigest()==row['gitBlobSha1'], 'Pinned field reader Git blob differs')
    return raw

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');parser.add_argument('--root',type=Path,default=ROOT);args=parser.parse_args()
    raw=PIN.read_bytes();require(hashlib.sha256(raw).hexdigest()==PIN_SHA256,'Field reader pin differs');record=json.loads(raw)
    require(record['revision']=='65a7d2a746b9d02d65dab788b5f7b8198d5e555e' and len(record['files'])==7,'Field reader closure differs')
    rows=[]
    for row in record['files']:
        source=Path(row['path']);require(source.parent==ROOT and source.suffix=='.ts','Invalid field reader cache path')
        target=args.root/source.name
        if target.exists():checked(target.read_bytes(),row)
        elif args.check:raise FileNotFoundError(target)
        rows.append((target,row))
    # All existing conflicts are rejected before any network access.
    outputs=[]
    if not args.check:
        for target,row in rows:
            if not target.exists():
                raw=subprocess.check_output(['curl','-fLsS','--max-time','30',row['url']]);outputs.append((target,checked(raw,row)))
        for target,raw in outputs:
            require(not target.exists() or target.read_bytes()==raw,'Conflicting field reader appeared')
        for target,raw in outputs:
            if not target.exists():
                target.parent.mkdir(parents=True,exist_ok=True)
                with target.open('xb') as out:out.write(raw)
    print(json.dumps({'files':len(rows),'restored':len(outputs),'mode':'check'if args.check else'restore'}))

if __name__=='__main__':main()
