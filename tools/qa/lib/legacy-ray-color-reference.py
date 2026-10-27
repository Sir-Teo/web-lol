"""Conditional legacy Gromp raw-key color reference; executes host C, not native code."""
from pathlib import Path
import hashlib,json,math,os,re,shutil,struct,subprocess,sys,tempfile
PINS={
 'docs/reference/native-legacy-color-curves.json':'b41ba9cea4d747af9e39b94ab59738120e83e83743179c5851bf2e4e8d282e72',
 'docs/reference/native-ray-packet.json':'ab9b825f1108ed1e44124ee5f9821753eb73352cbf8738a8eebbb884c892b4ec',
 'docs/reference/gromp-effects.json':'3cb54cd774fbfd66cc52846bb8775d17ab0adb473a570600e274e5f2ae0a1033',
}
def require(ok,message):
 if not ok:raise ValueError(message)
def sha(raw):return hashlib.sha256(raw).hexdigest()
def numeric(text,count):
 require(isinstance(text,str)and re.fullmatch(r'[0-9eE+\.\- \t]+',text)is not None,'Invalid numeric source text')
 values=text.split();require(len(values)==count and all(math.isfinite(float(v))for v in values),'Invalid source tuple');return json.dumps(text)
CODE=r'''
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <math.h>
typedef struct {int count;const char *base;const char *keys[4];} CurveText;
static const CurveText text[2]={CURVES};
static float times[2][4],values[2][4][4];
static void prepare(void){for(int p=0;p<2;p++){float base[4];if(sscanf(text[p].base,"%f %f %f %f",base,base+1,base+2,base+3)!=4)exit(2);for(int k=0;k<text[p].count;k++){float tuple[4];if(sscanf(text[p].keys[k],"%f %f %f %f %f",&times[p][k],tuple,tuple+1,tuple+2,tuple+3)!=5)exit(3);for(int lane=0;lane<4;lane++)values[p][k][lane]=tuple[lane]*base[lane];}}}
static void sample(int p,float phase,float *out){int n=text[p].count;if(n==1||phase<=times[p][0]){memcpy(out,values[p][0],16);return;}for(int k=1;k<n;k++)if(phase<times[p][k]){float numerator=phase-times[p][k-1],denominator=times[p][k]-times[p][k-1],ratio=numerator/denominator;for(int lane=0;lane<4;lane++){float difference=values[p][k][lane]-values[p][k-1][lane],scaled=difference*ratio;out[lane]=scaled+values[p][k-1][lane];}return;}memcpy(out,values[p][n-1],16);}
static unsigned byte(float value){return value<=0?0:value>=1?255:(unsigned)fmaf(value,255.0f,.5f);}
int main(void){prepare();int profile;double input;while(scanf("%d %lf",&profile,&input)==2){if((profile!=5&&profile!=7)||!isfinite(input)||input<0||input>1)return 4;float color[4];sample(profile==5?0:1,(float)input,color);uint32_t bits[4];memcpy(bits,color,16);float packed[4];memcpy(packed,color,16);if(profile==7){for(int lane=0;lane<3;lane++)packed[lane]*=packed[3];packed[3]=1;}printf("%08x %08x %08x %08x %u %u %u %u\n",bits[0],bits[1],bits[2],bits[3],byte(packed[2]),byte(packed[1]),byte(packed[0]),byte(packed[3]));}return ferror(stdin)?5:0;}
'''
def main():
 require(len(sys.argv)==3,'Usage: legacy-ray-color-reference.py INPUT.json OUTPUT.json')
 input_path,output=map(Path,sys.argv[1:]);sidecars=[output,Path(str(output)+'.c'),Path(str(output)+'.compiler.json')]
 require(not any(p.exists()for p in sidecars),'Use fresh reference output files')
 pins={}
 for name,expected in PINS.items():
  raw=Path(name).read_bytes();require(sha(raw)==expected,'Pinned source changed: '+name);pins[name]=expected
 witness=json.loads(Path('docs/reference/native-legacy-color-curves.json').read_text());curves=[]
 for index,count in[(5,4),(7,3)]:
  profile=witness['source']['profiles'][index];keys=profile['keys'];require(profile['profileIndex']==index and profile['kind']=='ray'and len(keys)==count,'Curve scope changed')
  curves.append('{'+str(count)+','+numeric(profile['base']['raw'],4)+',{'+','.join(numeric(k['source']['raw'],5)for k in keys)+'}}')
 code=CODE.replace('CURVES',','.join(curves));rows=json.loads(input_path.read_text());require(isinstance(rows,list)and len(rows)<=1000000,'Invalid reference rows')
 for row in rows:
  require(isinstance(row,dict)and type(row.get('profileIndex'))is int and row['profileIndex']in[5,7],'Unsupported profile')
  phase=row.get('phase');require(type(phase)in[int,float]and math.isfinite(phase)and 0<=phase<=1,'Invalid normalized local phase')
 compiler=shutil.which('cc');require(compiler is not None,'A host C compiler is required');compiler_real=Path(compiler).resolve();flags=['-std=c11','-O2','-ffp-contract=off','-fno-fast-math']
 with tempfile.TemporaryDirectory(prefix='legacy-ray-color-')as temp:
  source=Path(temp)/'reference.c';binary=Path(temp)/'reference';source.write_text(code)
  subprocess.run([compiler,*flags,str(source),'-lm','-o',str(binary)],check=True,capture_output=True)
  lines=subprocess.check_output([str(binary)],input=''.join(f"{r['profileIndex']} {r['phase']:.17g}\n"for r in rows),text=True,env={**os.environ,'LC_ALL':'C'}).splitlines()
 require(len(lines)==len(rows),'Reference row count differs');results=[]
 for row,line in zip(rows,lines):
  fields=line.split();require(len(fields)==8,'Invalid reference output');words=[int(v,16)for v in fields[:4]];bgra=[int(v)for v in fields[4:]];require(all(0<=v<=255 for v in bgra),'Invalid packed bytes')
  results.append({**row,'rgba':[struct.unpack('<f',struct.pack('<I',v))[0]for v in words],'words':[f'{v:08x}'for v in words],'bgra':bgra})
 compiler_record={'compiler':compiler,'realpath':str(compiler_real),'sha256':sha(compiler_real.read_bytes()),'version':subprocess.check_output([compiler,'--version'],text=True).splitlines()[0],'flags':flags,'sourceSha256':sha(code.encode()),'sourcePins':pins,'scope':'Raw-key Gromp Ray color component at supplied normalized local phases, unit birth/external colors. Native live dispatch, clocks and later cache mutation unobserved.','nativeExecuted':False}
 for p in sidecars:p.parent.mkdir(parents=True,exist_ok=True)
 sidecars[1].write_text(code);sidecars[2].write_text(json.dumps(compiler_record,indent=2)+'\n');output.write_text(json.dumps(results,separators=(',',':'))+'\n')
if __name__=='__main__':main()
