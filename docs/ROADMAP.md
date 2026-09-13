# Implementation roadmap and quality gates

This is the proposed execution order after the research/design phase. It does not indicate completed implementation. Build the eventual full 5v5 experience through independently reviewable milestones.

## Milestone 0 — reference and production foundation

Create the frozen rules manifest, reference ledger, content schema, asset provenance manifest, target-browser matrix, and benchmark hardware record. Establish the actual content/asset production route.

Prepare the TypeScript/Vite workspace, Three.js shell, diagnostics, local content loader, and headless scenario runner. Record a representative lane camera target and combat reference clips when available. Verify source fields rather than copying raw JSON directly into spell handlers.

**Exit:** a reproducible local build, a named benchmark device, a validated data sample, and a clear list of reference rules still unknown. No claim of playable fidelity yet.

## Milestone 1 — movement, camera, and attack feel

Build one polished lane segment with walls, brush, a turret, a champion, and a target dummy. Implement right-click movement, selection, attack move, stop, free/locked camera, range indicators, and basic attack states. Establish the provisional final material and HUD direction here.

**Exit:** repeated attacks, cancellations, and kiting behave correctly; no wall penetration; clicks and indicators agree with world coordinates; camera and HUD remain usable on both team orientations.

The unit may be a temporary reference rig, but visual fidelity cannot pass until its intended art and animation are present. Do not describe colored capsules as a finished art direction.

## Milestone 2 — two complete kits and a credible duel

Implement Ashe and Lux as research targets or their independently designed production counterparts. Complete every passive and ability, resource use, leveling, indicators, animation, effects, sound, and relevant item/rune interactions. Add one enemy tactical bot and a controlled minion wave.

**Exit:** a player can farm, trade, dodge, kite, cast through the correct targets, die, and restart without inconsistent combat state. Both kits pass their individual behavior matrices. Review gameplay footage as well as screenshots.

Parallel work within this milestone can include art production and mechanics implementation, but their interface is the same versioned ability timeline. Do not let animation and code invent separate hit moments.

## Milestone 3 — complete battlefield and match rules

Expand to all lanes, bases, jungle quadrants, structures, camps, and vision regions. Add economy, purchasing, recalls, respawns, inhibitors, and victory/defeat. Implement selected patch objectives and role systems incrementally with visible coverage tracking.

**Exit:** automated opposing teams can progress from initial spawn to a valid destroyed base. Offscreen lanes stay simulated. Ward, fog, brush, and targetability tests pass. A partial objective catalog remains explicitly labeled until finished.

## Milestone 4 — six-character local 5v5

Complete Garen, Master Yi, Leona, and Ahri research coverage or corresponding production content. Support all five roles with mirrors allowed, then add team planning, jungle routes, support actions, objective contests, and pushing after successful fights.

**Exit:** one human plus nine bots can play a full match. Each role functions. Bots obey team information boundaries and exhibit configurable reaction/aim limits. There are no recurring recall loops, suicidal turret paths, or unexplained motion toward hidden enemies.

Run at least 100 seeded headless matches as an initial regression suite. All must avoid crashes, invalid health/resources, and structurally impossible victories. Any match unfinished by a 60-minute simulation horizon is retained for diagnosis; the horizon is a test timeout, not a forced game rule. Track completion rates and duration distribution rather than hiding stalemates.

## Milestone 5 — presentation, browser reliability, and offline delivery

Complete the cohesive map art, rigged roster, effect library, combat sound mix, and match HUD. Add practice tools, replay, checkpoint saves, export/import, offline packs, and explicit failure/recovery states. Profile the real full-match stress fixture.

**Exit:** browser interaction and screenshot/video review pass; a cached match works with network disabled; imports reject incompatible versions; context loss recovers or offers a valid save; repeated matches do not accumulate undisposed assets. Meet the performance budgets or publish revised, measured device-specific limits.

## Milestone 6 — reference-mode audit and expansion

Finish all applicable role quests, objectives, vision variants, items, and selected runes for the frozen patch. Reconcile source changes and measured exceptions. Expand to ten distinct characters only after the match retains its earlier quality.

