import unittest
from baron_attack_fields import binhash, label_maps, relabel


class Labels(unittest.TestCase):
    def setUp(self):
        self.rows = {'binfields': {'labels': {'c4663005': 'alphaErosionDefinition', '5e661fd4': 'mTrail'}},
                     'bintypes': {'labels': {'5705625a': 'VfxPrimitiveArbitraryTrail',
                                           '287851b9': 'VfxPrimitiveCameraTrail'}}}
        self.maps = label_maps(self.rows)

    def test_known_hashes_are_case_insensitive(self):
        self.assertEqual(binhash('alphaErosionDefinition'), '{c4663005}')
        self.assertEqual(binhash('ALPHAEROSIONDEFINITION'), '{c4663005}')
        self.assertEqual(binhash('VfxPrimitiveCameraTrail'), '{287851b9}')

    def test_nested_roundtrip_keeps_unknown_and_asset_strings(self):
        raw = {'primitive': {'__type': '{5705625a}', '{5e661fd4}': {'__type': '{ee39916f}'}},
               'paths': ['assets/{c4663005}.tex', '{287851b9}'], '{c4663005}': {'constantValue': -0.0}}
        labeled = relabel(raw, self.maps)
        self.assertEqual(labeled['primitive']['__type'], 'VfxPrimitiveArbitraryTrail')
        self.assertEqual(labeled['primitive']['mTrail']['__type'], '{ee39916f}')
        self.assertEqual(labeled['paths'], raw['paths'])
        self.assertEqual(relabel(labeled, self.maps, reverse=True), raw)
        self.assertIn('{c4663005}', raw)  # input remains untouched

    def test_plain_and_hashed_field_collision_rejects(self):
        with self.assertRaisesRegex(ValueError, 'collision'):
            relabel({'{c4663005}': 1, 'alphaErosionDefinition': 2}, self.maps)

    def test_wrong_candidate_hash_rejects(self):
        self.rows['bintypes']['labels']['5705625a'] = 'VfxPrimitiveCameraTrail'
        with self.assertRaisesRegex(ValueError, 'name/hash differs'):
            label_maps(self.rows)

    def test_invalid_raw_hash_rejects(self):
        self.rows['binfields']['labels']['C4663005'] = 'alphaErosionDefinition'
        with self.assertRaises(ValueError):
            label_maps(self.rows)

    def test_non_ascii_candidate_rejects(self):
        with self.assertRaisesRegex(ValueError, 'ASCII'):
            binhash('tráil')


if __name__ == '__main__':
    unittest.main()
