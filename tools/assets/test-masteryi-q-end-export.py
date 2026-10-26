"""Exact complete runtime delivery of the separately retained Q_End reading."""
from pathlib import Path
import json,runpy,unittest
EXPORT=runpy.run_path(str(Path(__file__).with_name('export-masteryi-q-end-particles.py')))
class EndDelivery(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.outputs,cls.content,cls.reading=EXPORT['generate_outputs']()
 def test_complete_runtime_projection_and_shared_ownership(self):
  self.assertEqual(len(self.content['profiles']),2);self.assertEqual(len(self.content['textures']),5);self.assertEqual(sum(len(t['rectangles'])for t in self.content['textures']),41);self.assertEqual(self.reading['historyTicks'],18)
  self.assertEqual(sum('masteryi-q-end-'in t['url']for t in self.content['textures']),3)
  self.assertEqual(sum('masteryi-q-cast-'in t['url']for t in self.content['textures']),1)
  self.assertEqual(sum('masteryi-q-contact-'in t['url']for t in self.content['textures']),1)
  self.assertEqual(self.content['profiles'][1]['distortion']['mode'],2)
 def test_all_delivered_files_match_exact_generated_bytes(self):
  for path,raw in self.outputs:self.assertEqual(path.read_bytes(),raw)
 def test_unmodified_source_projection_keeps_raw_fields_and_omissions(self):
  source=json.loads(Path('docs/reference/masteryi/q-end-particle-reading.json').read_text())
  self.assertEqual([p['explicitFields']for p in self.content['profiles']],[p['explicitFields']for p in source['profiles']]);self.assertFalse(source['onCreateSoundAuthored'])
if __name__=='__main__':unittest.main()
