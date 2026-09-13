# Development status

Last updated: September 13, 2026 (America/New_York).

**Goal remains active:** continuously develop the highest-quality, visually authentic League-like browser game, without an application backend, through small commits. The required final state is a verified production-level full match experience. This file describes progress toward that goal; it does not reduce its scope.

## Current authoritative state

Latest validation: 222 simulation checks, three focused Chrome scenarios, static build and production smoke pass at the effective movement-speed readout milestone below. The last full Chrome run passed all 71 scenarios at the preceding ammunition milestone.

- TypeScript/Vite/Three.js application boots directly into practice on the full reference Rift.
- Fixed-step, renderer-independent simulation with command handling, wall-aware navigation, ranged attack windup/release, homing attacks, swept skillshots, death, and respawn.
- Basic Ashe ability representations, minion waves, turrets, a local sparring champion, a target dummy, gold/XP, recall, and four purchasable items.
- DOM HUD, health bars, ability cooldowns, aiming, camera controls, minimap, menus, scoreboard, practice controls, and synthesized audio feedback.
- Archived Ashe model converted to GLB: 4,902 vertices, 7,406 triangles, 85 bones, nine retained animation clips. Native Three.js skeletal animation replaces the procedural champion silhouette.
- Team vision now accounts for terrain occlusion, brush, living allied observers, temporary attack reveals, and Hawkshot. Targeting, bot acquisition, render visibility, HUD, minimap fog, projectiles, and event feedback use the shared policy.
- Both teams’ source tower models now replace all 22 procedural structures, with exact source transforms and persistent rubble. Six inhibitors and two Nexus objects complete the base placements; lane dependencies, timed regrowth, and terminal local-game results are implemented.
- Eight animated minion assets now replace the primitive supporting units, using matching patch 16.18 meshes, rigs, textures, animation graphs, and authored scales. The runtime shares geometry/textures and clones skeletons per unit.
- Source revisions and SHA-256 hashes are recorded for imported art. The GLB passes the Khronos glTF validator with zero errors and zero warnings.
- The default playable now renders pinned Base_SRX terrain and vegetation with original BC1/BC3 blocks, authored mip levels, and a lossless WebP fallback. Source navigation, elevation, fountain spawns, three lane routes, timed barracks waves, and 22 turret positions are connected. The separate inspector retains its navigation overlay.
- Validation counts and exact scope are recorded in the milestones below. They cover the current practice build and map asset inspector, not a complete match.

The game is **not production complete**. No roadmap milestone that requires complete map/kit/reference fidelity is certified by this first playable.

## Historical baseline verification

The table below records the earlier baseline. Subsequent milestones below contain later test counts and validation scope.

