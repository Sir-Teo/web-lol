# Lux Lucent Singularity: evidence and implementation contract

E now has a queued cast, flight, persistent zone, buffered free recast, area detonation, Illumination, independent slows, vision and saved continuation. Source Spell3, twenty static source particle layers, three moving detonation batches and four continuous field streams are used, and human selection supports Lux. Complete effects, matched native audio/visual calibration and full tactical/role AI remain unfinished. Lux's local policy also uses observed minion groups; see [LUX-BOTS.md](LUX-BOTS.md).

## Continuous field waves and sparks — October 23, 2026

Both source team fields now add the authored `WaveRight` stream and rising
`sparks`, with two fixed-capacity draws per armed field. Their animated rate
curves retain **126 wave births and 90 spark births** on the local 60 Hz grid.
Birth lifetime, velocity, emission offset, emitter position, tint and size sample
normalized emitter age; particle color and scale then sample each particle's own
normalized age. These clocks are separate. Per-axis probability tables use the
existing shared indexed birth chance. Seeded reverse seeks, saves and fog cannot
advance simulation randomness or restart the effect.

The deterministic rate adapter uses right-endpoint samples with compensated
summation, including the existing charged first-update birth. Probabilistic
rates are explicitly unsupported by this adapter. Shape axes/angles, source
drag, orbital velocity, initial/angular rotation, direction stretch, team tint,
source color lookup, the spark palette and its random 2×2 atlas remain retained.
All four emitters are ground-list camera quads with their authored pass and depth
policy. Nonlocal wave offsets stay in world axes; the spark stream uses the
captured cast frame. Root height, shared probability correlation, normalized rate
time, first dispatch, orbital radians and camera roll/direction composition are
local conventions awaiting native comparison.

The field wrapper uses the existing saved arrival clock. Detonation, cancellation
or victory immediately retires both motion batches with the field's static
layers. It does not expand source `particleLinger` into an invented 11.2-second
post-field effect. Native stop/linger behavior remains unverified. Inactive GPU
slots are zeroed, so reverse seeking and a fresh restoration retain identical
buffer bytes as well as rendered primitives. Textures remain shared session
resources when field geometry/materials retire.

Coverage rises from 23 to **27 of 65 emitter records**, with 38 deferred. Remaining
flight/field layers, rays, rotating beams, distortion and attached target-hit
capture are still required. The nonvisual sound-emitter binding is not certified
by the separate E audio controller. No new image files are needed: the source
small mote image is already prepared, while spark/palette images are shared.
All three runtime E profile JSON files now participate explicitly in the strict
ruleset identity. Saved fields remain schema 109; no combat state changed.

All 1,380 unit checks across 253 files and 19 targeted Chrome cases pass, along
with nested-path production smoke. Ten isolated frames use two emitter draws per
field; both team streams contribute pixels independently. The largest difference
from separate particle draws is one RGBA channel value in one byte. The live
armed-field graphics restoration matches every captured framebuffer byte; all
fourteen field geometry/material resources retire at recast.

Four fresh [normal-rules diagnostic matches](reference/lux-e-field-match-audit.json)
check 780,762 ticks and 220 exact checkpoint round trips. Every recorded sample,
winner and terminal tick matches `c8f85fe`. All complete saved states, including
cosmetic audio history, match after changing only the fingerprint. The four
victories remain within one hour; the 100-seed gate remains unmet.

[The field verification ledger](reference/lux-e-field-verification.json) records
source profiles, GPU/source checks, captures and diagnostic match comparisons.
The complete browser suite, native composition, full-match performance and
project-wide release gates remain open. Run `node tools/qa/verify-lux-e-field.mjs`
from the repository root to check the retained local evidence references.

## Finite source audio — October 23, 2026

All twelve E recordings now play from the pinned Lux base Wwise bank. The five
source events identify cast, delayed flight, two zone actions, detonation and a
flight stop. The source graph and unchanged float masters are recorded in
[the event inventory](reference/lux-e-audio.json) and
[decoder ledger](reference/lux-e-audio-decoded.json). The pinned vgmstream decoder
exports 44,100 Hz mono float32 PCM without normalization, resampling, expanded
loops or added fades; the twelve files total 5,029,948 bytes. Two hit masters
retain peaks above one. Source gain, existing local master gain and distance
attenuation are applied separately in WebAudio.

