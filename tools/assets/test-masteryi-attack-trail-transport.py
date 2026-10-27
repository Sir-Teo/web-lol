"""Private attack-trail mip transport and independent native-attribute GLB guards."""
from pathlib import Path
import copy
import json
import runpy
import struct
import unittest

SOURCE = runpy.run_path(str(Path(__file__).with_name('pack-masteryi-attack-trail-textures.py')))


class TransportGuards(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.record = json.loads((SOURCE['OUTPUT'] / 'textures.json').read_text())

    def invalid(self, change, pattern):
        record = copy.deepcopy(self.record); change(record)
        with self.assertRaisesRegex(ValueError, pattern): SOURCE['verify'](record,SOURCE['SOURCE_ROOT'])

    def test_all_four_textures_and_34_mips_recover_the_original_pixels(self):
        SOURCE['verify'](self.record,SOURCE['SOURCE_ROOT'])
        self.assertEqual(len(self.record['textures']), 4)
        self.assertEqual(sum(len(t['rectangles']) for t in self.record['textures']), 34)
        self.assertEqual(sum(t['bytes'] for t in self.record['textures']), 30128)

    def test_wrong_decoded_record_rejects(self): self.invalid(lambda r: r.update(decodedRecordSha256='0'*64), 'source binding')
    def test_omitted_system_rejects(self): self.invalid(lambda r: r['systems'].pop(), 'source binding')
    def test_missing_texture_rejects(self): self.invalid(lambda r: r['textures'].pop(), 'closure')
    def test_duplicate_texture_rejects(self): self.invalid(lambda r: r['textures'].append(copy.deepcopy(r['textures'][0])), 'closure')
    def test_changed_native_texture_rejects(self): self.invalid(lambda r: r['textures'][0]['source'].update(sha256='0'*64), 'native source')
    def test_missing_mip_rejects(self): self.invalid(lambda r: r['textures'][0]['rectangles'].pop(), 'mip chain')
    def test_moved_mip_rejects(self): self.invalid(lambda r: r['textures'][0]['rectangles'][0].update(y=1), 'rectangle layout')
    def test_changed_whole_png_rejects(self): self.invalid(lambda r: r['textures'][0].update(sha256='0'*64), 'Frozen particle input')
    def test_changed_mip_pixels_rejects(self): self.invalid(lambda r: r['textures'][0]['rectangles'][0].update(rgbaSha256='0'*64), 'mip pixels')


class NativeMeshTransport(unittest.TestCase):
    def test_glb_keeps_native_corners_uv_face_bytes_and_untransformed_node(self):
        decoded=json.loads(Path('docs/reference/masteryi/attack-trail-particles-decoded.json').read_text());mesh=json.loads(Path(decoded['meshes'][0]['path']).read_text());audit=json.loads(Path('docs/reference/masteryi/attack-trail-mesh-transport.json').read_text());raw=Path(audit['output']['path']).read_bytes()
        self.assertEqual(SOURCE['sha'](raw),audit['output']['sha256']);self.assertEqual(len(raw),audit['output']['bytes']);self.assertEqual(raw[:4],b'glTF');self.assertEqual(struct.unpack_from('<II',raw,4),(2,len(raw)))
        chunks={};offset=12
        while offset<len(raw):
            size,kind=struct.unpack_from('<I4s',raw,offset);self.assertNotIn(kind,chunks);chunks[kind]=raw[offset+8:offset+8+size];offset+=8+size
        self.assertEqual(offset,len(raw));self.assertEqual(set(chunks),{b'JSON',b'BIN\0'});doc=json.loads(chunks[b'JSON']);binary=chunks[b'BIN\0']
        self.assertEqual(len(doc['nodes']),1);self.assertEqual(len(doc['meshes']),1);self.assertNotIn('skins',doc);self.assertNotIn('animations',doc)
        node=doc['nodes'][0]
        for key in ['matrix','translation','rotation','scale','skin']:self.assertNotIn(key,node)
        primitive=doc['meshes'][0]['primitives'][0];self.assertNotIn('indices',primitive);self.assertEqual(set(primitive['attributes']),{'POSITION','TEXCOORD_0','_SOURCE_FACE_RGB'})
        def stream(name,kind,components):
            accessor=doc['accessors'][primitive['attributes'][name]];view=doc['bufferViews'][accessor['bufferView']];self.assertEqual(accessor['componentType'],kind);self.assertEqual(accessor['count'],1500);self.assertEqual(accessor['type'],'VEC'+str(components))
            code={5126:'f',5121:'B'}[kind];width=struct.calcsize('<'+code*components);stride=view.get('byteStride',width);start=view.get('byteOffset',0)+accessor.get('byteOffset',0)
            return b''.join(binary[start+i*stride:start+i*stride+width]for i in range(accessor['count']))
        positions=b''.join(struct.pack('<3f',*(v*.01 for v in mesh['sourcePoints'][index]))for index in mesh['sourceIndices']);uv=b''.join(struct.pack('<2f',mesh['faceUv'][i//3][i%3],mesh['faceUv'][i//3][i%3+3])for i in range(1500))
        self.assertEqual(stream('POSITION',5126,3),positions);self.assertEqual(stream('TEXCOORD_0',5126,2),uv);self.assertEqual(stream('_SOURCE_FACE_RGB',5121,3),bytes.fromhex(mesh['sourceFaceRgbHex']))
        self.assertEqual(audit['centralPoint'],mesh['centralPoint']);self.assertEqual(audit['rawSourceBounds'],mesh['sourceBounds']);self.assertEqual(audit['tailHex'],mesh['tailHex']);self.assertIs(audit['sourceFaceRgbAppliedAsMaterial'],False);self.assertIs(audit['normalsGenerated'],False);self.assertEqual(audit['validation'],{'errors':0,'warnings':0,'roundTripAttributesExact':True})

if __name__ == '__main__': unittest.main()
