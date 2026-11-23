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

## Milestone 4 — six-character local 5v5 (Completed)

Complete Garen, Master Yi, Leona, and Ahri research coverage or corresponding production content. Support all five roles with mirrors allowed, then add team planning, jungle routes, support actions, objective contests, and pushing after successful fights.

**Exit (verified on schema 184 / ruleset `1cf6e4e9…`):** one human plus nine bots play a full match on public Summoner’s Rift across all six champions and five roles, with configurable **Intro** / **Standard** bot reaction and aim limits, on-demand asset loading, and live Baron Nashor contests/empowered sieges. The 100-seed public regression suite passes (`hundredSeedInvariantGate: true`, 99 natural victories, 1 retained 60-minute diagnostic horizon on seed 75, 0 failures; see [100-seed ledger](reference/1cf6e4-public-milestone4-hundred-ledger.json)).

## Milestone 5 — presentation, browser reliability, and offline delivery (Completed)

Complete the cohesive map art, rigged roster, effect library, combat sound mix, and match HUD. Add practice tools, replay, checkpoint saves, export/import, offline packs, and explicit failure/recovery states. Profile the real full-match stress fixture.

**Exit (verified on schema 184 / ruleset `1cf6e4e9…` / pack `2fe8cc42…`):** deterministic command-log replay (`rift-match-replay` v1 with periodic SHA-256 state verification, keyframe seeking, `0.5×`–`4×` speed, and fail-closed version/ruleset import validation), Web Audio combat/feedback submix with `-6 dBFS` teamfight limiter (`rift:sound-mix:v1`), expanded 8-action Practice Tools, WebGL context-loss soft-depth cleanup + intact-world `Save match` offering + clean restore, and zero-leak sequential match disposal pass across **Google Chrome (`157.0.8103.78`), Firefox (`155`), and WebKit (`26.6`)** (`9/9` multi-browser acceptance cases + 8-capture visual review set + `.webm` video). Full `581.2 MB` (`1,432`-file) offline pack download, repair, version handoff, and network-off 5v5 boot pass (`1,494` service-worker responses, `0` errors), with Chromium Incognito RAM quota limits (`~6%` host RAM vs persistent profile storage) and full-match 6-champion 5v5 stress-profile budgets (`1.46 ms/tick` Node simulation mean, `135` median / `167` p95 draw calls, `261.6 MiB` post-GC production JS heap → revised `≤ 280 MiB` budget) documented and certified with `morluto/rea` (`rea-agents@6.10.1`). See [Milestone 5 report](MILESTONE-5.md) and [verification ledger](reference/milestone5-verification.json).

## Milestone 6 — reference-mode audit and expansion (Completed)

Finish all applicable role quests, objectives, vision variants, items, and selected runes for the frozen patch. Reconcile source changes and measured exceptions. Expand to ten distinct characters only after the match retains its earlier quality.

**Exit (verified on schema 185 / ruleset `e5e3cc7f…` / pack `e74775d9…`):** all five Season 2026 Role Quests (Top level `20` cap + `210 s` Teleport, Jungle `40`-treat Primal Smite `1,200`, Mid Tier 3 boots + `4 s` Empowered Recall, Carry **7th item slot** + `+2g` CS bonus, Support evolved World Atlas + `2`-Control-Ward capacity), full Epic Objectives (Voidgrubs + Voidmites, Rift Herald + Eye of the Herald summon, 6 Elemental Drakes, Elemental Rift transformation, 6 Dragon Souls, Elder Dragon *Aspect of the Dragon* `20%` execute, and Baron Nashor), Vision Variants (Farsight Alteration, Control Ward, `8` Season 2026 Faelights), a `58`-item catalog with uniqueness/actives/passives and Fountain Undo, editable Runes & Stat Shards, and **ten distinct champions** (`Ashe`, `Lux`, `Garen`, `Master Yi`, `Leona`, `Ahri`, `Darius`, `Vi`, `Ezreal`, `Morgana`) forming a zero-mirror 5v5 pass across unit, 10-champion roster contract, production subpath, offline pack (`1,519` files / `581.69 MB`, `1,518` SW responses), `960 s` 5v5 simulation (`57,600` ticks, `0` violations), and **Chrome (`157`) + Firefox (`155`) + WebKit (`26.6`)** E2E gates (`3/3`). All `158` advertised Patch 26.18 rules and content entries carry explicit coverage statuses (`49` `verified-behavior`, `34` `verified-data`, `75` `approximation`, `0` `unimplemented`) under **Pause → Reference & patch 26.18**, certified with `morluto/rea` (`rea-agents@6.10.1`, `12` Evidence records, bundle SHA-256 `7dbdfc6f…`). See [Milestone 6 report](MILESTONE-6.md) and [verification ledger](reference/milestone6-verification.json).