The flight action waits 100 ms. The zone has an immediate two-variant layer and
a separate action delayed by 500 ms. None of the recordings has embedded loop
markers, and all source containers play once. No infinite flight or zone loop is
invented. The source flight stop applies a 1.5-second linear fade at arrival or
local cancellation. A flight stopped before its delayed birth never plays.
There is no zone-stop event in this bank: cutting the finite zone layers at
local detonation/cancellation is explicit local policy. An early recast cannot
start a delayed zone layer after the zone is gone.

Schema 109 retains accepted cast positions, captured aim/release origins,
launch/arrival/hit clocks, global cosmetic dispatch ordinals and the actual
endpoint of a cancelled flight. Records retire 311 ticks after stop; active
zones keep their histories. Restore rejects missing/crossed owners and spells,
contradictory clocks, duplicate/future ordinals and invalid stopped endpoints.
Gameplay entity IDs, combat RNG, damage, mana, cooldowns, slows and vision are
unchanged. Cosmetic ordinal cycles satisfy the source global avoid-repeat
windows (cast 3/4, hit 2/3, flight and immediate zone 1/2). Initial ordering,
native Wwise PRNG/shuffle and priority/virtualization behavior remain unverified.

The controller resumes finite clips at their saved phase after mute, fog or
reload. Enemy audibility checks the current phase point; it cannot expose an
unobserved cast origin through a visible orb or vice versa. A failed asset load
keeps one synthesized cast cue; a successful retry suppresses the corresponding
late source cast. Global local voice caps are two cast/hit and four per flight
and zone layer, killing oldest equal-priority voices. Pause suspends AudioContext
time. Frozen victory tails advance only on that clock without changing the
checkpoint. Native script callback delivery, emitter attachment, bus mix,
listener, attenuation calibration and matched listening remain open.

All 1,375 unit checks across 252 files, 30 targeted Chrome cases and nested-path
production smoke pass. Four fresh normal-rules diagnostic matches check 780,762
ticks and 220 exact saved round trips. All recorded samples, winners and end
ticks match `843052c`; final gameplay fields match exactly after removing only
the schema/ruleset identifiers and new cosmetic history. All four victories
remain within one hour. These four seeds do not meet the 100-seed gate. The
malformed-windup finding was repaired before the final cohorts; earlier stopped
diagnostics are retained and excluded. The complete browser suite was not repeated.

[Verification and limitations](reference/lux-e-audio-verification.json) record the
current browser/source checks and [diagnostic matches](reference/lux-e-audio-match-audit.json). Complete emitter coverage,
full native presentation and the project-wide completion gates remain open.
Run `node tools/qa/verify-lux-e-audio.mjs` from the repository root to verify
the retained local evidence, source master hashes and diagnostic report references.

## Moving detonation particles — October 23, 2026

The source `motes_RAINBOW`, `motes1` and `Bokeh` emitters now add moving particles
to the existing detonation. The two streams retain rates of 140/200 per second
and source emission lifetimes of approximately 0.18/0.11 seconds. They use the
shared local 60 Hz Lux emission schedule, including first-update accounting,
which permits 23 and 20 births. The single Bokeh emitter begins forty particles
on the detonation update. Its authored atlas is **2×2 with four random frames**,
regardless of the texture filename's `4x4` suffix.

Each birth retains source lifetime/size/tint probability tables, shape rotations,
velocity, acceleration, drag, orbital velocity, lifetime scale/color and lookup
selectors. Birth random remains fixed through seeking and fog. Direction-oriented
quads use projected travel and the source velocity scale; uniform scaling uses
the evaluated X component. Closed-form constant-force/linear-drag motion matches
the existing local fixed-step integrator, including fractional seeks, without
integrating every particle from birth on each render.

