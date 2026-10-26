"""Retain all three literal primary contact bindings and complete emitter identities."""
from pathlib import Path
import argparse,json
from masteryi_primary_hits import load,project
from masteryi_audio_graph import write_outputs

def generate_outputs():
 reading=project(*load())
 return [(Path('docs/reference/masteryi/primary-hit-binding-reading.json'),(json.dumps(reading,indent=2,allow_nan=False)+'\n').encode())],reading
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--check',action='store_true');args=p.parse_args();outputs,reading=generate_outputs();write_outputs(outputs,args.check)
 print(json.dumps({'systems':len(reading['systems']),'emitters':sum(len(r['emitters'])for r in reading['systems']),'sourceFiles':reading['sourceFiles'],'runtimeChanged':False}))
