"""Frozen supplemental skin-material guards, independent of Python assertions."""
from pathlib import Path
import hashlib
import json
import runpy
import unittest
from unittest.mock import patch

module = runpy.run_path(str(Path(__file__).with_name('export-champion-attack-materials.py')))
generate = module['generate']; scope = generate.__globals__


class MaterialGuards(unittest.TestCase):
    def test_changed_source_rejects_before_output(self):
        with patch.object(Path, 'read_bytes', return_value=b'changed'):
            with self.assertRaisesRegex(ValueError, 'Frozen skin differs'): generate()

    def changed_material(self, material):
        key = 'Characters/Leona/Skins/Skin0'
        record = {} if material is None else {'armorMaterial': material}
        raw = json.dumps({'skin': {'data': {key: record}}}).encode()
        pin = {'leona': ('Leona', hashlib.sha256(raw).hexdigest())}
        with patch.dict(scope, PINS=pin), patch.object(Path, 'read_bytes', return_value=raw):
            with self.assertRaisesRegex(ValueError, 'Missing/unknown'): generate()

    def test_missing_material_does_not_default_to_flesh(self): self.changed_material(None)
    def test_unknown_material_is_not_silently_repaired(self): self.changed_material('Unknown')


if __name__ == '__main__': unittest.main()
