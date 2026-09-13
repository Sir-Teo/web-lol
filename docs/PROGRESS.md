# Development status

Last updated: September 12, 2026 (America/New_York).

**Goal remains active:** continuously develop the highest-quality, visually authentic League-like browser game, without an application backend, through small commits. The required final state is a verified production-level full match experience. This file describes progress toward that goal; it does not reduce its scope.

## Current authoritative state

- TypeScript/Vite/Three.js application boots directly into practice on the full reference Rift.
- Fixed-step, renderer-independent simulation with command handling, wall-aware navigation, ranged attack windup/release, homing attacks, swept skillshots, death, and respawn.
- Basic Ashe ability representations, minion waves, turrets, a local sparring champion, a target dummy, gold/XP, recall, and four purchasable items.
- DOM HUD, health bars, ability cooldowns, aiming, camera controls, minimap, menus, scoreboard, practice controls, and synthesized audio feedback.
- Archived Ashe model converted to GLB: 4,902 vertices, 7,406 triangles, 85 bones, nine retained animation clips. Native Three.js skeletal animation replaces the procedural champion silhouette.
- Team vision now accounts for terrain occlusion, brush, living allied observers, temporary attack reveals, and Hawkshot. Targeting, bot acquisition, render visibility, HUD, minimap fog, projectiles, and event feedback use the shared policy.
- Six animated minion assets now replace the primitive supporting units, using matching patch 16.18 meshes, rigs, textures, animation graphs, and authored scales. The runtime shares geometry/textures and clones skeletons per unit.
- Source revisions and SHA-256 hashes are recorded for imported art. The GLB passes the Khronos glTF validator with zero errors and zero warnings.
- The default playable now renders pinned Base_SRX terrain and vegetation with original BC1/BC3 blocks, authored mip levels, and a lossless WebP fallback. Source navigation, elevation, fountain spawns, three lane routes, timed barracks waves, and 22 turret positions are connected. The separate inspector retains its navigation overlay.
- Sixteen browser scenarios and thirty-one simulation scenarios pass. These cover the current practice build and map asset inspector, not a complete match.

The game is **not production complete**. No roadmap milestone that requires complete map/kit/reference fidelity is certified by this first playable.

## Verification performed

| Evidence | Result | Scope |
|---|---|---|
| `npm run check` | TypeScript check and 31 simulation tests pass | Attack cancellation/release, collision, navigation, last-hit attribution, atomic purchase rejection, deterministic identical inputs, occlusion/brush, shared sight, attack reveal timing, event visibility, source-grid clearance/gates, full-map routes, wave cadence, and fountain recall |
| `npm run test:browser` | 16 Chrome scenarios | Existing practice interactions, minion lifecycle, full terrain loading, original compressed mips, BC1 alpha, both gzip-hosting conventions, navigation overlay, WebP fallback, full-map pointer/elevation alignment, movement/attack, and exact fog-mask/query agreement |
| `npm run assets:validate` | 0 errors, 0 warnings | Seven character GLBs, full map glTF, 278 hashed map resources, navigation payload, gameplay layout, and minimap; not certification of pixel parity |
| `npm run build` | Static build succeeds | Bundles the application and local assets; not deployment or backend work |
| Browser screenshots | Inspected at multiple viewports up to 1920×1080 | Full terrain, live lane combat, river aim, fountain placement, character visibility, HUD and shop presentation |
| Built-game smoke check | No browser errors or failed requests | Full Rift loads; real movement/aim input; development diagnostics absent |

Browser tests save additional screenshot evidence into the ignored local `artifacts/` folder. They intentionally use real pointer and keyboard interactions; the diagnostics hook supplies observations and world-to-screen coordinates.

A short performance observation used Apple M5 Pro, Mac17,8, 64 GiB RAM, headless Chrome 152, 1920×1080, device scale 1. The practice simulation was advanced to 30 seconds, then 180 rendered frames were sampled. Observed frame intervals: median 16.7 ms, p95 16.8 ms, p99 16.8 ms; 11 live/persisting unit records, 173 draw calls, 214,102 submitted triangles. This is a small-scene observation on capable hardware, **not** certification of the full 5v5 budget or low-end devices. Reproduce a larger match fixture before drawing performance conclusions.

