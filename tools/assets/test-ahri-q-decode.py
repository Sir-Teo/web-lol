"""Native SCB/color, complete mip and publication guards without changing source artifacts."""
import copy
import json
from pathlib import Path
import runpy
import struct
import tempfile
import unittest
from ahri_q_particles import SOURCE_ROOT, cache_path, load
from ahri_q_decode import scb_mesh, scb_bytes
from masteryi_q_decode import png_rgba8

class DecodeGuards(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pin, _ = load()
        cls.raw = [cache_path(SOURCE_ROOT, r).read_bytes() for r in cls.pin['extraction']['files'] if r['path'].endswith('.scb')]
        cls.decoder = runpy.run_path(str(Path(__file__).with_name('decode-ahri-q-particles.py')))

    def test_all_four_meshes_round_trip_through_json_without_geometry_changes(self):
        self.assertEqual(len(self.raw), 4)
        for raw in self.raw:
            mesh = scb_mesh(raw)
            self.assertEqual(scb_bytes(json.loads(json.dumps(mesh, allow_nan=False))), raw)
            self.assertEqual(mesh['flags'], 2); self.assertEqual(mesh['tailHex'], '')
            self.assertEqual(mesh['sourceFaceRgbHex'], '')
        self.assertEqual([(scb_mesh(r)['sourceVertices'],scb_mesh(r)['triangles']) for r in self.raw], [(132,172),(150,192),(242,480),(603,792)])

    def test_vertex_colors_preserve_native_bgra_and_separate_rgba(self):
        meshes = [scb_mesh(r) for r in self.raw]
        self.assertEqual([m['hasVertexColors'] for m in meshes], [True, True, False, True])
        for m in meshes:
            bgra = bytes.fromhex(m['sourceVertexBgraHex']); rgba = bytes.fromhex(m['vertexRgbaHex'])
            self.assertEqual(len(bgra), m['sourceVertices']*4 if m['hasVertexColors'] else 0)
            for i in range(0,len(bgra),4): self.assertEqual(rgba[i:i+4],bytes([bgra[i+2],bgra[i+1],bgra[i],bgra[i+3]]))

    def test_truncation_unknown_flags_and_invalid_color_headers_reject(self):
        raw = self.raw[0]
        bad = [raw[:-1],b'wrong'+raw[5:]]
        for offset,fmt,value in [(8,'<H',4),(148,'<I',5),(176,'<I',2),(140,'<I',0)]:
            changed=bytearray(raw);struct.pack_into(fmt,changed,offset,value);bad.append(changed)
        for changed in bad:
            with self.subTest(kind=bad.index(changed)):
                with self.assertRaises(ValueError): scb_mesh(changed)

    def test_outside_vertex_index_is_not_truncated_to_ushort(self):
        raw=bytearray(self.raw[0]);v=struct.unpack_from('<I',raw,140)[0];colors=struct.unpack_from('<I',raw,176)[0]
        for value in [v,65536,0xffffffff]:
            changed=bytearray(raw);struct.pack_into('<I',changed,180+v*(12+colors*4)+12,value)
            with self.assertRaisesRegex(ValueError,'index'): scb_mesh(changed)

    def test_nonfinite_source_coordinates_reject(self):
        changed=bytearray(self.raw[0]);struct.pack_into('<f',changed,180,float('nan'))
        with self.assertRaisesRegex(ValueError,'coordinates'): scb_mesh(changed)

    def test_retained_color_metadata_cannot_forge_channels_or_boolean_type(self):
        original=scb_mesh(self.raw[0])
        for change in ['rgba','boolean','tail','count']:
            mesh=copy.deepcopy(original)
            if change=='rgba': mesh['vertexRgbaHex']='00'+mesh['vertexRgbaHex'][2:] if mesh['vertexRgbaHex'][:2]!='00' else 'ff'+mesh['vertexRgbaHex'][2:]
            if change=='boolean': mesh['hasVertexColors']=1
            if change=='tail': mesh['tailHex']='00'
            if change=='count': mesh['sourceVertices']+=1
            with self.assertRaises(ValueError): scb_bytes(mesh)

    def test_complete_frozen_record_checks_every_authored_mip_and_native_mesh(self):
        record=self.decoder['check_record'](self.decoder['RECORD'],SOURCE_ROOT)
        self.assertEqual((len(record['textures']),sum(len(t['levels']) for t in record['textures']),len(record['meshes'])),(37,312,4))

    def test_changed_record_and_png_crc_reject_without_repair(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'record.json';path.write_text('{}')
            with self.assertRaisesRegex(ValueError,'Frozen particle input'): self.decoder['check_record'](path,SOURCE_ROOT)
        record=json.loads(self.decoder['RECORD'].read_text());level=record['textures'][0]['levels'][0];raw=bytearray(Path(level['path']).read_bytes());raw[40]^=1
        with self.assertRaises(ValueError): png_rgba8(raw,level['width'],level['height'])

    def test_whole_publication_preflight_prevents_partial_earlier_writes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);first=root/'first.png';last=root/'last.json';last.write_bytes(b'conflict')
            with self.assertRaisesRegex(ValueError,'Conflicting'): self.decoder['publish']([(first,b'new'),(last,b'expected')])
            self.assertFalse(first.exists());self.assertEqual(last.read_bytes(),b'conflict')

    def test_publication_rejects_leaf_and_parent_symlinks(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);target=root/'real';target.write_bytes(b'expected');link=root/'link';link.symlink_to(target)
            with self.assertRaisesRegex(ValueError,'symlink'): self.decoder['publish']([(link,b'expected')])
            directory=root/'redirect';directory.symlink_to(root,target_is_directory=True)
            with self.assertRaisesRegex(ValueError,'symlink'): self.decoder['publish']([(directory/'new',b'new')])
            self.assertFalse((root/'new').exists())

if __name__=='__main__':unittest.main()
