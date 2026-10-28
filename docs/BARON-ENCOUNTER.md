# Private Baron combat fixture

Run the development server and open
`/?scene=fixture&encounter=baron` for a controlled neutral Baron encounter.
Right-click his ground position to attack. The player starts with Flash/Smite;
point at Baron and press F to use the existing targeted Smite control. Practice
tools can raise the player's level and resources before attacking. The encounter
has no lane waves or live objective calendar.

The later [control-resistance increment](BARON-CONTROL.md) rejects root, stun,
silence and Charm while preserving incoming damage. Its source and remaining
slow/Frost/stat/stasis limits are recorded separately. Results and build
identities below describe the original fixture increment.

This is a stationary basic-combat fixture. It does not activate Baron in the
public match. The full native boss kit, crowd-control immunity, corrosion/shred,
cleaves, authored sound, team-wide rewards, Hand of Baron, live spawn/respawn
rules and native animation calibration remain unfinished. In particular,
current debuffs still follow the interim generic-monster rules. Gold, XP, CS,
companion feeds and kill recovery are disabled on this controlled target so its
partial presentation does not masquerade as a completed epic reward system.

## Supported source and local policies

The eleven-character [source pin](EPIC-CHARACTERS.md) and the original
[Baron base rig](EPIC-MODELS.md) provide the character scalars, source tags,
mesh, skeleton, diffuse assignment and 85 atomic clips. The selected runtime
aliases reference the original idle, attack, death and spawn files. The unused
run alias shares idle because the local fixture is stationary; no walking
animation is fabricated.

Riot's published standard-Rift 26.1 notes match Root's base/growth values and
state minimum level 11. Applying the existing champion growth curve gives:

| Level | Health | Attack damage | Armor | Magic resistance |
| --- | ---: | ---: | ---: | ---: |
| 11 | 17,791.75 | 350.5 | 104.2 | 67.1 |
| 18 | 19,190 | 515 | 170 | 100 |

The fixture starts at the minimum. The calculator rejects invalid/non-integer
levels and clamps valid lower levels to 11. It does not choose a real camp's
level from game state. The authored movement scalar 300 remains in the source
profile; the local actor uses speed zero. Range 900 and attack speed 0.625 come
from Root. The local 60 Hz adapter rounds the authored 0.282999992-second cast
value to 17 windup ticks and uses a 96-tick ordinary attack period. A local
1,100-unit sight/leash and 20%/second reset heal govern disengagement.

All eighteen official patch articles through 26.18 are retained in the research
artifacts with URLs, hashes and heading-scoped extracts. The
[published-rule reading](reference/baron-rules-source.json) retains standard
Baron facts separately from other modes. The 12-minute Baron and removal of
Grubs/Herald in the season notes belong to Swiftplay. Later Classic sections
are also separate. The 26.13/26.18 Void Corruption bugfix supplies no numeric
stack cap; no cap is invented here. This reading is source evidence, not a
native-client measurement packet.

```sh
python3 tools/assets/prepare-baron-encounter.py
```

The checker requires exact character/model identities and the frozen published
minimum level. `--write` regenerates the small private profile explicitly.
Native nominal duration and the converted clip key span remain distinct as
recorded in the model pipeline; local timing is not native calibration.

## Admission, saves and cleanup

The trusted development host flag is supplied by the dev-only query path and
is never serialized. Spawning Baron requires that host, the fixture battlefield
and the Baron encounter. Extra NPC selector flags are ignored in this controlled
scene, so they cannot make its own save fail to restore. Invalid admission fails before allocating IDs or
units. Saved Baron data also requires that trusted encounter; a forged null
encounter cannot carry a Baron into an ordinary host.

Baron uses the separate `development-baron-encounter` browser slot. Ordinary
practice remains untouched. Save/reload, export/import, mid-windup future
continuation, dead bodies and cleared saves retain the existing fields.
An ordinary host rejects the private file before replacing state or storage.
The private importer requires its own encounter. A cleared reload prepares no
Baron rig and restores no ghost unit. The source epic tags enable Smite and
exclude ordinary-monster companion damage modifiers; original ordinary-camp
tag pins remain unchanged.

Schema remains 163, with the species/encounter enums extended. The ruleset
fingerprint changes, so earlier `abc8dc…` checkpoints remain tied to their
frozen build. No migration or old-corpus relabeling is performed. Both ongoing
hundred-seed audits retain their original checkout/runners and remain historical
baselines for that fingerprint.

The current full unit run reports 3,590 passing tests / 3,592 across 417 files.
The same historical Leona archive and Lux sampler checksum assertions remain
open. All 39 Node QA checks and complete model/map validation pass. Sixteen
new unit cases and all eight final browser scenarios pass, including real
combat/Smite, exact paused save/future continuity, ordinary-save preservation,
file admission, death/cleanup and existing Gromp/Smite/file regressions.
The nested-path production check passes with all 32 expected recordings,
public Ashe/Lux choices, no development hook, an ignored Baron query flag and
zero Baron rig preloads. The extra-NPC selector regression repeats successfully;
its build is byte-identical to the checked production pack. All three final
quiet-check receipts plus the selector receipt resume the frozen audits.
The [verification ledger](reference/baron-encounter-verification.json) pins
sources, the unchanged known failures, snapshots, captures, asset rejection
fixtures, source/pack identities and resumed process receipts.

The current fingerprint is `25f21e02b07b748ab22622ea260d92f32575a1b5be8e31c0136404e1a31f607b`.
Pack `e56b573f359924a159d5eb5de3a5174e4519e6805a1622849ffe2bf2ec4b56a0` has
1,204 files / 551,654,996 bytes. No fresh full-match, hundred-seed,
offline or native-boss certification is claimed for this fingerprint.

## Asset-validation repair

The broader asset command exposed six existing Yi particle meshes whose
identities live in their runtime source profiles rather than conventional
sidecars. The validator now reads those exact identities, checks sizes and
hashes, rejects conflicting shared identities, and still runs glTF validation.
An isolated fixture validates all six originals and rejects corrupt, conflicting
and unrecorded copies. Original Yi media and source pins remain unchanged.