The forty Bokeh spawn points use the existing uniform-area horizontal disk policy
at source radius 150, with no missing cylinder height invented. Cylinder flag 1
is retained but not interpreted; sampled launch velocity is not reoriented by a
guessed flag meaning. Shared birth correlation, disk distribution, radians-based
orbit, integration/attachment order and native random/cadence semantics remain
explicit local adapters requiring matched native evidence. The unnamed unity
source block is preserved and asserted unchanged rather than assigned a meaning.

Each emitter uses one fixed-capacity combined buffer, carrying independent tint,
lookup coordinates and atlas UVs for every quad. Capacity follows the source
birth budget (23/20/40); no per-particle mesh or material is allocated. Source
pass order, depth flags and source-alpha additive blending remain distinct per
emitter. Buffers reuse their capacity while live counts shrink, and their
geometry/materials retire with the owner. Images remain borrowed.

The longest sampled mote life can approach 1.6 seconds after a late birth.
The exporter therefore derives a conservative **108-tick** retained interval,
replacing this effect's prior 43 ticks. The change retains presentation only:
damage still happens once, the accepted slow expires on its original deadline,
and detonated zones grant no vision. Schema 108 fields are unchanged, while the
simulation fingerprint changes. Accepted bursts survive caster death and frozen
victory playback; no new gameplay epoch or random state is saved.

Coverage is now **23 of 65 emitter records**, with 42 explicitly deferred.
Flight/field motion, distortion, remaining static layers, target-hit capture and
source E audio remain required. The existing prepared mote image adds 7,381
runtime bytes; the Bokeh image is already shared with Final Spark. No new image
files were added. E now references thirteen textures, including nine prepared
`lux-e-` images totaling 175,881 bytes.

The [moving-particle ledger](reference/lux-e-moving-verification.json) records
source hashes, unit/GPU/browser checks, recovery captures and match comparisons.
Six controlled Chrome frames match separate particle draws in every RGBA byte;
the measured 0.15-second frame uses three draws instead of 81. All three layers
contribute pixels independently. These are local draw-count and equivalence
results, not FPS or native-composition certification. A 0.9-second live tail
restores the same buffers and framebuffer after real graphics loss. Enemy
particles suppress hidden draws and resume at their continued saved phase.

All 1,367 unit tests across 251 files and 31 distinct targeted Chrome cases pass.
The previous timeout case still requires slow expiry after sixty ticks and now
checks presentation retirement at the source-derived bound. Graphics loss,
enemy fog, saved phase continuation, owned disposal and frozen victory playback
retain their assertions. Nested-path production smoke casts/recasts E through
normal input and captures the moving burst, with nine selected new E textures
and no development hook. The fixture and production burst captures were reviewed.

Four fresh [match audits](reference/lux-e-moving-match-audit.json) check 780,762
ticks and 220 exact checkpoint round trips. Every recorded sample, winner and
terminal tick matches `3599bc0`; all terminal checkpoints match after changing
only the fingerprint. All four victories occur within one hour. The 100-seed,
full-match quality, native comparison, offline and performance gates remain
unfinished. Game/Three chunks are 778.49/658.75 KB with the existing warning.

## Static source particle adapter — October 23, 2026

The following initial milestone describes `3599bc0`; its 43-tick lifetime and
twenty-record coverage are superseded by the moving-particle increment above.

The temporary sphere and line perimeter have been replaced by selected static
source layers: five emitter records for flight, five for each team field, and
five for detonation. Two rate-two bursts produce six draws in flight and six
in detonation; a field uses five. The perimeter is the authored 480-triangle
`Lux_Base_E_Indicator` mesh with separate blue/red textures and source color
curves. Its measured inner/outer corner radii at scale twelve are approximately
302.697/366.644 units. The art has not been resized to the provisional gameplay
radius; its outer decoration is not a collision boundary.

