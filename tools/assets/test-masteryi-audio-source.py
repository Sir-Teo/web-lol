"""Offline source-integrity guards; run normally and with python -O."""
from pathlib import Path
import importlib.util
import shutil
import sys
import tempfile
import types
import unittest
from unittest.mock import patch
from masteryi_audio_source import BANKS, BANK_ROOT, EXTRACTION, REFERENCE, inputs

spec = importlib.util.spec_from_file_location('extract_masteryi_audio', Path(__file__).with_name('extract-masteryi-audio.py'))
cli = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cli)


class SourceGuards(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.reference = root / 'reference.json'
        self.pin = root / 'extraction.json'
        self.banks = root / 'banks'
        shutil.copyfile(REFERENCE, self.reference)
        shutil.copyfile(EXTRACTION, self.pin)
        for name, _, _ in BANKS:
            target = self.banks / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(BANK_ROOT / name, target)

    def read(self, require=True):
        return inputs(self.reference, self.pin, self.banks, require)

    def test_exact_frozen_contract(self):
        pin, unit = self.read()
        self.assertEqual(len(pin['files']), 2)
        self.assertEqual(len(unit['events']), 31)
        self.assertTrue(all('/sfx/' in row['path'] for row in pin['files']))

    def test_missing_pin(self):
        self.pin.unlink()
        with self.assertRaises(FileNotFoundError): self.read()

    def test_changed_pin(self):
        self.pin.write_bytes(self.pin.read_bytes() + b' ')
        with self.assertRaisesRegex(ValueError, 'SHA-256'): self.read()

    def test_changed_reference(self):
        self.reference.write_bytes(self.reference.read_bytes() + b' ')
        with self.assertRaisesRegex(ValueError, 'SHA-256'): self.read()

    def test_malformed_reference_is_not_parsed_as_a_new_contract(self):
        self.reference.write_text('{broken')
        with self.assertRaisesRegex(ValueError, 'SHA-256'): self.read()

    def test_missing_bank(self):
        (self.banks / BANKS[0][0]).unlink()
        with self.assertRaises(FileNotFoundError): self.read()

    def test_truncated_bank(self):
        p = self.banks / BANKS[0][0]
        p.write_bytes(p.read_bytes()[:-1])
        with self.assertRaisesRegex(ValueError, 'length'): self.read()

    def test_same_length_changed_audio(self):
        p = self.banks / BANKS[0][0]
        b = bytearray(p.read_bytes()); b[-1] ^= 1; p.write_bytes(b)
        with self.assertRaisesRegex(ValueError, 'SHA-256'): self.read()

    def test_same_length_changed_events(self):
        p = self.banks / BANKS[1][0]
        b = bytearray(p.read_bytes()); b[-1] ^= 1; p.write_bytes(b)
        with self.assertRaisesRegex(ValueError, 'SHA-256'): self.read()

    def test_preflight_allows_missing_banks_but_not_conflicts(self):
        (self.banks / BANKS[0][0]).unlink()
        self.read(False)
        p = self.banks / BANKS[1][0]
        p.write_bytes(b'conflict')
        with self.assertRaisesRegex(ValueError, 'length'): self.read(False)
        self.assertEqual(p.read_bytes(), b'conflict')

    def test_normal_cli_rejects_conflict_before_archive_access(self):
        p = self.banks / BANKS[0][0]
        p.write_bytes(b'conflict')
        def forbidden(*args, **kwargs):
            self.fail('Network/archive access occurred before source preflight')
        args = ['extract-masteryi-audio.py', '--reference', str(self.reference), '--pin', str(self.pin), '--banks', str(self.banks)]
        modules = {'xxhash': types.SimpleNamespace(xxh64_intdigest=forbidden), 'riot_archive': types.SimpleNamespace(RiotArchive=forbidden)}
        with patch.object(sys, 'argv', args), patch.dict(sys.modules, modules):
            with self.assertRaisesRegex(ValueError, 'length'): cli.main()
        self.assertEqual(p.read_bytes(), b'conflict')


if __name__ == '__main__': unittest.main()