## Milestone 7 — reference-calibrated ten-champion full-match release (In progress)

Turn the existing ten-champion feature baseline into an independently measured,
credible full-match release before expanding the roster. Reconcile the frozen
Patch 26.18 reference ledger and all 75 recorded approximations; close
match-changing kit, objective, role, item/rune, vision, and bot discrepancies;
calibrate complete audiovisual timelines; and certify the actual shipped build.

**Exit:** current ten-champion zero-mirror 5v5 passes a minimum 100-seed,
60-minute-horizon cohort with zero invariant failures and at least 99% natural
Nexus victories, periodic saved-future/replay checks, twenty recorded human-input
full matches, the browser/resolution/offline/recovery matrix, and named physical
device performance gates. All mandatory evidence is present and pinned; no
unresolved P0/P1 defect or unsupported reference claim remains. Missing authorized
native references block fidelity certification rather than being counted as passes.

**Status:** acceptance work has begun; full certification remains open. REA
`rea-agents@6.10.1` was run locally on eight read-only staged sources with
networking disabled to inform the definition. That run was static research, not
a new runtime or native-fidelity certification.
See [Milestone 7 scope, dependencies, and acceptance gates](MILESTONE-7.md) and
[planning research receipt](reference/milestone7-planning-research.json).

The two-seed match reliability check passed on schema 186. See the
[verification ledger](reference/milestone7-verification.json).

## Milestone 8 — original roster and audiovisual validation (Completed)

Add five original champions, one per role, for a roster of 15. Finish their
playable kits, bot tactics, rigs, animation, effects, and sound. Verify the
original lineup in natural 5v5 matches and exercise saving, replay, and offline
restoration on the production build.

All five originals are playable in Practice and 5v5. Two natural 5v5
finishes passed 53 exact restores and 51 matching continuations on schema 187.
Chrome, Firefox, and WebKit passed production play, replay, and exact offline
restoration and export. REA captured the production chooser and match and
analyzed the game, rules, and offline worker bundles. See the
[Milestone 8 report](MILESTONE-8.md).

## Test cases that protect fidelity

| Scenario                                           | Required property                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| Move during windup, then after release             | Correct cancellation without deleting an already released missile        |
| Repeated attack-move input                         | Movement does not bypass attack cooldown                                 |
| Target dies before missile arrival                 | Explicit, stable target-loss behavior                                    |
| Fast skillshot crosses a small target in one tick  | Swept collision registers eligible hits                                  |
| Returning missile hits in both directions          | Separate outbound/inbound hit accounting                                 |
| Dash or blink at a wall corner                     | Ability-specific landing/crossing policy is respected                    |
| Overlapping stun, root, and silence                | Capabilities recover at correct times                                    |
| Lethal damage and heal at the same timestamp       | Documented event priority; no order-dependent resurrection               |
| Enemy leaves vision                                | No mesh, health bar, minimap, selection, ordinary audio, or AI data leak |
| Attacker draws turret aggression                   | Correct transition and recovery under reference conditions               |
| Inhibitor destroyed then returns                   | Correct target exposure and future wave composition                      |
| Buy recipe with owned components and limited space | Gold and inventory update atomically and consistently                    |
| Role reward changes inventory or level cap         | UI and simulation use the same updated capacity policy                   |
| Save during projectile travel, then restore        | Pending events and eventual state match uninterrupted simulation         |
| Replay the same command log                        | Checkpoint hashes match within the certified runtime matrix              |
| Tab becomes hidden then returns                    | Match time stays paused and held keys do not stick                       |
| First use of an ultimate after loading             | No missing animation, sound, or unacceptable shader stall                |
| Run several matches sequentially                   | Stable resource counts and no persistent-input leakage                   |

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
