"""Offline mutation checks for immutable source-WEM cache restoration."""
import hashlib
import json
from pathlib import Path
import runpy
import struct
import tempfile
import unittest

module = runpy.run_path(str(Path(__file__).with_name('restore-garen-audio-media.py')))
restore = module['restore']
sha = lambda raw: hashlib.sha256(raw).hexdigest()


class RestoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.ref = self.root / 'docs/reference'
        self.ref.mkdir(parents=True)
        (self.ref / 'garen-model.json').write_bytes(b'{}')
        self.wem = b'RIFF' + struct.pack('<I', 8) + b'WAVEdata'
        self.bank = b'bank-prefix' + self.wem
        self.bank_path = self.root / '.cache/garen-audio-sources/assets/garen_base_sfx_audio.bnk'
        self.bank_path.parent.mkdir(parents=True)
        self.bank_path.write_bytes(self.bank)
        self.extraction = dict(referenceVersion='16.18.8175716',
            archive='DATA/FINAL/Champions/Garen.wad.client',
            files=[dict(path='assets/garen_base_sfx_audio.bnk', bytes=len(self.bank), sha256=sha(self.bank))])
        self.write_extraction()
        self.graphs = {}
        for ability in ['aa', 'p']:
            self.graphs[ability] = dict(extractionSha256=sha(self.extraction_raw),
                referenceSha256=sha(b'{}'), parserRevision=module['PARSER_REVISION'],
                media=[dict(id=1, bankOffset=len(b'bank-prefix'), bytes=len(self.wem), sha256=sha(self.wem))])
            self.write_graph(ability)

    def tearDown(self):
        self.temp.cleanup()

    def write_extraction(self):
        self.extraction_raw = json.dumps(self.extraction).encode()
        (self.ref / 'garen-audio-extraction.json').write_bytes(self.extraction_raw)

    def write_graph(self, ability='aa', encoded_sha=None):
        raw = json.dumps(self.graphs[ability]).encode()
        (self.ref / f'garen-{ability}-audio.json').write_bytes(raw)
        (self.ref / f'garen-{ability}-audio-decoded.json').write_text(json.dumps(dict(
            sourceGraphSha256=sha(raw), media=[dict(id=1, encodedSha256=encoded_sha or sha(self.wem))])))

    def output(self, ability='aa'):
        return self.root / f'.cache/garen-{ability}-audio-media/1.wem'

    def test_exact_restore_and_repeat_check(self):
        self.assertEqual(restore(self.root, ['aa', 'p']), dict(files=2, bytes=32, check=False))
        self.assertEqual(self.output().read_bytes(), self.wem)
        self.assertTrue(restore(self.root, ['aa', 'p'], True)['check'])

    def test_wrong_bank_before_writing(self):
        self.bank_path.write_bytes(b'x' + self.bank[1:])
        with self.assertRaisesRegex(ValueError, 'bank differs'):
            restore(self.root, ['aa', 'p'])
        self.assertFalse(self.output().exists())

    def test_graph_chain_mismatch(self):
        self.graphs['aa']['extractionSha256'] = '0' * 64
        self.write_graph()
        with self.assertRaisesRegex(ValueError, 'provenance'):
            restore(self.root, ['aa'])

    def test_outside_bank(self):
        self.graphs['aa']['media'][0]['bankOffset'] = len(self.bank)
        self.write_graph()
        with self.assertRaisesRegex(ValueError, 'outside'):
            restore(self.root, ['aa'])

    def test_numeric_booleans_rejected(self):
        for field in ['id', 'bankOffset', 'bytes']:
            original = self.graphs['aa']['media'][0][field]
            self.graphs['aa']['media'][0][field] = True
            self.write_graph()
            with self.assertRaises(ValueError):
                restore(self.root, ['aa'])
            self.graphs['aa']['media'][0][field] = original

    def test_encoded_hashes_must_match_actual_bytes(self):
        self.graphs['aa']['media'][0]['sha256'] = '0' * 64
        self.write_graph(encoded_sha='0' * 64)
        with self.assertRaisesRegex(ValueError, 'source media differs'):
            restore(self.root, ['aa'])

    def test_bad_riff_extent_even_with_matching_hash_chain(self):
        self.wem = self.wem[:4] + struct.pack('<I', 99) + self.wem[8:]
        self.bank = b'bank-prefix' + self.wem
        self.bank_path.write_bytes(self.bank)
        self.extraction['files'][0]['sha256'] = sha(self.bank)
        self.write_extraction()
        self.graphs['aa']['extractionSha256'] = sha(self.extraction_raw)
        self.graphs['aa']['media'][0]['sha256'] = sha(self.wem)
        self.write_graph()
        with self.assertRaisesRegex(ValueError, 'WEM extent'):
            restore(self.root, ['aa'])

    def test_differing_cache_never_overwritten_or_partially_restored(self):
        self.output('p').parent.mkdir(parents=True)
        self.output('p').write_bytes(b'corrupt')
        with self.assertRaisesRegex(ValueError, 'Existing media differs'):
            restore(self.root, ['aa', 'p'])
        self.assertFalse(self.output().exists())
        self.assertEqual(self.output('p').read_bytes(), b'corrupt')

    def test_check_requires_complete_cache(self):
        with self.assertRaisesRegex(ValueError, 'incomplete'):
            restore(self.root, ['aa'], True)
        self.assertFalse(self.output().exists())

    def test_invalid_duplicate_ability_rejected(self):
        for abilities in [[], ['aa', 'aa'], ['invalid']]:
            with self.assertRaises(ValueError):
                restore(self.root, abilities)


if __name__ == '__main__':
    unittest.main()