**Exit:** every advertised rule and content entry has a coverage status, and the supported reference scenarios pass. Present remaining deviations to the player where they affect expectations. A full-roster program follows this gate and repeats the same content tests per addition.

## Test cases that protect fidelity

| Scenario | Required property |
|---|---|
| Move during windup, then after release | Correct cancellation without deleting an already released missile |
| Repeated attack-move input | Movement does not bypass attack cooldown |
| Target dies before missile arrival | Explicit, stable target-loss behavior |
| Fast skillshot crosses a small target in one tick | Swept collision registers eligible hits |
| Returning missile hits in both directions | Separate outbound/inbound hit accounting |
| Dash or blink at a wall corner | Ability-specific landing/crossing policy is respected |
| Overlapping stun, root, and silence | Capabilities recover at correct times |
| Lethal damage and heal at the same timestamp | Documented event priority; no order-dependent resurrection |
| Enemy leaves vision | No mesh, health bar, minimap, selection, ordinary audio, or AI data leak |
| Attacker draws turret aggression | Correct transition and recovery under reference conditions |
| Inhibitor destroyed then returns | Correct target exposure and future wave composition |
| Buy recipe with owned components and limited space | Gold and inventory update atomically and consistently |
| Role reward changes inventory or level cap | UI and simulation use the same updated capacity policy |
| Save during projectile travel, then restore | Pending events and eventual state match uninterrupted simulation |
| Replay the same command log | Checkpoint hashes match within the certified runtime matrix |
| Tab becomes hidden then returns | Match time stays paused and held keys do not stick |
| First use of an ultimate after loading | No missing animation, sound, or unacceptable shader stall |
| Run several matches sequentially | Stable resource counts and no persistent-input leakage |

Use boundary scenarios and complete match invariants rather than tests that simply repeat implementation arithmetic. For visual correctness, DOM assertions are insufficient: capture the playfield, fog, aiming, a busy fight, the shop, death state, and result screen.

## Proposed repository shape

```text
src/
  app/                 boot, asset readiness, mode transitions
  input/               action bindings, pointer routing, command construction
  simulation/
    core/              clock, entities, PRNG, commands, events
    movement/          navigation corridors, local avoidance, dashes
    combat/            attacks, casts, projectiles, effects, damage
    vision/            occlusion, brush, wards, team knowledge
    match/             waves, structures, jungle, objectives, victory
    progression/       XP, gold, items, runes, role policies
    champions/         exception handlers over shared combat primitives
  ai/                  perception, team utility, role tactics, action execution
  render/              scene, camera, models, animation, materials, VFX, fog
  audio/               event mixer, priorities, visibility rules
  ui/                  HUD, minimap, shop, loadout, menus, settings
  persistence/         snapshots, replay log, migrations, exports
  diagnostics/         perf, scenario controls, inspection, capture hooks
content/
  rulesets/            normalized, versioned definitions and provenance
  manifests/           asset packs, hashes, dependencies
tools/
  reference/           source normalization and reconciliation
  assets/              validation, compression, size reports
  scenarios/           deterministic fixtures and match sweeps
tests/                 behavior, integration, browser acceptance
public/                optimized approved runtime assets and decoders
```

## Definition of a complete content entry

A champion is complete only when its kit rules, state transitions, timings, targeting, effects, animation, audio, HUD, tooltip values, bot behavior, save/replay behavior, and interaction scenarios all work. An item is complete only when its recipe, modifiers, passives/actives, restrictions, and purchases work. A map is complete only when its navigation, vision, objectives, structural progression, and minimap agree with its art.

## Planning effort

The appropriate planning scale is months with multiple production disciplines, not a weekend clone. This is an engineering judgment, not a sourced cost estimate. The full art pipeline and reference measurements are the largest schedule uncertainties.

The work needs gameplay engineering, AI/navigation work, technical art, character/environment art, animation, VFX/audio, and playtesting. A single developer can progress sequentially with purchased or commissioned assets, but coding speed does not eliminate the content workload.

Estimate delivery dates after Milestones 1 and 2 establish measured art throughput, combat implementation cost, and device performance. Until then, prioritize exit criteria over confident calendar promises.
