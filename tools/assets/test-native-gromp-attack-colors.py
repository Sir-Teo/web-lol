"""Mutation guards for original Gromp missile routing and color source."""
from pathlib import Path
import copy, json, unittest
from unittest.mock import patch
import legacy_troy
import native_gromp_attack_colors as source

class MissileColorGuards(unittest.TestCase):
    def fixture(self):
        return (json.loads(Path('docs/reference/gromp-effects.json').read_bytes()),
                json.loads(Path('src/content/gromp-attack.json').read_bytes()), source.SOURCE.read_bytes())
    def test_exact_offline_replay(self):
        with patch('socket.socket', side_effect=AssertionError('Network forbidden')), patch('subprocess.Popen', side_effect=AssertionError('Child forbidden')):
            result = source.observe()
        self.assertEqual(result, json.loads(source.OUTPUT.read_bytes()))
        self.assertEqual([p['premultiply'] for p in result['source']['profiles']], [True, True, False, True])
        self.assertEqual([len(p['keys']) for p in result['source']['profiles']], [4, 5, 4, 0])
        self.assertFalse(result['nativeExecuted'])
        self.assertFalse(result['applicationBehaviorChanged'])
    def test_each_parent_pin_required(self):
        for name in source.PINS:
            with self.subTest(name=name), patch.object(source, 'PINS', {**source.PINS, name: '0' * 64}), self.assertRaises(ValueError):
                source.verify(None, None)
    def test_original_source_bytes_bound(self):
        pin, compiled, raw = self.fixture()
        for bad in [raw[:-1], bytes([raw[0] ^ 1]) + raw[1:]]:
            with self.assertRaises(ValueError):source.source_rows(pin, compiled, bad)
    def test_original_typed_rows_bound(self):
        pin, compiled, raw = self.fixture()
        pin['records'][source.NAME]['typed']['rows'].pop()
        with self.assertRaises(ValueError):source.source_rows(pin, compiled, raw)
    def test_original_decoded_fields_bound(self):
        pin, compiled, raw = self.fixture()
        pin['records'][source.NAME]['decoded']['values']['System']['GroupPart1'] = 'trailorbs'
        with self.assertRaises(ValueError):source.source_rows(pin, compiled, raw)
    def test_each_profile_cannot_add_simple_override(self):
        for i in range(4):
            pin, compiled, raw = self.fixture()
            record = pin['records'][source.NAME]
            record['decoded']['values']['System'][f'GroupPart{i+1}Type'] = 'Simple'
            with self.subTest(index=i), self.assertRaises(ValueError):source.source_rows(pin, compiled, raw)
    def test_profile_order_bound(self):
        pin, compiled, raw = self.fixture()
        compiled['profiles'].reverse()
        with self.assertRaises(ValueError):source.source_rows(pin, compiled, raw)
    def test_source_linkage_bound(self):
        for field, value in [('sourceRecord', 'other'), ('sourceIndex', 9)]:
            pin, compiled, raw = self.fixture();compiled['profiles'][0][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):source.source_rows(pin, compiled, raw)
    def test_each_primitive_bound(self):
        for i in range(4):
            pin, compiled, raw = self.fixture();p=compiled['profiles'][i];p['kind']='quad' if p['kind']=='billboard' else 'billboard'
            with self.subTest(index=i), self.assertRaises(ValueError):source.source_rows(pin, compiled, raw)
    def test_each_blend_bound(self):
        for i in range(4):
            pin, compiled, raw = self.fixture();compiled['profiles'][i]['blend']=1
            with self.subTest(index=i), self.assertRaises(ValueError):source.source_rows(pin, compiled, raw)
    def test_each_base_bound(self):
        for i in range(4):
            pin, compiled, raw = self.fixture();compiled['profiles'][i]['color'][0]=0.5
            with self.subTest(index=i), self.assertRaises(ValueError):source.source_rows(pin, compiled, raw)
    def test_key_values_and_times_bound(self):
        for i in range(3):
            for field in ['time','value']:
                pin, compiled, raw = self.fixture();key=compiled['profiles'][i]['colorCurve'][0]
                if field=='time':key[field]=0.25
                else:key[field][0]=0.25
                with self.subTest(index=i,field=field), self.assertRaises(ValueError):source.source_rows(pin, compiled, raw)
    def test_key_scope_cannot_shrink_or_expand(self):
        for i in range(4):
            pin, compiled, raw = self.fixture();keys=compiled['profiles'][i]['colorCurve']
            if keys:keys.pop()
            else:keys.append({'time':0,'value':[1]*4})
            with self.subTest(index=i), self.assertRaises(ValueError):source.source_rows(pin, compiled, raw)

if __name__ == '__main__':unittest.main()
