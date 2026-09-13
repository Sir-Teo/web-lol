# Champion selection dimensions

Ashe's pinned 16.18 `Characters/Ashe/CharacterRecords/Root` specifies `selectionRadius: 120`, `selectionHeight: 155` and `pathfindingCollisionRadius: 35`. The upstream bytes were fetched again and matched the SHA-256 recorded in `reference/ashe-progression.json`. `tools/assets/export-ashe-selection.py` checks that pin and generates the selection constants used by the renderer. [Versioned character record](https://raw.communitydragon.org/16.18/game/data/characters/ashe/ashe.bin.json)

Riot distinguishes selection size from gameplay collision and pathfinding size. Selection determines hovering for attacks and targeted spells; gameplay collision affects attack ranges and missile collision; pathfinding affects how closely units can stand together. These values must not be substituted for one another. [Riot patch 14.9 radius explanation](https://www.leagueoflegends.com/en-sg/news/game-updates/patch-14-9-notes/)

## Current adapter

Champion picking now intersects the camera ray with a vertical cylinder using the source selection radius and height, located at the rendered model's interpolated ground position. It includes side and cap intersections and ignores intersections behind the ray origin. An unrendered champion falls back to its simulation position and terrain elevation. Projection therefore responds to viewport, perspective, elevation and camera zoom, replacing the former fixed 26-pixel circle. Hover, ordinary clicks and attack-move selection share this picker.

Only living team-visible units are eligible. Overlapping eligible targets retain the existing nearest projected-center preference. Other unit types retain their existing selection approximations pending their own source-dimension audit. The debug selection ring is not the picking boundary.

Both champion hit testing and nearest-center ranking now use the same rendered position. Previously the cylinder followed interpolation while its ranking used the next simulation position, allowing another overlapping champion to win beneath the visible target. A regression reproduces this with one tick of ordinary Ashe movement and verifies the rendered target across three interpolation fractions and both unit-array orders.

Hover refreshes after rendering even when the pointer remains still. Target movement, visibility, death and camera changes therefore update cursor feedback without another mouse event. Leaving the canvas, losing window focus or entering a modal clears hover; merely pausing the battlefield still allows inspection. The per-frame refresh uses the shared picker and visibility rules, not a second targeting policy. Its full-match performance has not been separately profiled.

The upright, ground-based cylinder is an explicit adapter interpretation of the fields. Native shape, cap behavior, vertical placement, overlap priority and animation-dependent exceptions have not been measured. This does not establish pixel parity with native selection outlines. Combat still uses the existing provisional unit radius; Ashe's record supplies no explicit gameplay-radius override, so the engine default and separate combat dimensions remain unresolved. Dynamic unit collision also remains unfinished.

## Verification

Three geometry scenarios exercise elevated side/cap hits, misses above/outside/behind the volume, and oblique rays whose radial and vertical intervals do not overlap. A real-Rift Chrome scenario checks inside/outside world offsets at zoom 0.7, 1.0 and 1.35, rejects hidden/dead targets, and observes the real enemy-hover cursor state. It also demonstrates that the former screen-circle rule rejected an inside point when zoomed in. Existing attack-move and structure-visibility browser cases pass. The captured hover view was inspected; it is local visual QA, not a native comparison.
