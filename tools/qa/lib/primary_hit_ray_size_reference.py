"""Independent source-component sizes on the retained local linear phase policy.

The native witness establishes component routing, not curve arithmetic or clocks.
"""
from pathlib import Path
import hashlib,json,math,sys

def checked(path,digest):
 raw=Path(path).read_bytes()
 if hashlib.sha256(raw).hexdigest()!=digest:raise ValueError('Ray size reference pin differs: '+path)
 return json.loads(raw)

def source_ray():
 native=checked('docs/reference/native-ray-birth-scale.json','98eefa0524f2ef726b5a789f54eaab04d97007cf5a914b8c6e7424b9cd57f5f1')
 pin=native['sourcePin'];source=checked(pin['path'],pin['sha256']);ray=source['resources']['MasterYi_Crit_tar']['definition']['complexEmitterDefinitionData'][1]
 if ray['primitive']!={'__type':'VfxPrimitiveRay'}or ray['birthScale0']['constantValue']!=[80,180,0]:raise ValueError('Ray size specialization differs')
 return ray

def sizes(ray,phase):
 if not math.isfinite(phase)or not 0<=phase<=1:raise ValueError('Invalid local ray phase')
 curve=ray['scale0']['dynamics'];times=curve['times'];values=curve['values'];scale=values[-1]
 if phase<=times[0]:scale=values[0]
 else:
  for i in range(1,len(times)):
   if phase<=times[i]:
    scale=[values[i-1][axis]+((values[i][axis]-values[i-1][axis])*(phase-times[i-1]))/(times[i]-times[i-1])for axis in range(3)];break
 return [birth*factor for birth,factor in zip(ray['birthScale0']['constantValue'],scale)]

if __name__=='__main__':
 ray=source_ray();request=json.loads(Path(sys.argv[1]).read_text());Path(sys.argv[2]).write_text(json.dumps([sizes(ray,row['phase'])for row in request],separators=(',',':'))+'\n')
