# Epic-objective character sources

The pinned 16.18 Map11 archive supplies eleven character files for Baron,
Rift Herald, the generic dragon, six elemental dragons, Elder Dragon and
Void Grubs (`SRU_Horde`). Their 57,967 original bytes contain fifteen distinct
CharacterRecord variants plus embedded spell records. The source pin retains
all records, unresolved names, compressed-chunk hashes and per-file hashes.
It also retains thirteen matching placed map objects from the earlier frozen
map reading, including three Grub objects and off-map dragon objects.

These are client declarations. They do not select the active variant, prove
server scaling, establish rewards or activate camps. The generic dragon is a
separate character identity from its elemental variants. The map's `DragonParty`
type declaration does not add a corresponding placed character to this scope.

| Root character | Authored base HP | Authored base damage | Authored gold on death | Authored XP on death |
| --- | ---: | ---: | ---: | ---: |
| Baron | 16,300 | 175 | 100 | 0 |
| Rift Herald | 7,000 | 60 | 100 | 240 |
| Generic dragon | 3,625 | 100 | 100 | 160 |
| Infernal | 3,625 | 70 | 75 | 160 |
| Mountain | 4,200 | 105 | 75 | 160 |
| Ocean | 3,625 | 70 | 75 | 160 |
| Cloud | 3,625 | 35 | 75 | 160 |
| Hextech | 3,625 | 47 | 75 | 160 |
| Chemtech | 3,625 | 47 | 75 | 160 |
| Elder | 11,500 | 150 | 100 | 0 |
| Void Grub | 1,300 | 12 | 30 | 65 |

Values above are the exact Root `ModifiableFloat.baseValue` or reward fields,
not live gameplay totals. Baron also retains a 17,000-HP variant. Herald has
another variant with 6,000 HP, 130 damage, 600 XP and no authored gold field.
Elder's second variant has 13,000 HP and 75 damage; the other Grub variant has
375 HP. Their unresolved record keys remain unresolved. Explicit zero XP stays
zero, and absent fields stay absent. Level-growth fields and complete spell
links remain inspectable in the [source pin](reference/epic-character-source.json).

The extractor uses three committed, hash-pinned readings to label finite field,
type, entry and path hashes. No mutable discovery dictionary is required. It
requires exact reproduction of the entire pin, including original extraction
provenance. It refuses a differing existing cache and refuses to overwrite a
report. First discovery requires an explicit flag and a missing pin.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python \
  tools/assets/extract-epic-characters.py \
  --report artifacts/epic-characters-fresh.json
```

A fresh separate cache reproduces the complete pin exactly. Recovery checks
recreate a deleted source file, preserve and reject a corrupted cache, reject
an edited Root record and leave an existing report unchanged. All eleven files
are revalidated afterward. The [verification ledger](reference/epic-character-verification.json)
retains results and source identities. The first exploratory print helper failed
after writing its raw extraction; its log and source are retained separately.

Live objective combat, spawn calendars, rewards/buffs, team contest policies,
rig conversion, audiovisual dispatch and native comparisons remain unfinished.
This source increment changes no public media, simulation rules, save fields,
champion selection or production loading.
