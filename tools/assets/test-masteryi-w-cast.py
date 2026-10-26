"""Complete cast projection and fail-closed source-value/field guards."""
from pathlib import Path
import copy
import json
import runpy
import unittest
from masteryi_w_particles import load
from masteryi_w_cast import acceleration, binhash, profiles, value

EXPORT = runpy.run_path(str(Path(__file__).with_name('export-masteryi-w-cast-particles.py')))


class CastGuards(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pin, _ = load(); cls.outputs, cls.content, cls.reading = EXPORT['generate_outputs']()
        cls.textures = {t['source']['path']: t['url'] for t in cls.content['textures']}
        cls.defaults = json.loads(Path('docs/reference/garen-spin-defaults.json').read_text())['defaults']

    def test_complete_native_cast_and_all_selected_assets_are_projected(self):
        self.assertEqual(len(self.content['profiles']), 7); self.assertEqual(len(self.content['textures']), 10)
        self.assertEqual(sum(len(t['rectangles']) for t in self.content['textures']), 87)
        self.assertEqual(self.reading['historyTicks'], 55)
        native = self.pin['resources']['MasterYi_W_Cas']['definition']['complexEmitterDefinitionData']
        self.assertEqual([p['explicitFields'] for p in self.content['profiles']], [sorted(e) for e in native])
        self.assertEqual(sum(p['kind']=='mesh' for p in self.content['profiles']), 2)
        self.assertEqual(sum(p['multiplier'] is not None for p in self.content['profiles']), 1)

    def test_delivery_is_exact_and_reuses_the_two_existing_shared_transports(self):
        for path, raw in self.outputs: self.assertEqual(path.read_bytes(), raw)
        self.assertEqual(sum(t['url'].startswith('assets/effects/masteryi-q-contact-') for t in self.content['textures']), 2)

    def invalid_profile(self, change):
        pin=copy.deepcopy(self.pin); change(pin['resources']['MasterYi_W_Cas']['definition']['complexEmitterDefinitionData'])
        with self.assertRaises((ValueError, KeyError)):
            profiles(pin, self.textures, self.content['mesh']['url'], self.defaults)

    def test_lost_emitter_rejects(self): self.invalid_profile(lambda e:e.pop())
    def test_new_field_rejects(self): self.invalid_profile(lambda e:e[0].update(unreviewed=1))
    def test_new_primitive_rejects(self): self.invalid_profile(lambda e:e[0].update(primitive={'__type':'Unknown'}))
    def test_wrong_mesh_rejects(self): self.invalid_profile(lambda e:e[1]['primitive']['mMesh'].update(mSimpleMeshName='Unknown.scb'))
    def test_new_shape_field_rejects(self): self.invalid_profile(lambda e:e[1]['SpawnShape'].update(radius=4))
    def test_new_multiplier_field_rejects(self): self.invalid_profile(lambda e:e[3]['textureMult'].update(unreviewed=1))
    def test_new_blend_rejects(self): self.invalid_profile(lambda e:e[0].update(blendMode=1))
    def test_unreviewed_mesh_flags_rejects(self): self.invalid_profile(lambda e:e[0].update(meshRenderFlags=8))

    def test_source_field_candidates_match_literal_native_hashes(self):
        self.assertEqual(binhash('VfxFieldAccelerationDefinitionData'), '{0a94f3d4}')
        self.assertEqual(binhash('fieldAccelerationDefinitions'), '{5d60e987}')
        self.assertEqual(binhash('acceleration'), '{2fa0ba9d}')
        fields=self.pin['resources']['MasterYi_W_Cas']['definition']['complexEmitterDefinitionData'][-1]['fieldCollectionDefinition']
        self.assertEqual(acceleration(fields)['values'], [[0,600,0]])
        self.assertIn('{5d60e987}', fields)

    def test_local_force_frame_cannot_be_silently_substituted(self):
        self.invalid_profile(lambda e:e[-1]['fieldCollectionDefinition']['{5d60e987}'][0].update(isLocalSpace=True))

    def test_omitted_orbital_force_cannot_gain_an_unhandled_vector(self):
        self.invalid_profile(lambda e:e[-1]['fieldCollectionDefinition']['fieldOrbitalDefinitions'][0].update(velocity=[1,2,3]))

    def test_bad_value_shape_rejects(self):
        with self.assertRaisesRegex(ValueError,'dimension'): value({'constantValue':[1,2]},[0,0,0])
    def test_boolean_is_not_a_float(self):
        with self.assertRaisesRegex(ValueError,'number'): value({'constantValue':True},0)
    def test_nan_rejects(self):
        with self.assertRaisesRegex(ValueError,'number'): value({'constantValue':float('nan')},0)
    def test_unknown_value_field_rejects(self):
        with self.assertRaisesRegex(ValueError,'Unsupported'): value({'unhandled':1},0)
    def test_curve_extent_rejects(self):
        with self.assertRaisesRegex(ValueError,'extent'): value({'dynamics':{'times':[0,1],'values':[0]}},0)
    def test_curve_order_rejects(self):
        with self.assertRaisesRegex(ValueError,'order'): value({'dynamics':{'times':[1,0],'values':[0,1]}},0)
    def test_probability_extent_rejects(self):
        with self.assertRaisesRegex(ValueError,'extent'): value({'dynamics':{'times':[0],'values':[1],'probabilityTables':[{'keyTimes':[0],'keyValues':[]}]}},0)
    def test_extra_probability_axes_rejects(self):
        with self.assertRaisesRegex(ValueError,'dimensions'): value({'dynamics':{'times':[0],'values':[1],'probabilityTables':[{},{}]}},0)


if __name__=='__main__':unittest.main()