After the visibility change, the same small 30-second practice setup at 1920×1080 was sampled for 180 frames: median 16.7 ms, p95 18.6 ms, p99 19.1 ms. The 23 sampled fog updates cost median 1.7 ms and p95 2.4 ms. There were 11 unit records and 157 draw calls. Local evidence: `artifacts/vision-benchmark.json`, `artifacts/vision-30-seconds.png`, and hidden/revealed brush screenshots. This remains a small-scene observation, not a full-match performance gate.

See [vision policy](VISION.md) for source evidence, event semantics, and explicit remaining fidelity limitations.

## Fidelity debt that must remain visible

| Area | Current limitation | Required direction |
|---|---|---|
| Match scope | Three-lane practice on full terrain with one sparring opponent | Jungle, nine role-aware bots, objective progression, valid victory/defeat |
| Champion art | Archived base Ashe, not a validated 26.18 asset set | Matched reference captures, scale/orientation/material validation, current or approved content pipeline |
| Environment | Full terrain integrated; 22 procedural towers, missing base buildings and camps | Import building/camp models; complete effects, lighting, shader calibration, and region streaming |
| Minion art | Matching 16.18 base models with four source clips each | Validate active match skin selection, attack impact timing, variant selection, VFX, camera-scale match, and full-wave reference captures |
| Camera | Provisional perspective and scale | Fit against reference gameplay screenshots at matched viewport/zoom |
| Abilities | Practice approximations; all abilities unlocked | Complete passive and Q/W/E/R, rank rules, charges, cast locks, travel/impact behavior, exact timing, animation/VFX synchronization |
| Q | Attack-speed buff and Focus, no full flurry/crit interaction | Implement complete attack replacement and modifier semantics |
| E | Immediate circular reveal and fixed cooldown | Traveling vision, ammunition/charge timing, brush/reveal rules |
| R | Fixed damage/stun; no full travel-distance/splash rules | Reference-accurate hit and CC semantics |
| Summoner spells | Simple heal and obstacle-projected blink | Exact targeting, ally effects, wall rules, timing, rank/patch values |
| Combat systems | Simplified stats, status effects, growth, and mitigation | Full typed modifiers, patch reconciliation, CC capabilities, item/rune interaction rules |
| Vision | Source-grid occlusion and brush; elevated terrain fog; provisional sight radii; enemy buildings disappear without vision | Reference sight checks, static building memory/global destruction semantics, wards, stealth/true sight, projectile-specific reveal rules |
| Navigation | Source-grid A*, cached radius clearance, swept capsule validation and authored lane routing | Dynamic overlays, local unit avoidance, exact steering calibration, camp behavior |
| Bots | One tactical sparring policy | Per-role perception, team strategy, objective conversion, decision uncertainty, complete match QA |
| Shop | Four direct purchases | Recipes, sell/undo, full builds, role-specific capacity, passives/actives, runes |
| Audio | Synthetic feedback tones | Reference-aligned event timing, real impact/ambient/voice assets, perceptual hierarchy |
| Persistence | Snapshot serialization only | Validated restore/import, command replay, IndexedDB saves, cache lifecycle, offline reload |
| QA | Chrome practice, full-map, and inspector coverage | Firefox/Safari, larger stress fixtures, long-match soak, context restore, complete content and match gates |
| Distribution | Riot reference assets have provenance, no distribution authorization | Resolve the final asset/content rights before a production release |

## Next implementation priorities

1. Import the matching map-placeable tower, nexus, inhibitor, and camp assets. Implement building progression and complete-match win/loss, retaining the source-aligned navigation and placement.
2. Complete static building memory, wards/stealth, and ability-specific reveal rules. Calibrate camera, fog, shaders, and scale against matched reference captures; reduce large-scene rendering cost.
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
