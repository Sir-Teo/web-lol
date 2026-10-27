"""Restore exact selected original native payloads; never execute the target or rewrite pins."""
from pathlib import Path
import argparse,json
from concurrent.futures import ThreadPoolExecutor
from native_client_restore import PIN_SHA256,VERIFIER_SHA256,sha,load,rows,target,checked,preflight,fetch,validate_manifests,reconstruct,verify,publish,require

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');parser.add_argument('--receipt',type=Path);args=parser.parse_args()
 require(args.receipt is None or not args.receipt.exists(),'Receipt already exists');pin=load();preflight(pin);payloads={};receipts=[]
 if args.check or all(target(row).exists()for row in rows(pin)):
  payloads={r['path']:checked(target(r).read_bytes(),r)for r in rows(pin)};result=verify(pin,payloads)
 else:
  for row in [pin['officialManifest'],pin['frozenAssetsManifest']]:
   path=target(row)
   if path.exists():payloads[row['path']]=checked(path.read_bytes(),row)
   else:
    payloads[row['path']],receipt=fetch(row);receipts.append(receipt)
  # Bind all ranges and selected files to both verified manifests before fetch.
  validate_manifests(pin,payloads)
  print(json.dumps({'stage':'manifests-verified','version':pin['matchingVersion']}),flush=True)
  missing=[]
  for row in pin['chunks']:
   path=target(row)
   if path.exists():payloads[row['path']]=checked(path.read_bytes(),row)
   else:missing.append(row)
  with ThreadPoolExecutor(max_workers=4)as pool:
   for row,(raw,receipt)in zip(missing,pool.map(fetch,missing)):
    payloads[row['path']]=raw;receipts.append(receipt)
    print(json.dumps({'stage':'chunk-verified','id':row['id'],'compressedBytes':len(raw)}),flush=True)
  payloads.update(reconstruct(pin,payloads));result=publish(pin,payloads)
 report={**result,'sourcePinSha256':PIN_SHA256,'verifierSha256':VERIFIER_SHA256,'restorerSha256':sha(Path(__file__).read_bytes()),'helperSha256':sha(Path(__file__).with_name('native_client_restore.py').read_bytes()),'mode':'check'if args.check else'restore','networkRequests':len(receipts),'requests':receipts}
 if args.receipt:
  args.receipt.parent.mkdir(parents=True,exist_ok=True)
  with args.receipt.open('x')as out:out.write(json.dumps(report,indent=2)+'\n')
 print(json.dumps({k:v for k,v in report.items()if k!='requests'}))
if __name__=='__main__':main()
