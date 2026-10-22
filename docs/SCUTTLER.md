# Rift Scuttler in the lane match

The same shared controller now runs in [ordinary Rift practice](RIFT-PRACTICE.md).
The lane-only milestone below retains its original source and validation scope.

The interim lane match now includes the base Scuttler rig and a shared river
controller alongside its twelve ordinary jungle camp calendars. Both initial
Scuttlers become ready at 2:55. After both die, each later clear schedules one
selected river 150 seconds after death. This advances the full-match goal;
jungle roles, Smite, epic objectives and native acceptance remain unfinished.

## Evidence and local policy

[The source preparation](SCUTTLER-SOURCE.md) pins both locators, five patrol
waypoints per river, boundaries, retained movement scripts and seventeen clips.
Root has `Special_Peaceful`: its damage/range fields do not establish an attack.
The live controller never opens an attack windup or retaliation cycle. Root base
health, defenses, movement, collision and last-hit rewards are retained: 1,550 HP,
42 armor/MR, 255 movement speed, 55 gold, 100 XP and four CS. Native level,
damage and reward modifiers are still unimplemented.

The 2:55 first-ready baseline comes from the pinned published 26.1 reference;
legacy settings instead say 146 seconds. The local adapter combines the legacy
2.2-second lead-up with Root's separate 1.5-second untargetability. At 60 Hz it
holds the source buried hide pose for 42 ticks, then plays emergence for the 90
protected ticks. The ~1.60000014-second source clip retains seven final ticks
after readiness unless damage interrupts it. Buried units cannot be picked or
shown by the health bar, hover or minimap. These derived alignments are local
policy; native callback and graph timing still require comparison.

Scuttlers bounce through the source waypoints inside the retained river polygons.
Navigation uses the source 100-unit pathfinding radius. Local behavior replans
every 30 ticks, grazes for 90 ticks and flees a visible attacker for up to 300
ticks after damage. Flee destinations use reachable river points; movement cannot
cross the polygon. Roots/stuns stop movement without postponing deadline cleanup.
Local recovery starts 300 ticks after the last damage and restores 3.5% maximum
health per second. Cornered dashes, taunts, melee/ranged component distinctions,
native regeneration conditions and full graph dispatch remain unfinished.

The retained legacy controller selects a river with a 1–100 draw: 1–50 chooses
dragon, with 25/75 thresholds after four repeated selections. Every death advances
the saved RNG and streak, including the first initial death. That first death
waits for its partner; only the second schedules a single later Scuttler. Native
feature flags and current callback activation remain unverified. Two independent
ordinary camp calendars would not preserve this coordination.

## Shrine and presentation

A champion team's kill creates a shrine at that river's source center. The local
adapter binds retained 90/0.3/2 effect-slot candidates to a 90-second shrine,
30% movement bonus and two-second exit linger. A 250-unit speed radius and
525-unit sight radius are explicit unverified local choices. Sight uses the
existing team fog and terrain/brush rules. Speed affects allied living champions,
adds to other percentage speed bonuses, survives saved reloads and clears on death.
Combat gating for the speed bonus is not yet implemented.

The world ring and minimap marker indicate the local area and ownership. They
are procedural aids, not reconstructed native shrine particles, model or audio.
The base source rig uses idle, run2, flee, stun and emergence clips; a cloned run
alias preserves run2. Death holds the source hide pose, which lies below ground,
for the clip's rounded 59-tick retention. There is no authored attack/death atomic
clip. Source shrine rendering, native hiding/death transition, later forms,
lighting, materials, sounds and pixel comparison remain open.

## Persistence and verification

Schema 97 introduced the controller state. Current schema 98 retains its initial
deaths, current IDs, selected side,
selection streak, pending death/ready ticks, shrines and speed buffs. Per-unit
state retains river, waypoint/direction, think/graze/flee and damage clocks.
Validation rejects crossed ownership, extra living Scuttlers, invented attacks,
invalid phases, early pending deadlines and duplicate or expired reward state.
Old schemas/fingerprints follow the existing incompatible-save handling.

Eleven Scuttler tests cover protected timing, all five destinations on each river,
river bounds, peaceful fleeing/control, exact checkpoint continuations, RNG
thresholds, first-pair coordination, repeated single spawns, rewards, both-team
vision/speed, linger/death, regeneration and grazing expiry under root.
TypeScript and all 1,182 tests across 231 files pass. Eight focused jungle Chrome
cases passed together; the Scuttler and Gromp emergence cases passed again after
the final visibility/deadline repairs. Real Lux attack and Binding input provoke
flee/root without health loss from Scuttler. GPU checks require more than 100 rig
pixels and 50 local shrine pixels. Hidden/flee/shrine/corpse-free pending saves
reload exactly, and the next selected river has one new full-health source rig.
Setup, lethal finishes and calendar jumps remain diagnostic.

The three live captures were visually reviewed. Their scope is readable local
integration; they do not establish native visual parity. Exact hashes, commands,
asset and production results are recorded in
[the live verification ledger](reference/scuttler-verification.json). The full
project goal remains active.
