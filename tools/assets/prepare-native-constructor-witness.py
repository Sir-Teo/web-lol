"""Retain native constructor evidence separately from current Yi compiler alignment."""
from pathlib import Path
import argparse,json
from native_constructor_witness import observe,primary_alignment,primary_archive_match,sha
from masteryi_audio_graph import write_outputs
RECORD=Path('docs/reference/native-constructor-witness.json')
ALIGNMENT=Path('docs/reference/masteryi/primary-hit-native-default-alignment.json')
def raw(value):return(json.dumps(value,indent=2,allow_nan=False)+'\n').encode()
def generate():
 reading=observe();data=raw(reading);alignment={'format':1,'nativeWitness':{'path':str(RECORD),'sha256':sha(data)},**primary_alignment(),'nativeAssetCohort':primary_archive_match(),'limits':['Current source/compiled alignment only; constructor defaults do not establish actual native dispatch or later overrides.','Alpha byte normalization by 255 remains the local reader/material policy.']}
 return[(RECORD,data),(ALIGNMENT,raw(alignment))],reading,alignment
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args();outputs,reading,alignment=generate();write_outputs(outputs,args.check);print(json.dumps({**reading['checks'],'primaryEmitters':len(alignment['emitters']),'nativeExecuted':False}))
