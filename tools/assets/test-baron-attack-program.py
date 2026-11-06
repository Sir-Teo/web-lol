import copy
import json
import unittest
from pathlib import Path
from collections import Counter
from baron_attack_fields import label_maps
from baron_attack_program import profiles


class Program(unittest.TestCase):
    def setUp(self):
        self.source = json.loads(Path('docs/reference/baron-attack-source.json').read_text())
        self.maps = label_maps(json.loads(Path('docs/reference/baron-attack-field-reading.json').read_text())['tables'])
        decoded = json.loads(Path('docs/reference/baron-attack-decoded.json').read_text())
        self.textures = {r['source']['path']: r['source']['wadPathHash'] for r in decoded['textures']}
        self.meshes = {r['source']['path']: r['source']['wadPathHash'] for r in decoded['meshes']}

    def emit(self, role='missile', index=0):
        return self.source['systems'][role]['definition']['complexEmitterDefinitionData'][index]

    def compile(self):
        return profiles(self.source, self.maps, self.textures, self.meshes)

    def test_all_source_indices_and_primitive_families(self):
        rows = self.compile()
        self.assertEqual([(p['role'], p['index']) for p in rows], [('missile', i) for i in range(9)] + [('hit', i) for i in range(12)])
        self.assertEqual(Counter(p['geometry']['kind'] for p in rows), {'billboard': 13, 'quad': 4, 'mesh': 2, 'arbitrary-trail': 1, 'camera-trail': 1})
        self.assertEqual([p['geometry']['smoothing'] for p in rows if p['geometry']['kind'].endswith('trail')], [0, 0])

    def test_emission_sphere_stays_separate_from_drawn_capsule(self):
        rows = self.compile()
        emitter = next(p for p in rows if p['name'] == 'Embers_Blend')
        self.assertEqual(emitter['geometry']['kind'], 'billboard')
        self.assertEqual(emitter['emissionMesh'], {'asset': '80975d7a4f06e4d6', 'scale': 0.30000001192092896, 'useNormal': True})
        self.assertEqual({p['geometry']['asset'] for p in rows if p['geometry']['kind'] == 'mesh'}, {'2a79d5c0e7f2dc6f'})

    def test_point_identity_and_volume_flag_are_explicit(self):
        rows = self.compile()
        head = next(p for p in rows if p['name'] == 'missileHead_outer')
        self.assertEqual(head['shape'], {'kind': 'point', 'offset': [0, -150, 0], 'declared': True, 'sourceType': '{ee39916f}'})
        cylinder = next(p for p in rows if p['name'] == 'LIghtningJayce')['shape']
        self.assertEqual((cylinder['radius'], cylinder['height'], cylinder['volume']), (0, 100, True))
        self.assertFalse(next(p for p in rows if p['name'] == 'Electricity_Burst')['shape']['volume'])

    def test_integrated_acceleration_type_is_not_erased(self):
        p = next(p for p in self.compile() if p['name'] == 'Embers_Add')
        self.assertEqual(p['curves']['worldAcceleration']['sourceType'], 'IntegratedValueVector3')
        self.assertEqual(p['curves']['worldAcceleration']['values'], [[0, 0, 0]])

    def test_source_probability_tables_remain_ordered(self):
        p = next(p for p in self.compile() if p['name'] == 'vecalign')
        self.assertEqual(p['curves']['particleLifetime']['probabilities'][0]['values'], [0.6000000238418579, 1.100000023841858, 2])

    def test_unknown_emitter_field_rejects(self):
        self.emit()['unexpected'] = 1
        with self.assertRaisesRegex(ValueError, 'Unhandled Baron emitter field'):
            self.compile()

    def test_unknown_trail_field_rejects(self):
        self.emit(index=2)['primitive']['{5e661fd4}']['unexpected'] = 1
        with self.assertRaisesRegex(ValueError, 'Unhandled source trail field'):
            self.compile()

    def test_missing_texture_binding_rejects(self):
        self.textures.pop(next(iter(self.textures)))
        with self.assertRaisesRegex(ValueError, 'Missing Baron texture binding'):
            self.compile()

    def test_unused_asset_rejects(self):
        self.meshes['assets/unexpected.scb'] = '0000000000000000'
        with self.assertRaisesRegex(ValueError, 'asset closure'):
            self.compile()

    def test_audio_payload_is_not_silently_dropped(self):
        self.emit()['{e0613999}']['event'] = 'unexpected'
        with self.assertRaisesRegex(ValueError, 'emitter audio'):
            self.compile()

    def test_wrong_curve_type_rejects(self):
        self.emit()['birthVelocity']['__type'] = 'IntegratedValueVector3'
        with self.assertRaisesRegex(ValueError, 'value type'):
            self.compile()

    def test_wrong_vector_dimension_rejects(self):
        self.emit()['birthVelocity']['constantValue'] = [1]
        with self.assertRaises(ValueError):
            self.compile()

    def test_nonfinite_setting_rejects(self):
        self.emit()['lifetime'] = float('nan')
        with self.assertRaisesRegex(ValueError, 'Nonfinite'):
            self.compile()

    def test_wrong_scalar_setting_rejects(self):
        self.emit()['lifetime'] = 'three'
        with self.assertRaisesRegex(ValueError, 'numeric emitter setting'):
            self.compile()

    def test_wrong_flag_rejects(self):
        self.emit()['isUniformScale'] = 2
        with self.assertRaisesRegex(ValueError, 'emitter flag'):
            self.compile()

    def test_unknown_shape_flags_reject(self):
        self.emit('hit', 4)['SpawnShape']['flags'] = 2
        with self.assertRaisesRegex(ValueError, 'shape field/flags'):
            self.compile()

    def test_unknown_shape_type_rejects(self):
        self.emit()['SpawnShape']['__type'] = 'UnknownShape'
        with self.assertRaisesRegex(ValueError, 'shape type/fields'):
            self.compile()

    def test_wrong_mesh_child_type_rejects(self):
        self.emit(index=3)['primitive']['mMesh']['__type'] = 'UnknownMesh'
        with self.assertRaisesRegex(ValueError, 'mesh primitive field'):
            self.compile()

    def test_wrong_erosion_type_rejects(self):
        self.emit()['{c4663005}']['__type'] = 'UnknownErosion'
        with self.assertRaisesRegex(ValueError, 'erosion field'):
            self.compile()

    def test_orphan_mesh_scale_rejects(self):
        self.emit()['{bda98597}'] = 1
        with self.assertRaisesRegex(ValueError, 'Orphan emission mesh scale'):
            self.compile()

    def test_projection_does_not_mutate_source(self):
        original = copy.deepcopy(self.source)
        p = self.compile()
        p[0]['shape']['offset'][0] = 123
        p[0]['curves']['birthVelocity']['constant'][0] = 123
        self.assertEqual(self.source, original)


if __name__ == '__main__':
    unittest.main()
