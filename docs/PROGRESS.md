# Development status

Last updated: September 12, 2026 (America/New_York).

**Goal remains active:** continuously develop the highest-quality, visually authentic League-like browser game, without an application backend, through small commits. The required final state is a verified production-level full match experience. This file describes progress toward that goal; it does not reduce its scope.

## Current authoritative state

- TypeScript/Vite/Three.js application boots directly into a playable practice scene.
- Fixed-step, renderer-independent simulation with command handling, wall-aware navigation, ranged attack windup/release, homing attacks, swept skillshots, death, and respawn.
- Basic Ashe ability representations, minion waves, turrets, a local sparring champion, a target dummy, gold/XP, recall, and four purchasable items.
- DOM HUD, health bars, ability cooldowns, aiming, camera controls, minimap, menus, scoreboard, practice controls, and synthesized audio feedback.
- Archived Ashe model converted to GLB: 4,902 vertices, 7,406 triangles, 85 bones, nine retained animation clips. Native Three.js skeletal animation replaces the procedural champion silhouette.
- Team vision now accounts for terrain occlusion, brush, living allied observers, temporary attack reveals, and Hawkshot. Targeting, bot acquisition, render visibility, HUD, minimap fog, projectiles, and event feedback use the shared policy.
- Source revisions and SHA-256 hashes are recorded for imported art. The GLB passes the Khronos glTF validator with zero errors and zero warnings.
- Nine browser scenarios and nineteen simulation scenarios pass after the keyboard-focus repair. These cover the current practice build only.

The game is **not production complete**. No roadmap milestone that requires complete map/kit/reference fidelity is certified by this first playable.

## Verification performed

| Evidence | Result | Scope |
|---|---|---|
| `npm run check` | TypeScript check and 19 simulation tests pass | Attack cancellation/release, collision, navigation, last-hit attribution, atomic purchase rejection, deterministic identical inputs, occlusion/brush, shared sight, attack reveal timing, event visibility |
| `npm run test:browser` | 9 Chrome scenarios | Boot, actual mouse movement/attacks, casting, cooldown, pause, shop, laptop layout/minimap, GPU geometry reuse, modal focus, hidden/revealed brush presentation |
| `npm run assets:validate` | 0 errors, 0 warnings | GLB structure and recorded source-output hash, not visual parity with current League |
| `npm run build` | Static build succeeds | Bundles the application and local assets; not deployment or backend work |
| Browser screenshots | Inspected at 1600×1000 and 1366×768 | Playfield composition, character visibility, HUD overlap, targeting and shop presentation |

Browser tests save additional screenshot evidence into the ignored local `artifacts/` folder. They intentionally use real pointer and keyboard interactions; the diagnostics hook supplies observations and world-to-screen coordinates.

A short performance observation used Apple M5 Pro, Mac17,8, 64 GiB RAM, headless Chrome 152, 1920×1080, device scale 1. The practice simulation was advanced to 30 seconds, then 180 rendered frames were sampled. Observed frame intervals: median 16.7 ms, p95 16.8 ms, p99 16.8 ms; 11 live/persisting unit records, 173 draw calls, 214,102 submitted triangles. This is a small-scene observation on capable hardware, **not** certification of the full 5v5 budget or low-end devices. Reproduce a larger match fixture before drawing performance conclusions.

After the visibility change, the same small 30-second practice setup at 1920×1080 was sampled for 180 frames: median 16.7 ms, p95 18.6 ms, p99 19.1 ms. The 23 sampled fog updates cost median 1.7 ms and p95 2.4 ms. There were 11 unit records and 157 draw calls. Local evidence: `artifacts/vision-benchmark.json`, `artifacts/vision-30-seconds.png`, and hidden/revealed brush screenshots. This remains a small-scene observation, not a full-match performance gate.

See [vision policy](VISION.md) for source evidence, event semantics, and explicit remaining fidelity limitations.

## Fidelity debt that must remain visible

