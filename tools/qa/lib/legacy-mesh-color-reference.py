"""Conditional complex Gromp mesh float color reference; executes host C, not native code."""
from pathlib import Path
import hashlib,json,math,os,re,shutil,struct,subprocess,sys,tempfile
PINS={'docs/reference/native-legacy-color-curves.json': 'b41ba9cea4d747af9e39b94ab59738120e83e83743179c5851bf2e4e8d282e72', 'docs/reference/native-mesh-color-route.json': '147d2debc84675fc1c63f39d1fdfa71cb644ae8242f7efb0ec2e6f66c19510c1', 'docs/reference/native-gromp-emitter-routes.json': '8e268d02303addefa4c70b311215329d4ef1782eac4ae12378a54039dd6eff3c', 'docs/reference/gromp-effects.json': '3cb54cd774fbfd66cc52846bb8775d17ab0adb473a570600e274e5f2ae0a1033', 'src/content/gromp-death.json': '683823f0f8c647e973690508f474b9c1e54adf98543b01ba1322fdbd9fdc6bc0'}

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
typedef struct {int count;const char *base;const char *keys[5];} CurveText;
static const CurveText text[1]={CURVES};
static float times[1][5],values[1][5][4];
static void prepare(void){for(int p=0;p<1;p++){float base[4];if(sscanf(text[p].base,"%f %f %f %f",base,base+1,base+2,base+3)!=4)exit(2);for(int k=0;k<text[p].count;k++){float tuple[4];if(sscanf(text[p].keys[k],"%f %f %f %f %f",&times[p][k],tuple,tuple+1,tuple+2,tuple+3)!=5)exit(3);for(int lane=0;lane<4;lane++)values[p][k][lane]=tuple[lane]*base[lane];}}}
static void sample(int p,float phase,float *out){int n=text[p].count;if(n==1||phase<=times[p][0]){memcpy(out,values[p][0],16);return;}for(int k=1;k<n;k++)if(phase<times[p][k]){float numerator=phase-times[p][k-1],denominator=times[p][k]-times[p][k-1],ratio=numerator/denominator;for(int lane=0;lane<4;lane++){float difference=values[p][k][lane]-values[p][k-1][lane],scaled=difference*ratio;out[lane]=scaled+values[p][k-1][lane];}return;}memcpy(out,values[p][n-1],16);}
int main(void){prepare();int profile;double input;while(scanf("%d %lf",&profile,&input)==2){if(profile!=6||!isfinite(input)||input<0||input>1)return 4;float color[4];sample(0,(float)input,color);uint32_t bits[4];memcpy(bits,color,16);printf("%08x %08x %08x %08x\n",bits[0],bits[1],bits[2],bits[3]);}return ferror(stdin)?5:0;}
'''
def main():
 require(len(sys.argv)==3,'Usage: legacy-mesh-color-reference.py INPUT.json OUTPUT.json')
 input_path,output=map(Path,sys.argv[1:]);sidecars=[output,Path(str(output)+'.c'),Path(str(output)+'.compiler.json')]
 require(not any(p.exists()for p in sidecars),'Use fresh reference output files')
 pins={}
 for name,expected in PINS.items():
  raw=Path(name).read_bytes();require(sha(raw)==expected,'Pinned source changed: '+name);pins[name]=expected
 mesh=json.loads(Path('docs/reference/native-mesh-color-route.json').read_text());require(mesh['source']['profileIndex']==6 and mesh['source']['blendMode']==1 and mesh['floatTransfer']['bytes']==16 and mesh['source']['quadBytePolicyApplicable']is False,'Mesh route scope changed');compiled=json.loads(Path('src/content/gromp-death.json').read_text());require([compiled['profiles'][i]['blend']for i in[6]]==[1],'Unpremultiplied mode scope changed');witness=json.loads(Path('docs/reference/native-legacy-color-curves.json').read_text());routes=json.loads(Path('docs/reference/native-gromp-emitter-routes.json').read_text())['source'];require(routes['simpleProfiles']==[0]and routes['profiles'][6]['pType']==3 and routes['profiles'][6]['queue']=='legacy-record','Emitter route scope changed');curves=[]
 for index,count in[(6,4)]:
  profile=witness['source']['profiles'][index];keys=profile['keys'];require(all(0<=v<=1 for k in keys for v in k['source']['values'][1:])and profile['base']['values']==[1.,1.,1.,1.],'Reference unit-color scope changed');require(profile['profileIndex']==index and profile['kind']=='mesh'and len(keys)==count,'Curve scope changed')
  curves.append('{'+str(count)+','+numeric(profile['base']['raw'],4)+',{'+','.join(numeric(k['source']['raw'],5)for k in keys)+'}}')
 code=CODE.replace('CURVES',','.join(curves));rows=json.loads(input_path.read_text());require(isinstance(rows,list)and len(rows)<=1000000,'Invalid reference rows')
 for row in rows:
  require(isinstance(row,dict)and type(row.get('profileIndex'))is int and row['profileIndex']==6,'Unsupported profile')
  phase=row.get('phase');require(type(phase)in[int,float]and math.isfinite(phase)and 0<=phase<=1,'Invalid normalized local phase')
 compiler=shutil.which('cc');require(compiler is not None,'A host C compiler is required');compiler_real=Path(compiler).resolve();flags=['-std=c11','-O2','-ffp-contract=off','-fno-fast-math']
 with tempfile.TemporaryDirectory(prefix='legacy-mesh-color-')as temp:
  source=Path(temp)/'reference.c';binary=Path(temp)/'reference';source.write_text(code)
  subprocess.run([compiler,*flags,str(source),'-lm','-o',str(binary)],check=True,capture_output=True)
  lines=subprocess.check_output([str(binary)],input=''.join(f"{r['profileIndex']} {r['phase']:.17g}\n"for r in rows),text=True,env={**os.environ,'LC_ALL':'C'}).splitlines()
 require(len(lines)==len(rows),'Reference row count differs');results=[]
 for row,line in zip(rows,lines):
  fields=line.split();require(len(fields)==4,'Invalid reference output');words=[int(v,16)for v in fields[:4]]
  results.append({**row,'rgba':[struct.unpack('<f',struct.pack('<I',v))[0]for v in words],'words':[f'{v:08x}'for v in words]})
 compiler_record={'compiler':compiler,'realpath':str(compiler_real),'sha256':sha(compiler_real.read_bytes()),'version':subprocess.check_output([compiler,'--version'],text=True).splitlines()[0],'flags':flags,'sourceSha256':sha(code.encode()),'sourcePins':pins,'scope':'Raw-key float32 RGBA for complex Gromp mesh profile6 at the conditional float4 transfer boundary at supplied normalized local phases; unit birth/external/modulation, no premultiplication for source mode1. Native live dispatch, clocks and later cache mutation unobserved.','nativeExecuted':False}
 for p in sidecars:p.parent.mkdir(parents=True,exist_ok=True)
 sidecars[1].write_text(code);sidecars[2].write_text(json.dumps(compiler_record,indent=2)+'\n');output.write_text(json.dumps(results,separators=(',',':'))+'\n')
if __name__=='__main__':main()
