# Prepared Rift Scuttler sources

Rift Scuttler's base rig, both legacy river regions and the retained movement
scripts are prepared for live integration. **Scuttler is not yet in the live
match.** The game still has twelve camp calendars and ten live monster rigs.
The development character review now exposes all eleven imported ordinary jungle
rigs, including Scuttler, without changing the match simulation or saved ruleset.

## Original evidence

[The source pin](reference/scuttler-source.json) adds 22 Map11 archive members and
18 Scripts archive members from frozen manifest `29CE6E781C3B6368`
(16.18.8175716). The character, map and neutral-spawn parent pins remain unchanged.
It retains the base skin/graph/mesh/skeleton/diffuse, full recursive prototype
inventories for the selected scripts, both named spawn locators and the legacy
camp-controller windows. The selected scripts include normal/slime river AI,
RiverRegions, AIComponentSystem, four movement/regeneration components and the
character/spell scripts. Other default event/component dependencies and native
APIs are not reconstructed by this inventory.

The river script explicitly loads wandering/grazing, skittish movement,
river-boundary locking and non-aggressive taunt behavior. Its nested table
handlers distinguish melee/ranged attacks and respond to being cornered. Those
closures are preserved; a global-function-only inventory would omit them.
The character script itself is a RETURN-only stub.

Root contains `Special_Peaceful`, despite retaining damage/range/attack-speed
fields. The rig has no attack or death atomic clip. It must receive a dedicated
peaceful movement and hide/shrine lifecycle rather than ordinary retaliation
with an invented attack animation.

| Root value | Source |
| --- | --- |
| HP / damage | 1550 / 35 |
| Armor / MR | 42 / 42 |
| Movement speed / range | 255 / 300 |
| Attack speed | 0.6380000114440918 |
| Gold / XP / CS | 55 / 100 / 4 |
| Gameplay / navigation radius | 50 / 100 |
| Untargetable spawn time | 1.5 seconds |

The prepared export preserves these values as source data. It does not apply
server level/reward modifiers or treat attack stats as permission to retaliate.
The shrine-stat SpellObject retains effect-slot arrays with first values
90, 0.30000001192092896 and 2. Their active callback bindings, radius and complete
reward semantics remain unverified; no shrine reward has been implemented here.

## Routes, calendars and timing

`DragonEelCamp` and `BaronEelCamp` provide the two unique named map locators;
legacy camps 15/16 reference one `Sru_Crab` with `crab_hide`. RiverRegions retains
five patrol waypoints, top/bottom border paths, start/end points, a center,
one-based destination 4 and direction -1 for each river. All original coordinates
remain pinned; the prepared export uses the existing centered XY transform.

The final point in each Lua table uses an open-result constructor call. The
restricted decoder now accepts only the known data-only Make3DPoint constructor
in this form, followed immediately by SETLIST. Synthetic checks verify that it
consumes exactly one returned point, ignores stale registers and rejects unknown
calls, a missing result boundary and intervening operations. It does not execute
Lua or expand into a general interpreter.

The feature-gated legacy controller begins with both rivers and then coordinates
a selected later location. It retains 1–100 random selection, a 50 threshold and
25/75 thresholds after a four-selection streak. First-pair readiness, selection
and timer coordination must be represented together; two independent ordinary
camp respawn loops would lose this behavior. Current native feature-flag values
and lifecycle activation remain open.

Legacy settings give 146-second first-ready, 150-second respawn and 2.2-second
lead-up values. Root separately gives 1.5 seconds untargetable, while the source
emergence clip lasts about 1.6 seconds. The prepared profile keeps all three
clocks distinct. Riot's [26.1 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/)
publish the later 2:55 first-spawn baseline; that baseline does not prove the
legacy controller's active timing or callback flags.

## Rig review and validation

The pin contains 610,554 raw Map11 member bytes and 20,048 raw script bytes,
with 71 retained prototypes and 1,474 decoded instructions.

The base rig has 4,218 triangles, 66 bones, skinScale 0.75 and seventeen atomic
clips. These include idle, run, two fleeing clips, stun, hide, emergence, short
dash actions, turns, transitions and dance. The prepared clip labels come from
filenames and retain their original graph keys separately. Base skin 0 is a
local review choice; native forms, material/lighting, pose modifiers, graph
dispatch and effects/audio still require comparison.

The review now combines the existing Blue/Gromp pin with the separate Red,
wolf, raptor, Krug and Scuttler pins. All eleven characters load their actual
converted rigs on demand. Missing Root fields remain displayed as absent even
when a rig is available. The review retains retry, caching and late-load
selection guards. A character query opens Scuttler directly:

`/tools/qa/jungle-characters.html?character=Sru_Crab`

Reproduce with:

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-scuttler.py
node tools/assets/convert-roster-base.mjs Sru_Crab
PYTHONPATH=.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/export-scuttler.py
python3 tools/assets/test-lua51.py
```

Extraction repeats against the same pin. Numeric Lua table keys are normalized
to their JSON carrier spelling for repeat comparison; no source values change.
The GLB, manifest and prepared export reproduce byte-identically. Exact commands,
hashes, Chrome review results and remaining work are recorded in
[the verification ledger](reference/scuttler-source-verification.json).
Live peaceful patrol/flee behavior, coordinated spawn saves, shrine vision/speed,
full-match roles/objectives, native comparison and production certification
remain unfinished. The full project goal stays active.

All 1,171 checks across 230 files, TypeScript and the separate review typecheck
pass. All five focused character/map Chrome cases pass after correcting the
new hide-frame assumption. Diagnostic skinned bounds show a held below-ground
pose throughout sampled times; the review now explains that empty stage, and
the browser checks negative mesh height and zero pixels at this framing.
Idle/emergence each contribute more than 500 pixels, all seventeen clips retain
finite 66-bone matrices, and playback/rewind work. Three final captures were
visually reviewed. Production smoke and all GLB/map validators pass; the live
ruleset remains unchanged. The existing bundle-size warning remains.
