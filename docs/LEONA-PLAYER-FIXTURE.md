# Leona development player fixture

`?scene=fixture&champion=leona` now creates a human-controlled Leona in the
development server. She starts at level one with her own stats, mana, unlearned
spells and a normal skill point. The existing `npc=leona` fixture remains separate.
Ordinary Rift construction/spawning, roster selection and production query flags
remain gated. This is a development input/presentation integration, not completed
player, support, full-match or native acceptance.

## Controls and presentation

Q and W activate immediately. E and R aim while their key is held and cast on
release; Escape cancels. E shows the local simulation's 900-unit corridor with
a 70-unit half width. R shows the outer 300-unit and inner 120-unit circles at
the point clamped to 1,200 units. These previews follow current local collision
rules and do not claim recovered native targeting art or geometry calibration.

The HUD uses the pinned 16.18.1 portrait and four spell icons, Leona's title,
spell names, rank-one learning previews, rank/AP/level descriptions, current mana
and active Q/W/E/R states. Sunlight text identifies the other allied champion
needed to consume the mark. Existing learning, haste, mana, cooldown and input
validation remain authoritative. No Ashe Focus, Hawkshot charges/minimap aim or
Garen targeted-R behavior is inherited.

Practice tools and menus work with the fixture. Save/reload restores the Leona
player and existing spell/history state; Restart practice retains Leona and
resets the kit to level-one unlearned state. The controlled Gromp encounter can
also use this player. No new snapshot field is added; schema 126 remains, with
a new ruleset fingerprint for the changed constructor/decoder scope.

## Verification

Nine new units check human skill allocation, ordinary Rift/selection rejection,
W/R overlap and exact saved futures, the Gromp encounter, input modes, spell
previews/descriptions, pinned icon identities/hashes and E/R preview geometry.
The full standard check passes 1,949 tests in 316 files, TypeScript and three
Node QA tests.

Three new Chrome cases exercise actual HUD learning and Q/W keys, E/R aim and
cancellation, paid dash/impact, source rendering, W/R Save/reload with exact
90-tick futures, and Restart practice. Preview, aim and restored source captures
are inspected. The cases use controlled navigation/visibility and establish no
ordinary Rift pathfinding result or native frame.

The initial browser attempt retained three test issues: a symbol-prefixed
Controls button selector, an exact float32 radius comparison and a restart
navigation race. Corrected selectors, geometric tolerance and explicit navigation
waiting pass. The initial full check also caught a widened string literal in
the new unit fixture; an explicit literal fixes that compile error. All original
failure logs/traces and the original browser spec are retained.

All 23 final Chrome cases pass, including the new player cases, NPC setup and
E/R decisions, Garen player controls, Lux HUD/input, real ward previews and saved
combat, skill learning, practice resets and queued HUD Heal. Production passes
32 nested-path recordings. Both Garen/Leona development query combinations are
ignored in production; the development hook and Leona preloads remain absent.
The preload observation now includes Leona model, texture, audio and icon paths.

Schema 126 uses ruleset
`ceccf829647a6c36aeb10c0e955e7650276965f45787eb4f48cad34487e6d782`.

Offline pack
`2491785e7926d36a676af489d2efaf42f54570dc1ccc0f8cb075e307b60d8d4d`
contains 1,017 files / 513,375,388 bytes. Integrity, repair, saved offline boot and
atomic-version controls pass with 963 worker responses and zero production errors.
These production offline controls exercise the supported Ashe/Lux routes; they
do not expose the development Leona player in production.

Five new icon files and the reference-manifest update are the only public asset
changes. All 94 previous manifest records and the other 965 public files retain
their exact bytes. The [verification ledger](reference/leona/player-fixture-verification.json)
records the exact source and acceptance evidence. Complete roster/support,
missing R families, native behavior/frame calibration, normal-match cohort and
performance acceptance remain open.