The [complete pin](reference/lux-e-vfx.json) retains all six skin resource bindings,
65 emitter definitions, 37 losslessly decoded textures and two source mesh
identities from three skin-linked Riot BINs. The pinned patch manifest and archive
chunks retain provenance; repeated extraction verifies the recorded source bytes.
No naming cache is required. Unknown hashes remain explicit. The
[coverage inventory](reference/lux-e-particle-coverage.json) identifies the twenty
rendered records and all 45 deferred records. Moving motes/sparks/rays/spinners,
distortion, remaining static layers, target-hit capture and source E audio are
still required. This is not a completed E presentation.

Static births begin on the accepted flight, arrival or detonation update. A
stable phase/instance seed reconstructs source rotation, angular velocity and
multiplier offsets without simulation randomness. Source lifetime color/scale,
birth tint, uniform scaling, independent multiplier coordinates, locked-alpha UV
mode, palette product, source blend modes 0/2/4 and separate alpha factors are
retained. The shockwave includes its erosion texture and drive. Its feather
widths of one and slice width 1.5 remain explicit external defaults, as in the
existing particle adapter; the arithmetic has GPU checks but native E uniforms
and sampler state remain unverified.

The local attachment uses a source origin 100 units above terrain, the captured
cast direction and the existing Ry/Rx/Rz arbitrary-quad convention. The authored
perimeter is projected onto sampled terrain with a two-unit lift. Other quads
keep their source rotation and offsets. Ground display-list flags preserve
composition before ordinary world objects; billboard axes follow the camera.
Origin height, palette-row conversion, projection, phase dispatch and immediate
phase replacement remain local policies pending matched native captures.
Emitter/particle linger fields are retained in the pin but do not yet create
flight/field stop tails.

Enemy effects require observed centers, and individual triangles require all
three observed corners. Losing sight suppresses their draws without restarting
their saved phase. Restoring a phase reconstructs identical position, index,
color and multiplier buffers. Owned geometry/materials retire on phase changes
or expiry; source images and the source mesh template remain session-owned.
The renderer explicitly reads XYZ from Three.js interleaved attributes, preserving
the indicator's face UVs rather than interpreting packed UV values as positions.

The longest selected detonation layer lasts 0.7 seconds. Its conservative
43-tick retained interval replaces the old eighteen-tick temporary burst. The
existing zone fields still support exact continuation and terminal playback;
schema 108's layout is unchanged, while the simulation fingerprint changes.
No spell cost, cooldown, flight/zone timing, damage, slow, vision or bot policy
was changed. Terminal cancellation removes active fields without inventing a
detonation; accepted bursts finish on the separate result presentation clock.

