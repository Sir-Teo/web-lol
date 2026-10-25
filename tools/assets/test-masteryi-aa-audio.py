"""Offline primary-cue binding/export guards; also run with python -O."""
from pathlib import Path
import copy
import json
import runpy
import unittest
from unittest.mock import patch

export = runpy.run_path(str(Path(__file__).with_name('export-masteryi-aa-audio.py')))
generate = export['generate']
scope = generate.__globals__


class PrimaryGuards(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.character, cls.names = scope['source']['load']()
        cls.graph = json.loads(scope['checked_bytes'](scope['GRAPH'], scope['GRAPH_SHA256']))

    def changed_spell(self, name, change):
        character = copy.deepcopy(self.character)
        change(character['records']['Characters/MasterYi/Spells/' + name]['mSpell'])
        with patch.dict(scope['source'], load=lambda: (character, self.names)):
            with self.assertRaises(ValueError): generate()

    def test_missing_material_flag_is_not_invented(self):
        self.changed_spell('MasterYiBasicAttack', lambda spell: spell.pop('mApplyMaterialOnHitSound'))

    def test_false_material_flag_rejects(self):
        self.changed_spell('MasterYiBasicAttack', lambda spell: spell.update(mApplyMaterialOnHitSound=False))

    def test_critical_suffix_cannot_be_silently_repaired_to_another_event(self):
        self.changed_spell('MasterYiCritAttack', lambda spell: spell['SpellEventToAudioEventSuffix'].update({'13': 'Play_sfx_MasterYi_MasterYiBasicAttack_OnHit\n'}))

    def test_multiple_suffixes_require_new_dispatch_review(self):
        self.changed_spell('MasterYiBasicAttack', lambda spell: spell['SpellEventToAudioEventSuffix'].update({'12': spell['SpellEventToAudioEventSuffix']['12'] * 2}))

    def changed_graph(self, change):
        graph = copy.deepcopy(self.graph); change(graph)
        checked = scope['checked_bytes']
        # Deliberately pass altered parser output beyond the already separately
        # tested immutable-file gate to exercise semantic export rejection.
        def inputs(path, *args):
            if path == scope['GRAPH']: return json.dumps(graph).encode()
            return checked(path, *args)
        with patch.dict(scope, checked_bytes=inputs):
            with self.assertRaises(ValueError): generate()

    def test_additional_primary_action_is_not_collapsed(self):
        def change(graph):
            event = next(e for e in graph['events'] if e['name'] == 'Play_sfx_MasterYi_MasterYiBasicAttack_OnCast')
            event['actions'].append(copy.deepcopy(event['actions'][0]))
        self.changed_graph(change)

    def test_unknown_inherited_property_requires_new_playback_support(self):
        def change(graph):
            node = next(n for n in graph['nodes'] if n['id'] == 3831)
            prop = next(p for p in node['parameters'] if p[0].endswith('/pID') and 'RANGED_MODIFIERS' not in p[0])
            prop[3] = '[UnsupportedProperty]'
        self.changed_graph(change)


if __name__ == '__main__': unittest.main()
