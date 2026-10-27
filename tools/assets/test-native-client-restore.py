"""Bounded HTTP framing, immutable native cache and frozen-input guards."""
from pathlib import Path
import copy,io,tempfile,unittest
from unittest.mock import patch
import native_client_restore as source
DATA=b'known-data'
class Response:
 def __init__(self,raw=DATA,status=206,headers=None,url='https://lol.secure.dyn.riotcdn.net/channels/public/bundles/0123456789ABCDEF.bundle'):
  self.raw=raw;self.status=status;self.headers={'Content-Range':'bytes 5-14/100','Content-Length':'10'}if headers is None else headers;self.url=url;self.reads=[]
 def __enter__(self):return self
 def __exit__(self,*args):return False
 def geturl(self):return self.url
 def read(self,size):self.reads.append(size);return self.raw[:size]
def row():return{'path':'.cache/native-test/range.zst','url':'https://lol.secure.dyn.riotcdn.net/channels/public/bundles/0123456789ABCDEF.bundle','range':[5,14],'bytes':len(DATA),'sha256':source.sha(DATA)}
class NativeRestoreGuards(unittest.TestCase):
 def fetch(self,response,record=None):return source.fetch(record or row(),opener=lambda request,timeout:response)
 def rejected(self,response):
  with self.assertRaises(ValueError):self.fetch(response)
 def test_valid_range_keeps_exact_bytes_and_bounded_read(self):
  response=Response();raw,receipt=self.fetch(response);self.assertEqual(raw,DATA);self.assertEqual(response.reads,[len(DATA)+1]);self.assertEqual(receipt['status'],206);self.assertEqual(receipt['sha256'],source.sha(DATA))
 def test_range_ignored_rejects_before_read(self):
  response=Response(status=200);self.rejected(response);self.assertEqual(response.reads,[])
 def test_wrong_start_rejects(self):self.rejected(Response(headers={'Content-Range':'bytes 4-13/100','Content-Length':'10'}))
 def test_wrong_end_rejects(self):self.rejected(Response(headers={'Content-Range':'bytes 5-15/100','Content-Length':'10'}))
 def test_invalid_total_rejects(self):self.rejected(Response(headers={'Content-Range':'bytes 5-14/14','Content-Length':'10'}))
 def test_missing_range_rejects(self):self.rejected(Response(headers={'Content-Length':'10'}))
 def test_wrong_content_length_rejects_before_read(self):
  response=Response(headers={'Content-Range':'bytes 5-14/100','Content-Length':'1000000000'});self.rejected(response);self.assertEqual(response.reads,[])
 def test_missing_length_still_bounds_and_verifies_bytes(self):
  response=Response(headers={'Content-Range':'bytes 5-14/100'});self.assertEqual(self.fetch(response)[0],DATA);self.assertEqual(response.reads,[11])
 def test_truncated_payload_rejects(self):self.rejected(Response(raw=DATA[:-1]))
 def test_oversized_payload_rejects_with_bounded_read(self):
  response=Response(raw=DATA*10000);self.rejected(response);self.assertEqual(response.reads,[11])
 def test_equal_length_wrong_hash_rejects(self):self.rejected(Response(raw=b'wrong-data'))
 def test_unexpected_redirect_rejects_before_read(self):
  response=Response(url='https://example.com/native');self.rejected(response);self.assertEqual(response.reads,[])
 def test_unexpected_origin_never_calls_opener(self):
  record=row();record['url']='https://example.com/native';calls=[]
  with self.assertRaises(ValueError):source.fetch(record,opener=lambda *a,**k:calls.append(a))
  self.assertEqual(calls,[])
 def test_manifest_requires_200_and_exact_frozen_bytes(self):
  record=row();record.pop('range');response=Response(status=200,headers={'Content-Length':'10'});self.assertEqual(self.fetch(response,record)[0],DATA)
  with self.assertRaises(ValueError):self.fetch(Response(),record)
 def test_changed_pin_rejects_before_json_or_parser(self):
  with tempfile.TemporaryDirectory()as temp:
   path=Path(temp)/'pin';path.write_bytes(b'{}')
   with self.assertRaisesRegex(ValueError,'Frozen native pin'):source.load(path)
 def test_existing_conflict_is_not_repaired(self):
  pin=source.load();record=pin['officialManifest']
  with tempfile.TemporaryDirectory()as temp,patch.object(source,'ROOT',Path(temp)):
   path=source.target(record);path.parent.mkdir(parents=True);path.write_bytes(b'conflict');before=path.stat().st_mtime_ns
   with self.assertRaisesRegex(ValueError,'Frozen native bytes'):source.preflight(pin)
   self.assertEqual(path.read_bytes(),b'conflict');self.assertEqual(path.stat().st_mtime_ns,before)
 def test_cache_path_cannot_escape_root(self):
  with self.assertRaises(ValueError):source.target({'path':'../outside'})
 def test_symlink_escape_rejects(self):
  with tempfile.TemporaryDirectory()as temp,tempfile.TemporaryDirectory()as outside,patch.object(source,'ROOT',Path(temp)):
   (Path(temp)/'.cache').mkdir();(Path(temp)/'.cache'/'escape').symlink_to(outside,target_is_directory=True)
   with self.assertRaises(ValueError):source.target({'path':'.cache/escape/native'})
if __name__=='__main__':unittest.main()
