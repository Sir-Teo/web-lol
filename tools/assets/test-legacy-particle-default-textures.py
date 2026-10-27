"""Negative guards for the bounded legacy DDS evidence reader."""
import json,struct
from types import SimpleNamespace
from unittest.mock import patch
from pathlib import Path
import legacy_particle_default_textures as check

def reject(action):
 try:action()
 except (ValueError,struct.error):return
 raise ValueError('Corrupt DDS was accepted')

def main():
 with patch('socket.socket',side_effect=ValueError('Network forbidden')),patch('subprocess.Popen',side_effect=ValueError('Subprocess forbidden')):
  observed=check.observe()
 check.require(observed==json.loads(check.OUTPUT.read_text()),'Legacy DDS record differs')
 raw=bytes.fromhex(observed['resources'][1]['ddsHex']);guards=0
 for change in [lambda b:b[:127],lambda b:b[:-1],lambda b:b+b'\0',lambda b:b'BAD!'+b[4:],lambda b:b[:84]+b'BAD!'+b[88:]]:
  reject(lambda:check.decode(change(raw)));guards+=1
 for offset,value in [(4,123),(12,5),(16,257),(28,10)]:
  damaged=bytearray(raw);struct.pack_into('<I',damaged,offset,value);reject(lambda:check.decode(bytes(damaged)));guards+=1
 archive=object.__new__(check.FrozenArchive);archive.expected={check.EXTRA['id']:check.EXTRA};row=check.EXTRA;chunk=SimpleNamespace(chunk_id=int(row['id'],16),offset=row['offset'],size=row['bytes'],bundle=SimpleNamespace(bundle_id=int('6859BDE6E142DF38',16)))
 payload=(check.ROOT/(row['id']+'.chunk')).read_bytes();archive.verify_chunk(chunk,payload)
 for damaged in [payload[:-1],bytes([payload[0]^1])+payload[1:]]:
  reject(lambda:archive.verify_chunk(chunk,damaged));guards+=1
 for field,value in [('offset',row['offset']+1),('chunk_id',0)]:
  original=getattr(chunk,field);setattr(chunk,field,value);reject(lambda:archive.verify_chunk(chunk,payload));guards+=1;setattr(chunk,field,original)
 check.require(check.rgb565(0xffff)==[255,255,255]and check.rgb565(0)==[0,0,0],'RGB565 endpoints differ')
 # BC1 transparent selector, and BC3's separately indexed alpha interpolation.
 check.require(check.block(bytes.fromhex('00000000ffffffff'),False)==[[0,0,0,0]]*16,'BC1 transparency differs')
 selectors=sum((i%8)<<(3*i)for i in range(16));block=bytes([255,0])+selectors.to_bytes(6,'little')+bytes.fromhex('ffffffff00000000')
 check.require([p[3]for p in check.block(block,True)]==[255,0,218,182,145,109,72,36]*2,'BC3 alpha interpolation differs')
 print(json.dumps({'resources':2,'mips':10,'negativeGuards':guards,'knownBlockChecks':3,'offlineWithSubprocessBlocked':True,'nativeExecuted':False}))
if __name__=='__main__':main()
