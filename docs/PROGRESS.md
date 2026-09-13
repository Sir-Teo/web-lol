# Development status

Last updated: September 13, 2026 (America/New_York).

**Goal remains active:** continuously develop the highest-quality, visually authentic League-like browser game, without an application backend, through small commits. The required final state is a verified production-level full match experience. This file describes progress toward that goal; it does not reduce its scope.

## Current authoritative state

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

## Verification performed

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
