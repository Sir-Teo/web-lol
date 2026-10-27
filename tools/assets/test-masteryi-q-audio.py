"""Source helpers plus semantic rejection behind an intentionally bypassed hash.

Production always verifies the immutable input hashes first. Mutation controls
override that one read to exercise the subsequent structural checks directly.
"""
from pathlib import Path
import copy
import json
import unittest
from unittest.mock import patch
import masteryi_q_audio as source


def scalar(value='-11', label='0x06 [MakeUpGain]'):
    return {1: {'parameters': [['/props/0/pID', 'u8', '6', label], ['/props/0/pValue', 'f32', value, None]]}}


class Helpers(unittest.TestCase):
    def test_exact_parameter(self): self.assertEqual(source.parameter(scalar(), 1, 'pValue'), '-11')
    def test_missing_parameter(self):
        with self.assertRaises(ValueError): source.parameter(scalar(), 1, 'missing')
    def test_duplicate_parameter(self):
        nodes=scalar(); nodes[1]['parameters'].append(['/other/pValue','f32','-12',None])
        with self.assertRaises(ValueError): source.parameter(nodes, 1, 'pValue')
    def test_source_gain(self): self.assertEqual(source.properties(scalar(),1), {'MakeUpGain':-11})
    def test_unresolved_property(self):
        with self.assertRaises(ValueError): source.properties(scalar(label=None),1)
    def test_nonfinite_property(self):
        for value in ['nan','inf','-inf']:
            with self.subTest(value=value), self.assertRaises(ValueError): source.properties(scalar(value),1)
    def test_duplicate_property(self):
        nodes=scalar();nodes[1]['parameters'] += [['/props/1/pID','u8','6','0x06 [MakeUpGain]'],['/props/1/pValue','f32','0',None]]
        with self.assertRaises(ValueError): source.properties(nodes,1)
    def test_ranged_pitch_separate_from_scalar_gain(self):
        nodes=scalar();nodes[1]['parameters'] += [['/RANGED_MODIFIERS/0/pID','u8','2','0x02 [Pitch]'],
            ['/RANGED_MODIFIERS/0/min','f32','-100',None],['/RANGED_MODIFIERS/0/max','f32','100',None]]
        self.assertEqual(source.properties(nodes,1),{'MakeUpGain':-11})
        self.assertEqual(source.properties(nodes,1,True),{'Pitch':[-100,100]})
    def test_missing_property_value(self):
        nodes=scalar();nodes[1]['parameters'].pop()
        with self.assertRaises(ValueError): source.properties(nodes,1)
    def test_complete_parent_chain(self):
        nodes={i:{'parameters':[['/DirectParentID','tid',str(parent),None]]} for i,parent in [(1,2),(2,3),(3,0)]}
        self.assertEqual(source.ancestors(nodes,1),[1,2,3])
    def test_cycle(self):
        with self.assertRaises(ValueError):source.ancestors({1:{'parameters':[['/DirectParentID','tid','1',None]]}},1)
    def test_missing_parent(self):
        with self.assertRaises(ValueError):source.ancestors({1:{'parameters':[['/DirectParentID','tid','2',None]]}},1)


class ActualReading(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.record=source.generate()
        cls.graph=json.loads(source.checked_bytes(source.GRAPH,source.GRAPH_SHA256))
        cls.decoded=json.loads(source.checked_bytes(source.DECODED,source.DECODED_SHA256))
    def test_exact_source_profiles_and_omissions(self):
        r=self.record;self.assertEqual(len(r['profiles']),3);self.assertEqual(r['media'],7)
        self.assertEqual(r['wavBytes'],1300172);self.assertEqual(r['tails'],{'cast':144,'hit':42})
        self.assertEqual(r['peaksAboveOne'],3);self.assertGreater(r['peak'],1)
        self.assertEqual([p['gainDb'] for p in r['profiles']],[-12,-10,-11])
        self.assertEqual([p['policy']['u16MaxNumInstance'] for p in r['profiles']],[3,3,2])
        self.assertEqual([p['policy']['bKillNewest'] for p in r['profiles']],[1,0,0])
        self.assertEqual({b['system'] for b in r['bindings'] if b['present']},{'MasterYi_Q_Cas','MasterYi_Q_Tar'})
        self.assertEqual(len(r['attenuation']['points']),6);self.assertEqual(r['attenuation']['unresolvedOutputBusId'],1259461568)
    def reject(self, mutate):
        graph=copy.deepcopy(self.graph);nodes={n['id']:n for n in graph['nodes']};mutate(graph,nodes)
        checked=source.checked_bytes
        def override(path,*args):
            return json.dumps(graph).encode() if Path(path)==Path(source.GRAPH) else checked(path,*args)
        with patch.object(source,'checked_bytes',side_effect=override),patch.object(source,'check_masters',return_value=self.decoded):
            with self.assertRaises(ValueError):source.generate()
    @staticmethod
    def set(nodes,identity,ending,value):
        rows=[r for r in nodes[identity]['parameters'] if r[0].endswith('/'+ending)]
        if len(rows)!=1:raise RuntimeError('Invalid mutation fixture')
        rows[0][2]=str(value)
    def test_missing_event(self):self.reject(lambda g,n:g['events'].__setitem__(slice(None),[e for e in g['events'] if e['name']!='Play_sfx_MasterYi_AlphaStrike_hit']))
    def test_wrong_action_target(self):self.reject(lambda g,n:next(e for e in g['events'] if e['name']=='Play_sfx_MasterYi_AlphaStrike_hit')['actions'][0].update(target=8847))
    def test_changed_cap(self):self.reject(lambda g,n:self.set(n,8846,'u16MaxNumInstance',4))
    def test_changed_kill_newest(self):self.reject(lambda g,n:self.set(n,8847,'bKillNewest',0))
    def test_changed_playlist_weight(self):self.reject(lambda g,n:self.set(n,8846,'AkPlaylistItem:0/weight',1))
    def test_changed_leaf_media(self):self.reject(lambda g,n:self.set(n,920289726,'sourceID',108844688))
    def test_changed_parent(self):self.reject(lambda g,n:self.set(n,8845,'DirectParentID',8846))
    def test_changed_inherited_bus(self):self.reject(lambda g,n:self.set(n,1056413114,'OverrideBusId',211064428))
    def test_leaf_limit(self):self.reject(lambda g,n:self.set(n,920289726,'u16MaxNumInstance',1))
    def test_new_action_modifier(self):
        self.reject(lambda g,n:n[448316895]['parameters'].extend([['/props/pID','u8','6','0x06 [MakeUpGain]'],['/props/pValue','f32','-1',None]]))
    def test_unknown_event_node(self):
        self.reject(lambda g,n:next(e for e in g['events'] if e['name']=='Play_sfx_MasterYi_AlphaStrike_hit')['actions'][0]['targetNodes'].append(12345))
    def test_critical_binding_is_not_filled(self):
        particles,_=source.load();particles=copy.deepcopy(particles)
        particles['resources']['MasterYi_Q_Crit_tar']['definition']['soundOnCreateDefault']='Play_sfx_MasterYi_AlphaStrike_hit'
        with patch.object(source,'load',return_value=(particles,None)),patch.object(source,'check_masters',return_value=self.decoded):
            with self.assertRaisesRegex(ValueError,'binding/omission'):source.generate()


if __name__=='__main__':unittest.main()
