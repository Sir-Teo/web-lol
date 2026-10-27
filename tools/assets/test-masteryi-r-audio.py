"""Offline Highlander export guards, also exercised under Python optimization."""
from pathlib import Path
import copy
import json
import runpy
import unittest
from unittest.mock import patch

module = runpy.run_path(str(Path(__file__).with_name('export-masteryi-r-audio.py')))
generate = module['generate']; scope = generate.__globals__


class HighlanderGuards(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.character, cls.names = scope['source']['load']()
        cls.graph = json.loads(scope['checked_bytes'](scope['GRAPH'], scope['GRAPH_SHA256']))

    def test_ending_cannot_silently_resolve_another_spell_event(self):
        character = copy.deepcopy(self.character)
        character['records']['Characters/MasterYi/Spells/HighlanderAbility/Highlander']['mSpell']['SpellEventToAudioEventSuffix']['19'] = 'Play_sfx_MasterYi_Meditate_OnBuffDeactivate\n'
        with patch.dict(scope['source'], load=lambda: (character, self.names)):
            with self.assertRaisesRegex(ValueError, 'binding changed'): generate()

    def changed_graph(self, change):
        graph = copy.deepcopy(self.graph); change(graph)
        checked = scope['checked_bytes']
        # Deliberately exercise semantic guards beyond the independent frozen
        # input gate; production generation always verifies the original hash.
        def inputs(path, *args):
            return json.dumps(graph).encode() if path == scope['GRAPH'] else checked(path, *args)
        with patch.dict(scope, checked_bytes=inputs):
            with self.assertRaises(ValueError): generate()

    def parameter(self, graph, identity, suffix):
        node = next(n for n in graph['nodes'] if n['id'] == identity)
        return next(p for p in node['parameters'] if p[0].endswith('/' + suffix))

    def test_extra_action_requires_new_dispatch_review(self):
        def change(graph):
            event = next(e for e in graph['events'] if e['name'] == 'Play_sfx_MasterYi_Highlander_OnBuffActivate')
            event['actions'].append(copy.deepcopy(event['actions'][0]))
        self.changed_graph(change)

    def test_looping_cannot_be_invented(self):
        self.changed_graph(lambda g: self.parameter(g, 9116, 'sLoopCount').__setitem__(2, '2'))

    def test_bus_cannot_be_borrowed_from_basic_attacks(self):
        self.changed_graph(lambda g: self.parameter(g, 1056413114, 'OverrideBusId').__setitem__(2, '211064428'))

    def test_changed_media_binding_rejects(self):
        self.changed_graph(lambda g: self.parameter(g, 893477969, 'sourceID').__setitem__(2, '449771614'))

    def test_unsupported_inherited_gain_property_rejects(self):
        self.changed_graph(lambda g: self.parameter(g, 1056413114, 'AkPropBundle:0/pID').__setitem__(3, '[Unsupported]'))

    def test_new_attenuation_point_is_not_discarded(self):
        def change(graph):
            node = next(n for n in graph['nodes'] if n['id'] == 339248780)
            point = copy.deepcopy(self.parameter(graph, 339248780, 'AkRTPCGraphPoint:5/From'))
            point[0] = point[0].replace('AkRTPCGraphPoint:5', 'AkRTPCGraphPoint:6')
            node['parameters'].append(point)
        self.changed_graph(change)


if __name__ == '__main__': unittest.main()