| Area | Current limitation | Required direction |
|---|---|---|
| Match scope | Practice lane with one opponent | Full three-lane map, jungle, nine role-aware bots, objective progression, valid victory/defeat |
| Champion art | Archived base Ashe, not a validated 26.18 asset set | Matched reference captures, scale/orientation/material validation, current or approved content pipeline |
| Environment | Procedural paving, trees, rocks, brush, and towers | Authored/validated map geometry, textures, buildings, minions, vegetation, and lighting; remove temporary silhouettes |
| Camera | Provisional perspective and scale | Fit against reference gameplay screenshots at matched viewport/zoom |
| Abilities | Practice approximations; all abilities unlocked | Complete passive and Q/W/E/R, rank rules, charges, cast locks, travel/impact behavior, exact timing, animation/VFX synchronization |
| Q | Attack-speed buff and Focus, no full flurry/crit interaction | Implement complete attack replacement and modifier semantics |
| E | Immediate circular reveal and fixed cooldown | Traveling vision, ammunition/charge timing, brush/reveal rules |
| R | Fixed damage/stun; no full travel-distance/splash rules | Reference-accurate hit and CC semantics |
| Summoner spells | Simple heal and obstacle-projected blink | Exact targeting, ally effects, wall rules, timing, rank/patch values |
| Combat systems | Simplified stats, status effects, growth, and mitigation | Full typed modifiers, patch reconciliation, CC capabilities, item/rune interaction rules |
| Vision | Occlusion and brush work against practice circles; sight radii remain provisional, fog is sampled on the floor, enemy buildings disappear without vision | Measured map sight geometry, static building memory/global destruction semantics, wards, stealth/true sight, projectile-specific reveal rules, terrain-wide fog shading |
| Navigation | Circle-obstacle visibility graph | Measured navmesh, unit avoidance, lane/camp behavior, geometry agreement |
| Bots | One tactical sparring policy | Per-role perception, team strategy, objective conversion, decision uncertainty, complete match QA |
| Shop | Four direct purchases | Recipes, sell/undo, full builds, role-specific capacity, passives/actives, runes |
| Audio | Synthetic feedback tones | Reference-aligned event timing, real impact/ambient/voice assets, perceptual hierarchy |
| Persistence | Snapshot serialization only | Validated restore/import, command replay, IndexedDB saves, cache lifecycle, offline reload |
| QA | Chrome practice coverage | Firefox/Safari, larger stress fixtures, long-match soak, context restore, complete content and match gates |
| Distribution | Riot reference assets have provenance, no distribution authorization | Resolve the final asset/content rights before a production release |

## Next implementation priorities

1. Establish a stronger environment asset path and validate the imported champion's animation orientation, scale, and attack/cast synchronization. The current screenshot is not close enough to the requested final visual fidelity.
2. Extend the tested vision policy to measured map geometry, static building memory, wards/stealth, and complete ability-specific reveal rules; shade elevated terrain consistently with the floor.
3. Replace the ability approximations with a versioned ability timeline/state model and complete Ashe behavior, then implement a second full kit.
4. Extend the lane test harness toward the complete map and role-aware match simulation, preserving the tested input/combat boundaries.

## Asset investigation notes

The CommunityDragon 16.18 directory supplied mesh/texture references but returned HTTP 404 for the referenced Ashe skeleton and `.anm` files. The archived `tengge1/lol-model-viewer` repository at commit `ef5635c5fbe0c315275c9bcccf83558cfe7ee436` supplied a complete matching mesh/animation/texture set. The converter reads that archived format and writes GLB, baking coordinates and validating normalized joints and animation transforms. It does not run legacy viewer code inside the app.

Rebuild this asset with `node tools/assets/convert-ashe.mjs`, then run `npm run assets:validate`. This is a local development command that fetches the explicitly pinned source. Hash validation prevents accidental output drift.

`lol2gltf` was also built locally under ignored `.tools/` using a local .NET SDK for future current-format/map investigations, but it was not used for the archived Ashe conversion and is not a runtime dependency. Its current source dependencies emitted ImageSharp vulnerability warnings; resolve those before adopting that tool into a maintained production build pipeline.