Eleven textures are used by these layers, including three already shared source
images. The eight new runtime images total 168,500 bytes; the validated perimeter
GLB adds 29,532 bytes. All 37 prepared images total 463,485 bytes; unused images
are not requested by this adapter. Source-quality delivery/performance budgets
remain open.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-lux-e-particles.py
python3 tools/assets/export-lux-e-particles.py
node tools/assets/convert-lux-e-indicator.mjs
```

The [verification ledger](reference/lux-e-source-verification.json) records source
hashes, extraction/rebuild checks, unit/browser/GPU checks, production input and
reviewed captures. Color-product and blend checks establish this local adapter's
arithmetic; screenshots and source-data agreement do not certify native visual,
timing, attachment, audio or full-match parity.

All 1,360 unit tests across 250 files and 28 distinct targeted Chrome cases pass.
The GPU case checks all twenty materials' raw products and framebuffer factors;
gameplay cases cover phase restoration, source radii, enemy fog, disposal and
frozen result playback. The first browser run's interleaved-attribute defect and
GPU clear-color fixture correction remain recorded. Nested-path production smoke
casts/recasts E with real input, loads only the eight selected new textures and
source mesh, and keeps development hooks absent. Four captures were reviewed.

Four fresh [match audits](reference/lux-e-source-match-audit.json) validate 780,762
ticks and 220 exact checkpoint round trips. All recorded samples, winners and
terminal ticks match the wave-clear baseline; all final checkpoints match after
changing only the fingerprint. These four seeds are short of the 100-seed gate.
Game/Three chunks are 767.79/658.75 KB, with the existing warning. Full Chrome,
native comparison, browser performance and offline delivery remain unaccepted.

## Winning checkpoints and finite result playback — October 22, 2026

Continuing the retained seed-719 match beyond its one-hour diagnostic horizon
reached a Blue-team Nexus victory at **63:29.5**. The winning checkpoint failed
validation because an E flight still held the preceding tick’s position: a melee
kill ended the update before E’s separate flight/zone phase.

Nexus destruction now cancels E windups, flights and armed zones at the same
boundary that cancels ordinary projectiles. It preserves committed mana/cooldown
costs and cannot detonate a buffered recast afterward. Already-resolved bursts
retain only their unexpired presentation tail. A winning checkpoint rejects an
active E flight or zone; schema 108’s fields are unchanged, while the simulation
fingerprint changes as usual.

At `2feb4fd`, the result view advanced the temporary burst’s scale/fade on its
presentation clock and disposed its sphere/ring geometry and materials at expiry.
It does not advance simulation, damage, marks, slows, vision or the saved clock.
Repeated samples and a fresh restoration reconstruct the same initial burst.
Active flight/zone visuals are removed rather than inventing an explosion.

These are explicit local match-ending policies, not a native victory/E-particle
parity claim. The native E visuals/audio and their exact cancellation behavior
remain unfinished. [Verification](reference/match-end-lucent-verification.json)
retains the original failed checkpoint, source hashes, phase regressions,
browser export/disposal checks and fresh full-match diagnostics.

That milestone's checks included 1,340 unit tests across 248 files and 14 distinct targeted
Chrome cases. Four fresh extended matches validate 836,115 ticks and 234 exact
checkpoint round trips. Seed 719’s repaired winning state matches the original
continuation except for ruleset identity and cancelled E state; it still exceeds
the one-hour completion horizon. These checks do not certify native E effects,
full-match quality or the broader project requirements.

## Implemented lifecycle and provisional policies

Initial cast spends rank mana, starts the rank cooldown, captures rank/AP damage, cancels recall and unreleased attacks, and winds up for 15 ticks. Aim is clamped to 1100; self casts work. Lux E does not consume, recharge or grant Hawkshot charges. The flight travels at the explicit movement-component speed 1200 and does not collide with intervening units. It advances its first step on release, consistent with existing projectile scheduling.

Arrival starts the five-second zone deadline. The 310 source effect value is provisionally interpreted as radius, with target collision radius included at the boundary. An active zone refreshes its captured slow through the independent `lucent` contribution API. Leaving the undetonated field leaves a provisional 0.25-second slow; detonation applies the supported one-second slow. Refresh occurs before commands/movement and after flight processing, and detonation samples post-movement positions after ordinary projectile processing.

Repeated E commands during windup or flight buffer detonation for arrival. Recast costs no mana, does not restart cooldown, and neither interrupts a current cast (including R) nor recall. Hard stun and death still block commands; root does not. There is no extra minimum recast interval in this adapter. Multiple commands and timeout cannot cause multiple detonations. Native recast/HUD fidelity remains unaccepted.

An armed zone supplies unobstructed team vision at named radius 650. This adapter grants no flight vision or post-detonation sight. Damage is magic/area, ignores allies and structures, applies Illumination without consuming an existing mark, and follows shared shield/mitigation rules. Death during windup cancels E; death after release preserves flight, zone, timeout and effects. Explosion visuals now retain the selected source layers for 108 ticks and never reapply gameplay.

All timing/geometry choices above beyond explicit source fields and the supported post-detonation slow are provisional and require native comparison. In particular, lifetime measured from arrival, buffered windup recast, recast/recall/CC rules, circle boundaries, exit linger, source-death behavior and sight obstruction/tails are not established by the promotional clip.

Snapshot 43 preserves windup recast requests and each instance's origin, endpoint, flight position, source/team, captured damage/slow, arrival/deadline and detonation tick. It validates transit position against fixed-speed elapsed travel, radius-independent cast range, source ownership, unique active owner and global identity, compatible windup payloads and active/retained lifetimes. Dead sources remain valid.

The original temporary presentation used a small orb, a ground-following 64-segment perimeter and a brief fading burst, before the source adapter above replaced them. Static perimeter geometry is allocated once per instance and all geometry/materials are disposed on retirement. The inspected `artifacts/lux-e-zone.png` is a diagnostic fixture capture, not a native visual match. Cast events now carry champion identity so Lux E cannot play Ashe's Hawkshot source sample; Lux still uses temporary synthesized cast feedback.

Original E milestone validation: 566 source/simulation checks passed, including nine E cases spanning windup/flight/zone/burst saves, every resource rank, range/self cast, buffered/free recast, exit/reentry, timeout, R interaction, death, team vision and invalid persistence. Four focused Lux Chrome cases and eight audio cases passed, alongside production build and nested-path smoke. Those historical results did not repeat the full browser, full-match or performance suites; current result-boundary evidence is linked above.

## Frozen evidence

[reference/lux-e.json](reference/lux-e.json) retains the complete ability, root spell, slow/end buff records and recast spell from the hashed [CommunityDragon 16.18 export](https://raw.communitydragon.org/16.18/game/data/characters/lux/lux.bin.json). It also retains the complete E entry and original response hash from [Data Dragon 16.18.1](https://ddragon.leagueoflegends.com/cdn/16.18.1/data/en_US/champion/Lux.json). Standard parent values are used; the `cherry` mode override is excluded.

| Property | Supported source value | Interpretation |
|---|---|---|
| Damage | 65/115/165/215/265 + 0.8 AP | Named root damage and tooltip formula agree with Data Dragon and official 13.17 notes |
| Mana | 70/80/90/100/110 | Root mana array begins at rank one; no leading rank-zero slot |
| Cooldown | 10/9.5/9/8.5/8 seconds | Rank-one index is one in the root cooldown array |
| Cast | 0.25 seconds, Spell3 | Root cast duration and source animation name |
| Slow | 25/30/35/40/45 percent | Named root values; five-second zone duration |
| Post-detonation slow | 1 second | Named linger value plus explicit official 10.11 behavior |
| Cast range | 1100 | Root and Data Dragon agree |
| Missile motion | Fixed speed 1200, no target tracking | Explicit movement component; legacy root missileSpeed is 1300 |
| Vision | Named VisionRadius 650 | Missile perception bubble 750 is a different field and must not automatically become granted vision |
| Geometry | castRadius 295; unnamed fourth effect 310 | Data Dragon also carries 310; collision role and center/edge treatment need measurement |

[Patch 13.17](https://www.leagueoflegends.com/en-gb/news/game-updates/patch-13-17-notes/) independently corroborates the root damage formula. The recast record's legacy effect damage and 0.6 coefficient disagree with it; that record delegates its tooltip to the root and carries `Trait_FreeRecast`. It must not define a second damage formula. [Patch 10.11](https://www.leagueoflegends.com/en-us/news/game-updates/patch-10-11-notes/) explicitly establishes one additional second of slow after E2 damage. It does not establish an identical timer after simply walking out of an undetonated zone.

The 26.17 radius change to 350 and E-during-R change previously found are in **League Classic**. They are not standard-mode overrides for this pinned ruleset.

`python3 tools/assets/export-lux-e.py --check --verify-sources` verifies all retained records against their hashed cached responses and checks the generated [source profile](../src/content/lux-e.ts). Without `--verify-sources`, the command runs from committed records alone. Omit `--check` to regenerate. The exporter checks the child graph, delegated tooltip, root damage formula, movement type, and cross-source rank arrays. Unresolved geometry remains under distinct field names rather than being silently selected as gameplay truth.

## Official visual example

The [official champion page](https://www.leagueoflegends.com/en-us/champions/lux/) links the [E video](https://lol.dyn.riotcdn.net/x/videos/champion-abilities/0099/ability_0099_E1.mp4). Its retained hash and metadata identify a 1056×720, 30 FPS, 218-frame clip. The local original is `.cache/lux-e-reference.mp4`; analysis sheets are `artifacts/lux-e-reference-sheet.png`, `artifacts/lux-e-arrival-sheet.png` and `artifacts/lux-e-detonation-sheet.png`.

Frame inspection shows the orb visibly separating around frames 15–18, gradual ground-ring appearance around 34–38, a ring at frame 169, and an explosion at 170. These are presentation observations. The camera moves during flight; no world coordinates, gameplay build or input log are supplied. The clip cannot distinguish manual detonation from automatic expiry, establish a units-per-second speed, choose between radius fields, or prove which callback starts the five-second lifetime. Do not calibrate simulation deadlines from the visible ring onset alone.

The cached base-skin resolver identifies `Lux_Base_E_mis`, `Lux_Base_E_tar_aoe_green`, `Lux_Base_E_tar_aoe_red`, `Lux_Base_E_tar_aoe_sound`, `Lux_Base_E_tar_hit` and `Lux_Base_E_tar_nova` under `Characters/Lux/Skins/Skin0/Particles/`. These six resources are now pinned in the complete E particle record above; only the selected static layers are currently rendered. Ally/enemy ring choice, sustained sound, explosion and target hit effects must have distinct lifetimes; one generic projectile mesh is insufficient.

## Original integration contract and remaining audit

1. Add a saved, caster-owned E instance with explicit windup, flight, active-zone and retirement states. Capture aim, rank/AP damage, slow strength, source/team, launch and arrival ticks, lifetime deadline and a requested-detonation flag. Stable IDs must participate in snapshot identity validation. At most one active E instance belongs to a caster.
2. Clamp initial aim to the supported cast range and allow a zero-distance cast. Use the explicit movement component as the initial motion adapter, documenting that 1200 remains unmeasured. Other units must not consume the projectile as if it were Q. Decide and document the five-second timer anchor separately; the current evidence does not resolve it.
3. Make recast a distinct command path: no second mana spend or second damage formula, no accidental Hawkshot charge handling, and no cooldown rejection of the active spell's free recast. Determine flight buffering, windup buffering, minimum recast delay, permitted CC states, interaction with R/recall, and cooldown start from controlled evidence or explicit provisional policies. Do not inherit all initial-cast guards blindly.
4. The shared independent slow contribution system is now implemented; use `World.applySlow` with the `lucent` effect identity for persistent zone contributions. Legacy diagnostic `slowUntil`/`slowMultiplier` fields still exist, but E must not repeatedly overwrite them. Compute the strongest currently active slow, retain weaker effects until their own expiry, and combine with existing movement-speed caps. Test overlap with critical Frost Shot and independently owned zones.
5. Supply team-filtered zone vision independently of damage and presentation. Resolve obstruction, brush, flight sight and post-detonation sight duration explicitly; `mPerceptionBubbleRadius` alone is not authority for any of them. Bot observations must use the same team view.
6. Detonate exactly once on a permitted recast or timeout, using current enemy positions, excluding structures and allies, applying separately mitigated area magic damage, Illumination and supported post-hit slow. Determine circle-versus-target-radius semantics. A detonation and expiry on the same tick must not double-hit. Committed flight/zone death behavior and damage AP capture timing need explicit policies.
7. Integrate source Spell3, visible flight, team-appropriate zone perimeter, sustained sound, detonation/hit particles, cleanup and saved visual phase. Finish E input/HUD and tactical AI alongside the existing Lux selection work. Preserve the default Ashe path until champion selection is implemented.

## Acceptance scenarios

Test every rank's resources and damage; range clamp and self cast; early, late and repeated recasts; expiry-versus-recast ordering; free recast at zero mana and while initial cooldown is active; leaving/re-entering the field; entering after it is created; overlap and weaker-slow restoration; shield absorption; Illumination; caster and target death; hidden enemies and brush; R interaction; saved windup, flight, armed zone and detonation request. Repeated full matches must retire every zone, particle and audio voice. Source-data agreement and local regression tests must remain distinct from native timing and geometry evidence.

The core E lifecycle and supporting slow state are now implemented as described above. Remaining work includes the deferred source effects/audio, native input/HUD comparison, broader tactical/role AI and item builds, and native composition/timing calibration. The broader full-match design and production gates remain unchanged.
