"""Independent mip/PNG controls and SCB preservation guards; run also with -O."""
from pathlib import Path
import binascii
import json
import runpy
import struct
import unittest
from unittest.mock import patch
import zlib
from masteryi_q_decode import png_rgba8, scb_bytes, scb_mesh, single_mip_tex, tex_levels


def chunk(tag, data): return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', binascii.crc32(tag + data) & 0xffffffff)
def png(filtered, width=2, height=2, **options):
    header = struct.pack('>IIBBBBB', width, height, options.get('bits',8), options.get('color',6), 0, 0, options.get('interlace',0))
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR',header) + chunk(b'IDAT',zlib.compress(filtered)) + chunk(b'IEND',b'')


class PngControls(unittest.TestCase):
    truth = bytes([10,20,30,40,50,60,70,80,5,15,25,35,45,55,65,75])
    def test_all_five_filters_recover_hand_calculated_rgba(self):
        controls = {
            0: ([10,20,30,40,50,60,70,80],[5,15,25,35,45,55,65,75]),
            1: ([10,20,30,40,40,40,40,40],[5,15,25,35,40,40,40,40]),
            2: ([10,20,30,40,50,60,70,80],[251]*8),
            3: ([10,20,30,40,45,50,55,60],[0,5,10,15,18,18,18,18]),
            4: ([10,20,30,40,40,40,40,40],[251]*8),
        }
        for kind,(first,second) in controls.items():
            with self.subTest(kind=kind): self.assertEqual(png_rgba8(png(bytes([kind,*first,kind,*second])),2,2),self.truth)
    def valid(self): return png(bytes([0,*self.truth[:8],0,*self.truth[8:]]))
    def test_crc_corruption(self):
        raw=bytearray(self.valid());raw[-1]^=1
        with self.assertRaisesRegex(ValueError,'CRC'):png_rgba8(bytes(raw),2,2)
    def test_dimensions(self):
        with self.assertRaisesRegex(ValueError,'dimensions'):png_rgba8(self.valid(),3,2)
    def test_non_rgba_cannot_be_reinterpreted(self):
        with self.assertRaisesRegex(ValueError,'format'):png_rgba8(png(b'',color=2),2,2)
    def test_non_eight_bit_cannot_be_reinterpreted(self):
        with self.assertRaisesRegex(ValueError,'format'):png_rgba8(png(b'',bits=16),2,2)
    def test_interlace_requires_explicit_support(self):
        with self.assertRaisesRegex(ValueError,'format'):png_rgba8(png(b'',interlace=1),2,2)
    def test_filtered_extent(self):
        with self.assertRaisesRegex(ValueError,'extent'):png_rgba8(png(b'\0'*17),2,2)
    def test_trailing_file_bytes(self):
        with self.assertRaisesRegex(ValueError,'Trailing'):png_rgba8(self.valid()+b'x',2,2)
    def test_unknown_filter(self):
        with self.assertRaisesRegex(ValueError,'filter'):png_rgba8(png(bytes([5,*self.truth[:8],0,*self.truth[8:]])),2,2)
    def test_trailing_compressed_stream(self):
        raw=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',2,2,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(b'\0'*18)+b'extra')+chunk(b'IEND',b'')
        with self.assertRaisesRegex(ValueError,'extent'):png_rgba8(raw,2,2)


