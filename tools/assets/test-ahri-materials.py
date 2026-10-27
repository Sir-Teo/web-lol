"""Regression guards for local Ahri material evidence; normal and -O supported."""
import copy
import math
import runpy
import struct
import tempfile
import unittest
from pathlib import Path

module = runpy.run_path(str(Path(__file__).with_name('verify-ahri-skin.py')))
exporter = module['exporter']


class AhriMaterialTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data, cls.model = exporter['load']()
        cls.raw = cls.data['docs/reference/ahri/skin0.bin']
        cls.mesh = exporter['submeshes'](cls.data['docs/reference/ahri/mesh-submeshes.bin'])
        cls.glb = exporter['glb_json'](cls.data['public/assets/models/ahri-base.glb'])
        cls.content = exporter['generate']()

    def project(self, model=None, mesh=None, glb=None):
        return exporter['project'](model or self.model, mesh or self.mesh, glb or self.glb)

    def test_01_complete_local_decode_and_exact_generated_bytes(self):
        decoded = module['verify'](self.raw, self.model['skin']['data'])
        self.assertEqual(len(decoded), 5)
        self.assertEqual(len(decoded['__linked']), 23)
        self.assertEqual(self.content, (exporter['ROOT'] / 'docs/reference/ahri-materials.json').read_bytes())

    def test_02_raw_bin_tampering_and_truncation_rejected(self):
        raw = bytearray(self.raw)
        raw[-1] ^= 1
        for altered in [bytes(raw), self.raw[:-1], self.raw + b'\0']:
            with self.assertRaisesRegex(ValueError, 'skin BIN differs'):
                module['verify'](altered, self.model['skin']['data'])

    def test_03_local_record_mutations_rejected(self):
        for mutation in ['number', 'boolean', 'missing', 'extra', 'array', 'type']:
            with self.subTest(mutation=mutation):
                records = copy.deepcopy(self.model['skin']['data'])
                body = records[exporter['MATERIALS'][0]]
                if mutation == 'number':
                    body['paramValues'][0]['value'][0] += 1
                elif mutation == 'boolean':
                    body['paramValues'][0]['value'][1] = False
                elif mutation == 'missing':
                    del records[exporter['MATERIALS'][1]]
                elif mutation == 'extra':
                    records['UnexpectedRecord'] = {'__type': 'StaticMaterialDef'}
                elif mutation == 'array':
                    body['samplerValues'].pop()
                else:
                    body['__type'] = 'UnknownMaterialDef'
                with self.assertRaisesRegex(ValueError, 'local Ahri skin records differ'):
                    module['verify'](self.raw, records)

    def test_04_absent_fields_cannot_be_filled_as_source_values(self):
        for kind in ['value', 'switch', 'driverTime']:
            records = copy.deepcopy(self.model['skin']['data'])
            if kind == 'value':
                next(p for p in records[exporter['MATERIALS'][0]]['paramValues'] if p['name'] == 'Diffuse_Lerp_Factor')['value'] = [0, 0, 0, 0]
            elif kind == 'switch':
                next(p for p in records[exporter['MATERIALS'][0]]['switches'] if p['name'] == 'USE_RIM')['on'] = False
            else:
                records[exporter['MATERIALS'][1]]['dynamicMaterial']['parameters'][0]['driver']['mTurnOnTimeSec'] = 0.25
            with self.assertRaisesRegex(ValueError, 'local Ahri skin records differ'):
                module['verify'](self.raw, records)

    def test_05_equality_keeps_bool_and_signed_zero_distinct(self):
        same, fnv = module['same'], module['binfile'].compute_binhash
        self.assertFalse(same(False, 0))
        self.assertFalse(same(-0.0, 0.0))
        self.assertFalse(same({'a': 1}, {'a': 1, 'b': 2}))
        self.assertFalse(same([1], [1, 2]))
        alias = '{%08x}' % fnv('Diffuse_Lerp_Factor')
        self.assertTrue(same('Diffuse_Lerp_Factor', alias))
        self.assertFalse(same('UnrelatedField', alias))
        self.assertFalse(same('Diffuse_Lerp_Factor', alias.upper()))

    def test_06_presence_and_dynamic_driver_declarations_preserved(self):
        result = self.project()
        body, tails = result['materials']
        value = next(p for p in body['parameters'] if p['name'] == 'Diffuse_Lerp_Factor')
        self.assertEqual(value, {'name': 'Diffuse_Lerp_Factor', 'valuePresent': False})
        switch = next(p for p in body['switches'] if p['name'] == 'USE_RIM')
        self.assertEqual(switch, {'name': 'USE_RIM', 'onPresent': False})
        switch = next(p for p in body['switches'] if p['name'] == 'OUTLINE_ON')
        self.assertEqual(switch, {'name': 'OUTLINE_ON', 'onPresent': True, 'on': False})
        driver = body['definition']['dynamicMaterial']['parameters'][0]['driver']
        self.assertEqual(driver['mTurnOnTimeSec'], 0.25)
        self.assertEqual(driver['mTurnOffTimeSec'], 2.5)
        driver = tails['definition']['dynamicMaterial']['parameters'][0]['driver']
        self.assertEqual(driver['mOnValue'], 1.25)
        self.assertEqual(driver['mOffValue'], 0.15000000596046448)
        self.assertNotIn('mTurnOnTimeSec', driver)
        self.assertNotIn('mTurnOffTimeSec', driver)

    def test_07_native_and_preview_submesh_routes_are_separate(self):
        result = self.project()
        self.assertEqual([r['route'] for r in result['sourceBindings']], ['customMaterial', 'defaultSkinMeshProperties', 'customMaterial', 'textureOverride'])
        self.assertEqual([r['declaredHidden'] for r in result['sourceBindings']], [False, False, False, True])
        self.assertEqual(result['declaredHiddenWithoutMesh'], ['Body_Proxy'])
        preview = result['currentPreviewTransport']['materials']
        self.assertEqual([p['indexCount'] for p in preview], [45162, 1248, 16776, 1848])
        self.assertTrue(all('KHR_materials_unlit' in p['material']['extensions'] for p in preview))
        self.assertNotIn('alphaMode', preview[1]['material'])
        self.assertNotIn('alphaMode', preview[3]['material'])

    def test_08_all_five_sampler_resources_bound_and_unknown_path_rejected(self):
        result = self.project()
        samplers = [s for m in result['materials'] for s in m['samplers']]
        self.assertEqual(len(samplers), 5)
        self.assertEqual(len({s['source']['path'] for s in samplers}), 5)
        self.assertEqual([s['source']['bytes'] for s in samplers], [1398140, 174788, 36, 1398140, 1044])
        altered = copy.deepcopy(self.model)
        altered['skin']['data'][exporter['MATERIALS'][0]]['samplerValues'][0]['texturePath'] = 'assets/missing.tex'
        with self.assertRaisesRegex(ValueError, 'outside the frozen extraction'):
            self.project(model=altered)

    def test_09_every_frozen_input_guarded(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for name, raw in self.data.items():
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(raw)
            for name, raw in self.data.items():
                with self.subTest(name=name):
                    (root / name).write_bytes(raw + b' ')
                    with self.assertRaisesRegex(ValueError, 'Frozen material input changed: ' + name):
                        exporter['load'](root)
                    (root / name).write_bytes(raw)

    def test_10_preview_binding_and_scope_changes_rejected(self):
        for kind in ['name', 'hidden', 'indices', 'shading']:
            with self.subTest(kind=kind):
                glb = copy.deepcopy(self.glb)
                if kind == 'name':
                    glb['materials'][0]['extras']['sourceSubmesh'] = 'Other'
                elif kind == 'hidden':
                    glb['materials'][0]['extras']['defaultHidden'] = True
                elif kind == 'indices':
                    glb['accessors'][glb['meshes'][0]['primitives'][0]['indices']]['count'] += 1
                else:
                    del glb['materials'][0]['extensions']['KHR_materials_unlit']
                with self.assertRaises(ValueError):
                    self.project(glb=glb)

    def test_11_mesh_table_boundaries_and_counts_rejected(self):
        raw = self.data['docs/reference/ahri/mesh-submeshes.bin']
        for altered in [raw[:-1], b'\0' + raw[1:], raw[:8] + struct.pack('<I', 5) + raw[12:]]:
            with self.assertRaises(ValueError):
                exporter['submeshes'](altered)
        rows = copy.deepcopy(self.mesh)
        rows[0]['indices'] += 1
        with self.assertRaisesRegex(ValueError, 'draw index count differs'):
            self.project(mesh=rows)

    def test_12_float32_words_reject_boolean_nonfinite_and_rounding(self):
        word = exporter['f32_word']
        self.assertEqual(word(0.0), '00000000')
        self.assertEqual(word(-0.0), '80000000')
        self.assertEqual(word(0.10000000149011612), '3dcccccd')
        self.assertEqual(word(0.15000000596046448), '3e19999a')
        for value in [False, math.nan, math.inf, 0.1, 16777217, 1e40]:
            with self.assertRaises(ValueError):
                word(value)

    def test_13_output_check_and_no_overwrite_or_mtime_changes(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'materials.json'
            with self.assertRaisesRegex(ValueError, 'missing'):
                exporter['publish'](self.content, path, check=True)
            self.assertFalse(path.exists())
            exporter['publish'](self.content, path)
            timestamp = path.stat().st_mtime_ns
            for check in [False, True]:
                exporter['publish'](self.content, path, check)
                with self.assertRaisesRegex(ValueError, 'refusing overwrite'):
                    exporter['publish'](b'different', path, check)
            self.assertEqual(path.read_bytes(), self.content)
            self.assertEqual(path.stat().st_mtime_ns, timestamp)

    def test_14_links_and_material_uniqueness_are_guarded_without_claiming_execution(self):
        result = self.project()
        self.assertEqual(len(result['linkedPackageNames']), 23)
        self.assertFalse(result['linkedPackagesDecoded'])
        self.assertFalse(result['nativeDefaultsVerified'])
        self.assertFalse(result['nativeShaderArithmeticVerified'])
        self.assertFalse(result['nativeBlendEnumMappingVerified'])
        self.assertFalse(result['nativeDynamicDriverDispatchVerified'])
        for kind in ['links', 'parameter', 'sampler']:
            altered = copy.deepcopy(self.model)
            if kind == 'links':
                altered['skin']['data']['__linked'].pop()
            elif kind == 'parameter':
                body = altered['skin']['data'][exporter['MATERIALS'][0]]
                body['paramValues'].append(copy.deepcopy(body['paramValues'][0]))
            else:
                body = altered['skin']['data'][exporter['MATERIALS'][0]]
                body['samplerValues'].append(copy.deepcopy(body['samplerValues'][0]))
            with self.assertRaises(ValueError):
                self.project(model=altered)

    def test_15_decoder_source_pin_remains_active(self):
        globals_ = module['verify'].__globals__
        previous = globals_['PARSER_SHA']
        try:
            globals_['PARSER_SHA'] = '0' * 64
            with self.assertRaisesRegex(ValueError, 'decoder differs'):
                module['verify'](self.raw, self.model['skin']['data'])
        finally:
            globals_['PARSER_SHA'] = previous


if __name__ == '__main__':
    unittest.main()