| Evidence                  | Result                                          | Scope                                                                                                                                                                                                                                                                                                                     |
| ------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`           | TypeScript check and 55 simulation tests pass   | Attack cancellation/release, collision, navigation, last-hit attribution, atomic purchase rejection, deterministic identical inputs, occlusion/brush, shared sight, attack reveal timing, event visibility, source-grid clearance/gates, full-map routes, wave cadence, and fountain recall                               |
| `npm run test:browser`    | 26 Chrome scenarios                             | Existing practice interactions, minion lifecycle, full terrain loading, original compressed mips, BC1 alpha, both gzip-hosting conventions, navigation overlay, WebP fallback, full-map pointer/elevation alignment, movement/attack, exact fog-mask/query agreement, tower transforms/rig sharing, and persistent rubble |
| `npm run assets:validate` | 0 errors, 0 warnings                            | Fifteen character/structure GLBs, full map glTF, 278 hashed map resources, navigation payload, gameplay layout, and minimap; not certification of pixel parity                                                                                                                                                            |
| `npm run build`           | Static build succeeds                           | Bundles the application and local assets; not deployment or backend work                                                                                                                                                                                                                                                  |
| Browser screenshots       | Inspected at multiple viewports up to 1920×1080 | Full terrain, live lane combat, river aim, fountain placement, character visibility, HUD and shop presentation                                                                                                                                                                                                            |
| Built-game smoke check    | No browser errors or failed requests            | Full Rift loads; real movement/aim input; development diagnostics absent                                                                                                                                                                                                                                                  |

Browser tests save additional screenshot evidence into the ignored local `artifacts/` folder. They intentionally use real pointer and keyboard interactions; the diagnostics hook supplies observations and world-to-screen coordinates.

A short performance observation used Apple M5 Pro, Mac17,8, 64 GiB RAM, headless Chrome 152, 1920×1080, device scale 1. The practice simulation was advanced to 30 seconds, then 180 rendered frames were sampled. Observed frame intervals: median 16.7 ms, p95 16.8 ms, p99 16.8 ms; 11 live/persisting unit records, 173 draw calls, 214,102 submitted triangles. This is a small-scene observation on capable hardware, **not** certification of the full 5v5 budget or low-end devices. Reproduce a larger match fixture before drawing performance conclusions.

After the visibility change, the same small 30-second practice setup at 1920×1080 was sampled for 180 frames: median 16.7 ms, p95 18.6 ms, p99 19.1 ms. The 23 sampled fog updates cost median 1.7 ms and p95 2.4 ms. There were 11 unit records and 157 draw calls. Local evidence: `artifacts/vision-benchmark.json`, `artifacts/vision-30-seconds.png`, and hidden/revealed brush screenshots. This remains a small-scene observation, not a full-match performance gate.

See [vision policy](VISION.md) for source evidence, event semantics, and explicit remaining fidelity limitations.

## Fidelity debt that must remain visible

| Area            | Current limitation                                                                                                                                                 | Required direction                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Match scope     | Three-lane practice on full terrain with one sparring opponent                                                                                                     | Jungle, nine role-aware bots, complete objectives and a verified full-match route to victory/defeat                                      |
| Champion art    | Archived base Ashe, not a validated 26.18 asset set                                                                                                                | Matched reference captures, scale/orientation/material validation, current or approved content pipeline                                  |
| Environment     | Full terrain, source towers, Nexus and inhibitors integrated; missing camps and complete effects                                                                   | Import remaining building/camp models; complete effects, lighting, shader calibration, and region streaming                              |
| Minion art      | Matching 16.18 models; four source clips per ordinary minion and six per super minion                                                                              | Validate active match skin selection, attack impact timing, variant selection, VFX, camera-scale match, and full-wave reference captures |
| Camera          | Provisional perspective and scale                                                                                                                                  | Fit against reference gameplay screenshots at matched viewport/zoom                                                                      |
| Abilities       | Practice approximations; all abilities unlocked                                                                                                                    | Complete passive and Q/W/E/R, rank rules, charges, cast locks, travel/impact behavior, exact timing, animation/VFX synchronization       |
| Q               | Attack-speed buff and Focus, no full flurry/crit interaction                                                                                                       | Implement complete attack replacement and modifier semantics                                                                             |
| E               | Immediate circular reveal and fixed cooldown                                                                                                                       | Traveling vision, ammunition/charge timing, brush/reveal rules                                                                           |
| R               | Fixed damage/stun; no full travel-distance/splash rules                                                                                                            | Reference-accurate hit and CC semantics                                                                                                  |
| Summoner spells | Simple heal and obstacle-projected blink                                                                                                                           | Exact targeting, ally effects, wall rules, timing, rank/patch values                                                                     |
| Combat systems  | Simplified stats, status effects, growth, and mitigation                                                                                                           | Full typed modifiers, patch reconciliation, CC capabilities, item/rune interaction rules                                                 |
| Vision          | Source-grid occlusion and brush; elevated terrain fog; provisional sight radii; known-building state implemented, exact hidden-regrowth behavior needs calibration | Reference sight checks, building-knowledge/global-announcement calibration, wards, stealth/true sight, projectile-specific reveal rules  |
| Navigation      | Source-grid A*, cached radius clearance, swept capsule validation and authored lane routing                                                                        | Dynamic overlays, local unit avoidance, exact steering calibration, camp behavior                                                        |
| Bots            | One tactical sparring policy                                                                                                                                       | Per-role perception, team strategy, objective conversion, decision uncertainty, complete match QA                                        |
| Shop            | Four direct purchases                                                                                                                                              | Recipes, sell/undo, full builds, role-specific capacity, passives/actives, runes                                                         |
| Audio           | Synthetic feedback tones                                                                                                                                           | Reference-aligned event timing, real impact/ambient/voice assets, perceptual hierarchy                                                   |
| Persistence     | Snapshot serialization only                                                                                                                                        | Validated restore/import, command replay, IndexedDB saves, cache lifecycle, offline reload                                               |
| QA              | Chrome practice, full-map, and inspector coverage                                                                                                                  | Firefox/Safari, larger stress fixtures, long-match soak, context restore, complete content and match gates                               |
| Distribution    | Riot reference assets have provenance, no distribution authorization                                                                                               | Resolve the final asset/content rights before a production release                                                                       |

## Next implementation priorities

1. Reconcile all lane minions’ base stats, timed upgrades, economy, attack timing, and wave cadence after the super-wave foundation. Import camps and extend the building dependency/result foundation into complete-match behavior.
2. Calibrate known-building state, implement wards/stealth and ability-specific reveal rules. Calibrate camera, fog, shaders, and scale against matched reference captures; reduce large-scene rendering cost.
3. Replace the ability approximations with a versioned ability timeline/state model and complete Ashe behavior, then implement a second full kit.
4. Extend the three-lane test harness toward role-aware match simulation, preserving the tested input/combat boundaries.

## Asset investigation notes

The CommunityDragon 16.18 directory supplied mesh/texture references but returned HTTP 404 for the referenced Ashe skeleton and `.anm` files. The archived `tengge1/lol-model-viewer` repository at commit `ef5635c5fbe0c315275c9bcccf83558cfe7ee436` supplied a complete matching mesh/animation/texture set. The converter reads that archived format and writes GLB, baking coordinates and validating normalized joints and animation transforms. It does not run legacy viewer code inside the app.

Rebuild this asset with `node tools/assets/convert-ashe.mjs`, then run `npm run assets:validate`. This is a local development command that fetches the explicitly pinned source. Hash validation prevents accidental output drift.

`lol2gltf` was also built locally under ignored `.tools/` using a local .NET SDK for future current-format/map investigations, but it was not used for the archived Ashe conversion and is not a runtime dependency. The initial ImageSharp dependency warnings were resolved by the 3.1.12 update described below.

## Matching minion asset milestone

[Asset pipeline](ASSETS.md) records the pinned release, extraction/conversion workflow, source graph mappings, and remaining calibration gaps. The extractor obtained 88 matching files using 3.10 MB of CDN archive chunks from the 2.49 GB map WAD. Rebuilds validate pinned source hashes; all seven GLBs pass with zero errors/warnings. The six minion assets add about 2.9 MiB of static files, with no runtime external requests.

Browser screenshots verify all six models facing both directions, their relative authored scales, and the corrected health-bar positions. The new browser scenarios verify independent mixers, full death playback through two seconds and subsequent removal, and immediate idle animation after a cancelled windup. Nineteen simulation tests, eleven Chrome scenarios, and the static build pass. This does not certify full minion combat or pixel parity.

The lol2gltf tool is now used for these matching minion sources. Its direct ImageSharp dependency was updated to 3.1.12 before rebuilding, removing the previous vulnerability warnings; the conversion still runs only during asset authoring.

A 96-minion rendering fixture (stationary units, AI disabled, vision active; Chrome 152, 1920×1080, Apple M5 Pro) sampled 180 frames after 45 warmup frames: median 16.7 ms, p95 24.1 ms, p99 24.8 ms, 229 draw calls and 427,572 submitted triangles. This exposes remaining large-scene performance work; it is not a full-match frame-budget pass. Per-unit skeleton textures are now explicitly disposed on removal, with a browser regression check preserving surviving models and shared geometry. Local evidence: `artifacts/minion-render-benchmark.json`.

## Full terrain asset milestone

[Map pipeline and audit](MAP-ASSETS.md) documents the explicit Base_SRX/default-layer selection, matching AIPath_SRX_3 grid, current-format converter patches, and 184 hash-pinned sources. The terrain artifact contains 645,491 triangles and 137 full-resolution textures. Native DXT loading preserves the original compression blocks and mip levels, requires 327.42 MiB of texture GPU storage, and avoids decoding every texture to RGBA. The standard lossless WebP fallback is also browser-tested.

The navigation exporter validates 87,320 cells and 350,463 height samples. Inspection screenshots show the navigation overlay aligning with base object cutouts, brush, river edges, and walls; the playable now uses this grid for movement and sight. The textured intermediate rebuild is byte-identical with the frozen minimal path table. All 19 simulation tests, 13 Chrome scenarios, asset validators, and the two-page static build pass.

An isolated terrain-only measurement at 1920×1080 on Chrome 152 / Apple M5 Pro sampled 180 frames after 45 warmup frames per viewpoint. Overview: median 16.7 ms, p95 17.7 ms, 198 draw calls, 645,491 triangles. Mid lane: median 16.7 ms, p95 17.3 ms, 78 draw calls, 174,365 triangles. Both retained 138 GPU textures. This has no combat simulation, units, or full-match effects and is not a match-performance certification. Evidence: `artifacts/map-render-benchmark.json`.

Remaining visible terrain gaps include missing map-placeable buildings and VFX, approximate dynamic shaders, provisional grass tint/camera calibration, omitted procedural Faelights indicators, and unimplemented terrain overlays. The full production objective remains active.

## Full-map gameplay integration milestone

The default page now loads the same terrain as the inspector and uses the frozen gameplay layout described in [MAP-ASSETS.md](MAP-ASSETS.md). Camera picking, unit feet, health bars, targeting, and ground indicators account for source elevation. All three lanes spawn both teams on the authored barracks cadence and follow the source routes. The old small scene is explicitly selected with `/?scene=fixture` in development so its regression scenarios remain reproducible.

The simulation retains deterministic A* queries and exact swept capsule checks against grid rectangles. Range filtering before expensive visibility queries avoids repeated full-map rays during target acquisition. Fog computes the union of observer-local samples, preserving exact agreement with the simulation at every sampled position while doubling its resolution from 128 to 256.

A 90-second three-lane run on Apple M5 Pro / Chrome 152 at 1920×1080 sampled 180 frames after 45 warmup frames. There were 101 live/persisting unit records, 260 draw calls, and 313,510 submitted triangles. Before optimization, simulation steps cost median 3.1 ms / p95 4.1 ms; after optimization they cost median 0.2 ms / p95 0.3 ms. Fog updates at the higher resolution cost median 6.2 ms / p95 7.1 ms. Frame intervals remained median 16.7 ms, p95 23.5 ms, p99 25.4 ms. This is **not a full-match performance pass**: frame tails still miss budget, and nine complete bots and final effects are absent. Local evidence: `artifacts/rift-before-vision-optimization.json`, `artifacts/rift-90s-benchmark.json`, and `artifacts/rift-90s-playable.png`.

Current validation: 31 simulation scenarios, 16 Chrome scenarios, zero asset validator errors/warnings, and a passing static production build. A separate preview smoke check loaded the built default game without browser errors or failed requests, exercised actual movement/aim input, and confirmed that the development hook is absent. The goal remains active; full kit, match, art, device, persistence, and performance gates remain outstanding.

## Tower presentation milestone

Both tower assets are imported from the matching frozen release, preserving separate intact, damaged, broken, and rubble parts. All 22 runtime placements retain their full authored matrices, including the source heights and rotations. The renderer uses one independent rig per tower, shares its rig among its submeshes, and keeps shared geometry/textures across units. Destroyed structures persist as inert rubble instead of disappearing with the minion cleanup window.

The complete suite now passes 32 simulation and 19 Chrome scenarios. All nine model GLBs and the terrain pass asset validation with zero errors/warnings; the static build succeeds. The new scenarios verify every placement matrix, initial part visibility, independent rigs, persistent rubble for both teams, dead health-bar hiding, and per-unit GPU cleanup. Intact and rubble screenshots were visually inspected in the full terrain. Full destruction/VFX sequencing, damage stages, attack attachment, respawn rules, and building memory remain unimplemented; this is not certification of tower gameplay parity.

The full-map performance observation is now reproducible with `node tools/qa/benchmark-rift.mjs` against a running development server. It records machine/browser details, advances the world to 90 seconds, runs 45 warmup frames, and samples 180 frames with live simulation. Run it without concurrent browser tests or other heavy tasks; outputs are `artifacts/rift-benchmark.json` and `.png`. This remains a three-lane practice fixture rather than a complete 5v5 gate.

With the source towers, the 90-second fixture on Chrome 152 / Apple M5 Pro / 64 GiB at 1920×1080 recorded 101 unit records, 224 draw calls, and 383,730 submitted triangles. Across 180 sampled frames: median 16.7 ms, p95 21.5 ms, p99 25.3 ms. Simulation steps cost median 0.2 ms / p95 0.3 ms; the 22 sampled fog updates cost median 4.3 ms / p95 4.5 ms. Frame tails still miss a consistent 60 FPS budget. These timings are observations on the stated machine, not a low-end or full-match certification.

## Base structures and progression milestone

[Structure policy and assets](STRUCTURES.md) records the source data, dependency rules, supported transitions, and remaining fidelity gaps. Both Nexus models and both inhibitor models are now integrated at all eight source transforms. Base statistics replace the generic tower values in the default Rift. Protected structures reject both target acquisition and damage; cleared lanes expose inhibitors and Nexus defenders, and a fallen Nexus produces a non-resumable local result. Inhibitors and Nexus turrets return in place on their configured deadlines.

The current suite passes 39 simulation and 23 Chrome scenarios, including real pointer-driven victory, bot-driven defeat, animation continuation behind the result dialog, and a clean restart. The final Nexus-killing melee attack also stops the remainder of its live simulation tick. A fresh built-game smoke check passed with no failed requests or browser errors and no development diagnostics exposed. Source models and terrain pass asset validation with zero errors/warnings, and the static build succeeds. Base, destroyed-inhibitor, and result screenshots were visually inspected; floating combat feedback is hidden over the result dialog.

This is a base progression foundation. Super waves, plates, structural gold distribution, siege/backdoor modifiers, regeneration thresholds, complete animation/VFX sequencing, static building memory, camps, and nine role-aware bots remain incomplete. No full-match production gate is claimed.

The base-structure run of the same 90-second benchmark recorded 109 unit records, 232 draw calls, and 406,116 triangles on Chrome 152 / Apple M5 Pro / 64 GiB at 1920×1080. Across 180 frames after 45 warmup frames: median 16.7 ms, p95 22.3 ms, p99 27.4 ms. Simulation steps cost median 0.2 ms / p95 0.3 ms; 22 fog updates cost median 5.4 ms / p95 5.8 ms. Frame tails remain above budget, and this fixture still lacks nine full bots, camps, and complete effects. Instrumentation excludes warmup; these measurements are observations, not a claim of improvement over earlier runs.

## Super-minion foundation milestone

[Minion source and rules audit](MINIONS.md) records the selected Summoner’s Rift CharacterRecords, source models, wave rules, and unfinished mechanics. Downed inhibitors now produce lane-specific super waves, including two supers per lane when all three are down. New waves sample inhibitor deadlines consistently; already queued units keep their composition. Super minions use their larger radius for spawn projection and navigation, their own base stats and melee attacks, and separate starting rewards. Negative resistance now amplifies damage through a finite branch.

The source death clips exceed the former four-second cleanup window. Clip durations are recorded by the converter and become a simulation retention floor so both super-minion death animations finish. The runtime keeps independent rigs and does not remove a surviving minion’s resources when another dies.

Current validation is 46 simulation scenarios, 25 Chrome scenarios, zero errors/warnings across fifteen model GLBs and the full map, and a passing static build. The browser scenarios inspect both team models, source clip catalogs, full death playback, and cleanup; intact and death screenshots were visually inspected. This is not a full-match or pixel-parity certification. Timed stat upgrades, complete economy, minion aura, regeneration, attack impact calibration, pre-regrowth super cutoff, and timed wave-interval overrides remain unfinished. The production goal stays active.

A fresh production preview smoke check also passes with real movement/aim input, no browser errors or failed requests, and no development diagnostics exposed. Both super-model outputs and the gameplay layout reproduce byte-identically.

## Timed lane cadence and rewards milestone

The default Rift now applies the documented 25-second and 20-second wave intervals after 14 and 30 minutes. The scheduler retains elapsed progress toward a wave across transitions and keeps explicit wave suppression intact. A tick-by-tick 31-minute clock scenario checks both boundaries; precise phase alignment still awaits reference capture.

Six ordinary minion Root records and their source hashes are frozen and verified against upstream. Both teams now receive 350 starting movement speed, the source timed movement increments for newly spawned minions, and distinct initial gold/XP rewards. Combat initialization, HP/damage growth, on-hit effects, and shared economy remain incomplete. The new reward checks also exposed and fixed a unit-creation bug where spreading a position object could overwrite identity/team/class with fields from another unit.

The simulation suite passes 51 scenarios. The work continues toward full minion reconstruction, static-building vision, and the larger complete-match gates; this milestone does not certify those unfinished systems.

The 25 Chrome regression scenarios, static build, asset validation, and built-game smoke check also pass. All six upstream minion files match their recorded hashes, and the generated layout/source snapshot rebuild byte-identically. Full minion combat and exact reference transition phases remain outstanding.

## Known buildings under fog milestone

Enemy buildings now remain visible under the same fog shading as terrain, filling the source terrain cutouts. The simulation retains separate per-team intact/destroyed knowledge; live sight still governs picking, health bars, targeting, and combat events. Known intact buildings appear on the minimap. Hidden regrowth keeps the remembered destroyed representation until the building is observed, then preserves its newly observed intact state after sight is lost. Snapshot version 4 retains that knowledge.

The shared fog shader computes world positions after skinning, so structure meshes and source matrices agree with terrain fog. Before/after full-base screenshots and hidden-regrowth screenshots were inspected in Chrome. Simulation checks now total 55 scenarios. Exact reference knowledge/announcement behavior and broader vision systems remain unfinished; the production goal stays active.

All 26 Chrome scenarios and the static build pass for this milestone. The 90-second full-Rift benchmark on Chrome 152 / Apple M5 Pro / 64 GiB at 1920×1080, with 45 warmup frames and 180 samples, records 109 unit records, 318 draw calls, and 554,586 triangles. Frame intervals: median 16.7 ms, p95 23.3 ms, p99 28.1 ms. Simulation steps cost median 0.2 ms / p95 0.4 ms; 22 fog updates cost median 6.3 ms / p95 7.8 ms. Retaining known enemy structures increases submitted geometry; this does not pass the full-match frame budget. Animation-aware building bounds and offscreen culling are a concrete next rendering task. These timings are a scoped observation, not a controlled comparison with older fixtures.

The fresh production preview smoke check passes with no browser errors or failed requests and no development diagnostics exposed.

## Building culling milestone

All six structure references now receive conservative bounds covering their imported animation tracks and ordinary blends. Cloned building meshes use native gameplay/shadow frustum culling. Unsupported rigs keep culling disabled. Knowledge under fog and offscreen simulation are unchanged. See [structure bounds and verification](STRUCTURES.md#animation-aware-rendering-bounds).

Validation passes 61 unit/scenario checks, 27 Chrome scenarios, and the static production build. The new browser check covers 10,231,059 sampled deformed vertices and 14 byte-identical frozen framebuffer comparisons with culling enabled/disabled. The production preview loads without errors or failed requests, exercises movement/aim input, and exposes no development hook. The benchmark screenshot was visually inspected.

The 90-second live fixture now submits 249 draw calls and 394,575 triangles on Chrome 152 / Apple M5 Pro / 64 GiB at 1920×1080. Across 180 frames after 45 warmup frames, median frame interval is 16.6 ms, p95 24.0 ms, p99 29.2 ms. Simulation p95 is 0.4 ms; 22 fog updates have p95 7.4 ms. Geometry submission is lower, but this run does not demonstrate an improvement in frame tails or meet the full-match performance gate. The controlled frozen-view test isolates the draw-call saving; comparisons with earlier live runs are subject to scheduling variation. Fog-update scheduling and the remaining complete-match systems still need work. The production goal remains active.

## Exact fog cache milestone

The renderer now reuses exact terrain-ray results for unchanged observers. Moving or expired sources are evicted; changed sight geometry invalidates results through an explicit battlefield revision. The union still samples the same 256×256 positions every eight ticks. No gameplay query reads the cache. See [fog reuse and invalidation](VISION.md#exact-fog-sample-reuse).

All 64 unit/scenario checks, 28 Chrome scenarios, the static build, and the fresh production preview smoke check pass. Eight full-map transition states produce identical cached/uncached RGBA masks, and the independent source-brush comparison still agrees with simulation visibility at all 65,536 samples. Tests cover terrain revision changes and mutable queries without a revision as well as movement, overlap, radius, death, and expiry.

The live 90-second fixture on Chrome 152 / Apple M5 Pro / 64 GiB at 1920×1080 records fog median 1.4 ms / p95 2.0 ms / p99 2.5 ms over 22 updates. Across 180 frames after 45 warmup frames, frame median is 16.7 ms, p95 18.9 ms, p99 23.9 ms; simulation p95 is 0.4 ms. There are 109 unit records, 247 draw calls, and 394,551 triangles. This is a scoped run, with scheduling variation relative to the previous run; the stationary-observer unit check independently proves repeated rays are eliminated. Frame p95 still exceeds the 16.7 ms target, and the complete roster, nine bots, camps, effects, and full-match gates remain unfinished. The goal stays active.

## Minion turret-attack damage milestone

Rift basic attacks now apply the published minion-to-turret multipliers: 60% for melee/caster/super and 84% for siege, followed by armor mitigation. The values are pinned in the explicit rule overrides and exported into the gameplay layout. One shared hit path handles melee release and ranged impact, preserving projectile release AD and attacks arriving after the source dies. Other victim types, champion attacks, and direct non-attack damage remain independent.

All 75 unit/scenario checks and 28 Chrome scenarios pass, as do the static build and fresh production preview smoke check. The layout, provenance snapshot, and minimap regenerate byte-identically. Eleven new combat scenarios verify both teams and all four types, resistance composition, single application, source death, post-release AD changes, and target/effect exclusions. This corrects a lane-pushing discrepancy; full minion stat initialization/scaling, Minion Slayer, turret defenses/aggro, and complete-match fidelity remain unfinished. No new performance claim is made for this change. The goal remains active.

## Melee health progression milestone

Melee minions now use their frozen 430 base HP and barracks health upgrades: +35 per completed 90-second period, with the source 1,120 bonus cap. Health is computed at creation and initializes both current and maximum HP. Existing living units retain their health across deadlines. The cap interpretation and precise spawn-time policy remain awaiting controlled reference capture; other minion stat families and on-hit effects are unfinished. See [melee health policy](MINIONS.md#melee-health-progression).

All 79 unit/scenario checks, 28 Chrome scenarios, the static build, and the fresh production preview smoke check pass. The six upstream ordinary-minion records match their frozen hashes. Layout and provenance regenerate byte-identically. Four new scenarios cover both teams, exact timer boundaries, the cap, living damaged minions, source-record immutability, and all 18 melee units of a real queued three-lane wave. The production goal remains active.

## Browser interruption and graphics recovery milestone

Graphics loss now enters a blocking recovery dialog instead of a toast with a resumable simulation. Lost/restoring/failed states reject menu bypasses and pause gameplay until assets and restored shaders are ready. Warmup cancellation and generation checks prevent a stale completion from clearing a newer loss. Focus loss, hidden-document events, and initially hidden pages also pause with cleared held input and queued commands. Resume remains explicit. Dialog focus prevents a Space key held across an interruption from activating restart or resume. See [recovery behavior and limits](RECOVERY.md).

Validation passes 79 unit/scenario checks, a full 34-scenario Chrome run, and the subsequently added initially-hidden startup scenario in isolation (35 current Chrome scenarios total). The final static build and production preview smoke check pass without errors or failed requests. Real WebGL extension loss/restoration, repeated loss, loading interruption, injected warmup failure/retry, and stale warmup completion are covered. A frozen full-Rift framebuffer is byte-identical after restoration, and snapshots remain unchanged until resume. Recovery/restored screenshots were inspected. Focus/visibility handler tests use controlled events and are not operating-system/browser-matrix certification. Reload-safe saves, persistence, broader reliability testing, and complete match/content fidelity remain unfinished; the goal stays active.

## Manual match checkpoint milestone

The pause menu now saves one local checkpoint per battlefield. Reloading a compatible build restores the simulation and remains paused; restart clears that checkpoint. Writes report success only after their IndexedDB transaction completes. Failed writes preserve the previous save, and incompatible saves are retained with a notice. Snapshot version 5 validates gameplay state and a ruleset fingerprint before restoration. See [checkpoint format and limits](SAVES.md).

Validation passes 92 unit/scenario checks and the production build. The full Chrome run passed 37 cases and exposed one outdated pause-menu focus expectation; the corrected focus case and all three checkpoint cases then passed together. The final three checkpoint cases passed again after error-message handling changes. The production save/reload smoke check passes without browser errors and without the development hook. The restored pause screen was visually inspected. Browser tests now own port 5198 and reject an existing server, preventing accidental attachment to another project's app.

These checks cover exact simulation continuation, an aborted storage transaction, incompatible-save retention, and explicit resume/restart. Autosaves, migrations, export/import, offline assets, and cross-browser replay guarantees remain unfinished, alongside the broader match and content fidelity work. The production goal remains active.

## Lane-minion current-health damage milestone

Ordinary minion attacks now add the pinned item ratios of the opposing lane minion's current HP: 2% melee, 3.5% caster, and 5% siege. Both teams' source inventories resolve through frozen 16.18 item definitions into the gameplay layout. Ranged attacks read current HP on contact while preserving release AD, including after source death. The combined physical hit resolves once. Physical composition and precise pre-hit sampling remain explicit policies awaiting matched reference capture; the primary data establishes the ratios and eligible victim class. See [source evidence and combat boundaries](MINIONS.md#minion-current-health-on-hit-damage).

All 103 unit/scenario checks, all 38 Chrome scenarios, the static production build, and the production preview smoke check pass. The six frozen item/tooltip records match upstream hashes and data. Layout, provenance, and minimap exports reproduce byte-identically. The production screenshot was inspected; no new rendering or performance claim is made. Eleven new combat scenarios cover both teams, all ordinary source types and lane-minion victim types, armor, impact-time health changes, source death, repeated attacks, exclusions, and one-time lethal resolution.

This closes a missing lane-combat contribution. Full minion initialization and scaling, turret-specific damage received, siege mid-lane attack speed, super-minion effects, complete champion/bot/objective systems, and pixel-level reference comparison remain unfinished. The production goal remains active.

## Siege mid-turret attack speed milestone

Siege minions now receive the source item's 30% attack-speed bonus when attacking a mid-lane turret. The exported pinned value drives both windup and repeated attack cadence without modifying baseline stats. Target switching samples the next attack's eligibility without rewriting the existing cooldown. Animation playback uses the same multiplier and rounded period, including the existing Ranger's Focus multiplier. See [timing policy and source evidence](MINIONS.md#siege-attacks-against-mid-lane-turrets).

All 107 unit/scenario checks, all 39 Chrome scenarios, the static build, and the production preview smoke check pass. The new browser scenario verifies both siege rigs against mid and top turrets, comparing actual animation duration to scheduled combat duration. Four simulation scenarios cover both teams, repeated release timestamps, lane/class/victim exclusions, target switching, and immutable baseline timing. Layout, provenance, and minimap reproduce byte-identically.

This corrects a missing siege-pushing modifier. Exact reference windup, complete minion stat initialization, future attack-speed stacking, turret-shot damage rules, full match systems, and pixel-level fidelity remain unfinished. No new performance claim is made. The production goal remains active.

## Turret damage against minions milestone

Turret basic attacks now replace ordinary AD with the pinned item-tooltip fraction for the minion victim and authored turret tier: melee 45%, caster 70%, super 7%, and siege 14/11/8% for outer/inner/base turrets. The exporter parses the frozen tooltip phrases and fails on changed source wording. The item reference now includes Super Mech Armor. Maximum-health sampling at impact and physical mitigation are explicit runtime policies awaiting matched reference capture; tooltip fractions alone do not prove server ordering or resistance treatment. See [damage table and boundaries](MINIONS.md#turret-attacks-against-lane-minions).

All 118 unit/scenario checks, all 39 Chrome scenarios, the static production build, and the production preview smoke check pass. Eight selected item/tooltip records match upstream data and file hashes. Layout, provenance, and minimap exports reproduce byte-identically. Eleven new combat scenarios cover both teams, all turret roles and minion classes, varying HP and armor, wounded targets, source death after release, ordinary damage-path exclusions, and one-time lethal resolution. Zero-armor last-hit windows leave melee minions at 10% after two shots and kill casters on the second shot.

Turret armor penetration, exact reference damage ordering, super-minion aura effects, complete minion initialization, the remaining champion/bot/objective systems, and pixel-level reference comparison remain unfinished. No new performance or full-match parity claim is made. The production goal remains active.

## Scheduled attack animation milestone

Attack cycles now retain their start and end ticks in simulation state and snapshot version 6. The renderer uses that scheduled duration and simulation phase, so an expired attack-speed effect cannot change playback speed after the attack has already started. A late first render or a fresh model restored after missile release resumes the active clip at its elapsed phase. Pause freezes attack phase. Cancelled orders, stuns, invalid windup targets, and death clear the active cycle. Other animation phases and crossfade weights remain presentation state; this does not promise a pixel-identical restored framebuffer. See [checkpoint scope](SAVES.md).

All 121 unit/scenario checks, all 40 Chrome scenarios, the static build, and the production preview smoke check pass. The attack-cycle browser case was then strengthened and passed again: it checks the actual imported Ashe skeleton, confirms the pose changes as simulation advances, and matches paused/restored pose components within 1e-7. The restore check creates a fresh model after release, rather than retaining the previous AnimationAction. Simulation tests cover fixed timing through buff expiry/stat changes, exact snapshot continuation, cancellation causes, and invalid cycle durations.

This corrects animation continuity and save restoration within the current combat model. Exact source hit-frame calibration, other animation phases/events, full champion kits, full-match systems, and pixel-level reference comparison remain unfinished. The production goal remains active.

## Mobile death animation continuity milestone

Mobile death clips now seek from the saved death tick instead of starting when first rendered. A late first view or fresh restored rig reconstructs the elapsed pose; normal pause freezes that phase. Corpse visibility uses the same age and existing playback margin. Terminal presentation finishes the remaining sequence without advancing gameplay, then hides the completed mobile corpse. Terminal presentation elapsed time, crossfade weights, and structure transition playback are not persisted. See [death continuity and limits](MINIONS.md#mobile-death-playback-continuity).

All 121 unit/scenario checks, all 42 Chrome scenarios, the static build, and the production preview smoke check pass. The two new browser scenarios also passed in an initial targeted run. The rig comparison covers Ashe and all eight imported lane-minion models, matching paused and freshly restored skeleton pose components within 1e-7 while retaining hidden health bars. The terminal case reaches the super-minion clip's final pose and hides the completed corpse while the match tick remains unchanged. Existing full death-duration, survivor independence, corpse cleanup, graphics recovery, and structure destruction checks pass.

This improves the current source animation playback; alternate animation selection, source event graphs, particles, structure restoration phases, the complete champion/bot/objective systems, and pixel-level reference certification remain unfinished. The production goal remains active.

## Structure destruction phase milestone

Animated structure destruction now seeks from the known death tick and enters the destroyed-idle loop at the corresponding phase. A late first render or fresh restore of a dead inhibitor no longer restarts its collapse. The renderer retains the remembered destruction clock across hidden live regrowth, preventing that unseen change from resetting the rubble pose. Observed regrowth returns to the living state. Static tower rubble keeps its authored pose, and terminal presentation still completes animated destruction. See [phase reconstruction and remaining restore limits](STRUCTURES.md#destruction-phase-reconstruction).

All 121 unit/scenario checks, all 43 Chrome scenarios, the static build, and the production preview smoke check pass. The new browser scenario compares both inhibitor rigs before and after fresh restoration at the same age, matching pose components within 1e-7, and checks the enemy's remembered clock and loop phase across controlled hidden regrowth. An initial test incorrectly treated an allied inhibitor as hidden; after restricting that setup to the enemy, the corrected targeted case and full suite pass. Existing base destruction, terminal outcomes, fog knowledge, and graphics recovery scenarios remain green.

A fresh view of remembered rubble after unseen regrowth lacks its original death timestamp and starts a completed destroyed-idle state. Terminal elapsed playback and other presentation state are not persisted. Source particle events, respawn transitions, full match/content systems, and pixel-level reference comparison remain unfinished. The production goal remains active.

## Movement distance and run-rate milestone

Movement now retains the remainder of each tick's distance across path waypoints, including zero-length segments and turns. Dense routes no longer artificially slow units, and unused distance cannot carry them past the reachable endpoint. One effective-speed function supplies the existing slow and Heal haste rules to both movement and run playback. Run clips scale relative to the configured unmodified movement speed. This improves relative consistency; absolute authored stride and foot contacts remain reference-capture work. See [movement behavior and boundaries](MOVEMENT.md).

All 125 unit/scenario checks, all 44 Chrome scenarios, the static build, and the production preview smoke check pass. Four new simulation cases cover sparse/dense equivalence, turns and repeated points, endpoint stopping, and exact slow/haste deadlines. The new browser scenario also passed in isolation and checks 36 combinations across Ashe and eight minion rigs, comparing actual travel distance with effective speed and source run playback rate. Existing full-map navigation, pointer controls, fog, attack/death playback, saves, and recovery checks remain green.

Additional reference speed caps and crowd-control rules, absolute gait calibration, complete champion/bot/objective systems, and full pixel-level comparison remain unfinished. No new performance claim is made. The production goal remains active.

## Source-backed Ashe progression milestone

Ashe now uses pinned CharacterRecord stats and the matching client global level-growth factors. Leveling applies fractional HP, mana, AD, armor, MR, attack-speed, and regeneration growth, replacing the previous flat HP/AD increments. The CharacterRecord's 3.5 AD growth agrees with Riot's 26.2 notes and resolves the earlier Data Dragon sample's zero-growth discrepancy. Multiple-level awards carry XP forward; level 18 stops accumulation and save validation enforces that cap. Item bonuses and missing resources are preserved. Dead heroes stay at zero HP, and already-scheduled attacks retain their timing. See [source records, totals, and scope](PROGRESSION.md).

All 130 unit/scenario checks, all 45 Chrome scenarios, the static build, and the production preview smoke check pass. Both pinned upstream records verify and the generated gameplay data reproduces byte-identically. Five new simulation scenarios cover thresholds/cap, source totals, items/resources, death safety, regeneration, snapshot continuation, invalid saved levels, and attack timing. The level-2/18 HUD browser case passes; after its initial screenshot caught the loading fade, the test was updated to wait for the overlay to detach and passed again. The unobstructed level-18 HUD was visually inspected.

Enemy leveling, XP sharing and eligibility, role modifiers and higher role-specific caps, ability ranks, complete stat/item interactions, and the remaining full-match and pixel-fidelity gates are unfinished. Exact source windup and attack-speed stacking also remain unresolved. The production goal remains active.

## Minion experience collection milestone

Rift minion XP now uses each victim team's pinned barracks radius of 1,500 units, matching Riot's published range change. The inclusive center-distance boundary replaces the hard-coded 1,400-unit check for Rift lane minions. Living players can collect proximity XP without sight or the last hit; dead players cannot collect that minion award. Gold and CS remain tied to the separate last-hit path. Champion-kill XP and the legacy unconfigured practice radius remain separate approximations. See [collection rules and limits](PROGRESSION.md#minion-experience-collection).

All 137 unit/scenario checks, all 45 Chrome scenarios, the static build, and the production preview smoke check pass. Layout, provenance, and minimap reproduce byte-identically. Seven new scenarios verify both source radii, all four minion classes inside/on/outside the boundary, sight and last-hit independence, dead-player and victim exclusions, distant last-hit gold/CS, and automatic leveling from proximity XP.

Experience sharing, full champion-kill and assist rewards, role modifiers, enemy progression, the remaining full-match systems, and pixel-level reference comparison remain unfinished. No new performance claim is made. The production goal remains active.

## Ambient gold milestone

Standard Rift passive income now starts after the 65-second boundary and accrues at 2.04 gold per second, replacing the immediate two-gold-per-second practice grant. The pinned map's CLASSIC mode link supplies the start, amount, and interval; the start agrees with the official 26.1 game-start change. Fractional balances survive purchases and checkpoints. HUD and shop show whole spendable gold, and an open shop refreshes as income arrives. Death permits income; pause and victory freeze it. See [economy evidence and cadence policy](ECONOMY.md).

All 142 unit/scenario checks and all 46 Chrome scenarios pass. After adding the open-shop refresh, the affected browser scenario, all unit checks, and static build passed again. The production preview smoke check also passes. Tests cover the exact start boundary, sustained rate, fractional saves/change, purchase affordability, death, victory, debug time jumps, and both balance displays. The exporter verifies the selected fields against the pinned map SHA.

Continuous per-tick credit is an explicit policy pending a matched reference capture of payout cadence. Role income, reward scaling/sharing, complete items, independent bot economies, full-match systems, and pixel-level reference comparisons remain unfinished. No new performance claim is made. The production goal remains active.

## Cannon and super bounty scaling milestone

Cannon and super minions now receive 50 starting gold plus one per 90 seconds of spawn time, capped at 90 total. Both team configurations come from the pinned barracks upgrade interval and maximum, reconciled with Riot's published initial reward and increment. The exporter verifies the hashed `GoldUpgrade` and `GoldMax` names; red super's omitted increment uses the explicit official rule. Existing units retain their spawn bounty, and checkpoint restoration and last-hit payout preserve it. See [minion gold evidence and interpretation](MINIONS.md#cannon-and-super-gold-growth).

All 149 unit/scenario checks, all 47 Chrome scenarios, the static build, and production smoke pass. Seven new unit scenarios cover both teams/kinds, upgrade and cap boundaries, surviving units, save restoration, last-hit ownership, duplicate lethal hits, and unchanged ordinary rewards. The full-Rift browser test spawns a 30-minute wave with five cannons and one inhibitor-driven super, verifies all six 70-gold bounties, and checks the super's payout and HUD balance. Its initial exact floating-point subtraction assertion was corrected to the defined six-decimal balance precision; the complete suite then passed.

Spawn-time versus live upgrade behavior, exact initialization boundaries, and maximum-field interpretation remain pending matched reference-client observation. Ordinary minion scaling, reward sharing, role systems, complete bot economies, full-match gameplay, and pixel-level fidelity remain unfinished. The production goal remains active.

## Super-minion health scaling milestone

Both super variants now receive their pinned barracks health growth: 100 HP per 90 seconds, capped at 6,000 bonus HP above the 1,500 base. The existing spawn-health system consumes the newly exported configuration, producing 3,500 HP at 30 minutes and a maximum of 7,500 at 90 minutes. Existing wounded units and restored checkpoints retain their original maximum and current health. Turret percentage-health attacks use the increased maximum. See [source values and timing policy](MINIONS.md#super-minion-health-growth).

All 153 unit/scenario checks, the three affected Chrome scenarios, the static build, and production smoke pass. The full browser suite was not repeated for this data-only runtime change. Four new unit scenarios cover both teams' upgrade/cap boundaries, wounded-unit/save preservation, and a real turret projectile. The full-Rift late-wave scenario additionally verifies the spawned super's 3,500 HP. The first turret test setup omitted initial structures; correcting its fixture initialization made the intended projectile check pass. Layout, provenance, and minimap reproduce byte-identically.

Exact upgrade phase and living-unit behavior still require reference-client observation. Super damage growth, aura, regeneration, complete match systems, and pixel-level fidelity remain unfinished. The production goal remains active.

## Super-aura source reconciliation

Inspected the selected super CharacterRecords, item 1512, matching shared buffs, and English string table before implementing the missing aura. Found conflicting descriptions in the same 16.18 source set: the carried cosmetic item describes 35 armor/MR, whereas the shared Minion Commander description claims 70 armor/MR plus 70% damage. Neither supplies radius, filtering, stacking, or application cadence. This changes the next action from importing tooltip values to obtaining behavioral evidence; no guessed aura was added.

Pinned three whole-source hashes and five selected records in `reference/super-aura.json`; `tools/assets/verify-super-aura.py` verifies all of them successfully. [SUPER-AURA.md](SUPER-AURA.md) distinguishes source facts from interpretation and specifies the comparison needed to resolve the effect. Runtime files are unchanged, so simulation/browser checks were not repeated. Independent full-match and presentation work remains available; the production goal remains active.

## Champion health-bar readability milestone

Replaced the fixed 16-pixel champion stripe pattern with health-based 100-HP divisions and stronger 1,000-HP marks. Spacing follows maximum health after levels and items; damage only changes the fill. CSS layers keep DOM size constant. The selected-target panel now rounds maximum health consistently with current health. See [presentation policy and remaining calibration](HEALTH-BARS.md).

All 153 simulation checks, the new division browser scenario, the existing progression HUD scenario, the static build, and production smoke pass. Starting, level-18, and post-item bar captures were visually inspected. The full browser suite was not repeated for this presentation-only change. Exact source styling, shield presentation, high-health density, full-match systems, and pixel-level comparison remain unfinished. The production goal remains active.

## Explicit A-click targeting milestone

A followed by an enemy click now issues a targeted attack using the same picked enemy as right-click. Previously the input handler discarded that target and issued ground attack-move, which could acquire a different nearby enemy or ignore a directly clicked dummy. Ground and ally clicks remain attack-move, and Escape cancels the armed input. README controls and [movement documentation](MOVEMENT.md#explicit-attack-clicks) describe the distinction.

All 153 simulation checks, four focused Chrome scenarios, the static build, and production smoke pass. The browser cases use actual keyboard/mouse input, verify explicit champion/caster/dummy damage despite a nearer enemy, and cover ground/ally clicks, cursor cleanup, and Escape. The initial test incorrectly stunned the player, causing commands to be rejected as designed; removing that fixture constraint exercised the intended behavior. The full browser suite was not repeated for this localized input change.

Configurable attack-move-on-cursor, champion-only targeting, exact input buffering/cancellation calibration, complete match systems, and pixel-level fidelity remain unfinished. The production goal remains active.

## Source-backed Heal self-cast milestone

The stun-command review found an explicit source exception: Summoner Heal is castable while disabled and does not break channels. Its pinned record now drives the supported self-cast values: 80–318 healing across levels 1–18, 240-second cooldown, and 30% movement speed for one second. Heal works during the implemented stun and preserves recall; it does not remove stun, permit movement during it, or revive dead players. Other spells and movement orders retain the existing stun filter. Movement buffering itself remains unverified and unchanged. See [Heal scope and remaining mechanics](SUMMONER-HEAL.md).

All 157 unit/scenario checks, three affected Chrome scenarios, the static build, and production smoke pass. New checks cover healing totals/clamping, stun permission and other-spell rejection, recall/cooldown behavior, checkpoint continuation, death, and victory. The browser presses F during stun and checks the cooldown and heal event; existing movement/run and attack-cycle cases remain green. Generated Heal data reproduces byte-identically. The full browser suite was not repeated.

Ally targeting/healing/haste, repeated-Heal reduction, healing modifiers, additional crowd-control types, complete champion kits, full-match systems, and pixel-level reference comparison remain unfinished. The production goal remains active.

## Repeated Heal reduction milestone

The pinned 0.5 multiplier and 30-second duration now apply to repeated Summoner Heal on a recipient. Reduction precedes missing-health clamping, refreshes on an accepted cast, and does not compound or reduce ordinary regeneration/haste. A recipient timestamp preserves the effect through saves; snapshot version 7 validates it. The practice cooldown reset leaves the reduction intact. See [source facts and runtime policies](SUMMONER-HEAL.md#repeated-heal-reduction).

All 160 simulation checks, four affected Chrome scenarios, the static build, and production smoke pass. New cases cover consecutive casts, exact expiry, clamping, regeneration, checkpoint continuation, and invalid saved deadlines. Browser coverage includes an actual practice cooldown reset and reduced F cast during stun, plus the three existing save scenarios. Generated data reproduces byte-identically. The full browser suite was not repeated.

Exact refresh/full-health/death-persistence semantics still require reference observation. Ally healing, bot spell inventories, healing modifiers, complete match systems, and pixel-level fidelity remain unfinished. The production goal remains active.

## Allied Heal milestone

Heal now affects the caster and one living allied champion within the pinned 900-unit range. F uses the hovered unit or cursor location, with the exported 200-unit tolerance; without a qualifying cursor target, the current policy chooses the lowest health percentage. The matching tooltip is now pinned and verified alongside the spell record. Each recipient independently receives healing, repeated-Heal reduction, and a one-second speed effect. Snapshot version 8 replaces the player-only haste timer with per-unit deadlines consumed by movement and run playback. See [selection rules and assumptions](SUMMONER-HEAL.md#allied-champion-selection-and-haste).

All 165 simulation checks, six affected Chrome scenarios, the static build, and production smoke pass. Five new simulation cases cover cursor preference, fallback, range/tolerance boundaries, exclusions, independent reductions, caster-level healing, expiry, and saved continuation. The new browser case hovers one ally and verifies that exactly the intended recipient gains healing and haste. Existing Heal, run-speed, and all three save cases pass. Generated data reproduces byte-identically. The full browser suite was not repeated.

Exact selection geometry, fallback interpretation, tie-breaking, additional healing modifiers, bot spell inventories, complete match systems, and pixel-level fidelity remain unfinished. The production goal remains active.

## Queued command snapshot milestone

Command queuing now captures only the fields belonging to each command. Previously a structurally valid coordinate argument could be an entire Unit; cloning it copied all entity fields into the point and made a pending command incompatible with strict snapshot validation. The HUD Heal button still exercises this caller shape. Cast, move, and attack-move destinations now contain only copied coordinates, with attack targets and other scalar command fields copied independently.

Three new regressions reproduced the oversized point payload before the fix; all 168 simulation checks now pass. Eight affected Chrome scenarios pass, including a new real HUD-click test that snapshots the pending Heal before execution and verifies identical restored continuation. Existing save and explicit attack-targeting cases remain green. Static build and production smoke pass. The full browser suite was not repeated. Complete match systems and pixel-level fidelity remain unfinished; the production goal remains active.

## Champion recovery and bot retreat milestone

Living allied and enemy champion prototypes now regenerate health and mana, with fountain restoration tied to each champion's own team. The old red-spawn bot healing increment was removed. Bots below 22% health enter a persistent retreat state, replace unrelated movement orders with their own home, and wait until at least 85% health before resuming their tactical policy. Snapshot version 9 preserves that state. The thresholds are authored AI decisions; fountain radius/rates remain the existing provisional values. See [recovery scope and remaining bot work](CHAMPION-RECOVERY.md).

All 172 simulation checks, all 55 Chrome scenarios, the static build, and production smoke pass. Four new scenarios cover both teams' fountain recovery and restored continuation, redirection to the correct home, ordinary regeneration at an enemy fountain, and dead-champion exclusion. Existing damage and ally-Heal checks were updated to account for newly active non-player regeneration without obscuring the damage/heal amount being tested.

Role assignments, team strategy, safe retreats, recall and shopping decisions, mana-driven recovery, independent bot progression, source fountain calibration, full-match completion, and pixel-level fidelity remain unfinished. The production goal remains active.

## Team-correct champion respawn milestone

Champion respawns now use each unit's team spawn. This fixes non-player blue champions incorrectly returning to the red fountain. Structures and dummies retain their in-place behavior. Three new simulation cases verify both teams, exact timing, resources, cleared combat/navigation/retreat state, pre-respawn checkpoint continuation, and unchanged dummy placement. The blue case reproduced the placement failure before the fix.

All 175 simulation checks, four affected Chrome scenarios, the static build, and production smoke pass. The new full-Rift browser case verifies both authored fountains and live-vision/health-bar visibility after respawn; all three save cases remain green. The full browser suite was not repeated. Source death-timer scaling, fountain protection, complete bot strategy, full-match systems, and pixel-level fidelity remain unfinished. See [respawn scope](CHAMPION-RECOVERY.md#respawn-placement). The production goal remains active.

## Champion base death-time milestone

Replaced the fixed ten-second champion respawn delay with the 18-level base table selected by standard Rift's pinned 16.18 map record. The player now waits 52.5 seconds at level 18, with an integer-tick deadline and upward-rounded HUD countdown. Other champion prototypes remain level one until independent progression exists. The complete source record, including unapplied scaling fields, is pinned and the exporter verifies both the whole source hash and mode selection. Official patch 14.16 corroborates early-level values. See [death-time evidence and remaining research](CHAMPION-RECOVERY.md#base-death-duration-by-level).

All 178 simulation checks, three focused Chrome cases, the static build, and production smoke pass. New checks cover every base level, half-second timing, restored continuation, prototype level isolation, and visible countdown expiry. Export regeneration is byte-identical. The full browser suite was not repeated. Match-time scaling, role modifiers, fountain protection, complete match systems and pixel fidelity remain unfinished; the production goal remains active.

## Champion death-time scaling milestone

Champion respawn deadlines now incorporate the pinned record's time bands and multiplier cap. The implementation accumulates each band's contribution, counts started 30-second intervals, samples at death and rounds the final duration up to a simulation tick. Explicit scaling points take precedence over legacy scalar fields. These evaluation choices are documented in CHAMPION-RECOVERY.md as policies pending reference capture; the source establishes numeric fields, not complete runtime semantics. At the cap, level 18 waits 78.75 seconds. Both teams receive scaling; structures and dummies retain separate rules.

All 181 simulation checks, six focused Chrome cases (respawn and saves), static build and production smoke pass. New coverage includes band boundaries, cap, saved death spanning a scaling boundary, prototype teams, and the late-game HUD countdown. Export regeneration is byte-identical. The full browser suite was not repeated. Exact boundary calibration, role modifiers, fountain protection, full match systems and pixel fidelity remain unfinished. The production goal remains active.

## Focus cleanup on death milestone

Death immediately clears the player's Focus stacks, expiry and active Q deadline. An arrow already in flight still damages its target after its source dies, but no longer grants posthumous Focus. Cooldowns and inventory remain intact. This closes a lifecycle/HUD state leak in the prototype; complete Ashe Q reference behavior remains unfinished.

All 183 simulation checks, four focused Chrome cases, static build and production smoke pass. New cases cover cleanup, saved continuation through respawn, retained cooldowns/inventory, in-flight damage without Focus, and disappearance of charged pips and the active-Q HUD indicator. The full browser suite was not repeated. Full kit fidelity, match systems and pixel accuracy remain unfinished; the production goal remains active.

## Source-backed Ashe Q duration milestone

Ranger's Focus now remains active for six seconds instead of four. The duration comes from the pinned 16.18 Ashe spell record and is corroborated by Riot's patch 13.5 notes. The tooltip shares the generated value. The complete Q record is retained for future rank, stacking and arrow-flurry work; this change does not claim those systems are complete. See ASHE-Q.md.

All 184 simulation checks, three focused Chrome cases, static build and production smoke pass. New tests verify activation, persistence beyond the former four-second deadline, exact six-second expiry, HUD state and saved continuation. Existing attack-cycle and death-cleanup browser cases remain green. Export regeneration is byte-identical. The full browser suite was not repeated. Complete champion, full-match and pixel fidelity remain unfinished; the production goal remains active.

## Individual Focus decay milestone

Focus now loses one stack after four seconds of inactivity, then one per second, using pinned spell timing values and retained tooltip corroboration. New eligible impacts refresh the full window. Active Q prevents Focus accumulation, and casting clears the stack deadline. The existing deadline field persists intermediate decay through saves. Exact boundary ordering and impact-based generation remain documented limitations; full Q parity is not claimed.

All 187 simulation checks, three focused Chrome cases, static build and production smoke pass. New tests cover individual decay and saved continuation, impact refresh, active-window damage without Focus, and visible pip falloff. Export regeneration is byte-identical. The full browser suite was not repeated. Full champion behavior, match systems and pixel fidelity remain unfinished; the production goal remains active.

## Focus attack-release milestone

Focus now increments on a successfully released attack rather than projectile impact. The fourth arrow can unlock Q while still traveling; impact does not duplicate or refresh the stack. Canceled, stunned or invalidated windups grant nothing. This removes travel distance from Q readiness. The source tooltip describes attacks granting Focus, while exact callback mapping remains a documented implementation interpretation pending reference capture.

All 190 simulation checks, four focused Chrome cases, static build and production smoke pass. New regressions cover pre-impact readiness, saved arrows, canceled windups, no duplicate impact stacks and visible pips before damage. The full browser suite was not repeated. Full Q ranks/flurry, specialized attack outcomes, match systems and pixel fidelity remain unfinished; the production goal remains active.

## Additive Ashe Q attack-speed milestone

Q now adds rank-one ratio-scaled attack speed instead of multiplying the whole baseline by 1.4. The exporter pins and verifies Ashe's 0.658 attack-speed ratio and exports the five normal-rank bonus values. Rank one adds 0.1316 attacks/second at early and late levels. HUD and simulation share the calculation. Skill-point allocation, baseline stat quantization/caps, attack reset and complete flurry damage remain unfinished.

All 191 simulation checks, four focused Chrome cases, static build and production smoke pass. New coverage checks level-one/18 absolute bonuses and scheduled periods, while existing saved-duration and animation tests use corrected timing. The HUD shows 0.79 during rank-one Q and returns to 0.66 on expiry. Export regeneration is byte-identical. The full browser suite was not repeated. Full champion, match and pixel fidelity remain unfinished; the production goal remains active.

## Ashe Q aggregate damage milestone

Rank-one Q now captures 110% AD at attack release, using the pinned spell coefficient. In-flight damage remains stable through Q expiry, AD changes, source death and checkpoint restoration; an ordinary arrow is not retroactively empowered by activating Q after release. This remains a single aggregate hit. Five-arrow sequencing, presentation, individual hit interactions and Frost Shot amplification are still required for full parity.

All 194 simulation checks, five focused Chrome cases, static build and production smoke pass. New tests cover normal/empowered armor mitigation, saved in-flight damage, expiry and activation boundaries. The full browser suite was not repeated. Full champion, match and pixel fidelity remain unfinished; the production goal remains active.

## Source-backed Ashe attack projectile speed milestone

Ordinary and empowered attack arrows now travel at 2,500 units/second instead of 2,000. Four pinned spell records agree on fixed-speed movement; their complete records are retained and verified by the new exporter. Champion prototypes currently all use Ashe's stat profile, so the shared champion default receives the correction. Q inter-arrow timing is not exposed in these selected specifications; five-arrow sequencing, effect binding and individual hit behavior remain unfinished.

All 195 simulation checks, all 63 Chrome scenarios, static build and production smoke pass. The new simulation case checks first-tick displacement, expected impact timing and saved continuation for ordinary/empowered arrows. Export regeneration is byte-identical. Full champion, full-match and pixel fidelity remain unfinished; the production goal remains active.

## Frost Shot level-scaled basic slow milestone

Basic attack slows now interpolate from 20% at level one to 30% at level 18 for two seconds, from the pinned standard Ashe passive. Snapshot version 10 stores each victim's applied slow multiplier so later attacker leveling cannot change an existing effect. Movement and animation use the shared speed helper. Non-player prototypes remain level one. Volley/ultimate slow tuning, multiple-effect priority, critical slows, movement caps and passive damage remain unfinished.

All 198 simulation checks, five affected Chrome cases, static build and production smoke pass. The new browser case initially divided by a stationary dummy's zero speed; its fixture now supplies 325 speed, and both simulation and browser checks verify actual speed changes and expiry. Four existing save/run-speed cases passed in the initial run; the corrected Frost Shot case passed on rerun. Export regeneration is byte-identical. The full browser suite was not repeated. Full champion, match and pixel fidelity remain unfinished; the production goal remains active.

## Crystal arrow acceleration milestone

Enchanted Crystal Arrow now starts at 1,500 units/second, accelerates by 200 units/second² and caps at 2,100, using the pinned standard spell movement record. Step integration accounts for acceleration and partial-step arrival at the cap; the existing projectile speed field preserves flight through saves. The complete source record is retained for further stun, splash and vision work. Distance-based stun remains unfinished because the selected record does not expose the required distance threshold.

All 200 simulation checks, four focused Chrome cases, static build and production smoke pass. New cases check integrated distance, speed cap, range expiry, saved continuation and browser presentation updates. Export regeneration is byte-identical. The full browser suite was not repeated. Full champion, match and pixel fidelity remain unfinished; the production goal remains active.

## Crystal arrow moving vision milestone

Crystal Arrow now contributes its source-backed 750-unit sight radius at its current position to the casting team's shared vision sources. The radius follows saved projectile state, persists through caster death, and disappears on removal. Ordinary/Volley projectiles are excluded. Default terrain/brush occlusion and no lingering reveal remain explicit policies pending reference verification.

All 203 simulation checks, three focused Chrome cases, static build and production smoke pass. New checks cover both teams, radius boundaries, movement/removal, saved dead-caster continuation, occlusion and distant-enemy visibility in the browser. Existing structure-vision behavior remains green. Export regeneration is byte-identical. The full browser suite was not repeated. Full champion, match and pixel fidelity remain unfinished; the production goal remains active.

## Crystal arrow splash milestone

Crystal Arrow now damages and applies basic Frost Shot slow to surrounding living enemy non-structure units. The source radius is 400 and area coefficient 1.0; the direct target is excluded from the splash loop and alone receives the primary stun. Lethal direct hits still splash minions. Center-distance geometry and shared damage/slow radius are documented interpretations pending reference calibration. Explosion audiovisual effects, slow priority, distance-scaled stun and full rank/AP behavior remain unfinished.

All 205 simulation checks, three focused Chrome cases, static build and production smoke pass. New cases cover radius/exclusions, mitigation, primary non-duplication, lethal-hit minion splash, saved continuation and browser damage/stun separation. Export regeneration is byte-identical. The full browser suite was not repeated. Full champion, match and pixel fidelity remain unfinished; the production goal remains active.

## Crystal arrow cross-map range milestone

Crystal Arrow now uses its pinned 25,000-unit cast/travel range instead of 10,000. Long-range shots reach targets beyond the former cutoff and retain their remaining range through saves. A terminal-step test exposed a floating-point remainder that extended projectile lifetime by one tick; cleanup now ignores at most 1e-8 world units of residual range while preserving the collision travel bound.

All 206 simulation checks, four focused Chrome cases, static build and production smoke pass. Coverage includes source acceleration through full range, exact terminal removal and saved/browser hits at 15,000 units. Export regeneration is byte-identical. The full browser suite was not repeated. Distance-scaled stun, full champion, match and pixel fidelity remain unfinished; the production goal remains active.

## Crystal arrow distance-stun milestone

Direct-hit stun now follows distance × 0.00125 seconds clamped to the source-backed 1–3.5-second bounds. The coefficient comes from a first-hand technical analysis with calibrated map comparison, separately attributed in the source pin and ASHE-R.md. Consumed range and fractional sweep contact supply traveled distance, so caster movement cannot change it. Our exact 60 Hz expiry does not reproduce the report's coarse live buff expiry; observed lifetime parity remains unverified.

All 208 simulation checks, seven focused Chrome cases, static build and production smoke pass. New checks cover curve breakpoints/cap, caster movement, saved flight and exact expiry; the long-range browser test verifies 210 ticks at impact. Export regeneration is byte-identical. The full browser suite was not repeated. Full champion, match and pixel fidelity remain unfinished; the production goal remains active.

## Spellbook-selected Volley milestone

Volley now uses the main spell selected by Ashe's character root: seven rank-one arrows, 60 + 100% bonus AD damage and 1,500-unit/second projectile speed. This replaces provisional nine-arrow, total-AD scaling and 1,800-speed behavior. Root selection and complete main/missile records are pinned and verified, avoiding unused older rank records. Spread geometry, hit width, casting windup, enhanced slow and rank allocation remain unfinished.

All 210 simulation checks, two focused Chrome cases, static build and production smoke pass. New coverage checks level/base-AD separation, item bonus scaling, arrow count/speed, saved cast damage and one hit per target. Export regeneration is byte-identical. The full browser suite was not repeated. Full champion, match and pixel fidelity remain unfinished; the production goal remains active.

## Volley enhanced-slow milestone

Volley champion hits now apply source-backed 40–60% enhanced slow strength, easing to ordinary Frost over a one-second policy window. A separate component prevents a subsequent basic attack from erasing the enhanced decay. Non-champion Volley hits use ordinary level-scaled Frost. Snapshot version 11 validates and preserves the component; respawn clears it. Source tooltips support the enhancement/decay behavior, while exact linear timing remains pending reference capture.

All 213 simulation checks, five focused Chrome cases, static build and production smoke pass. New checks cover level endpoints, decay/tail/expiry, saved continuation, subsequent basic hits and malformed component bounds. Export regeneration is byte-identical. General slow priority, critical basic attacks, movement caps and full champion/match/pixel fidelity remain unfinished; the production goal remains active.


## Hawkshot ammunition milestone

Hawkshot now stores two charges with a five-second cast delay and serial 90-second rank-one recharge, replacing its provisional 45-second single cooldown. Spending the second charge does not restart recharge; death and respawn preserve it. Snapshot version 12 validates and saves charge count/deadline. The HUD displays ammunition, recharge progress and actual cast availability; practice reset restores both charges. Complete selected spell/tooltip records are pinned, and the verified exporter excludes nonstandard rank entries. [Hawkshot evidence and remaining scope](ASHE-E.md).

All 218 simulation checks, all 71 Chrome scenarios, static build and production smoke pass. Five new simulation cases cover serial recharge, boundary ordering, rejection, recall, death/respawn, save continuation and malformed state. Browser coverage exercises actual keyboard casts, charge/countdown display, accessible feedback and practice reset; charge-state screenshots were visually inspected. Export regeneration is byte-identical. These are local checks, not reference timing or pixel-parity certification.

Hawkshot still needs travel, range enforcement, complete vision geometry/persistence, cast windup and audiovisual fidelity. Starting charges and recharge event ordering remain documented policies pending reference capture. Passive research also confirmed that the pinned zero-crit calculation does not justify adding an old flat Frost Shot amplification; crit-stat support remains missing. Full champion, match and pixel fidelity remain unfinished; the production goal remains active.


## Hawkshot flight milestone

Hawkshot now travels at the source-backed 1400 units/second toward a target clamped to 25000 units, grants moving team sight and creates a separate five-second destination reveal on arrival. It passes through units and terrain without damage. Multiple flights/reveals coexist and survive caster death and saved continuation. Typed scouting areas remain visible to queries that intentionally exclude attack-reveal feedback. Snapshot version 13 preserves the new projectile and area kinds.

All 222 simulation checks, nine focused Chrome cases, static build and production smoke pass. New cases cover flight distance, endpoint/range/expiry boundaries, collision exclusion, team sight, multiple scouts, death and saved continuation. Browser checks confirm visible flight, frozen wing pose while paused, distant enemy reveal and re-hide, model cleanup and existing charge feedback. Screenshots were inspected; the final silhouette uses indexed triangles without adding a polygon triangulation dependency. Export regeneration is byte-identical. The full Chrome suite was not repeated for this milestone.

The bird is an authored temporary proxy, and sight retains the earlier provisional 650 radius. Lingering trail vision, source cast windup, reference geometry, minimap targeting and original audiovisual effects remain unfinished, as detailed in [ASHE-E.md](ASHE-E.md). Full champion, match and pixel fidelity remain unfinished; the production goal remains active.


## Minimap targeting milestone

E and R now aim and cast from minimap world coordinates without moving the camera, using their verified source flags. A shared conversion keeps map navigation and casting aligned. Pointer transitions no longer retain stale battlefield aim over HUD panels; unsupported minimap spells submit no cast. Right-click minimap movement and Escape cancel held targeting. Heal only picks a hovered unit on the battlefield canvas. The controls panel documents minimap spell use.

All 222 simulation checks, 16 focused Chrome scenarios, static build and production smoke pass. Four new browser scenarios cover full-Rift E/R direction and endpoint, laptop geometry, unchanged camera, surface transitions, unsupported spells and cancellation; existing controls and ally Heal remain passing. Both source exports regenerate byte-identically. Full Chrome coverage was not repeated. Alternate cast modes, broader champion systems and full match/pixel fidelity remain unfinished; the production goal remains active.


## Effective movement-speed readout milestone

The HUD now displays the same effective speed used by movement and run playback, including active slows, enhanced decay and Heal haste. Whole-number display uses six-decimal normalization before rounding, preventing a binary-noise error at the 227.5 midpoint. Stored speed and movement calculations are unchanged.

All 222 simulation checks, three focused Chrome scenarios, static build and production smoke pass. Browser checks cover a real attack slow, Heal composition, expiry and the enhanced-slow midpoint; existing run-playback coverage remains passing. Full Chrome coverage was not repeated. Movement soft caps, exact reference rounding, full champion/match systems and pixel fidelity remain unfinished; the production goal remains active.


## Hawkshot original-effect source recovery

Recovered the three base Hawkshot effect definitions directly from the pinned Ashe archive after their linked JSON URLs proved unavailable. The flight effect explicitly uses an animated hawk mesh in three material/trail layers, alongside glow, wind, dust and smoke; this provides a concrete replacement path for the current procedural bird. Complete decoded records and 21 required files are pinned with archive/chunk/file provenance. The reproducible extractor checks the base skin's resource selection, linked binaries, records and asset closure using minimal pinned name tables.

All 21 source files re-extract and verify: 907,219 output bytes from 468,831 compressed patch bytes. The generalized archive reader also revalidated all 40 existing base-structure files through its default Map11 path. No runtime files changed, so gameplay/browser tests were not repeated. Conversion, layered rendering, original animation/effects and reference visual comparison remain outstanding; the production goal remains active.

## Hawkshot source-body milestone

Replaced the procedural two-wing proxy with the pinned Owl1 mesh, texture, five-bone rig and original 1.333333-second flight animation. The reproducible converter verifies all 21 recovered source files and emits a 73,856-byte, 642-triangle GLB plus provenance manifest. Each scout has its own skeleton and mixer while sharing geometry/material/texture. Snapshot version 14 requires a launch tick so separate casts, pause and restored flights retain the correct local animation phase. Removal releases private skeleton GPU resources without destroying shared assets.

All 223 simulation checks, all 79 Chrome scenarios, static build and production smoke pass. All 16 model GLBs and the map validate with zero errors or warnings. GLB and manifest regeneration are byte-identical. New browser coverage checks independent phases, shared resources, pause, restored pose, resumed motion and disposal; simulation coverage rejects malformed launch ticks. Flight screenshots were inspected: the body is faint and can be occluded by scenery.

This implements only the original body layer. Normal alpha blending and transform interpretation remain provisional; reflection, mesh trails, glow, wind, dust, smoke, arrival/linger effects and audio are unfinished. Exact reference appearance, full champion/match systems and performance targets remain outstanding; the production goal remains active. See [Hawkshot evidence and scope](ASHE-E.md).

## Hawkshot blend-state milestone

The Owl1 body now uses alpha-weighted additive blending instead of the previous normal-alpha approximation. Its source mode 4 is retained in GLB material extras and restored explicitly by the runtime. This follows DAKA's pinned engine dictionary factor table; the older guide's conflicting shorthand and a texture census that cannot establish pipeline state are documented separately. Independent 16.18 GPU capture remains absent. The screenshot shows a brighter, more legible bird, but missing particle layers and exact visual calibration remain unresolved.

All 223 simulation checks, four focused Chrome cases, asset validation, static build and production smoke pass. The new GPU readback case verifies additive color over two backgrounds and the black-source identity within byte quantization, using the loaded material's blend state. GLB and manifest regeneration are byte-identical; the additional material metadata brings the GLB to 73,888 bytes. The full browser suite was not repeated after the previous milestone's 79 passing scenarios. Full champion/match systems, complete effects and pixel fidelity remain unfinished; the production goal remains active.

## Hawkshot Fresnel-layer milestone

Added the source Owl2 Fresnel rim alongside Owl1, using its black birth color, color-hold texture, 0.05 exponent and authored rim RGB. The shader follows a pinned published transcription of Riot's reflective mesh shader: compute the rim at vertices from camera direction and transformed normals, then add its alpha-weighted contribution before blending. This is attributed evidence, not our own bytecode or reference-pixel verification. No cubemap behavior was inferred from the reflection-definition name.

The converter retains normals and the source constant texture, emits two primitives sharing source attributes, and produces an 80,440-byte GLB. Ordinary unlit pruning removed necessary normals; the GPU test also exposed Three's default transparent back-face normal inversion, resolved by the source's single-pass culling-disabled behavior. Existing per-cast animation, shared resources and private skeleton disposal remain intact.

All 223 simulation checks, six focused Chrome cases, asset validation, static build and production smoke pass. New checks cover both layers' source normals and synchronized poses, numerical camera/object/alpha-dependent Fresnel output, and exact framebuffer restoration after graphics loss with a hawk in flight. GLB and manifest regeneration are byte-identical. Flight and recovery screenshots were inspected; the combined bird is substantially brighter, with final tone/orientation still pending reference calibration. The full Chrome suite was not repeated. Remaining particle layers, full champion/match systems and pixel fidelity remain unfinished; the production goal remains active.

## Hawkshot wind asset milestone

Prepared the source WindTunnel mesh, color texture and erosion texture for particle playback. The exact source SCB has 96 vertices, 124 triangles and eight vertex-alpha values; the exported GLB expands face corners to preserve UV seams and retains source topology, color bytes and centimeter scaling. Complete source emitter parameters and provenance accompany the assets. The main GLB is 41,400 bytes; the external erosion PNG is 150,143 bytes.

All 17 model GLBs and the map validate with no errors or warnings. Lossless decoded-texture checks, GLB roundtrip geometry/color/texture checks and byte-identical regeneration pass. An isolated Chrome preview rendered the original curved mesh and fading texture without errors, verified all vertex-alpha values and vertex-color activation, and was visually inspected. Auxiliary erosion hash/size verification is now part of asset validation. Gameplay code did not change, so simulation and full browser suites were not repeated.

This completes asset preparation only. Wind emission, random sampling, motion/drag, erosion and post-arrival particle lifetimes still require implementation; current gameplay still shows Owl1 and Owl2. Full effects, champion/match systems and pixel fidelity remain unfinished; the production goal remains active.

## Hawkshot wind playback milestone

Integrated the source WindTunnel as a single instanced draw with deterministic emission, independent birth sampling, rotation/scale, vertex-alpha envelope, analytic drag and green-channel erosion. The shader uses the pinned class defaults and published two-ramp interpretation. Snapshot version 15 requires the flight origin and retains launch/arrival trajectory data on scouting areas, allowing particles to survive the bird's arrival and reconstruct after a save. Natural lifetime and shutdown cap limit tails; the reusable allocation submits zero instances once they expire.

All 225 simulation/source-state checks, 11 focused Chrome cases, asset validation, static build and production smoke pass. Coverage includes bounded deterministic sampling, arrival/expiry, saved trajectory validation, frozen instance transforms, restored tail state, graphics-loss pixel equality, and a GPU readback of the linear-green erosion ramp. Wind assets, manifest and generated parameters rebuild byte-identically. Flight/tail screenshots were inspected on an open lane. The full Chrome suite was not repeated.

The wind remains subtle and reference visual calibration is still needed. Exact RNG, emission phase, drag integration, placement/height and shutdown semantics are explicitly attributed or local policies in ASHE-E.md; passing tests prove our reconstruction is consistent, not complete League parity. Remaining Hawkshot layers, champion/match systems and pixel fidelity remain unfinished; the production goal remains active.


## Pinned base Ashe milestone

Replaced the archived champion GLB with the base skin mesh, rig, texture and complete atomic clip set from the pinned 16.18 Ashe archive. The reproducible extractor verifies 27 files, both binary definition records and all 25 atomic mappings. The new GLB is 3,953,864 bytes, with 7,406 triangles, 85 bones and 25 clips. Source skin scale 1.1 is now applied consistently; zero-weight joint slots are canonicalized without changing contributing weights. The retired runtime asset is removed and its provenance retained under docs/reference.

The comparison establishes identical topology counts and texture dimensions, differing decoded texture bytes, a scale/X-reflection difference between converters, and a source attack duration of 2.100000 seconds versus the archive's 2.133333 seconds. These findings do not independently establish reference-pixel orientation or lighting parity. Existing animation state selection remains in use; graph transitions, events, Recall sequencing and gait selection are unfinished.

All 225 simulation checks, all 85 Chrome scenarios, asset validation, production build and production smoke pass. The loading-recovery test now intercepts the new asset name and explicitly proves its request was blocked; that corrected case also passed separately. All 17 model GLBs and the map validate without errors or warnings. GLB and manifest regeneration are byte-identical. Practice and production Rift screenshots were inspected. The earlier page-creation timeout did not recur in the completed suite.

This replaces the archived source dependency; full champion/match systems, remaining effects, lighting/capture calibration and performance targets remain outstanding. The production goal remains active. See [the Ashe asset pipeline](ASSETS.md#pinned-base-ashe).


## Ashe recall sequence milestone

Replaced the looping Channel approximation with the source Recall sequence, Idle5 followed by Idle2 at their original clip durations. Rendering seeks from the simulation recall deadline, so late frames, pause and restored rigs retain the same phase. Cancellation, restart, completion, damage and death release or reset the recall pose correctly. Simulation and rendering share the existing eight-second duration; gameplay timing and snapshot schema are unchanged.

All 226 simulation/source checks, six distinct focused Chrome scenarios, production build and production smoke pass. Tests verify the sequence against the binary-verified graph, both stages and exact paused/restored bone transforms, plus attack/death/run regressions. Both recall stage screenshots were inspected. The full browser suite and asset validation were not repeated; assets did not change.

Native transition blending, recall VFX/audio and reference-pixel calibration remain unfinished. The complete production goal remains active. See [recall evidence and playback scope](ASHE-RECALL.md).


## Ashe empowered attack animation milestone

Q attack cycles now select the source Spell1 clip instead of ordinary Attack1. The exporter verifies the spell's animation field against the existing pinned source and base graph. Cycle creation captures animation empowerment once; later buff changes do not switch a running clip. Snapshot version 16 preserves that flag and rejects missing/non-boolean flags or empowered minion rigs. Existing cycle-based playback timing, cancellation and death behavior remain intact.

All 229 simulation/source checks, 14 distinct focused Chrome scenarios, production build and production smoke pass. Browser coverage checks normal and empowered phases, pause, exact restored bone transforms after expiry, Q behavior, recall, death, cancellation and checkpoint compatibility. Both attack screenshots were inspected after correcting the capture's loading-overlay wait. Q parameter regeneration is byte-identical. The full browser suite and unchanged asset validation were not repeated.

The Q flurry still uses aggregate projectile damage. Five-arrow sequencing, source release-frame alignment, activation/reset behavior, complete spell cast timing and pixel calibration remain outstanding. This milestone does not complete the production goal. See [Q evidence and scope](ASHE-Q.md#source-empowered-attack-animation).


## Q attack-reset milestone

Successful Q activation now resets the attack timer, supported by the pinned spell tag and Riot's patch 9.19 notes. It replaces an unreleased windup or recovery while retaining the current order/path and preserving already released arrows. The next eligible attack starts empowered on the activation tick. Idle/movement and rejected casts do not acquire unintended attacks or reset valid cycles.

All 233 simulation checks, nine focused Chrome scenarios, production build and production smoke pass. Coverage includes both reset phases, preserved projectile damage, exact saved continuation, rejected casts, movement, idle and the source animation restart. The reset screenshot was inspected and Q parameter regeneration is byte-identical. The full browser suite and unchanged asset validation were not repeated.

Same-tick ordering and precise native release-frame alignment still need reference calibration. Q activation animation, five-arrow flurry and complete spell cast timing remain unfinished; the production goal remains active. See [the reset evidence and semantics](ASHE-Q.md#q-attack-reset).


## Ashe cast-timing source audit

Added a reproducible join of the four spellbook-selected source records, base animation graph and shipped GLB. The checked profile preserves absent fields and distinguishes declared cast time, animator-frame selection, cast frame, cancellation flags and full clip duration. It exposes E's different frame value/absent animator flag and Q's special reset/flags despite the shared declared 0.25-second value. These findings prevent a generic delay or full-clip movement lock from being mistaken for verified native timing.

The audit verifies all source/definition/model hashes and all four graph mappings, and regenerates byte-identically. Runtime files and assets did not change, so gameplay, browser and asset suites were not repeated. W/E/R still launch immediately; pending cast state, release epochs, deferred orders, interruption semantics and reference capture checks are specified in [the casting implementation requirements](ASHE-CASTING.md). This is a research milestone, not completed cast playback; the full production goal remains active.


## Volley windup milestone

Volley now stores a pending cast and releases its seven arrows after the source's 0.25-second/15-tick windup. Mana/cooldown and damage are captured once at acceptance. Movement and attack advancement wait until release; retained orders resume afterward. An unreleased attack is cancelled, stun preserves an accepted cast, and death/match completion clear it. The source Spell2 pose seeks from simulation timing and survives pause and a fresh saved rig. Snapshot version 17 validates the pending deadline, ability and living/active state.

All 237 simulation checks, all 90 Chrome scenarios, production build and production smoke pass. Existing Volley tests now measure first travel from release while retaining damage, speed and remaining-distance assertions. New tests cover deferred movement, single spending/release, interrupted attacks, stun/death, restricted spell input, invalid snapshots and exact restored pose. The windup screenshot was inspected. W parameter generation is byte-identical; unchanged asset validation was not repeated.

This first windup implementation covers W only. During windup Heal remains available; other abilities and recall are rejected rather than buffered. Those interaction policies, cast-start damage/cooldown sampling, refunds and precise native frame alignment remain capture-calibration work. Full post-release animation recovery and E/R windups remain outstanding. The production goal remains active. See [casting evidence and implementation](ASHE-CASTING.md#volley-windup-implementation).


## Enchanted Crystal Arrow windup milestone

R now uses the saved pending-cast path, spending resources once and releasing after its verified 0.25-second windup. Rendering seeks the source Spell4 pose. Snapshot version 18 supports both W and R with source-selected duration validation. Existing movement/attack deferral, stun/death and restricted spell-input policies apply to both.

All 241 simulation checks, 15 focused Chrome scenarios, production build and production smoke pass. Shared windup coverage now exercises both spells, including no early missile, one release, saved continuation, frozen/restored bones and interruption rules. R flight fixtures use actual release as their epoch while retaining acceleration, range, splash, collision, sight and stun assertions. Minimap aiming/release passes. The source-pose screenshot was inspected and R parameter regeneration is byte-identical. The full browser suite and unchanged asset validation were not repeated after the prior 90-case full pass.

Hawkshot windup, full post-release animation, general spell buffering/Flash interactions and exact native frame calibration remain unfinished. R damage still uses the prior 200 baseline pending rank/AP work. The production goal remains active. See [R windup evidence and scope](ASHE-CASTING.md#enchanted-crystal-arrow-windup).


## Hawkshot windup milestone

E now uses the saved 15-tick pending-cast path and source Spell3 pose. Charges/cooldown/recharge are committed at acceptance; the scout is created only at release, giving flight animation, moving vision and wind particles their actual launch epoch. A shared source-profile lookup serves simulation, rendering and snapshot validation. Snapshot version 19 supports all W/E/R pending casts. Death before release cancels the scout without refunding its charge.

All 245 simulation checks, 18 focused Chrome scenarios, production build and production smoke pass. Shared tests cover E movement/attack lock, retained orders, stun/death, pending restoration and single charge spending. Existing flight, charge, vision, independent-rig, graphics-recovery, erosion and tail assertions pass after shifting fixtures to actual release. Tail expiry is measured relative to arrival. The source windup screenshot was inspected and E parameter generation is byte-identical. The full browser suite and unchanged asset validation were not repeated.

E uses its declared cast time; its distinct source castFrame and absent animator flag remain documented rather than collapsed into a universal timing formula. Exact native animation scaling, post-release recovery, complete spell buffering/Flash interactions, refund policy and pixel parity remain unfinished. The production goal remains active. See [Hawkshot windup and flight epoch](ASHE-CASTING.md#hawkshot-windup-and-flight-epoch).

## Spell recovery animation milestone

W/E/R now retain a saved animation epoch after their projectile releases. An idle Ashe finishes the selected source clip instead of snapping back to idle at 0.25 seconds. Movement and attacks resume at the existing deadline; subsequent orders, stun, death, recall, Q/Flash and replacement spells cancel recovery permanently. Heal preserves it. Snapshot version 20 validates presentation identity against any pending cast and restores its phase independently of renderer history.

All 249 simulation checks, 18 focused Chrome scenarios, production build and production smoke pass. The production screenshot was inspected. Browser assertions cover release, 0.6-second recovery, pause, fresh-rig saved restoration and eventual idle for all three spells. Adjacent attack, Q reset, recall, manual-save and graphics-recovery scenarios pass. The full browser suite and unchanged asset validation were not repeated. Native blend-graph transitions, E animation-speed/release-frame calibration and complete spell-input semantics remain unfinished; this milestone does not establish pixel parity. The production goal remains active. See [recovery behavior and limits](ASHE-CASTING.md#post-release-animation-recovery).

## Hawkshot background glow milestone

The scout now includes the two original background-glow emitters with the pinned source texture, colors, offsets, delays and pass values. A reproducible TEX export records original emitter data and source/output/pixel hashes. One shared 23,194-byte PNG serves both layers; geometry and materials survive individual scout disposal. Flight age drives delayed visibility across pause and saved restoration.

All 250 source/simulation checks, eight focused Chrome scenarios, production build and production smoke pass. New browser checks cover timing, restored layer state, shared resources and each layer's GPU pixel contribution; adjacent Hawkshot rig, Fresnel, wind and context-loss checks pass. The flight screenshot was inspected and asset generation is byte-identical. No GLBs changed, so their validation and the full browser suite were not repeated.

This adds source artwork with explicitly documented rendering interpretations; it does not establish native pixel parity. Quad orientation, uniform scaling, atlas defaults and culling still need capture calibration. Owl3, dust/smoke, endpoint VFX, sound and the broader production scope remain incomplete. See [source glow evidence and limits](ASHE-E.md#source-background-glow-layers).

## Hawkshot Owl3 particle milestone

The scout now emits the pinned Owl3 mesh particles: 10 per second, approximately 0.3-second lifetime, downward motion, independently animated poses and a fading blue Fresnel rim. The exporter verifies exact asset-field agreement with the shipped Owl2 layer, so this adds no model or texture downloads. Full binding follows the scout horizontally and holds at its destination while existing particles expire. At most four reusable rig/material slots per flight prevent per-birth GPU allocations; private resources are released after the tail.

All 253 source/simulation checks, nine focused Chrome scenarios, production build and production smoke pass. New coverage checks bound motion, source identity, lifetime, stateless pose restoration, independent animation, pooling, disposal and arrival cleanup. Existing Hawkshot graphics-loss pixel checks and neighboring glow/wind/Fresnel scenarios pass. The screenshot was inspected and source parameter regeneration is byte-identical. The full browser suite and unchanged GLB validation were not repeated.

Native emission phase, particle animation phase, binding/shutdown semantics and exact pixel calibration remain unresolved. Dust, smoke, endpoint effects, audio and the broader production scope remain unfinished. The production goal remains active. See [Owl3 source values and adapter policies](ASHE-E.md#owl3-bound-mesh-particles).

## Hawkshot dust/smoke source preparation milestone

Prepared the original four-cell dust and smoke atlases and the red-channel smoke erosion texture. The exporter verifies archive-source hashes, preserves decoded RGBA exactly, records individual atlas-cell pixel hashes and retains missing source fields as null. The three PNGs total 106,414 bytes; no renderer requests or visual behavior change yet.

All 254 source/simulation checks and the production build pass. The three images were inspected; source export is byte-identical, and the built static files match the verified outputs. Browser gameplay and unchanged GLB checks were not repeated for this asset-only step.

Playback requirements now explicitly include instanced atlas quads, dust orbital/box-space calibration, source erosion UV/default semantics, smoke depth intersection fading and saved deterministic particle reconstruction. These emitters remain unimplemented; this preparation is not a claim of completed effects or native pixel parity. The full production goal remains active. See [sprite preparation and required playback](ASHE-E.md#dust-and-smoke-sprite-preparation).

## Hawkshot Dust playback milestone

The original four-cell dust atlas now renders through one reusable instanced draw. Source-selected rate, randomized lifetimes, size/growth, rotation, color, velocity, drag and orbital ranges feed deterministic birth reconstruction. Camera-facing quads carry independent frame and alpha attributes without shared texture-offset mutation. Existing saved flight trajectories also reconstruct dust after arrival and let its tail expire. The atlas adds 10,401 requested bytes; smoke assets remain unused.

All 257 source/simulation checks, nine focused Chrome scenarios, production build and production smoke pass. Tests cover stable source sampling, motion covariance, saved instance equality, tail cleanup, draw reuse and actual GPU pixels for four distinct cells and alpha fading. Adjacent Hawkshot graphics-loss, Fresnel, body, wind and Owl3 scenarios pass. The screenshot was inspected and parameter export is byte-identical. The full browser suite and unchanged GLB validation were not repeated.

The implementation retains explicit provisional policies for half-extents, orbital units/order, unbound motion, birth phase, local randomness and fixed-step integration. These require native capture calibration before pixel/motion parity can be claimed. Smoke erosion/intersection fading, endpoint VFX, audio and the broader production goal remain incomplete. See [dust playback and evidence](ASHE-E.md#dust-atlas-playback).

## Hawkshot smoke and depth-fade milestone

Smoke_Trail now renders its original four-cell texture with randomized source lifetimes/scales, fade-in/out alpha, red-channel erosion and soft geometry intersections. A scene-depth pass runs only while smoke is active, preserves depth-writing material behavior and refreshes animated skeletons before capture. The latter fixes a first-frame stale-depth mismatch without relaxing exact pixel assertions. Depth targets resize, survive reconstruction and release after the tail or graphics loss. Existing flight trajectory state supplies saved continuation without a snapshot change.

All 259 source/simulation checks, 13 focused Chrome scenarios and the production build pass. GPU tests verify red erosion, smoothstep fade at controlled depth gaps, resize and target disposal. Existing Hawkshot and general recovery scenarios pass, including exact post-context-loss pixels. A production-only real-input Hawkshot cast consumed its charge and produced no console/request errors; fixture and production screenshots were inspected. Parameter regeneration is byte-identical. The full browser suite and unchanged GLB validation were not repeated.

All eight pinned flight emitters now have rendering adapters. This is not complete native visual parity: omitted defaults, RNG/phase/motion, source color interpretation, endpoint VFX and sound remain calibration/implementation gaps. The extra full-scene depth draw while smoke is active is a material performance cost and requires optimization against the production target. The full goal remains active. See [smoke and soft-intersection evidence](ASHE-E.md#smoke-trail-and-soft-intersections).

## Offscreen smoke depth-cost milestone

Smoke now tests conservative bounds for its complete instance quads before capturing scene depth. Fully offscreen effects skip both their draw and the additional scene pass. Initial offscreen rendering allocates no depth target; camera re-entry reuses an existing target while particles remain alive. Partial quads at the viewport edge are retained, and normal expiry/graphics-loss disposal remains intact.

All 259 source/simulation checks, eight focused Chrome scenarios, production build and a production real-input Hawkshot cast pass. New browser evidence confirms zero depth captures while offscreen, target reuse, exact camera-away/back pixel equality and correct partial-edge visibility. Existing soft-fade/erosion, resize, tail and context-loss pixel checks pass. The full browser suite and unchanged asset validation were not repeated.

Visible smoke still requires an additional full-resolution scene pass. Aggregate conservative bounds can retain a capture when separate offscreen groups straddle the viewport, so this is not the final depth optimization. Native visual calibration, endpoint effects, sound and the broader production scope remain unfinished. The goal remains active. See [offscreen culling behavior](ASHE-E.md#offscreen-smoke-depth-culling).

## Cropped smoke depth rasterization milestone

Visible smoke now captures depth only within conservative projected instance bounds, with outward rounding and a two-pixel margin. Near-plane crossings retain a full-frame fallback, and empty projected regions skip capture. Render-target scissor coordinates are physical pixels, preserving high-density display behavior. Texture resolution and effect shading remain unchanged.

All 261 source/simulation checks, nine focused Chrome scenarios, production build and a production real-input Hawkshot cast pass. The new browser comparison proves exact cropped/full final pixels at device pixel ratios 1 and 2 while the fixture capture covers less than one quarter of the framebuffer. Edge/fallback unit checks and neighboring smoke/graphics-loss scenarios pass. This saves rasterized area but does not reduce geometry submission or full-resolution target memory; those remain optimization opportunities. The full browser suite and unchanged asset validation were not repeated.

Native visual calibration, endpoint effects, audio and the broader production scope remain unfinished. The goal remains active. See [cropped depth behavior and evidence](ASHE-E.md#cropped-smoke-depth-capture).

## First Hawkshot endpoint Aurora milestone

Hawkshot now starts the pinned endpoint Aurora at its saved arrival tick. The original 128×128 texture adds 7,562 bytes; authored dimensions, emitter rotation, birth/color alpha, randomized short lifetime and upward velocity/drag feed a deterministic saved-age adapter. The burst fades independently of the five-second scouting reveal. Shared geometry/texture survive burst expiry; private opacity materials are released.

All 263 source/simulation checks, six focused Chrome scenarios, production build and a production real-input Hawkshot cast pass. New coverage checks arrival-only birth, pause, fresh restoration, lifetime cleanup, ongoing scouting and actual pixels. Visual inspection caught an unsupported incoming-flight yaw making the arbitrary quad edge-on; world-axis endpoint placement now retains only the authored emitter rotation. The inspected capture and byte-identical export are recorded in the effect documentation. The full browser suite and unchanged GLB validation were not repeated.

This is the first of five explosion emitters. Remaining explosion layers, all lingering layers, audio and native placement/phase/drag/RNG calibration remain unfinished, along with the broader production goal. See [endpoint Aurora evidence and limits](ASHE-E.md#first-endpoint-aurora-layer).

## Endpoint glow color-ramp preparation milestone

Verified the two endpoint glow emitters and decoded their shared 64×64 color-ramp texture. The 277-byte PNG preserves all RGBA pixels; its identical rows are also recorded as 64 exact samples. The source evidence shows opaque alpha throughout and a black-to-bright-to-black RGB ramp, separate from each emitter's authored alpha fade. Both glows reuse the existing base texture but have different uniform X scales (540/140 units).

All 264 source/simulation checks and the production build pass. The ramp was inspected, regeneration is byte-identical, and the built file matches the verified output. Browser and GLB checks were not repeated because runtime behavior is unchanged. The new ramp is not loaded by the renderer yet.

Emission phase, missing-primitive orientation and native ramp sampling/color space remain documented calibration questions. These two glow layers remain unimplemented, as do other endpoint/lingering effects, sound and substantial broader gameplay work. The goal remains active. See [glow ramp evidence](ASHE-E.md#endpoint-glow-ramp-preparation).

## Endpoint glow playback milestone

Both source endpoint glow layers now render with their distinct 540/140-unit uniform scales, exact RGB-ramp samples and independent alpha fade. They reuse the cached glow texture and geometry, derive deterministic variation and age from the saved flight, and release private materials on removal or expiry. No new texture request, gameplay rule or snapshot field is needed.

All 265 source/simulation checks, four focused Chrome scenarios, production build and a real-input production Hawkshot cast pass. Tests verify generated-source agreement, birth timing, paused/restored state, each layer's independent pixel contribution, expiry and material disposal. Profile regeneration is byte-identical; fixture and production screenshots were inspected. The full browser suite and unchanged GLB validation were not repeated.

Three of five explosion emitters now have rendering adapters. Rate-accumulator birth phase, camera-facing default orientation, full source rotation semantics, random distribution and native color interpretation remain explicit playback assumptions pending reference captures. DarknessFollow, radial smoke, all four linger emitters, sound and the broader production match remain unfinished. The full goal remains active. See [endpoint glow playback evidence](ASHE-E.md#endpoint-glow-playback).

## Endpoint DarknessFollow milestone

Hawkshot now renders its delayed single wispy endpoint particle with the source lifetime probability kink, randomized drift/scale/frame, birth alpha, lifetime fade and blue-channel erosion. It reuses the smoke atlas and WindTunnel's distinct erosion pack without new texture downloads. Source evidence and generated parameters are pinned, and private particle materials are released on removal or expiry.

All 267 source/simulation checks, four focused Chrome scenarios, production build and a real-input production Hawkshot smoke test pass. The new browser scenarios were repeated after adding an isolated capture. Controlled GPU coverage confirms blue-channel selection and full/half/zero erosion; state tests cover delay, pause, fresh restore and cleanup. Both generated files reproduce byte-identically. Combined and glow-hidden screenshots were inspected; the wispy particle is visible but subtle under the bright burst. The full browser suite and unchanged GLB validation were not repeated.

Four of five explosion emitters now have adapters. Radial smoke, four lingering layers, sound, native orientation/timing/shader calibration and the broader full-match objective remain incomplete. The goal stays active. See [DarknessFollow evidence and policies](ASHE-E.md#endpoint-darknessfollow-layer).

## Endpoint radial smoke milestone

The final explosion emitter now plays through one instanced smoke batch. It preserves the rising source rate, animated alpha rather than the distinct constant field, lifetime/velocity ranges, source scale growth, random atlas cells and horizontal drag. The adapter derives 50 births from the integrated rate curve, and saved arrival time restores every particle's phase. Existing smoke textures are reused; no image transfer or snapshot format change is needed.

All 269 source/simulation checks, five focused Chrome scenarios, production build and a real-input production Hawkshot smoke test pass. Tests cover source agreement, emission schedule, motion, alpha, pause/fresh restoration, actual pixels, expiry and batch reuse. Both generated files reproduce byte-identically and the fixture screenshot was inspected. The full browser suite and unchanged GLB validation were not repeated.

All five explosion emitters now have adapters. Normalized spawn curves, analytic integration, inclusive final birth, radial velocity coupling, orientation/default pass policies and native visual matching remain explicitly unverified. Four lingering layers, audio and the broader production match remain incomplete. The goal remains active. See [radial smoke evidence and assumptions](ASHE-E.md#endpoint-radial-smoke).

## Lingering effect source and dependency milestone

Prepared the complete four-emitter lingering effect and both missing textures. Lossless multiplication-band and sparkle PNGs total 3,501 bytes. Source/output/pixel hashes are pinned, and the skin-named erosion dependency is verified byte-identical to the existing base pack. Profiles retain missing fields explicitly, including Aurora's absent constant lifetime and the snow layers' different scale/orientation policies.

All 271 source/simulation checks and the production build pass. Both images were inspected, regeneration is byte-identical, and built images match the verified outputs. Browser and GLB checks were not repeated because runtime behavior and models are unchanged. The new textures are not requested by the renderer yet.

The audit identified a concrete playback dependency: the current scouting record expires at five seconds, while authored snow emission and active particle lifetimes permit tails beyond that point. The next implementation must preserve visual descriptors independently of vision expiry, with save/restore and no extra gameplay sight. Native shutdown behavior, texture-multiply semantics and orbital/cylinder defaults remain unresolved. Four lingering layers, sound and the full production objective remain unfinished. See [source evidence and lifecycle boundary](ASHE-E.md#lingering-effect-preparation-and-lifecycle-boundary).

## Independent saved scout visual lifetime milestone

Hawkshot arrival now records a presentation-only descriptor independently of its gameplay vision area. Emission stop uses the five-second reveal deadline; descriptor retirement allows one additional second for the maximum sustained-particle life. Sight, target validation and bot perception continue using the original vision sources. Snapshot version 21 preserves these descriptors and strictly validates identity, timing and expiry; version 20 is intentionally incompatible.

All 274 source/simulation checks, eight focused Chrome scenarios across endpoint rendering and checkpoint storage, production build and a real-input production Hawkshot smoke test pass. New tests cross the exact vision deadline, reject attacking a now-hidden target while the descriptor survives, restore during the tail and compare state through retirement. The browser saves/reloads the tail through IndexedDB without restoring expired vision. Existing save failure/incompatibility behavior still passes. The full browser suite and unchanged GLB validation were not repeated.

This supplies lifecycle state for the next rendering step; it does not yet display the four lingering layers. Capping source emission at the scouting deadline is a documented local policy pending native comparison. Sound, native effect semantics and the broader production match remain unfinished. The full goal stays active. See [saved presentation lifetime](ASHE-E.md#saved-presentation-lifetime).

## First sustained Sparkle playback milestone

Sparkle now renders from the independent saved visual descriptor, using its prepared full-image sprite, source uniform X size, triangular size curve, independent alpha fade, randomized spawn offsets and downward drift. The final particles finish after sight expires. Geometry/texture are shared; private materials are disposed when particles expire or become excluded by visibility. The new runtime image request is 3,128 bytes; snapshot version remains 21.

All 276 source/simulation checks, five focused browser scenarios, production build and a real-input production Hawkshot smoke test pass. Tests cover birth/growth/shrink, final emission, tail restoration, actual rendered pixels with expired vision, material disposal and checkpoint behavior. The new browser test was repeated while refining its diagnostic capture camera. Standard framing and a close-up raised to particle height were inspected; the latter shows the small blue cross without altering source particle size. Profile regeneration is byte-identical. The full browser suite and unchanged GLB validation were not repeated.

This implements one of four lingering layers. Aurora, Snow01, Snow02, source sound, native emission/orientation/color calibration and the full production match remain unfinished. The goal remains active. See [Sparkle playback](ASHE-E.md#lingering-sparkle-playback).

## Both sustained snow layers milestone

Snow01 and Snow02 now render through separate instanced batches sharing the existing shard atlas. Their distinct rates, heights, force/orbit parameters, nonuniform versus uniform scaling, direction orientation versus spin, frame selection and fade come from separate pinned profiles. Saved visual descriptors preserve their tails after sight expiry, with no new texture request or snapshot field.

All 278 source/simulation checks, four focused Chrome scenarios, production build and a real-input production Hawkshot smoke test pass. Browser evidence verifies each layer's independent pixels after reveal expiry, exact paused/restored buffers and empty batches after tail completion. Existing Dust atlas behavior passes. The source-scale fixture screenshot was inspected and both profiles regenerate byte-identically. The full browser suite and unchanged GLB validation were not repeated.

Three of four lingering layers have playback adapters. Force/orbit integration, native defaults, emission phase and visual parity remain unverified as documented. Linger Aurora, source sound and the broader full-match goal remain unfinished. The goal stays active. See [snow evidence](ASHE-E.md#lingering-snow01-and-snow02-playback).

## Lingering Aurora shader milestone

The remaining linger Aurora now renders its single drifting arbitrary quad with source lifetime, scale, alpha curve and blue erosion. A separately scrolling RGBA multiplication band adds 373 image bytes; the primary atlas and erosion pack are shared. Independent uniforms/materials restore from saved age and are released on expiry or removal.

All 280 source/simulation checks, four focused browser scenarios, production build and a real-input production Hawkshot smoke test pass. The Aurora browser scenarios were repeated after adding GPU scrolling/wrapping coverage. Tests verify source parameters, lifetime/drift/fade, pause/fresh restore, material cleanup, actual pixels, blue erosion, both RGB and alpha multiplication and repeat scrolling. The composite screenshot was inspected and profile regeneration is byte-identical. The full browser suite and unchanged GLB validation were not repeated.

All eight flight, five explosion and four lingering source emitters now have adapters. This establishes source-record coverage only. Native placement/defaults, probability/phase, color/UV semantics and rendered parity remain unverified; source sound and the broader production match remain incomplete. The goal stays active. See [lingering Aurora shader evidence](ASHE-E.md#lingering-aurora-playback).

## Complete browser regression and source-audio inventory

All 112 current Chrome browser scenarios pass in the full suite, including graphics recovery, checkpoint storage, combat, fog, structures and every implemented Hawkshot layer. This supersedes the earlier partial-browser coverage reports for the current runtime. The suite completed in approximately four minutes; it is not a full-match performance benchmark or native comparison. No runtime code changed in this step.

Extracted and pinned Ashe's two base SFX banks: 622,364 source bytes from 742,371 compressed patch bytes, retained only in the source cache. Archive resolution corrected legacy `wwise` names to the actual `wwise2016` entries. A pinned wwiser revision successfully parses bank format 145 and inventories 44 embedded media entries, 41 events and their sound/action/container counts. Extraction and inspection are reproducible scripts with pinned provenance. No audio media has been decoded, composed, listened to or added to browser playback yet.

The existing 280 source/simulation checks and production build were not repeated because this step changes only tools, source manifests and documentation. Native visual/audio calibration, source sound playback and the broader full-match production goal remain unfinished. See [source audio investigation](ASHE-AUDIO.md).

## Hawkshot source-audio event mapping

Resolved six named Hawkshot events to bank IDs, eight play/stop actions, two three-entry shuffle containers and nine distinct encoded media files. The reproducible mapper preserves selected parameter paths, inherited mixers and attenuation, and reports the missing shared output bus explicitly. It extracts 218,831 encoded media bytes to cache with bank-hash, binary index, parser-index, bounds and RIFF checks. Neither browser assets nor runtime code changed.

The source establishes a delayed cast, separate launch variant/loop layers and explicit stop transitions, including a 1.25-second linger sound fade. That fade exceeds the current visual tail and requires independent audio lifetime in the eventual runtime adapter. Regeneration of the graph/media is byte-identical. Decoding, listening, shared mixing and exact native dispatch remain unfinished; existing runtime checks/build were not repeated for this source-tool-only step. See [Hawkshot audio graph](ASHE-AUDIO.md#hawkshot-event-graph-and-encoded-media).

## Hawkshot float audio masters

Built pinned vgmstream and decoded all nine Hawkshot media files to cache-only float WAV masters. The reproducible decode manifest captures full frame/rate/channel metadata, source/PCM hashes, peaks, RMS, endpoint deltas and exact codec-library hashes. All files are mono 44.1 kHz with no embedded loop markers; source bank loop requests remain separate. Five recordings contain 22 samples above unit magnitude before gain, so float masters preserve headroom that a direct integer conversion would clip.

Repeat decoding produced identical hashes. A real Chrome 152 Web Audio decode check verified every float sample for all nine recordings, including values above 1. The approximately 5.32 MB masters are not runtime requests. No gameplay/render code changed; source/simulation checks, production build and the full browser gameplay suite were not repeated. Runtime source playback, listening comparison, shared mixing and native scheduling remain unfinished. See [decoded audio evidence](ASHE-AUDIO.md#decoded-source-masters-and-browser-verification).

## First source cast audio playback

Hawkshot now plays its three source cast variants with the mapped 150 ms delay and −12 dB authored gain. Source WAVs retain float headroom. Event-age scheduling handles batched simulation delivery, and a local shuffle bag avoids consuming gameplay randomness. The optional source preload falls back to synthesized feedback on failure.

Audio pause now suspends context time with the match; mute stops/disconnects voices immediately, ended nodes release connections, and checkpoint history is primed so old one-shots do not replay. All 281 source/simulation checks, seven focused Chrome audio/save scenarios, production build and real-input production Hawkshot smoke pass. Source profile regeneration is byte-identical. The full browser suite and full-match benchmark were not repeated.

This is source playback for the cast cue only. Launch/arrival/linger audio, spatial attenuation, shared-bus/native mixing, listening comparison and full-match production work remain unfinished. See [runtime audio scope](ASHE-AUDIO.md#first-runtime-source-playback-cast).

## Source arrival audio playback

Hawkshot now emits a single audience-frozen arrival event at the actual endpoint/tick and plays its verified 7.208-second source recording with authored −9 dB gain. The audio node survives visual retirement, seeks appropriately for delayed event delivery, suppresses already-finished cues, and uses the existing pause/mute/cleanup path. Source arrival loading is independent of cast loading and fails without blocking the match.

All 284 source/simulation checks, five focused Chrome audio scenarios, production build and a real-input production Hawkshot smoke test pass. Tests cover exact landing/single emission, hidden enemy information boundaries, checkpoint non-replay, full recording length/gain, late seeking and real node lifetime beyond visual expiry. Source export is byte-identical. Full gameplay browser regression and full-match benchmarking were not repeated.

Launch and persistent linger audio, spatial/shared-bus mixing, listening/native comparison and the broader complete production match remain unfinished. See [arrival audio evidence](ASHE-AUDIO.md#arrival-source-playback).

## Persistent source linger audio and version 22 saves

Hawkshot's endpoint now loops the source recording, seeks from saved simulation age, and schedules its authored 1.25-second stop transition. Reinspection corrected the earlier prose from Linear to the bank's actual Exp1 curve. Playback uses a documented polynomial amplitude interpretation pending native comparison. Pause freezes the loop; mute/visibility removal cleans up immediately; eligible re-entry resumes at the current phase. Completed identities prevent accidental tail restarts.

The saved presentation descriptor now includes the full 6.25-second visual/audio window. Snapshot version 22 rejects version 21; sight still expires at five seconds and particles retain their original lifetimes. Tests restore during the final audio-only quarter-second with no renewed vision.

All 286 source/simulation checks, ten focused Chrome audio/checkpoint scenarios, production build and real-input production Hawkshot smoke pass. Source export is byte-identical. Launch audio, shared/spatial/native mixing, listening comparison and the full production match remain unfinished. Full browser regression and full-match performance were not repeated. See [persistent linger evidence](ASHE-AUDIO.md#persistent-linger-playback-and-saved-fade).

## Both source flight audio layers

Hawkshot now plays a launch variant and separate persistent loop with source −8/−26 dB gain and paired 150 ms linear stop fades. Saved projectile state predicts exact arrival; endpoint state preserves the fade after arrival. Per-flight/layer voices seek correctly on restore or eligible re-entry, release on removal/mute/visibility loss, and remember natural completion to prevent tail restarts. Deterministic variant choice is a documented approximation of native shuffle behavior.

All 289 source/simulation checks, eight distinct Chrome audio scenarios across the initial and focused runs, production build and real-input production Hawkshot smoke pass. New checks cover source hashes/gains/stop curves, short/long-flight deadline prediction, restore consistency, loop versus one-shot phase, natural variant ending, exact stop scheduling and cleanup. Source export is byte-identical. Full gameplay browser regression and full-match performance were not repeated.

All nine prepared Hawkshot recordings now have runtime adapters. Native audio parity remains unverified: shared/spatial mixing, shuffle state, stop/fade dispatch, loop seams and listening comparison still need work. The larger full-match production goal remains unfinished. See [flight audio evidence](ASHE-AUDIO.md#flight-launch-variants-and-persistent-loop).

## Source attenuation interpretation and boundary evidence

Recovered the inherited six-point attenuation curve and positioning flags, generated a source profile and standalone evaluator, and sampled the pinned parser at 86 distances. Three focused tests compare source/profile identity and the independent parser outputs, including knots, interpolation and near-floor behavior; TypeScript checking passes and export is byte-identical.

The stored values are normalized, not literal dB: source distances 2,000 and 2,300 map to approximately −12 and −24 dB in the parser. Its special −1 floor introduces a tiny-amplitude boundary discontinuity that needs native validation. No listener coordinate policy or live attenuation was invented in this step; runtime playback remains unchanged. Existing hosting work was preserved separately. See [source attenuation](ASHE-ATTENUATION.md).

## Nested static-host regression coverage

The hosting change exposed four audio integrity-test path failures: relative asset URLs were concatenated into `publicassets/...`. The tests now resolve them beneath `public/` correctly. The map inspector also linked back to the domain root; its Practice game link now stays within the deployment directory.

Added `npm run test:production`, a reproducible production-build smoke test with a strict static server beneath `/nested/rift/` and no root fallback. It verifies map load/navigation, map-to-practice navigation, all nine source audio requests, no development hook, real keyboard/mouse aim and Hawkshot charge consumption, and zero console/request errors or requests outside the deployment prefix. Its game screenshot was inspected and confirms terrain, champion, HUD and effect rendering. The helper uses an ephemeral local port and closes its browser/server.

All 292 source/simulation checks and the production build/smoke pass. The existing lightweight deployment workflow remains unchanged. This verifies local production subdirectory behavior, not the current remote deployment or a full-match/browser-performance certification. Native reference calibration and the broader production match remain unfinished.

## Sparring bot attack commitment and recovery movement

Corrected a close-range decision bug that made a ready bot retreat instead of attacking. Bots now reserve close-range movement for attack recovery and retain valid committed windups when another target becomes nearer. Target visibility and low-health escape still take priority where appropriate. Coincident opponents use a fountain-directed escape instead of a zero vector.

All 298 source/simulation checks, the focused Chrome pursuit/pause scenario, and the nested-path production build/smoke pass. The initial three regression scenarios failed before the correction. Additional cases protect hidden-target cancellation, emergency retreat, checkpoint determinism and overlapping-unit escape. The browser capture was repeated after adding an explicit loading-screen wait and inspected. Full browser regression and full-match performance were not repeated.

Bot spellcasting remains disabled by single-human ability-state ownership. The required ownership separation and remaining 5v5 gaps are recorded in [bot combat notes](BOTS.md); this change improves the sparring bot without claiming native AI or complete matches.

## Independent champion state ownership

Added `ChampionState` records for every spawned champion while preserving `World.player` as the human HUD/input view. Each record owns its own mutable cooldowns, Focus, ammunition, cast state, progression and inventory. Charge regeneration and Focus expiry now advance per owner at their original before-command/after-combat phases, including recharge while dead. No bot spell command is enabled yet; execution and attribution still require owner-aware integration.

Snapshot version 23 persists other champion records alongside the human record, requires exactly one owner per champion, and applies cast/animation chronology checks to every owner. Version 22 is intentionally incompatible. Restore rebuilds independent records and discards presentation-event history.

All 303 source/simulation checks, six focused Chrome champion/save/bot scenarios and the nested-path production build/smoke pass. Tests verify no shared mutable state, distinct resource deadlines, exact restored continuation, ownership rejection and real IndexedDB reload with the human HUD still bound correctly. Full browser regression and full-match performance were not repeated. See [bot ownership scope](BOTS.md) and [save ownership](SAVES.md#champion-ownership).

## Champion combat ownership

Attack release now builds the attacking champion's Focus; Q attack speed, empowered animation-cycle flag and captured arrow damage read that owner's timer. Frost Shot, natural regeneration and respawn timing use the respective champion's level. Orders/movement/attacks/stuns clear the relevant cast animation; damage cancels the victim's recall. Death resets the victim's cast/Focus/recall and increments its death count while retaining cooldowns and E recharge. Victory clears every pending cast. State lookup avoids scanning units for ordinary nonchampion IDs.

Four new simulation regressions fail on the preceding commit and pass after this change, covering enemy attack Focus plus exact checkpoint continuation, independent Q timing/damage, enemy level scaling and death cleanup/recharge. All 307 source/simulation checks pass, along with seven focused Chrome scenarios (Q, bot kiting, ownership checkpoint/HUD and Frost Shot). The production build and strict nested-host smoke pass with all nine recordings, map navigation, a real Hawkshot cast and no development hook. Full browser-suite and performance runs were not repeated.

This extends the shared combat machinery, not the bot decision policy. Bot Q is verified using seeded state; actual nonhuman cast execution remains disabled. Progression/rewards, cast execution/presentation and the broader complete-match work remain outstanding. Snapshot shape remains version 23, with the changed simulation fingerprint protecting incompatible checkpoints.

## Shared champion spell execution

Champions now submit Q/W/E/R/Flash/Heal through the same command path with their own Focus, charges, mana, cooldowns, cast animation and pending windup. Release resolves each owner's pending spell. Cooldown queries accept an optional champion ID while preserving the human HUD default. Cast rejection and recall feedback use the caster's team audience. Recall channels and source animation use the owning record and return to the appropriate fountain. The renderer no longer substitutes the human cast/recall timeline for other champions.

Seven new simulation scenarios cover enemy W/E/R spending and exact checkpoint continuation through release, private cooldown rejection, Q activation/reset, red recall destination and Heal during a pending spell. All 314 checks pass. Eight focused Chrome scenarios pass, including enemy cast/recall source clips and damage interruption, existing human W/E/Heal and recall animation regressions. The production build and nested-host smoke pass. Full browser/performance suites were not repeated; snapshot shape remains version 23 with a new simulation fingerprint.

Bot decision logic still submits movement/attacks only. The next work is tactical spell decisions using permitted team observations and independent progression/rewards. This is shared local spell execution, not a complete AI policy or native-client parity.

## Independent champion rewards and source minion sharing

Champions now earn ambient gold and last-hit bounty/CS/kill credit independently, with team-private reward feedback. `gainExperience` accepts a champion ID and updates that owner's source growth stats. Nearby living champions on either team now receive minion XP using the pinned standard-mode `mPlayerMinionSplitXp` table, corroborated by Riot's 26.1 notes. The map hash/mode link/original float table are checked by the new exporter. Three-way sharing preserves the authored 0.433 value.

Nine new source/simulation cases cover the exported table, one through five enemy recipients, last-hit exclusivity, dead/distant/capped recipients, independent growth and saved continuation, and ambient income through death. An existing super-minion fixture includes two nearby allies; its XP assertion now checks 48.75 per recipient instead of incorrectly expecting a solo 75. All 323 checks pass. Four focused Chrome scenarios pass (progression/HUD, economy/shop, bot kiting, ownership checkpoint), as does the production nested-host smoke. No full-browser or performance sweep was repeated.

Champion-kill XP is still the prior human-only approximation. Its standard-mode curve has been located for follow-up, but kill participation, assist sharing, role penalties and catch-up rules need work before a parity claim. Minion sharing counts capped living recipients and clamps artificial populations above six to the final table entry; those are explicit local eligibility/fallback policies. Bot buying and spell decision policy remain outstanding.

## Autonomous Ranger’s Focus

The sparring bot now queues Q during attack recovery against a visible, vulnerable champion in attack range when its own Focus, mana and cooldown permit it. Existing 18-tick thinking cadence is preserved; a valid committed windup and low-health retreat take precedence. The queued cast goes through normal next-tick validation and attack-reset execution, including rejection if a stun arrives after the decision. This is a local policy, not native AI behavior.

Four new deterministic cases verify queued activation with independent state and exact saved continuation, visibility/range/resource/retreat exclusions, committed windup preservation and intervening stun. The browser pursuit scenario now advances ten simulated seconds from zero Focus, observes autonomous Q and empowered attacks, and still verifies kiting, damage and paused-state invariance. All 327 source/simulation checks, six focused Chrome scenarios and the production nested-host smoke pass. The inspected `artifacts/browser-bot-kiting.png` still shows overlapping champions in the fixture; unit collision remains outstanding. Full browser/performance suites were not repeated.

Other bot spells, coordinated decisions, tower safety, champion-kill XP and purchases remain incomplete. Q still follows the existing rank-one local spell mechanics and aggregated damage representation; this step does not establish full champion or match parity.

## Autonomous Volley pursuit

The sparring bot now queues Volley against a visible champion beyond basic-attack range when its own mana/cooldown permit it, preserving attack windups, retreat priority and the existing thinking cadence. The ordinary queued cast path handles windup, resources and release. Aim is copied from the observed target position and does not track hidden movement after decision. Q remains the in-range recovery action.

Four simulation cases verify owned release with exact checkpoint continuation and hit/slow, exclusion conditions, aim retention through vision loss and rejection after intervening stun. The test pathfinding stub initially copied entire units into path points; narrowing it to x/y fixed its strict checkpoint rejection. All 331 source/simulation checks, five focused Chrome scenarios and the production nested-host smoke pass. The new browser case observes autonomous Volley animation, damage, critical slow and separate cooldowns. Full browser/performance sweeps were not repeated.

This local pursuit policy does not predict dodges, estimate arrow obstruction, reserve mana or choose lane-clear opportunities. E/R/Flash/Heal decisions, team strategy, purchases, champion-kill XP and unit collision remain outstanding.

## Full browser regression and refreshed Rift observation

At runtime commit `d361405`, all 124 Chrome scenarios pass in the full browser suite (4.4 minutes). This supersedes the recent focused-only coverage for champion ownership, autonomous Q/W, reward sharing and audio integration. Coverage includes saves, source model/particle timelines, graphics recovery, fog/picking, structures, input and HUD; it does not establish native-client or complete-match parity. No runtime changes were needed for this verification.

A separate, sequential full-Rift benchmark on Chrome 152.0.7977.83 / Apple M5 Pro / 64 GiB at 1920×1080 advanced to 90 seconds, warmed up 45 frames and sampled 180 frames. The scene held 103 unit records, 231 draw calls and 379,519 submitted triangles. Frame median/p95/p99 were 16.6/18.3/22.6 ms. Simulation step median/p95/p99 were 0.2/0.3/0.4 ms; 22 fog updates measured 1.0/1.5/1.6 ms. The machine-readable results and tested revision are retained in `docs/reference/runtime-verification.json`. The capture `artifacts/rift-benchmark.png` was inspected and shows the source Rift lane and active minion combat.

Frame p95 remains above the 16.7 ms target. Different live unit counts and a short sample prevent a controlled improvement claim against prior runs. This is a development-build observation without a full 5v5 roster, camps or spell stress scene. It indicates that ordinary simulation cost is small in this fixture; rendering/frame tails and representative stress coverage still require work. The benchmark's time jump also leaves the wall-clock welcome announcement visible at 1:33 in the capture, a presentation timing issue to investigate. The production goal remains incomplete.

## Welcome announcement follows match time

The Rift benchmark exposed the welcome banner still playing at simulated 1:33 because its CSS animation used wall time. The HUD now seeks a paused CSS animation from the current simulation tick. Pause freezes its presentation; advancing beyond its existing eight-second duration leaves it hidden immediately. The reduced-motion one-second duration is retained, and checkpoint loads still suppress the welcome banner. Tick updates are cached and clamped to the endpoint so a completed announcement does not cause recurring style changes. These durations are existing local presentation choices, not a claim about native announcement timing.

All 331 source/simulation checks pass. Six focused Chrome cases pass (two new timing/reduced-motion tests plus four save scenarios); the two timing cases were rerun after caching the endpoint. The production build and nested-host smoke also pass. The prior complete 124-case run predates this small HUD change; a full rerun/performance measurement was not repeated. The new browser checks verify initial/visible/fading/finished states, pause, a 90-second jump and reduced motion.

## Scoreboard champion ownership

The held scoreboard now renders one row per actual champion, grouped by team, using that owner's kills, deaths and CS. It no longer derives the opponent's score by reversing the human record. The top team score sums credited champion kills while the personal K/D display remains bound to the human. The open panel refreshes when its data changes, with a signature cache avoiding unnecessary DOM replacement. Names are inserted as text. The panel has a bounded scroll area for larger rosters.

All 331 source/simulation checks pass. Eleven existing game browser checks and the new scoreboard ownership scenario pass. The first new-test attempt kept gameplay paused, where Tab is intentionally disabled; resuming the fixture before the real Tab key fixed the test setup. The scenario uses actual minion-caused and champion-caused deaths, verifies four distinct rows and team/personal totals, checks literal name rendering, and observes CS updates while held. `artifacts/scoreboard-ownership.png` was inspected. Production build and nested-host smoke pass; the full browser suite was not repeated after this change.

Assists remain the existing zero placeholder until participation tracking exists. The scoreboard does not yet provide the full native inventory/level/timer/team layout. This corrects attribution and roster rendering, not complete scoreboard parity.

## Shared purchasing and bot fountain plan

`buy` now accepts a champion ID, resolves its team fountain and applies gold/inventory/stat changes to that owner. The default remains the human shop API. Buying a health item while dead no longer adds current HP, preventing accidental revival while retaining maximum-health growth for respawn. Bots at their own shop radius, after retreat handling, attempt one item per decision from the finite local Blade → Boots → Pickaxe → Long Sword plan. They save toward the next missing item and stop when the plan is owned.

Five new simulation cases cover independent changes, rejection rules, dead purchases/respawn for both owners, deterministic automatic purchase continuation and saving/fountain restrictions. All 336 source/simulation checks pass. Thirteen focused Chrome scenarios pass, including automatic enemy purchase/checkpoint identity with unchanged human inventory/balance, economy/shop and existing gameplay. The production build and nested-host smoke pass. Full browser/performance suites were not repeated.

The four-item catalog and fixed purchase plan remain practice approximations; recipes, complete itemization, selling and adaptive builds are unfinished. This enables spending independently earned bot gold without claiming a native shop or build policy.

## Defensive bot Heal

Bots below 22% health outside their own shop radius now queue available Heal when an enemy champion is visible within 1,150 units. The normal command path owns effects, ally selection, cooldown and next-tick validation; retreat continues. Defensive planning runs before stun/pending-cast handling so Heal can be chosen while disabled or winding up. AI deadlines advance on the existing 18-tick cadence in those states, while offensive/movement decisions remain gated.

Four new simulation scenarios cover retreat Heal and saved continuation, stunned activation without movement, preservation of pending Volley, and eligibility exclusions. The Volley retreat assertion now checks absence of W specifically because defensive F is allowed. All 340 source/simulation checks, five focused browser scenarios and the production nested-host smoke pass. The new Chrome case observes actual Heal, independent cooldown, haste deadline and unchanged stunned position. Full browser/performance suites were not repeated.

The health/threat distances are local bot policy; incoming damage estimates, coordinated healing, R/E/Flash decisions and complete native behavior remain unfinished.

## Champion-kill XP source audit

Preserved and verified the complete standard-mode experience curve `{c6f6a84c}`, its map hash/link, the 1,600-unit XP proximity constant and the ten-second credit-after-death constant. The first ten base rewards match Riot's 13.4 release notes; the full supported curve ranges from 42 XP at level 1 to 990 at level 18. The current flat 180 award and 1,400-unit human-only collection are therefore known deviations. Original sharing and level-difference arrays are retained without inventing absent defaults.

`docs/CHAMPION-KILL-XP.md` specifies the remaining contributor/death-transaction boundary and validation cases. The source record alone does not settle shared coefficient indexing, capped recipient eligibility, assist windows or negative-level modifier semantics. In particular, credit-after-death duration must not be reused as an assist window. `python3 tools/assets/verify-champion-kill-xp.py` passes, checking full record identity plus independently published base values. No runtime code changed, so gameplay/browser suites were not repeated. This is evidence for the next implementation, not completed champion reward parity.

## Persistent damage contributions

Champion state now retains one latest positive-damage tick per opposing champion contributor. Refreshing an attacker updates its existing entry; lethal damage is included. Death retains history, and respawn clears it for the new life. Zero/friendly/nonchampion damage is excluded. Version 24 checkpoints require the new field and validate unique opposing champion identities and timestamp/death chronology. Version 23 is incompatible; history is not fabricated during migration.

Four new simulation cases cover refresh/ownership, exclusions, lethal retention plus exact checkpoint/respawn continuation, and malformed histories. All 344 source/simulation checks and seven focused browser scenarios pass. The new Chrome case writes and reloads the real manual checkpoint, verifies contribution identity and paused restoration, and confirms no combat events replay. Production build and nested-host smoke pass. Full browser/performance sweeps were not repeated.

This is provenance for the pending death-reward transaction. It does not award assists, resolve executions, choose an assist lifetime, track support/CC-only contribution or replace the legacy champion-kill XP approximation. Those remain explicit fidelity work.

## Source-window damage assists

The pinned standard-mode `Configs` link resolves `{4fd6b68d}` with `AssistDurationOverride = 15`, distinct from ten-second post-death XP credit. The full record/hash/link are retained and verified by `tools/assets/export-assist-window.py`. Direct champion kills now increment other recent damage contributors' independent assist counters. Repeated hits do not duplicate assists; the killer is excluded. HUD personal score and held scoreboard display those counters. Version 25 adds the counters and rejects version 24 saves.

Four new simulation scenarios cover direct-kill attribution, the inclusive 900-tick boundary, dead/distant contributors through checkpoint continuation and red-team ownership/nonchampion final-blow exclusion. All 348 source/simulation checks, seven focused Chrome cases and production nested-host smoke pass. The new Chrome scenario observes a real damage assist in both score displays. Full browser/performance suites were not repeated.

Boundary inclusivity is the local fixed-tick convention; support/reveal assists, execution attribution, assist gold and champion-kill XP still require work. The source configuration also contains hashed bounty fields, which remain uninterpreted rather than guessed.

## Hawkshot reveal assists

Hawkshot now records unseen-to-visible champion transitions separately from damage contributions, using the ten-second assist rule documented in Riot's 9.1 notes. Landed scout areas retain their caster ID, so an enemy walking into the lingering vision can grant credit. Ordinary allied sight takes precedence, continuous visibility does not refresh the contribution, and damage/reveal IDs deduplicate on a direct champion kill. Respawn clears reveal history. Version 26 stores reveal contributions and scout ownership and rejects version 25 checkpoints.

Six new simulation cases cover damage/reveal deduplication, already-visible exclusion, ten-second boundary with saved continuation, landed-area entry, invalid saved owners/timestamps and both team orientations. The initial ownership-validation fixture sampled before the hawk had landed; advancing to tick 120 corrected that fixture. All 354 source/simulation checks, eight focused Chrome scenarios and production nested-host smoke pass. The new browser case verifies an occluded reveal, checkpoint continuation, subsequent ally kill and HUD assist count. Full browser/performance suites were not repeated.

Scout radius remains provisional, simultaneous ordinary sight wins locally, and overlapping Hawkshots use current iteration order rather than measured native tie-breaking. These policies and conditional transition-scan costs are documented in ASHE-E.md. Heal support assists, execution credit, assist gold and champion-kill XP remain unfinished.

## Preserve latest damage contributor order

Execution research found inconsistent 13/15-second community descriptions without a separately identified pinned execution constant. No reward window was guessed from the assist override. Inspection did expose a prerequisite defect: refreshing a contributor in place preserved its first insertion order, losing the latest hitter when multiple attackers damaged a victim in one tick. Refreshes now move the source to the end, retaining exact local processing order. Checkpoint validation rejects decreasing damage ticks and preserves equal-tick order. Format remains 26 with a new simulation fingerprint.

Two new cases cover same-tick repeated-attacker order through checkpoint continuation and rejection of reversed chronology. The existing timestamp test now expects latest-hit order. All 356 source/simulation checks, three focused contribution/assist browser scenarios and the production nested-host smoke pass. Full browser/performance sweeps were not repeated. Execution reward eligibility is still unfinished; this change preserves evidence needed to resolve it correctly.


## Champion base kill gold by victim level

Replaced flat 300 champion base gold with the pinned standard-mode level table: 300 at levels 1–6, then 310–420 at levels 7–18. Official 25.09 bounty tuning independently corroborates the progression. The exporter checks the full cached map hash, mode/config link and retained configuration before producing the runtime table. Rewards use the victim level before XP distribution and belong to the opposing champion source, including posthumous sources; explicit practice overrides remain supported.

All 361 source/simulation checks, two focused Chrome scenarios and the nested-path production smoke pass. Coverage includes all 18 victim levels on both teams, different killer levels, duplicate death protection, saved continuation, posthumous rewards, overrides, nonchampion final blows and the HUD balance. The full browser suite and performance benchmark were not rerun. First blood, positive/negative bounties, assist gold, execution attribution and champion-death XP remain incomplete. See [economy evidence](ECONOMY.md#champion-base-kill-gold).


## First-blood gold and persisted claim

Implemented the pinned +100 first-blood bonus, corroborated by official 26.1 notes. The first credited opposing champion kill adds the bonus to its gold event and marks a match-wide claim before processing subsequent deaths. Both teams and posthumous killers are supported; assistants receive no bonus. Nonchampion targets, same-team debug kills and uncredited deaths do not claim it. Snapshot 27 stores the required boolean and restores without replaying rewards.

All 366 source/simulation checks, six focused Chrome cases (reward display, assists and save flows), and the nested-path production smoke pass. New scenarios cover same-tick trades in both team orders, assistant exclusion, nonqualifying deaths and checkpoint continuation before/after the claim. The full browser suite and performance sweep were not repeated. Native simultaneous-kill ordering, execution attribution, remaining bounty rules and announcement presentation remain unfinished; the full production objective remains active.


## Full browser verification after champion reward changes

Ran the complete Chrome suite against unchanged runtime `1b279b6`: all 133 scenarios passed in 4.6 minutes, including combat ownership, bots, assists, first-blood gold, snapshot 27, graphics recovery, structures and presentation. This replaces reliance on the older 124-case run for current integration coverage.

Refreshed the 90-second full-Rift practice benchmark on Chrome 152 / Apple M5 Pro / 64 GiB at 1920×1080, after 45 warmup frames with 180 samples. The scene contains 103 unit records and submits 231 draw calls / 379,519 triangles. Frame median/p95/p99: 16.6/18.9/23.0 ms. Simulation: 0.2/0.3/0.4 ms. Fog updates (22 samples): 1.3/1.7/1.9 ms. The screenshot was visually inspected; the expired welcome overlay is absent and terrain, lane units, fog and HUD render. The dedicated development server was stopped after measurement.

Updated [runtime evidence](reference/runtime-verification.json), retaining the previous record separately. This short development-build observation does not establish a performance regression or improvement, native pixel parity, full 5v5 performance, or cross-browser certification. Frame p95 remains above 16.7 ms. Complete camps, nine role bots and heavy spell stress remain absent, and the production objective remains active.


## Assist-gold source and mode audit

Compared full standard-mode bounty records from 15.24 and 16.18 and retained hashed source files/configuration records with every matching mode link. Two unnamed candidate timing fields changed from 90/210 to 55/175 in standard mode; 16.18 URF, Swiftplay and Ultimate Spellbook still retain 90/210. Three adjacent fractional fields remain 0.25/0.5/1. The checked CommunityDragon field-name dictionary does not resolve these five hashes.

Added an executable verifier for both map hashes, complete records, mode links, expected cross-version differences and dictionary coverage. It passes; documentation diff checks pass. The [assist-gold audit](ASSIST-GOLD.md) separates those verified values from speculative formula meanings, records official bounty/first-blood dependencies, and specifies controlled timing and reward experiments. No runtime payout was changed and no browser rerun was needed. A simple half-of-final-kill-gold formula would mix first-blood/positive bonuses with the assist pool and ignore unresolved time/devaluation rules. Assist gold remains unfinished; the full production objective remains active.


## Owned-item selling

Added `sell(slot, championId)` and owned-item sale buttons in the shop. Each transaction validates owner, slot, shop access and match state, removes one inventory copy, credits its pinned sell amount, and removes its flat stats. Both team fountains and dead owners are supported; selling health cannot revive a dead champion or reset its respawn deadline. The shop refreshes owned rows and balance after purchases and sales.

Pinned and verified Data Dragon 16.18.1 values: Blade 180, Boots 210, Long Sword 245, Pickaxe 613. All 370 source/simulation checks, two focused browser scenarios, the subsequent screenshot capture run and the nested-path production smoke pass. Inspected the shop capture with an owned Long Sword; text, prices and action remain readable. Full-suite/performance checks were not repeated. Living health removal uses an explicitly documented local policy; native inventory slot retention, undo, recipes, Doran's passive and complete shop fidelity remain unfinished. See [selling rules and source](ECONOMY.md#selling-owned-items).


## Inventory slots remain stable after selling

Sales now clear an inventory position instead of shifting later items. Purchases fill the first empty position before appending. The six-slot limit counts available positions correctly even when the stored array has interior gaps. Shop sale rows retain original slot indices, and the HUD already renders each position independently. Snapshot 28 permits null empty positions while retaining item-ID validation and the six-entry limit; only trailing empties are omitted.

All 373 source/simulation checks, six focused Chrome cases (sales/HUD slot placement and saves) and the nested-path production smoke pass. New tests cover both teams, multiple gaps in full inventories, rejected repeat sales, buy placement after restore and invalid snapshot slots. Browser input verifies that selling slot 1 leaves Boots in slot 2 and a subsequent Pickaxe purchase fills slot 1. Full-suite/performance checks were not repeated. Drag/reorder, item actives, undo, recipes and complete native shop presentation remain unfinished; the production objective remains active.


## Drag-and-drop inventory ordering

Added champion-owned `moveItem` swaps and moves into empty slots, available away from the fountain and while dead without changing stats or gold. The HUD supports native mouse dragging between its six positions, checks source identity at drop, ignores external drag payloads and blocks modal/paused drops. Occupied slots show a grab cursor; source images do not initiate independent image drags. Saved null positions preserve reordered inventories and subsequent sale slot labels.

All 375 source/simulation checks, three focused Chrome cases and the nested-path production smoke pass. The initial real-mouse test exposed inherited HUD pointer transparency; enabling inventory-grid pointer handling fixed the intercepted drag, and the rerun passed. Browser coverage swaps occupied slots, moves to slot 6 and verifies unchanged stats/gold plus the shop's updated sale label. Unit coverage includes enemy/dead ownership, invalid operations and saved restoration. Full-suite/performance checks were not repeated. Item actives, keyboard reordering, undo, recipes and native presentation calibration remain unfinished; the full production objective remains active.


## Component purchases and first health recipe

Added Ruby Crystal and Giant's Belt with pinned stats, prices, sell values and local source icons. Buying Belt consumes one owned Crystal and charges 500 remaining gold; direct purchase costs 900. Purchase planning uses distinct component slots and validates the complete transaction before mutation. Full inventories can upgrade through a consumed slot, duplicate components remain independent, and only net flat stats are added. Shop price labels use the same plan and refresh after purchases/sales.

All 379 source/simulation checks, four focused browser scenarios, both source verifiers and the nested-path production smoke pass. Inspected the expanded shop capture: both new icons, stat descriptions, balance, owned item and sale value are readable. Tests cover both teams, full inventory upgrades, insufficient funds, duplicate components, checkpoint restoration and dead owners. Full-suite/performance tests were not repeated. Recursive recipes, native slot-selection/health calibration, undo, broader item effects and full-match systems remain unfinished; the production objective remains active.


## Live shop purchase feedback

Extracted a read-only `purchaseError` query shared by the purchase transaction and shop feedback. Open shop cards now update quoted recipe cost, accessible unavailable state, reason title and muted icon/price styling as funds, inventory and fountain access change. Validation continues at purchase time. Capacity checks account for component consumption, so a full inventory can still upgrade its Ruby Crystal.

All 380 source/simulation checks, 13 Chrome scenarios and the nested-path production smoke pass. The new browser scenario covers an open shop transitioning through unaffordable, full-inventory recipe, out-of-fountain and available states. A fractional-funds scenario checks read-only validation and atomic rejection. Inspected the captured shop after a purchase: unavailable catalog icons/prices are muted while the owned item remains distinct. Full-suite/performance checks were not repeated. Native shop layout, persistent reason panels, recursive recipes, undo and the full production scope remain unfinished.


## Doran's Blade omnivamp

Implemented the pinned 2.5% omnivamp and one-Doran-item ownership group. The shop description now includes the effect. Damage processing differentiates direct hits from area spells so current Volley and Crystal Arrow area damage against minions heals at the official 26.1 33% effectiveness, while attacks and champion damage use full effectiveness. Healing follows current inventory ownership, does not revive dead sources and stops after sale.

All 384 source/simulation checks, three focused Chrome scenarios and the nested-path production smoke pass; the item/group source verifier also passes. Tests cover both teams, mitigated damage, minion direct/area differences, selling, duplicate ownership, missing-health cap, posthumous sources, save continuation and visible HUD healing. Full-suite/performance checks were not repeated. Overkill treatment, event timing and unsupported dummy targets are explicit local policies; shields, heal modifiers, damage-over-time/pet systems and native comparison remain unfinished. The full production objective remains active.


## Omnivamp through projectile collision and saved casts

Added integration scenarios that queue real W/R casts, save after projectile release, and run collisions against a champion and nearby minion. Identical control worlds retain flat stats and regeneration while omitting only Doran ownership, isolating the healing effect. Both spells apply full champion healing and reduced minion area healing, with byte-identical saved continuation. A separate in-flight Volley scenario sells Doran before impact and verifies that damage still lands without healing.

All 387 source/simulation checks pass. A deliberate local fault injection changed the two spell damage classifications to direct: both new W/R cases failed, confirming that the tests detect missing minion area scaling. The original runtime was restored in a finally block and the final diff contains no runtime edits. Browser and production checks were not rerun for this test-only change. Native overkill/event timing, complete healing modifiers and the overall production objective remain unfinished.


## Cloth Armor and Chain Vest

Added source-pinned Cloth Armor and Chain Vest, their local icons, sell values and component recipe. Item transactions now add/remove flat armor and apply only the net armor difference when consuming a component. Existing damage mitigation consumes the updated armor; selling retains champion level growth. Both teams and saved continuation are covered.

All 390 source/simulation checks, three focused Chrome scenarios, armor/sell source verifiers and the nested-path production smoke pass. Browser input verifies the armor HUD through purchase, upgrade and sale. Inspected the expanded shop capture: new icons and prices render, but the growing catalog scrolls the header out of view, leaving a known layout improvement for the full shop design. Full-suite/performance checks were not repeated. Adaptive bot builds, broader defensive effects and complete native shop/match fidelity remain unfinished; the production objective remains active.

## Shop scrolling and persistent controls

Split the shop into independently scrolling catalog and owned-item panels. Gold, section labels, transaction feedback and the close control remain outside those scrolling regions. Desktop uses side-by-side panels; narrow windows stack them within the viewport. Existing buy/sell and component-cost behavior remains connected to the same controls.

All 390 source/simulation checks, eight focused Chrome scenarios and the nested-path production smoke pass. New layout scenarios fill all six slots, scroll to the final catalog and owned entries, sell, and close at 1440×900, 1366×768 and 600×700. They check stationary controls, fully visible labels/feedback and no horizontal dialog overflow. Inspected laptop and narrow-window captures. Full-suite/performance checks were not repeated. This resolves the observed growing-catalog overflow; native shop parity, comprehensive items and the full production objective remain unfinished.

## Live owned items and keyboard selling

The open shop now reconciles owned controls when the actual inventory changes, retaining unchanged buttons instead of rebuilding the list after every transaction. Selling a focused item transfers focus to the next occupied slot, the previous remaining slot, or the close control when empty. Sale clicks validate the displayed item against the current slot before transacting, preventing a stale control from selling a replacement item.

All 390 source/simulation checks, seven focused Chrome scenarios and the nested-path production smoke pass. New browser cases cover an external purchase while a sale control is focused, keyboard-only sequential sales through closing the empty shop, and an inventory swap immediately before a stale click. Existing sale and three viewport layout scenarios pass. Full-suite/performance checks were not repeated; native shop fidelity and the full production objective remain unfinished.

## Null-Magic Mantle and Negatron Cloak

Added pinned magic-resistance components, their source icons and the Mantle-to-Cloak recipe. Purchases apply net resistance after consuming components; sales preserve unrelated stats and champion level growth. This adds a defensive response to magic damage alongside the existing armor purchases.

All 393 source/simulation checks, five focused Chrome scenarios, resistance/sell source verifiers and the nested-path production smoke pass. Both teams cover mitigation, true damage, sale and saved continuation; browser input covers buying, upgrading and selling, and the larger catalog retains the three viewport layout checks. Inspected the new icon/description/owned-item screenshot. Full-suite/performance checks were not repeated. The compact HUD still needs a magic-resistance readout; adaptive builds, full item effects and native match fidelity remain unfinished.

## Magic resistance in the combat HUD

Added current rounded magic resistance beside armor in the compact stat column. The column retains its width, permits native title tooltips, and distinguishes the MR abbreviation from neighboring symbols. Extended the real shop scenario to assert the visible 33→53→78→33 resistance sequence through purchase, upgrade and sale, then verify all five stats are in the viewport after closing the shop.

All 393 source/simulation checks, the focused Chrome scenario and nested-path production smoke pass. Inspected the captured combat HUD: the fifth row fits inside the existing panel. Full-suite/performance checks were not repeated. The MR abbreviation is a local presentation choice; authentic stat icon assets, full stat details and overall production fidelity remain unfinished.

## Source League stat artwork

Replaced the five compact HUD placeholder glyphs, including the MR abbreviation, with the pinned League stat atlas regions. Kept the original atlas intact and used CSS backgrounds with verified coordinates. The existing stat column dimensions and live values remain in place; each row has an accessible stat name and native title.

All 393 source/simulation checks, the focused shop/HUD browser case, stat-atlas verification and nested-path production smoke pass. Inspected development and production screenshots: all five colored stat symbols render beside their values. Full-suite/performance checks were not repeated. The added atlas is 164,668 bytes; exact native HUD icon selection, sizing, type and placement still require visual calibration. Overall production fidelity remains unfinished.

## Source League interface typography

Replaced approximate DOM interface fonts with local Beaufort for LOL and Spiegel faces from the pinned game assets. Added font provenance and a verifier for the definitions and binary files; removed the unused font packages. Existing layout and text sizes are retained for this step.

All 393 source/simulation checks, four focused Chrome HUD/shop scenarios, font-source verification and nested-path production smoke pass. Inspected HUD, narrow shop and production screenshots with the new font metrics. The five source files total 560,480 bytes before transfer compression. Full-suite/performance checks were not repeated. Native typography size/weight/spacing calibration, renderer text and localization coverage remain unfinished; the full production goal remains active.

## Font readiness before play

Startup now explicitly loads all five shipped interface font faces alongside other assets before removing the loading screen. This includes the medium heading face first used by menus. Failed font loads are handled as cosmetic failures and allow fallback text instead of interrupting the match.

All 393 source/simulation checks, two focused Chrome scenarios and nested-path production smoke pass. Browser cases hold a font response during cold boot, confirm loading remains active, then verify all five faces are available after release; a separate case aborts every font download and verifies that the match and shop still open. Full-suite/performance checks were not repeated. Pending font requests follow the browser's network lifecycle; no separate font timeout is introduced. Native typography calibration and full production fidelity remain unfinished.

## Full browser regression after item and typography changes

Ran all 148 current Chrome scenarios against commit `4844626`, with one worker and no retries. All passed in 5.0 minutes. The durable record in `reference/browser-regression.json` identifies the exact tested commit, complete scenario list and original output digest. No runtime edits were made during this run.

Coverage includes combat and animation timing, bot interactions, items and recipes, drag/reorder and keyboard selling, three shop viewport layouts, font readiness/failure fallback, saves, graphics loss/restoration, vision and map behavior, structures, summoner healing and announcements. This broadens evidence beyond the earlier focused runs. Performance was not rerun: the prior p95 frame result remains above target. Current-suite success does not establish full 5v5 behavior, native visual parity, complete roster/items or production completion.

## Stop hidden shop work during combat

HUD updates now skip the shop subtree unless the shop is open. Closing the modal retains its DOM, which previously caused all ten catalog purchase validations, recipe quotes and inventory reconciliation checks to continue during normal play. Reopening still reconstructs current inventory and gold and resumes live availability updates.

The new browser regression failed before the fix with 1,000 purchase validations across 100 closed-shop HUD updates, then passed with zero afterward. It also verifies externally purchased inventory and discounted recipe cost on reopening. All 393 source/simulation checks, four focused Chrome cases and nested-path production smoke pass. This proves removal of unnecessary calls, not a measured FPS improvement; the prior frame-time target remains unmet and no new frame benchmark was run. Full production fidelity remains unfinished.

## Current Rift timing with HUD instrumentation

Extended the scoped benchmark to open/close the shop before measurement and time HUD updates and render calls separately. Instrumented methods are restored afterward; missing samples fail the run. Retained the previous record and recorded the new measurement and exact harness digest in `reference/runtime-verification.json`.

On the recorded Chrome/Apple M5 Pro setup at 1920×1080, 180 samples of the 103-unit Rift scene show frame median/p95/p99 of 16.7/18.8/22.2 ms. HUD update p95 is 0.3 ms (51 samples), simulation step p95 0.3 ms, render-call p95 5.2 ms and fog p95 1.7 ms. Render timing includes nested fog work and is CPU wall time, not GPU execution. Inspected the battlefield capture. The p95 frame target remains unmet; this directs further profiling toward rendering/browser/GPU costs, without claiming a controlled improvement over earlier records. No runtime changes or new full-suite run were made. The benchmark remains too narrow to certify a complete 5v5 match.

## Cache static Rift transforms

After attaching and placing the terrain root, compute its local/world matrices once and disable automatic recomposition on that static subtree. Animated units, materials and fog remain live. The optimization relies on terrain transforms remaining fixed; future terrain transform animation must explicitly opt back into updates.

All 393 source/simulation checks, five focused Chrome scenarios and nested-path production smoke pass. The new full-Rift case toggles automatic updates at the same paused state and compares exact canvas pixels: they match, while the cached path performs zero local matrix recompositions. Existing elevation, picking and fog cases pass. A fresh scoped sample records frame median/p95/p99 16.8/18.5/22.0 ms and render-call p95 5.1 ms, with unchanged 231 draw calls and 379,519 triangles. These single-run differences do not establish an FPS improvement. The modified runtime source hash and measurement are retained in `reference/terrain-transform-profile.json`. The frame target and full production objective remain unfinished.

## Avoid unchanged world-label mutations

Health bars now retain their child element references and update hidden/protection/status DOM state only when it changes. Each visible label queries vulnerability once instead of twice. Child references use a WeakMap so removed labels do not remain retained by the cache. Position and resource widths continue to follow live simulation values.

The stationary browser regression recorded 40 mutations across 20 renders before the change and zero afterward, then verified that half health and a new stun still update the label. All 393 source/simulation checks, seven focused Chrome cases and nested-path production smoke pass, including full-map visibility transitions and Volley slow feedback. No FPS gain is claimed from mutation counts; the frame-time benchmark was not rerun for this step. Native visual calibration, performance target and complete production gameplay remain unfinished.

## Ability tooltip clarity and keyboard access

Expanded current rank-one Q feedback with its pinned attack-speed bonus, empowered damage multiplier and attack reset. Heal now describes its level-scaled healing, allied target, speed duration and repeated-heal reduction. Tooltip metadata distinguishes no cost and no cooldown. Tooltips also open on ability-button focus, expose a tooltip role and associate the active control with its description.

All 393 source/simulation checks, the focused tooltip browser case and nested-path production smoke pass. Inspected the Heal tooltip capture. An initial tooltip ownership attribute collided with the ability-button selector; log inspection caught the runtime error, the attribute was renamed and the final test explicitly exercises a live HUD update and checks page errors. Full-suite/performance checks were not repeated. Tooltips still need complete damage/rank scaling details and native layout calibration; full production fidelity remains unfinished.

## Volley tooltip shares combat damage calculation

Consolidated the existing rank-one Volley damage formula into a World query consumed by cast snapshots, fallback projectile construction and the tooltip. Volley now reports its seven arrows and current raw physical damage before armor. Visible tooltip descriptions refresh when stats change, without rewriting unchanged text.

All 393 source/simulation checks, four focused Chrome scenarios and nested-path production smoke pass. The new browser case keeps the tooltip open through a Pickaxe purchase and level-18 growth, observes 60→85 damage, and confirms all seven released arrows carry the same 85 damage. Existing saved-cast and bonus-AD-only tests pass. Inspected the updated tooltip screenshot. Full-suite/performance checks were not repeated. Spell rank progression and complete native tooltip styling/details remain unfinished.

## Heal tooltip shares cast calculation

Extracted the existing level-scaled Summoner Heal amount into a shared query, including optional per-recipient recent-Heal reduction. Casts still cap healing to each recipient's missing health. The open tooltip now displays the caster's current base amount and explicitly reports reduced self-healing while the recent-Heal penalty is active.

All 393 source/simulation checks, four focused Chrome scenarios and nested-path production smoke pass. Browser coverage follows 80→318 healing through level growth, checks the actual 318-point cast event, then observes the 159-point reduced amount and its removal exactly at expiry. Existing recipient selection/reduction tests remain passing. Inspected the reduced-healing tooltip screenshot. Full-suite/performance checks were not repeated. Broader healing modifiers and exact native tooltip presentation remain unfinished.

## Keep live tooltips inside resized windows

Tooltip placement now measures the rendered panel and clamps its position within viewport margins. Repositioning occurs on opening, viewport resize and changed live description text; tooltip width and height are bounded to the viewport. This replaces the fixed-width, opening-only bottom offset.

All 393 source/simulation checks, four focused Chrome tooltip cases and nested-path production smoke pass. The new scenario opens Heal at desktop size, resizes to 600×420, then adds the longer recent-Heal text and verifies the full panel remains visible. Inspected the small-window capture: the tooltip is readable above the ability controls. Full-suite/performance checks were not repeated. Complete mobile interaction and exact native tooltip geometry remain unfinished.

## Spell-rank source audit and resource tables

Pinned and normalized Q/W/E/R mana/cooldown tables against both game and client exports, and connected existing rank-one ability definitions to the generated values. The audit found different array indexing for game mana versus cooldown fields; the client coefficients confirm the normalized result. Client `maxLevel: 0` is explicitly not treated as a valid learning cap.

All 393 source/simulation checks, dual-source export verification and nested-path production smoke pass. Added `SPELL-RANKS.md` with the concrete state, command, cast snapshot, recharge, bot, UI and save integration requirements. No skill allocation behavior is claimed: standard-match unlearned spells and verified level restrictions remain unfinished. This establishes validated data and integration scope for actual progression, not completion of that feature.

## Verify rank counts and source skill recommendations

The spell-rank exporter now derives its table lengths from the selected game spell's level-up tooltip record: five ranks for Q/W/E and three for R. Pinned those complete records and the source recommendation list. Map-11 bottom/utility recommendations are R/W/Q/E priority with W/Q/E/W early choices; map 12 has a different opening and must not be substituted.

All 393 source/simulation checks and the expanded dual-source exporter pass. Runtime learning behavior is unchanged. This audit resolves the rank-count evidence gap left by unusable client `maxLevel: 0`, but recommendations and tooltip counts do not establish champion-level learning permissions. Standard unlock thresholds, allocation controls/state and actual rank-driven gameplay remain unfinished. Browser/production tests were not repeated for metadata generation with unchanged active values.

## Source Crystal Arrow damage ranks

Extended R's exporter to verify its damage formula and retain 200/400/600 normal-rank base damage plus the 1.2 AP ratio. Replaced both runtime 200 literals with the source rank-one entry and expanded tooltip feedback to cover damage, splash and distance-based stun bounds.

All 393 source/simulation checks, five focused tooltip Chrome scenarios, R export verification and nested-path production smoke pass. The new browser case verifies the displayed 200 damage and 1–3.5 second stun range against a real released R projectile; the tooltip screenshot was inspected. Full-suite/performance checks were not repeated. Higher-rank allocation and AP scaling are not implemented by this data change; full production fidelity remains unfinished.

## Amplifying Tome and Crystal Arrow AP scaling

Added source-pinned Amplifying Tome and its icon, flat item AP ownership, and R's verified 1.2 AP scaling. R's tooltip and cast use the same damage query. Item AP is derived from inventory, so no redundant snapshot field is introduced. Already-started casts retain their captured damage through sale and saved continuation.

All 396 source/simulation checks, six focused Chrome scenarios, Tome/sell verifiers and nested-path production smoke pass. Tests cover both teams, stacking, independent inventories, unchanged Volley damage, sale during R windup and restored projectile damage. Browser input verifies 200→224→200 tooltip damage through purchase and sale; inspected the screenshot. Full-suite/performance checks were not repeated. Broader AP modifiers, AP stat display, actual rank allocation and full production fidelity remain unfinished.

## Ability power in the combat HUD

Added the live ability-power readout beside attack damage, using the pinned `scaleap` icon region from the already-shipped source atlas. Tightened vertical stat spacing so six values fit within the existing stat column without increasing panel width. Extended atlas verification to the sixth region.

All 396 source/simulation checks, the AP purchase/sale browser case, six-icon atlas verification and nested-path production smoke pass. The browser case checks 0→20→0 AP and all six stats inside a 1366×768 viewport. Inspected the laptop capture: icons and values remain distinct and fit the panel. Full-suite/performance checks were not repeated. Native stat-panel geometry, broader AP modifiers and full production fidelity remain unfinished.

## Verify AP-scaled Crystal Arrow through impact

Added both-team integration coverage for a real R cast with two Amplifying Tomes, selling both during flight, and restoring the pre-impact checkpoint. Tests check actual health loss: captured 248 damage becomes 124 against the primary champion's 100 MR and 248/1.5 against a splash minion's 50 MR. The champion assertion accounts for the same-tick regeneration that follows impact. A minion beyond splash range remains unharmed, the projectile is consumed, and restored state matches uninterrupted execution.

All 398 source/simulation checks pass. No runtime behavior changed; browser and production smoke were not repeated for this test-only addition. This verifies the current captured-damage policy, not independent evidence of native cast-snapshot timing. Rank allocation, broader AP modifiers and production fidelity remain unfinished.

## Preserve tooltip ownership across pointer and keyboard input

Ability tooltips now track focus and hover separately. Leaving a focused ability keeps its description visible; hovering another ability temporarily shows that description and restores the focused ability when the pointer leaves. Moving focus away from a still-hovered ability also preserves its tooltip. Opening a dialog clears tooltip ownership and `aria-describedby` together, preventing a hidden tooltip from remaining attached to an ability control.

All 398 source/simulation checks, six focused Chrome tooltip scenarios and nested-path production smoke pass. The new browser scenario exercises real mouse movement, keyboard focus, shop opening/closing and resumed tooltip use, with no page errors. Tooltip layout/content is unchanged. This is browser interaction polish; exact native input behavior and the broader production clone remain unfinished.

## Shared spell-rank calculations

Added shared normal-rank queries combining each spell's resource requirements with Q bonuses, W damage/arrow count, E recharge and R damage. W/R world queries now delegate to these calculations and support explicit rank previews with current owned stats. Invalid and unlearned ranks throw instead of accidentally reading extra exported entries. Current casts retain rank-one behavior until champion rank ownership is connected.

All 401 source/simulation checks, seven focused Chrome scenarios, all five spell/resource source exporters and nested-path production smoke pass. Tests cover every normal rank, invalid numeric ranks, separate E timers and read-only higher-rank previews after item purchases and level growth. Standard-match learning, saved rank state, allocation controls and bots remain required; this commit establishes their shared calculations and does not claim progression is implemented.

## Champion-owned ranks drive combat and HUD

Added per-champion Q/W/E/R ranks, saved pending-cast ranks and retained E recharge durations under snapshot version 29. Actual mana costs, cooldowns, Q attack speed/damage, W arrow count/damage, R damage and E recharge now consume owned ranks. Bot resource checks and live HUD costs/descriptions use the same ownership. Rank-zero spells cannot cast or generate Q Focus. Saved-state validation rejects invalid rank caps, incompatible active states and invalid recharge durations.

All 407 source/simulation checks, eight focused Chrome scenarios and nested-path production smoke pass. New integration coverage exercises both teams, captured W/R casts during rank changes, rank-five Q attack output, E upgrades during recharge and saved continuation. Browser coverage checks all four spells, live resource metadata changes and an unlearned tooltip without page errors. Existing initialization still grants rank one to every spell; point accounting, learning commands/controls and bot allocation are the next required integration, not completed here. The preserved cast/recharge upgrade timing remains a documented simulation policy pending native verification. Full production fidelity remains unfinished.

## Skill-point allocation and upgrade controls

Added saved unspent skill points, XP point grants, validated learning commands, ability upgrade buttons, rank markers and Ctrl+Q/W/E/R shortcuts. Successful learning spends one point and adds one rank without casting or interrupting an order. Commands work while dead or stunned. Normal basic and ultimate level gates are implemented as documented conventional rules; their extraction from game constants remains unverified. Snapshot version is now 30.

All 411 source/simulation checks, eight focused Chrome scenarios and nested-path production smoke pass. Tests cover both teams, first learning, every gate boundary, point conservation through level 18, invalid upgrades and queued saved continuation. Real browser input upgrades W by click and Q by shortcut without generating casts. Visual inspection caught title overlap; reserved an upgrade row, added a non-overlap assertion, reran the learning browser test and production smoke, and inspected the corrected screenshot. Current practice initialization still grants four rank-one spells; standard unlearned initialization, strict standard point-budget save validation and bot allocation remain unfinished. CSS upgrade art is not yet native asset fidelity.

## Source-recommended bot skill allocation

Exported the pinned map-11 default skill recommendation into runtime data and connected bot point spending to the shared learning validator. Bots use W/Q/E/W early choices, then R/W/Q/E priority among legal upgrades; they retain points when no upgrade is legal. Allocation also runs while dead or stunned, and human points remain untouched.

All 415 source/simulation checks, three focused bot Chrome scenarios, source export verification and nested-path production smoke pass. New tests cover both teams through all 18 levels, human independence, accumulated points during death with saved continuation, and a real XP-upgraded Volley releasing eight rank-two arrows. Default matches still use the existing four-rank practice grant; standard unlearned initialization and stricter standard point-budget validation remain next. This source recommendation does not establish exact native bot decision timing or complete bot fidelity.

## Standard spell startup on the full Rift

Full-Rift champions now start with four unlearned spells, one skill point and no Hawkshot charges. First learning E grants its two charges. Only the explicit practice fixture retains its four free rank-one spells. Snapshot 31 enforces full-Rift rank totals plus unspent points equal champion level, rank-level gates and zero E charges before learning.

All 416 source/simulation checks, 13 focused Chrome scenarios and nested-path production smoke pass. The new default-map browser case verifies the starting points, three available basic upgrades, unavailable R, unlearned tooltip and a real Hawkshot launched after clicking its upgrade. Minimap E/R tests now learn their spells first; production smoke learns E via Ctrl+E. Full-Rift checkpoint/reload tests pass, and the resulting full-map screenshot was inspected. The full browser suite was not repeated. Native gate extraction, exact upgrade timing, champion exceptions and broader production fidelity remain unfinished.

## Full browser regression after spell progression

Ran the complete configured Chrome suite against `87e57a4` without runtime changes during execution: all 161 scenarios passed in 5.5 minutes, with one worker and zero retries. Updated `reference/browser-regression.json` with the exact tested commit, all scenario results and the captured output hash. Coverage includes combat, spell learning, bot behavior, source effects, full-Rift rendering, shop layouts, recovery and saved continuation.

This replaces the older 148-scenario browser baseline. No runtime code changed in this verification commit. Existing production smoke and 416 source/simulation results remain recorded above; performance was not remeasured. A passing regression suite does not establish complete native visual parity, full 5v5 behavior or production completion.

## Inspect spells before learning

Unlearned tooltips now display explicitly labeled rank-one mechanics and actual rank-one resource requirements instead of hiding the description and showing zero costs. W/R previews include the champion's current owned stats. The instruction line shows the learning shortcut or the current validation reason, updating while open when a point is spent elsewhere.

All 416 source/simulation checks, nine focused Chrome scenarios and nested-path production smoke pass. New full-Rift browser coverage verifies R's preview and level requirement, W's damage/mana/cooldown and shortcut, then the live no-points reason after learning E. Inspected the preview screenshot. The full suite was not repeated for this tooltip change. Native tooltip typography/layout and broader clone fidelity remain unfinished.

## Practice reset respects learned spells

Fixed a full-Rift save regression: Reset cooldowns had granted Focus stacks and E charges to unlearned abilities. It now fills these resources only for learned Q/E, leaves skill choices and points intact, and uses Q's source four-second stack lifetime. Updated the practice panel's obsolete all-spells-unlocked claim and reset feedback.

All 416 source/simulation checks, the two existing Hawkshot scenarios and two new full-Rift reset/save/reload scenarios pass, as does nested-path production smoke. The new cases compare the entire restored checkpoint after waiting for save confirmation, covering both unlearned and learned Q/E. Their first draft reloaded before asynchronous save completion; that test race was corrected and both cases rerun successfully. Full-suite and performance checks were not repeated; broader production fidelity remains unfinished.

## Source atlas artwork for skill-up controls

Replaced CSS plus signs with gold-chevron regions from the unmodified 16.18 `clarity_hudatlas.png`, including visually selected idle, hover/focus and pressed regions. Pinned the atlas bytes, measured 52×52 source regions and 20px display size. A verifier checks manifest provenance, atlas dimensions and CSS sampling coordinates. Adjusted the reserved row to fit square controls while preserving accessible button labels and keyboard focus outlines.

All 416 source/simulation checks, three focused learning Chrome scenarios, atlas verification and nested-path production smoke pass. Inspected the resulting control screenshot; buttons fit above their abilities and below the title. The source layout files were not recovered from the inspected Global archive, so semantic state assignment and display sizing are explicitly visual inferences, not verified native mappings. Full browser/performance suites were not repeated; exact native HUD geometry and broader fidelity remain unfinished.

## Champion XP payout for both teams

Replaced the human-only flat champion XP reward with the source victim-level bounty and a shared death transaction. It captures all awards before any recipient levels up, includes recorded damage/reveal contributors plus nearby opponents, and distinguishes unrestricted takedown death credit from the ten-second proximity-only window. Both teams now gain XP and skill points from champion kills. Shared bounty indexing was corrected to victim level after fuller reference retrieval; decimal-level arithmetic and level-cap sharing remain documented interpretations requiring native comparison.

All 426 source/simulation checks, seven focused Chrome scenarios, source verification and nested-path production smoke pass. Coverage includes all solo bounty levels, share bands, mixed levels, proximity and posthumous boundaries, distant/dead contributors, saved continuation and a real attack kill reaching level two with a new skill point. Updated the obsolete minion-suite assertions for the former 1,400-unit/180-XP champion path. Support-assist tracking, execution attribution and full native payout parity remain unfinished. Full browser/performance suites were not repeated.

## Champion credit after turret and minion final blows

Added recent-damage execution credit using the community reference's 15-second Summoner's Rift window, kept distinct from the assist constant. Direct champion final blows take precedence; otherwise the latest eligible damage contributor receives kill gold, first blood and the kill counter, and is excluded from assists. The actual finisher still owns the damage event. Untouched/expired executions preserve first blood and pay no champion kill gold.

All 433 source/simulation checks, four focused Chrome scenarios and nested-path production smoke pass. Tests exercise both teams, turret/minion finishers, actual same-tick hit order, the expiry boundary, dead contributors, direct-kill precedence and saved continuation. Browser coverage verifies credited gold and kill HUD values. Native constant extraction, debuff-only/special reveal attribution and full execution parity remain unfinished; the reference source and local inclusive-tick convention are documented. Full browser/performance suites were not repeated.

## Assist-gold evidence and capture design

Corroborated the pinned opening-timer shift against Riot's 26.1 Game Start Time notes without promoting unnamed fields to verified behavior. Added competing endpoint/duration predictions, discriminating capture times, required observation metadata and a reward interaction matrix to ASSIST-GOLD.md. Updated its stale XP/execution status and aligned the fidelity plan's historical performance figures with the saved d0d65a5 benchmark.

The existing cross-version source verifier passes; independently calculated hypothesis values, local document links and diff whitespace checks pass. This is a research/design change: no assist payout was added, no native capture was performed and no runtime/browser/performance suite was rerun. The full production goal remains unfinished.

## Heal support contribution rewards

Accepted allied Heal now records support contributions for assist counters and champion takedown XP. One deduplicated contributor set serves both rewards, including support of direct assistants, distant/dead supporters and credited executions. It excludes the killer from assists and does not expand support chains recursively. Snapshot 32 validates and retains entries; recipient respawn clears the prior life's support.

All 441 source/simulation checks, four focused Chrome scenarios and nested-path production smoke pass. New coverage includes both teams, saved continuation, expiry, mixed/repeated contributions, full-health haste, rejected casts, proximity-only exclusion, execution handling, malformed saves and respawn clearing. The browser uses real F input and verifies the assist HUD. The community support-assist description motivates the behavior; applying the source general 15-second window to support, full-health haste eligibility and one-hop timing remain explicit interpretations pending reference captures. Assist gold and broader production fidelity remain unfinished. Full browser/performance suites were not repeated.

## Prepared Ashe Q source projectile artwork

Recovered the active icearrow emitter's SCB mesh and TEX texture from the pinned Ashe archive, distinguished it from the disabled flat arrow emitter, and converted it to a 49,788-byte GLB. Pinned full effect data, extraction provenance and conversion checks. The artifact retains 244 triangles, source UVs, vertex transparency and the 256×256 texture, with emitter transforms left explicit for later integration.

Khronos validation reports zero errors/warnings, exact read-back checks pass, and the isolated one-draw Chrome preview was inspected. The renderer and simulation are unchanged; runtime/browser regressions and performance were not rerun. Source artwork preparation advances the Q flurry pipeline but does not complete its five-arrow schedule, on-hit behavior, effects or combat integration.

## Source Q arrow combat integration

Empowered arrows now use the prepared source ice-arrow model. Release captures projectile identity alongside damage, and snapshot 33 preserves it independently of later buff state. The model uses authored scale and an explicit forward-axis adaptation; native attachment offset and flight-height calibration remain open. Shared geometry/material/texture ownership prevents one removed projectile from disposing another's resources.

All 442 source/simulation checks, six focused Q Chrome scenarios and nested-path production smoke pass. Inspected the combat capture and verified source geometry, texture, vertex alpha, expiry persistence and shared-resource disposal behavior. Tests also preserve identity through source death/save restoration and reject invalid saved empowerment. Full browser/performance suites were not repeated. Five-arrow sequencing, individual impacts and the remaining source particle layers are still unfinished.

## Ordinary source attack arrows

Verified the ordinary attack resolver and active icearrow1 emitter against the cached source. It shares Q's mesh/texture but has its own authored width scale. Generalized the shared arrow renderer to display ordinary champion attacks using that scale, retaining captured normal/Q identity and source blue color for either team. Nonchampion projectile rendering is unchanged.

All 442 source/simulation checks and nested-path production smoke pass. Seven focused Chrome cases passed before a TypeScript tuple-spread correction; all three arrow cases were then rerun successfully on the corrected code. The source exporter passes and the red-team combat screenshot was inspected. Full browser/performance suites were not repeated. Complete surrounding particle effects, native attachment calibration and Q sequencing remain unfinished.

## Official Q flurry frame reference

Retrieved the Q demonstration embedded by Riot's champion page, pinned video/page hashes and metadata, and inspected ordinary-to-Q transition and flurry frames. The visible staggered, separated flight paths rule out simultaneous coincident arrows as a faithful visual implementation. Inspected animation records do not supply five launch events; differing cast-frame values do not establish a repeat schedule.

Added a reproducible provenance/metadata verifier and three ordered contact sheets. The verifier passes. This adds primary visual evidence without claiming the unspecified recording patch or attack-speed setup matches 26.18. Exact delays and individual-hit behavior remain unresolved; no runtime constants changed and runtime/browser suites were not rerun.

## Source attack-arrow glows

Added ordinary/Q Glow and Glow1 layers using verified source emitter records and the original texture. Saved attack launch ticks drive color-curve age; instances share geometry/texture and own only their changing glow materials. Native particle-plane adaptation and impact linger remain documented interpretations.

All 444 source/simulation checks and nested-path production smoke pass. Six related Chrome cases initially passed; the new Q check failed because its returned observation omitted three asserted fields. Corrected the observation and reran all three arrow cases successfully, including private-material disposal. Inspected the updated combat capture. Full browser/performance suites were not repeated; other particle layers and full flurry behavior remain unfinished.

## Full browser regression after attack-arrow effects

Ran all 170 configured Chrome scenarios against `34eed412090940b13a307e7da8764b5cdbc6513c` without code changes during execution. Every case passed once: zero failures, skips, flaky results or retries, one worker, 357.5 seconds. The JSON report's individual results and top-level error list were checked before replacing the 161-case historical baseline in `reference/browser-regression.json`.

Inspected fresh full-Rift fountain and river-aiming captures and recorded their hashes with the tested commit and report hash. This verification adds no runtime behavior and does not establish native visual parity, full 5v5 completeness or the still-open performance target. Source/simulation checks and production smoke were not rerun in this verification-only turn; their prior results remain above.

## Q flurry payload preparation

Exported verified shot count and primary/no-on-hit spell identities from the pinned records. Added a rank-aware helper preparing five equal arrow damage shares with only the first marked for on-hit dispatch. All 446 source/simulation checks and source export verification pass, including every rank's damage total and invalid inputs.

This is executable payload preparation, not live flurry integration. Equal division and callback assignment remain documented interpretations; the aggregate runtime attack has not changed, and no launch interval was invented. Browser/production/performance suites were not rerun. Sequencing, individual impact dispatch and native comparison remain open.

## Live staggered Q impacts

Connected five-arrow payloads to live ranged Q attacks. Separate saved pending/active queues retain captured damage and launch identity; every projectile applies its own physical impact. First-arrow-only on-hit/Frost handling avoids refreshing the slow from the four secondary arrows. Committed bursts survive source death and stop on target death. Snapshot 34 validates future pending launches and IDs.

All 451 source/simulation checks, nine focused Q Chrome scenarios and nested-path production smoke pass. After immediate pending-target cleanup was added, all four arrow Chrome cases were rerun successfully. Inspected the live flurry capture. Coverage includes both teams, per-impact mitigation, source/target death and exact saved continuation. Four-tick spacing, committed-burst semantics and fixed launch origins remain explicit approximations; native curved flight and timing calibration are unfinished. Full browser/performance suites were not repeated.

## Separated Q flight presentation

Added bounded lateral paths for secondary flurry arrows, with tangent facing and convergence at the existing collision boundary. Saved initial origins make the presentation reproducible after restoration. Authoritative homing, damage, visibility eligibility and pending launch scheduling retain their existing behavior. The spread and sine envelope are explicitly provisional; the pinned fixed-speed missile records do not supply native curve coefficients or resolve animated hand launch positions.

All 453 source/simulation checks, eight focused Q/arrow Chrome cases and nested-path production smoke pass. Inspected the updated `artifacts/ashe-q-live-flurry.png` showing separated live arrows. Tests check saved presentation equivalence, unmodified gameplay state, rotation, bounded spread and contact convergence. Full browser/performance suites and native-client comparisons were not repeated; complete Q parity and the full-match milestones remain open.

## Q flight continuity fixes

Reproduced two visual defects with failing regression cases: nonzero endpoint slope produced an approximately 17-degree facing discontinuity for the outer arrow, and moving targets were sampled at current simulation time while arrows were interpolated. The envelope now has zero endpoint slope, and target position uses the same interpolation phase as the projectile. This improves the provisional adapter without changing combat or claiming a native curve formula.

All 455 source/simulation checks, four arrow Chrome cases and nested-path production smoke pass. Inspected the updated live flurry capture. The two new regressions failed before the fix and pass afterward. Full-match performance and native trajectory calibration remain open.

## Bot retreat recalls

Retreating champions can now recall when safe and sufficiently far from their own fountain. They preserve a safe channel, cancel it for visible approaching threats, avoid visible incoming targeted missiles, and wait after recorded champion damage before retrying. Nearby hidden enemies do not alter the decision. Recall uses the same queued command and validation as human input, and saved channels continue identically on both teams.

All 461 source/simulation checks, six focused bot/recall Chrome scenarios and nested-path production smoke pass. One retry assertion initially checked before the next scheduled AI decision; it now accounts for the existing 18-tick cadence. This adds a recovery tactic, not a complete role/team planner. Travel-cost estimation, last-seen threat memory, economic recalls, nine-bot matches and full-match performance remain open; see BOTS.md for the policy's limits.

## Bot last-hit selection

Bots now prioritize an in-range, visible lane minion that the next attack impact can kill, considering armor, bounty and distance. Immediate champion threats retain priority and valid windups remain committed. Q estimates use the first arrow rather than the entire delayed burst. Shared damage arithmetic keeps the estimate consistent with current mitigation rules.

All 466 source/simulation checks, five focused bot Chrome scenarios and nested-path production smoke pass. New coverage includes both teams' actual kill/CS with exact saved continuation, visibility/range/armor exclusions, valuable targets, windup commitment, close threats and Q. The browser scenario verifies actual target selection, kill, CS/gold and preservation of the closer healthy minion. Incoming-damage prediction, wave management, role assignments and full 5v5 remain unfinished.

## Bot tower safety

Added visible-tower danger checks before combat commitment and target pursuit. Unsupported bots move out and hold outside danger instead of repeatedly re-entering; living minion cover permits tower pressure, while tower focus and protected champion aggression override it. New danger can cancel a windup. Hidden/destroyed towers do not affect the decision, and saved continuation remains deterministic.

All 472 source/simulation checks, six focused bot Chrome scenarios and nested-path production smoke pass. Coverage includes support loss, tower focus, newly visible protection, stable holding and pursuit rejection. The browser fixture isolates decisions by delaying tower shots. Whole-route danger avoidance, threat memory, alternate safe target selection and coordinated team play remain unfinished; the full-match completion gate remains open.

## Turret retaliation recovery

Reproduced stale out-of-range retaliation orders that prevented towers from defending the lane, plus delayed reacquisition after invalid targets. Turrets now clear unusable orders and reacquire visible targets in the same tick. The release/recovery case retains its original attack deadline and missile already in flight. Tests also cover in-range retaliation priority, target radius boundaries, hidden targets and exact saved continuation.

All 477 source/simulation checks and nested-path production smoke pass. Three related bot browser cases passed initially; the new browser fixture failed because it reused renderer IDs from a different world. Changed that fixture to exercise the running world, then passed the recovery case and all three existing source-turret rendering/destruction cases. The two initial simulation regressions failed before the fix. Native retarget timing and complete tower behavior remain unaudited.

## Full-Rift bot lane progression

Replaced the fixed full-Rift midpoint destination with assigned-lane waypoint progression. Bots move toward the opposing base in team-relative route order, preserve their waypoint while traveling, and rejoin the assigned lane after combat or base return. Assignment uses the existing saved unit fields; unassigned bots default to mid. The practice sparring destination remains specific to that fixture.

All 481 source/simulation checks, four focused bot Chrome scenarios and nested-path production smoke pass. Early route tests exposed waypoint oscillation, now corrected by retaining travel commitment. The combat-resumption fixture also postpones the defeated opponent's respawn so it measures one interruption rather than a second fight. Browser coverage confirms progression beyond the former midpoint on the actual Rift grid. Full role assignment, jungle/team planning and complete-match certification remain open.

## Safe alternatives during target selection

Moved tower safety into the champion bot's candidate searches. A protected opponent no longer masks a farther safe target or a covered minion last hit. When every visible candidate is unsafe, the bot retains its hold instead of advancing the lane. Existing non-bot target acquisition remains unfiltered by this tactical policy.

All 484 source/simulation checks and nested-path production smoke pass. Two new simulation regressions failed before the change; hidden safe candidates remain excluded. Four related browser cases initially passed; the alternative-target case failed with fixture occlusion. Made that case's visibility precondition explicit, asserted the alternative is visible, and reran both tower-safety browser cases successfully. The full browser/performance suites were not repeated. Route-wide danger evaluation, safe poke and complete team strategy remain open.

## Full browser regression after bot progression changes

Ran the complete configured Chrome suite against `504f43279f4c082fe8d11827ff48a19c39c418c9` with an unchanged worktree: all 177 scenarios passed once, with zero failures, skips, flaky results or retries, one worker, 393.7 seconds. Checked every individual result, retry/error list and top-level error list before updating `reference/browser-regression.json` with the tested commit, scenario timings and raw report hash.

Inspected the fresh full-Rift fountain, river-aiming and live Q-flurry captures and recorded their hashes after verifying their timestamps belong to this run. This verifies the integrated implemented scenarios; it does not certify native pixel parity, complete nine-bot matches or performance. Source/simulation checks and production smoke were not repeated in this verification-only step; the previous 484-check and production results remain above. Team strategy, roster, jungle/objectives and full-match certification remain unfinished.

## Healthy bot shopping returns

Healthy bots now queue safe recalls for an affordable unfinished purchase when banked gold reaches the local 900-gold trip threshold. Purchase planning and recall safety are shared with existing fountain/retreat behavior. Channels persist while safe, cancel for visible danger, and do not override committed attacks. No new save state is required.

All 489 source/simulation checks, five focused bot Chrome scenarios and nested-path production smoke pass. Coverage includes both teams' saved round trips, actual inventory/gold/stat changes, capacity/completed-plan/affordability exclusions, danger visibility and attack commitment. The full browser/performance suites were not repeated. Adaptive builds, wave/objective timing and complete team strategy remain unfinished.

## Bot finishing ultimates

Added a visible-target finishing tactic for R. Bots check current post-resistance damage, rank, resources, cooldown, range and visible blockers before queuing a fixed observed aim through normal cast validation. Prediction shares the existing projectile radius; hidden blockers remain unknown. Retreat, committed windups and tower danger retain priority.

All 494 source/simulation checks, five focused bot Chrome scenarios and nested-path production smoke pass. Coverage includes actual kills, both teams' ownership, queued save continuation, source cast animation, projectile release, visibility/blockers and intervening stun. Teamfight initiation, defensive ultimates, movement prediction, full kits/roster and complete 5v5 remain open. Full browser/performance suites were not repeated.

## Defensive bot ultimates

Retreating bots can now use R to interrupt a close visible attacker, based on an observed attack windup or incoming targeted attack projectile. The shared planner retains resource, blocker and tower checks, skips already stunned threats, and resumes fountain movement after casting. Retreat state and queued casts continue identically through saves.

All 497 source/simulation checks, six focused bot Chrome scenarios and nested-path production smoke pass. The new browser case observes source cast animation, a nonlethal stun and continued escape. An initial exclusion assertion incorrectly required walking even when the existing safe-recall policy was available; it now verifies the appropriate escape choice. Teammate protection, threat prediction, full team strategy and complete 5v5 remain open; full browser/performance suites were not repeated.

## Bot lane scouting

Full-Rift bots with learned E now scout unrevealed authored lane points ahead, without using hidden enemy coordinates. Both charges must be available, preserving one charge while the spent one recharges. Scouting queues the normal fixed-point cast and retains lane movement through the cast delay.

All 501 source/simulation checks, four focused lane/E Chrome cases and nested-path production smoke pass. Reran the real-Rift scouting case successfully after adding an explicit source-animation assertion. Tests cover both teams, exact saved continuation, actual reveal, charge retention and hidden-enemy independence. Broader scouting tactics, reserved-charge use, objective/team planning and complete 5v5 remain open. Full browser/performance suites were not repeated.

## Emergency bot Flash

Critically injured retreating bots now evaluate terrain-resolved escape endpoints against close visible champions and turret danger, then queue an ordinary Flash cast. The selected landing must materially increase clearance; nearby secondary enemies can rule it out. Normal cast validation and independent cooldown ownership remain shared, and retreat resumes after the teleport.

All 507 source/simulation checks, six focused bot Chrome scenarios and nested-path production smoke pass. Coverage includes both teams, exact saved continuation, actual browser teleport, exclusion conditions, a second enemy, tower danger and intervening stun. The thresholds and scoring are local tactical policy, not native AI evidence. Offensive Flash, skillshot prediction, route-wide safety, full team strategy and complete 5v5 remain open. Full browser/performance suites were not repeated.

## Full-team integration and chase checkpoint correction

Added a reproducible headless ten-Ashe diagnostic on the actual Rift, with 2/1/2 lane assignments per team and ordinary starting resources. Its first five-minute run exposed invalid chase checkpoints: navigation spread an entire target unit into its endpoint. Restricted the navigation result to coordinates, retaining strict save validation. Both new regressions failed before the fix; the browser case verifies exact save/reload continuation into an actual attack.

All 509 source/simulation checks, nine focused Rift/save Chrome scenarios and nested-path production smoke pass. The diagnostic then reached blue Nexus victory at 40:22 within a 60-minute horizon, with no detected position/resource violations and an exact terminal snapshot round trip. Evidence and scope are documented in `TEAM-SIMULATION.md` and `reference/team-simulation.json`. This single mirrored-lane scenario leaves roster, roles/jungle, repeated-match certification and visual/performance gates unfinished; the playable roster is unchanged.

## Source-dimension champion picking

Verified the pinned Ashe character bytes upstream and exported selection radius 120 and height 155. Replaced fixed-pixel champion picking with a camera-ray selection cylinder at the rendered model position, making its projected area follow zoom and elevation. Shared hover/click/attack-move selection retains living/team-visible exclusions. Other unit categories retain their existing picker.

All 512 source/simulation checks and six focused selection/attack-move/structure-visibility Chrome scenarios pass. Production nested-path smoke passes. The new selection scenario covers three zoom levels and an inside point missed by the old fixed circle; the hover capture was inspected. An added comparison initially assumed the outside point was accepted by the old picker; that assertion failed and was corrected to check its actual zoomed-in inside miss. The cylinder shape and overlap priority remain adapter assumptions, and combat-radius defaults, dynamic unit collision and native selection pixel comparison remain open. See `CHAMPION-SELECTION.md` for evidence and limits.

## Moving-target selection and stationary hover

Reproduced a wrong-target selection when overlapping champions were ranked from simulation positions despite their pick volumes following rendered interpolation. Both now use rendered positions. Hover refreshes after each frame, so moving targets, lost visibility and death update feedback beneath a stationary cursor; pointer exit/focus loss/modal overlays clear it.

All 512 source/simulation checks and production smoke pass. Four attack-move browser cases passed in the initial run; all three selection cases pass after correcting an overbroad paused-state hover exclusion. Pausing without a modal retains hover inspection. The movement regression failed before the correction and now covers three interpolation fractions and reversed unit order. Native overlap priority, full-match hover cost and broader fidelity gates remain unverified.

## Lux source rig preparation

Prepared the planned second champion's base rig from the pinned client archive. Verified 25 original files and exact binary skin/animation definitions, then converted all 22 atomic clips, 79 bones and 4,926 triangles with the source skin scale and texture intact. Added an interactive development preview with clip selection, scrubbing and camera orbit.

The Lux browser case checks every skinned vertex at three samples per clip, and the idle/ultimate captures were inspected. All 512 source/simulation checks, full model/map asset validation and production smoke pass. Fixed the asset validator's pre-existing static Ashe-arrow manifest lookup so it could finish the complete catalog. Lux's kit, effects/audio, runtime champion identity and native lighting/transition calibration remain unfinished; this does not add a selectable or playable Lux. See `LUX-ASSETS.md` for reproducible commands and the full scope boundary.

## Lux binding audit and shared root support

Pinned Lux Q and Flash records, preserving conflicting child/parent range and cooldown metadata rather than treating all fields as final gameplay values. Added a root deadline distinct from stun: walking/Flash are blocked, attacks and non-movement spells remain possible, and expiry resumes retained movement. Flash rejects newly rooted queued casts without consuming cooldown. Snapshot 35 preserves the deadline and respawn clears it; health bars show ROOTED.

All 517 source/simulation checks, seven focused root/Flash/save Chrome scenarios and production smoke pass. Lux's actual two-target projectile, champion identity, damage/passive effects, full kit and CC exceptions remain unfinished. This is shared combat groundwork; no existing playable spell applies root yet. See `LUX-BINDING.md` for source fields and limits.

## Light Binding projectile resolution

Added a fixed-direction two-contact projectile primitive with swept travel-order hits, once-only magic damage/root, caster-death continuation and saved first-hit history. Allies/structures do not consume contacts; lane minions do. Snapshot 36 validates participants and retained hit history. Source child range/width interpretations remain provisional.

All 522 source/simulation checks, three focused binding/root/ultimate Chrome scenarios and production smoke pass. Initial test corrections isolated an otherwise active turret and respected rounded combat-text values. Lux input, resource/windup handling, passive application and native missile effects remain unfinished; the release method is a combat integration primitive, not a selectable Lux or a completed Q cast. Full match and performance suites were not repeated.

## Lux champion identity and queued Q

Added saved Ashe/Lux identity, Lux's pinned stats and growth/regen/selection dimensions, runtime source rig and recall sequence, and a normal resource-consuming Q windup that releases the two-contact binding. Ashe Focus and Frost Shot now apply only to Ashe. Lux's unfinished W/E/R remain unavailable. Snapshot 37 preserves and validates champion-owned cast state.

All 526 source/simulation checks, five focused Chrome scenarios (Lux, binding and selection), and nested-path production smoke pass. Inspected the in-match Lux recall capture. The default human remains Ashe; this does not complete Lux's passive, full kit, AI or native effects. The additional runtime rig costs 3.86 MB in initial model loading. Full browser, full-match and performance suites were not repeated; production fidelity gates remain open.

## Lux Illumination through Q and basic attacks

Pinned the complete passive records and verified the six-second standard-mode duration, 0.35 AP ratio and level-indexed 30–200 base damage. Q now applies/refreshes saved owner-specific marks. Lux attacks consume their mark once for separately mitigated bonus magic damage; expiry precedes combat, target death clears marks and caster death preserves them. Snapshot 38 validates owners and deadlines. Visible unit bars show ILLUMINATED after higher-priority statuses end.

All 533 source/simulation checks, three focused Lux/binding Chrome scenarios and production smoke pass. Native passive particles/attack presentation, R/E interactions and wider kit/AI work remain unfinished. See `LUX-ILLUMINATION.md` for the distinction between pinned values and adapter behaviors awaiting native comparison. Full browser, match and performance suites were not repeated.

## Lux Final Spark cast, impact and Flash exception

Audited R records and an official 30 FPS demonstration; pinned conflicting timing/geometry metadata instead of treating input range or visual-missile fields as damage geometry. Added champion-owned R resources/windup, all-target beam damage, Illumination trigger/refresh and source spell4 animation. Flash during R preserves its original beam, as Riot's 10.4 notes specify. Snapshot 39 preserves windup geometry and short-lived beam presentation; the Ashe tactical R planner excludes Lux.

All 538 source/simulation checks, three focused Lux Chrome scenarios and production smoke pass. Inspected the beam capture; its procedural ribbon remains an interim effect. Native particles/audio/vision, exact collision geometry, near-expiry passive extension and Lux R AI remain unfinished. Full browser, full-match and performance suites were not repeated. See `LUX-R.md` for evidence and limitations.
