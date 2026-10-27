"""Retain the literal W animation/particle/persistent sound declaration chain."""
from pathlib import Path
import argparse,json
from masteryi_w_foley import generate
from masteryi_audio_graph import write_outputs

def generate_outputs():
 reading=generate()
 return [(Path('docs/reference/masteryi/w-foley-binding-reading.json'),(json.dumps(reading,indent=2,allow_nan=False)+'\n').encode())],reading
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--check',action='store_true');args=p.parse_args();outputs,reading=generate_outputs();write_outputs(outputs,args.check)
 print(json.dumps({'clip':reading['animation']['clipName'],'literalStartFrame':reading['animation']['definition']['mEventDataMap']['{875c32d5}']['mStartFrame'],'persistentEvent':reading['bankProfile']['eventName'],'media':1,'frames':reading['floatMaster']['frames'],'runtimeChanged':False}))