def tex(width=8,height=4,format=10,mips=True):
    sizes=[];count=max(width,height).bit_length() if mips else 1
    for i in range(count):sizes.append(((max(1,width>>i)+3)//4)*((max(1,height>>i)+3)//4)*(8 if format==10 else 16))
    return b'TEX\0'+struct.pack('<HH',width,height)+bytes([1,format,0,int(mips)])+b''.join(bytes([i])*size for i,size in reversed(list(enumerate(sizes))))


class TexControls(unittest.TestCase):
    def test_rectangular_chain_and_smallest_first_blocks(self):
        raw=tex();info=tex_levels(raw)
        self.assertEqual([(m['width'],m['height'],m['sourceOffset'],m['sourceBytes'])for m in info['levels']],[(8,4,36,16),(4,2,28,8),(2,1,20,8),(1,1,12,8)])
        for level in info['levels']:
            one=single_mip_tex(raw,level);self.assertEqual(one[12:],bytes([level['level']])*level['sourceBytes']);self.assertFalse(tex_levels(one)['hasMipmaps'])
    def test_four_by_four_keeps_three_minimum_blocks(self): self.assertEqual([m['sourceBytes'] for m in tex_levels(tex(4,4))['levels']],[8,8,8])
    def test_bc3_without_mips(self):
        info=tex_levels(tex(format=12,mips=False));self.assertEqual(len(info['levels']),1);self.assertEqual(info['levels'][0]['sourceBytes'],32)
    def test_rectangular_height_clamps_to_one(self):self.assertEqual([(m['width'],m['height'])for m in tex_levels(tex(16,4))['levels']],[(16,4),(8,2),(4,1),(2,1),(1,1)])
    def test_wrong_magic(self):
        with self.assertRaisesRegex(ValueError,'header'):tex_levels(b'BAD!'+tex()[4:])
    def test_zero_dimension(self):
        raw=bytearray(tex());struct.pack_into('<H',raw,4,0)
        with self.assertRaisesRegex(ValueError,'dimensions'):tex_levels(bytes(raw))
    def test_unsupported_format(self):
        raw=bytearray(tex());raw[9]=13
        with self.assertRaisesRegex(ValueError,'format'):tex_levels(bytes(raw))
    def test_invalid_mip_flag(self):
        raw=bytearray(tex());raw[11]=2
        with self.assertRaisesRegex(ValueError,'header'):tex_levels(bytes(raw))
    def test_truncated_mip(self):
        with self.assertRaisesRegex(ValueError,'Truncated'):tex_levels(tex()[:-1])
    def test_extra_mip_byte(self):
        with self.assertRaisesRegex(ValueError,'Unexpected'):tex_levels(tex()+b'0')


def mesh(unused=False):
    points=[(-0.,0.,0.),(1.,0.,0.),(0.,1.,0.)]+([(7.,8.,9.)]if unused else [])
    header=b'r3d2Mesh'+struct.pack('<HH',3,2)+b'control'.ljust(128,b'\0')+struct.pack('<III',len(points),1,5)+struct.pack('<6f',*(0.,)*6)+struct.pack('<I',0)
    material=b'mat\0'+b'padding-preserved'.ljust(60,b'\0')
    return header+b''.join(struct.pack('<3f',*p)for p in points)+struct.pack('<3f',2.,3.,4.)+struct.pack('<3I',0,1,2)+material+struct.pack('<6f',0.,1.,0.,0.,0.,1.)+bytes(range(1,10))+bytes(range(24))


class MeshControls(unittest.TestCase):
    def test_whole_mesh_round_trip_preserves_uv_rgb_pivot_padding_tail_and_negative_zero(self):
        raw=mesh();r=scb_mesh(raw);self.assertEqual(scb_bytes(json.loads(json.dumps(r))),raw)
        self.assertEqual(r['sourceIndices'],[0,1,2]);self.assertEqual(r['faceUv'],[[0.,1.,0.,0.,0.,1.]])
        self.assertEqual(r['sourceFaceRgbHex'],bytes(range(1,10)).hex());self.assertEqual(r['centralPoint'],[2.,3.,4.]);self.assertEqual(r['tailHex'],bytes(range(24)).hex())
        self.assertEqual(struct.pack('<f',r['sourcePoints'][0][0]),b'\0\0\0\x80');self.assertNotIn('normals',r)
    def test_unreferenced_source_points_are_retained(self):
        raw=mesh(True);r=scb_mesh(raw);self.assertEqual(r['unusedSourceVertices'],[3]);self.assertEqual(scb_bytes(r),raw)
    def modified(self,offset,format,value,pattern):
        raw=bytearray(mesh());struct.pack_into(format,raw,offset,value)
        with self.assertRaisesRegex(ValueError,pattern):scb_mesh(bytes(raw))
    def test_wrong_version(self):self.modified(8,'<H',4,'version')
    def test_unsupported_flags(self):self.modified(148,'<I',1,'flags')
    def test_unhandled_vertex_colors(self):self.modified(176,'<I',1,'colors')
    def test_out_of_range_index(self):self.modified(228,'<I',99,'index')
    def test_nonfinite_vertex(self):self.modified(180,'<f',float('nan'),'Non-finite')
    def test_nonfinite_pivot(self):self.modified(216,'<f',float('inf'),'Non-finite')
    def test_nonfinite_uv(self):self.modified(304,'<f',float('nan'),'Non-finite')
    def test_count_cannot_allocate_outside_file(self):self.modified(140,'<I',0xffffffff,'extent')
    def test_truncated_tail(self):
        with self.assertRaisesRegex(ValueError,'extent'):scb_mesh(mesh()[:-1])
    def test_extra_tail_is_not_silently_discarded(self):
        with self.assertRaisesRegex(ValueError,'extent'):scb_mesh(mesh()+b'x')


class ActualDecode(unittest.TestCase):
    def test_frozen_private_assets_check_without_pillow_or_cdtb(self):
        import builtins
        original=builtins.__import__
        def guard(name,*args,**kwargs):
            if name.split('.')[0] in {'PIL','cdtb'}:raise AssertionError('Independent check imported producer dependency')
            return original(name,*args,**kwargs)
        with patch('builtins.__import__',guard):
            module=runpy.run_path(str(Path(__file__).with_name('decode-masteryi-q-particles.py')))
            record=module['check_record'](module['RECORD'],module['SOURCE_ROOT'])
        self.assertEqual(len(record['textures']),23);self.assertEqual(sum(len(t['levels'])for t in record['textures']),198);self.assertEqual(len(record['meshes']),2)
    def test_unreviewed_record_checksum_rejects(self):
        module=runpy.run_path(str(Path(__file__).with_name('decode-masteryi-q-particles.py')))
        with self.assertRaisesRegex(ValueError,'Frozen particle input'):module['check_record'](module['RECORD'],module['SOURCE_ROOT'],'0'*64)


if __name__=='__main__':unittest.main()
