"""Compile pinned V8 trig source with controlled FMA contraction for QA only.
The generated source retains the upstream license. No game import or math changes.
"""
from pathlib import Path
import argparse,ctypes,hashlib,json,struct,subprocess
SOURCE_SHA256='badd30a2643ed785dcfbbce42f95c2522ccea3605cd39e2933467688aae1de14'

def require(ok,message):
 if not ok:raise ValueError(message)
def sha(data):return hashlib.sha256(data).hexdigest()
def generate(raw):
 require(sha(raw)==SOURCE_SHA256,'Pinned V8 trig source differs');text=raw.decode()
 marker='}  // namespace\n\n/* acos(x)';require(text.count(marker)==1,'V8 anonymous helper extent differs')
 end=text.index(marker)+len('}  // namespace\n');prefix=text[:end]
 prefix='\n'.join(line for line in prefix.splitlines()if not line.startswith('#include "'))
 shim='#include <bit>\n#include <cstdint>\n#define V8_INLINE inline\n#define V8_WARN_UNUSED_RESULT\nnamespace v8 { namespace base { using std::bit_cast; } }\n'
 def function(name):
  marker='double '+name+'(double x) {';require(text.count(marker)==1,'V8 trig function extent differs');start=text.index(marker);cursor=text.index('{',start)+1;depth=1
  while depth:
   require(cursor<len(text),'Truncated V8 trig function');char=text[cursor];depth+=(char=='{')-(char=='}');cursor+=1
  value=text[start:cursor];require(value.count('#endif\n')==1,'V8 trig conditional extent differs');return value.replace('#endif\n','')
 return(shim+prefix+'\n'+function('cos')+'\n'+function('sin')+'\n} } }\nextern "C" double qa_sin(double x) {return v8::base::ieee754::sin(x);}\nextern "C" double qa_cos(double x) {return v8::base::ieee754::cos(x);}\n').encode()

def build(source,calls,out,cxx,extra):
 require(not out.exists(),'Compiler reference output already exists');raw=source.read_bytes();generated=generate(raw);out.mkdir(parents=True);program=out/'trig-reference.cc';program.write_bytes(generated);trig=[r for r in calls if r['name']in ('sin','cos')];require(len(trig)==810,'Original distinct trig call closure differs')
 version=subprocess.check_output([cxx,'--version'],text=True);records=[]
 for mode in ['off','on','fast']:
  library=(out/('trig-'+mode+'.so')).resolve();command=[cxx,*extra,'-std=c++20','-O2','-shared','-fPIC','-mfma','-mavx2','-ffp-contract='+mode,str(program),'-o',str(library)]
  result=subprocess.run(command,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True,timeout=60);(out/('compile-'+mode+'.log')).write_text(result.stdout+result.stderr)
  module=ctypes.CDLL(str(library));functions={name:getattr(module,'qa_'+name)for name in ('sin','cos')}
  for f in functions.values():f.argtypes=[ctypes.c_double];f.restype=ctypes.c_double
  exact=[]
  for row in trig:
   value=struct.unpack('>d',bytes.fromhex(row['key'].split(':')[1]))[0];actual=functions[row['name']](value);updated={**row,'result':actual,'bits':struct.pack('>d',actual).hex()};exact.append(updated)
  path=out/('calls-'+mode+'.json');data=(json.dumps(exact,indent=2,allow_nan=False)+'\n').encode();path.write_bytes(data);records.append({'contraction':mode,'command':command,'librarySha256':sha(library.read_bytes()),'callsPath':str(path),'callsSha256':sha(data),'distinctCalls':len(exact)})
 reading={'sourceSha256':sha(raw),'generatedSourceSha256':sha(generated),'compilerVersion':version,'variants':records,'nativeGameExecuted':False,'limits':['Controlled x64 FMA-capable compiler experiment; not a reproduction of the complete historical producing machine.','Only the pinned trig/helper bodies are retained. Header macros use standard bit_cast; arithmetic bodies are unchanged.']};(out/'reference.json').write_text(json.dumps(reading,indent=2)+'\n');return reading

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--source',type=Path,required=True);parser.add_argument('--calls',type=Path,required=True);parser.add_argument('--output-dir',type=Path,required=True);parser.add_argument('--cxx',default='g++');parser.add_argument('--cxx-arg',action='append',default=[]);args=parser.parse_args()
 result=build(args.source,json.loads(args.calls.read_bytes()),args.output_dir,args.cxx,args.cxx_arg);print(json.dumps({'variants':len(result['variants']),'distinctTrigInputs':810,'sourceSha256':result['sourceSha256']}))
