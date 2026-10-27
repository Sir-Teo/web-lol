"""Retain literal ordinary/critical/passive trail animation events and rig bridge."""
from pathlib import Path
import argparse,json
from masteryi_attack_trails import generate
from masteryi_audio_graph import write_outputs

def generate_outputs():
 reading=generate()
 return [(Path('docs/reference/masteryi/attack-trail-binding-reading.json'),(json.dumps(reading,indent=2,allow_nan=False)+'\n').encode())],reading
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--check',action='store_true');args=p.parse_args();outputs,reading=generate_outputs();write_outputs(outputs,args.check)
 print(json.dumps({'systems':5,'events':len(reading['bindings']),'literalFrames':[b['event']['mStartFrame']for b in reading['bindings']],'jointNodes':sorted({p['glbNode']for b in reading['bindings']for p in b['pairs']}),'runtimeChanged':False}))
