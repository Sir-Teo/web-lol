"""Mutation guards for bounded gravity height code, routing and frozen Gromp source."""
from pathlib import Path
import json, runpy, struct, unittest
from unittest.mock import patch
import native_missile_gravity_height as source

class HeightGuards(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.core=json.loads(source.witness.pinned(source.CORE,source.PINS[str(source.CORE)]))
        raw=source.witness.restored.checked(Path(cls.core['native']['path']).read_bytes(),cls.core['native'])
        cls.data,cls.sections=runpy.run_path(str(source.witness.PARSER))['arm64_sections'](raw,cls.core['native']['architecture'])
        cls.image=source.witness.Image(cls.data,cls.sections)
    def changed_word(self,pc,word):
        class Changed(source.witness.Image):
            def word(self,address):return word if source.witness.number(address)==pc else super().word(address)
        return Changed(self.data,self.sections)
    def changed_bytes(self,address,raw):
        section=next(s for s in self.sections if s['address']<=address and address+len(raw)<=s['address']+s['bytes'])
        offset=section['offset']+address-section['address'];data=bytearray(self.data);data[offset:offset+len(raw)]=raw
        return source.witness.Image(data,self.sections)
    def fixture(self):
        return json.loads(Path('docs/reference/jungle-character-source.json').read_bytes()),json.loads(Path('src/content/gromp-attack.json').read_bytes())
    def mutate_spell(self,field,value):
        chars,compiled=self.fixture();spell=chars['records']['data/characters/sru_gromp/sru_gromp.bin']['{e545321f}']
        spec=spell['mSpell']['mMissileSpec'];field(spec,value);compiled['spell']=spell
        with self.assertRaises(ValueError):source.source_fields(chars,compiled)
    def test_exact_offline_replay(self):
        with patch('socket.socket',side_effect=AssertionError('Network forbidden')),patch('subprocess.Popen',side_effect=AssertionError('Child forbidden')):result=source.observe()
        self.assertEqual(result,json.loads(source.OUTPUT.read_bytes()));self.assertEqual(len(result['functionSpans']),21);self.assertEqual(len(result['selectedInstructions']),447)
        self.assertEqual(sum(s['bytes']for s in result['functionSpans']),15472)
        self.assertFalse(result['nativeExecuted']);self.assertFalse(result['applicationBehaviorChanged']);self.assertEqual(result['constructorDefaults']['byte16'],0)
    def test_every_complete_function_is_bound(self):
        for name,start,end,digest in source.SPANS:
            with self.subTest(name=name),self.assertRaises(ValueError):source.verify(self.changed_bytes(start,bytes([self.image.at(start,1)[0]^1])),self.core)
    def test_every_selected_word_is_bound(self):
        for pc,word,reading in source.WORDS:
            with self.subTest(pc=hex(pc)),self.assertRaises(ValueError):source.verify(self.changed_word(pc,word^1),self.core)
    def test_complete_bounds_cannot_shrink(self):
        rows=list(source.SPANS);name,start,end,digest=rows[0];rows[0]=(name,start,end-4,digest)
        with patch.object(source,'SPANS',rows),self.assertRaisesRegex(ValueError,'function bounds differ'):source.verify(self.image,self.core)
    def test_every_parent_pin_is_required(self):
        for name in source.PINS:
            with self.subTest(name=name),patch.object(source,'PINS',{**source.PINS,name:'0'*64}),self.assertRaises(ValueError):source.verify(self.image,self.core)
    def test_field_names_are_candidates_with_exact_hashes(self):
        rows=list(source.FIELDS);name,pc,offset,wrapper=rows[0];rows[0]=(name+'Changed',pc,offset,wrapper)
        with patch.object(source,'FIELDS',rows),self.assertRaises(ValueError):source.verify(self.image,self.core)
    def test_each_field_offset_and_wrapper_is_bound(self):
        for index,row in enumerate(source.FIELDS):
            for lane in [2,3]:
                rows=list(source.FIELDS);bad=list(row);bad[lane]+=4;rows[index]=tuple(bad)
                with self.subTest(index=index,lane=lane),patch.object(source,'FIELDS',rows),self.assertRaises(ValueError):source.verify(self.image,self.core)
    def test_all_config_and_runtime_slots_are_bound(self):
        for name,address,slots in source.VTABLES:
            for offset,target in slots.items():
                with self.subTest(name=name,offset=offset),self.assertRaises(ValueError):source.verify(self.changed_bytes(address+offset,struct.pack('<Q',target+4)),self.core)
    def test_both_constructor_default_words_are_bound(self):
        for offset in [0,4]:
            with self.subTest(offset=offset),self.assertRaises(ValueError):source.verify(self.changed_bytes(0x102114778+offset,b'\x01'),self.core)
    def test_literal_decoder_rejects_wrong_opcode_or_register(self):
        for pc,word in [(0x100ade3f4,0),(0x100ade3f4,self.image.word(0x100ade3f4)^1),(0x100ade3f8,0),(0x100ade3f8,self.image.word(0x100ade3f8)^1)]:
            with self.subTest(pc=hex(pc),word=word),self.assertRaises(ValueError):source.adrp_ldr_d_address(self.changed_word(pc,word),0x100ade3f4,0x100ade3f8)
    def test_literal_decoder_uses_scaled_eight_byte_offset(self):
        self.assertEqual(source.adrp_ldr_d_address(self.image,0x100ade3f4,0x100ade3f8),0x102114778)
        altered=self.changed_word(0x100ade3f8,self.image.word(0x100ade3f8)+(1<<10))
        self.assertEqual(source.adrp_ldr_d_address(altered,0x100ade3f4,0x100ade3f8),0x102114780)
    def test_compiled_spell_cannot_drift_from_source(self):
        chars,compiled=self.fixture();compiled['spell']['mSpell']['mMissileSpec']['heightSolver']['mGravity']=0
        with self.assertRaises(ValueError):source.source_fields(chars,compiled)
    def test_gravity_scope_and_omissions_are_bound(self):
        for value in [{'mGravity':0,'__type':'GravityHeightSolver'},{'mGravity':1500.,'__type':'Other'},{'mGravity':1500.,'__type':'GravityHeightSolver','mHeight':100}]:
            self.mutate_spell(lambda spec,v:spec.__setitem__('heightSolver',v),value)
    def test_every_movement_value_and_extra_field_is_bound(self):
        for field,value in [('mSpeed',1700.),('mStartBoneName','other'),('mTargetHeightAugment',0.),('mOffsetInitialTargetHeight',0.),('__type','Other'),('newOverride',1)]:
            with self.subTest(field=field):self.mutate_spell(lambda spec,v:spec['movementComponent'].__setitem__(field,v),value)
    def test_source_facing_is_preserved(self):
        self.mutate_spell(lambda spec,v:spec.__setitem__('verticalFacing',v),{'__type':'Other'})
    def test_runtime_factory_tail_and_progress_branch_are_bound(self):
        for pc in [0x100acfe28,0x100aec614,0x100aebf28,0x100ae3678]:
            with self.subTest(pc=hex(pc)),self.assertRaises(ValueError):source.verify(self.changed_word(pc,self.image.word(pc)^0x400),self.core)
    def test_bad_native_memory_spans_reject(self):
        for address,count in [(0,4),(0x102587378,0),(0x102587378,-1)]:
            with self.subTest(address=address,count=count),self.assertRaises(ValueError):self.image.at(address,count)

if __name__=='__main__':unittest.main()
