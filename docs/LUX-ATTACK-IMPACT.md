# Lux normal and critical impact source package

Normal and critical basic attacks resolve through the pinned skin resource map to `Lux_Base_BA_tar` and `Lux_Base_BA_tar_crit`. Both definitions are in the same verified 63,091-byte particle binary already used for Lux's basic missile: client 16.18.8175716, manifest `29CE6E781C3B6368`, binary SHA-256 `ca21a60661167c36f6416bdb32f7b93badabab8874e0a7b46e7311579fc1e152`. The exporter checks each spell's hit-effect key, resource-map resolution and complete decoded record against the binary.

The normal record contains eight authored emitters, but five are disabled: `star`, `star2`, `outerring`, `innerring` and `innerring1`. The active normal hit consists of `blastring`, `outerring1` and `sparks`. All three match critical emitters exactly except for the renamed outer ring. The critical hit adds `flash` and `ring`, for five active emitters. Rendering all eight normal entries would incorrectly restore disabled star layers.

| Active layer | Normal | Critical | Nominal particle life |
| --- | --- | --- | --- |
| Blast ring | `blastring` | Identical `blastring` | 0.3 s |
| Outer ring | `outerring1` | Identical `outerring` | 0.25 s |
| Sparks | `sparks` | Identical `sparks` | 0.4 s, with birth probability scaling |
| Flash | — | `flash` | 0.1 s |
| Expanding ring | — | `ring` | 0.5 s |

The schema audit resolves hashed fields using LeagueToolkit's generated metadata at revision `76bf57bf4fd195343dec610bf0f912a06b910914`: `33f36f05` is `disabled`, `76f8ad24` is `startFrame`, `6563bee8` is `miscRenderFlags`, and `8aa1ffc1` is `paletteDefinition`. Direction velocity scaling and flex-shape fields are also identified. The raw records retain their original field spellings; the normalized audit supplements them rather than silently rewriting the source.

Fourteen referenced textures export to PNGs totaling 279,435 bytes, including inputs belonging to disabled emitters. The shared target-hit atlas, flash and ring images, particle-color lookups, spark image and flame gradient remain distinct inputs. The flame gradient is nested under `paletteDefinition`; treating it as a second color sprite or as the particle-color lookup would be incorrect. The palette sections below reconstruct RGB replacement and the supplied row coordinate; complete native variant selection remains unverified. Every PNG retains decoded RGBA bytes exactly, and repeated exports verify dimensions, pixel hashes, PNG hashes and sizes.

`docs/reference/lux-attack-impact.json` preserves both full records, asset paths, hashes and archive/chunk provenance. `docs/reference/lux-attack-impact-audit.json` contains normalized emitter summaries, schema evidence, disabled flags and exact cross-variant equivalences. The browser inspection page at `/tools/qa/lux-impact-source.html` displays active/disabled entries and all source images. Its browser check verifies all fourteen images load, the five disabled entries remain visible as audit rows, and the active counts are three and five. The full-page texture board was visually reviewed.

Reproduce from the repository root:

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/export-lux-attack-impact.py
PYTHONPATH=.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/audit-lux-attack-impact.py
npx playwright test e2e/lux-impact-source.spec.ts
```

This package does not change gameplay impact rendering. Next work must compose the three shared active emitters and two critical additions, verify atlas-frame and palette behavior, and connect them to saved impact state and target-bone attachment. Target-follow binding, native height/orientation, material variants and timing remain unverified. The current generic hit feedback is not presented as a native Lux impact.

## Static atlas inspection

The atlas inspector now isolates any of the six `GlobalTargetHit01` cells, initially frame 4. Both active outer-ring records explicitly author `texDiv=[2,3]`, `numFrames=6` and `startFrame=4`. The row-major, top-down convention follows the [pinned LeagueToolkit UV reconstruction](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/uvTransform.ts) and its [source-coordinate discussion](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/docs/plans/vfx-particle-renderer.md#213-the-palette-and-erosion-readings-and-what-a-review-found). This is reconstruction evidence, not a captured native frame comparison.

`particleAtlasUv` maps local top-down coordinates directly into geometry UVs; source textures use `flipY=false`. This avoids relying on `Texture.offset/repeat`, which the initial-color-product custom shader does not apply. The helper only selects a static cell, with explicit invalid-input rejection. Animation rate, random phase, wrapping inside a cell, scrolling, rotation and native filtering remain separate work. UV boundaries use exact normalized thirds: the 512-pixel atlas height is not divisible by three, so rounded image crops would change the authored sampling region.

The browser test pins both active emitters' atlas fields and checks every RGBA byte of all six cells of an asymmetric synthetic texture through the actual particle shader. Its CPU reference crops texture rows directly and accounts for bottom-up WebGL readback; a zero-alpha colored texel checks preservation of hidden RGB. The source frame-4 screenshot was also visually reviewed. The preview uses nearest filtering and displays the raw cell's aspect ratio, not the final particle's world-space dimensions or framebuffer blend. Gameplay remains unchanged.

```sh
npx playwright test e2e/particle-atlas.spec.ts e2e/lux-impact-source.spec.ts
```

## Spark palette shader

The initial-color-product material now optionally implements the palette replacement found in pinned native quad pixel programs 12, 23 and 33. Program 12 (`PALETTIZE_TEXTURES` plus `DISABLE_FOW`) has SHA-256 `64372231ea7c1c5d781b247f4654c83c6bf50b87116c542ccfcb6d5a0d0915a2`. The existing shader exporter pins the program and the disassembler validates its hash before decoding the exact LLVM payload. The inspected operations are:

1. Sample base RGBA; dot all four channels with `cPaletteSrcMixerMain` and clamp to [0,1].
2. Form `(clampedDot, cPaletteSelectMain.x)`, then add `cPaletteSelectMain.zw`. Scroll is after saturation.
3. Sample `sPalettesTexture_TX`; replace base RGB while retaining **base alpha**, ignoring palette alpha.
4. Multiply that result by particle tint and the particle-color lookup. Quad MULT_PASS also multiplies its separate texture; the existing lookup/multiplier coordinate relationship remains intact.

Program 12's `%13–%30` contain those operations, followed by a separate pixel-color remap. The helper deliberately stops before that remap and framebuffer blending. Program 33 confirms the same replacement before the quad multiplier. This verifies the operation available in those native variants, not which complete variant the running Lux effect selects.

The impact audit now resolves nested palette field hashes as well. Both spark records author `palleteSrcMixColor=[0,1,0,0]`, `paletteSelector=[9,0,0]`, `paletteCount=10` and the flame-trail gradient. Animation curves and address mode are absent in the records and reported as null rather than invented authored values. The [pinned CPU reconstruction](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/palette.ts) converts the row to `(9+0.5)/10=0.95`; this reconstruction supports the preview's normalized uniform, while the native pixel program itself only establishes use of the supplied coordinate.

`/tools/qa/particle-palette.html` compares the original spark with this RGB replacement and allows inspection of all ten rows. It uses raw texture channels, `flipY=false`, linear filtering and clamp addressing, with an opaque RGB presentation. It does not claim a native final spark appearance. The selected row-9 screenshot was visually reviewed. Twelve synthetic GPU probes cover source alpha (including zero), alpha as the mixer input, multi-channel mixing, both saturation bounds with opposing scroll, shifted rows, nonwhite tint/lookup, and quad multiplication. Expected values come from an independent CPU nearest-sample calculation; every channel agrees within one byte. Existing initial-product and atlas GPU tests also pass.

```sh
python3 tools/assets/inspect-particle-shaders.py --llvm-dis /path/to/llvm-dis
npx playwright test e2e/particle-palette.spec.ts e2e/particle-color-product.spec.ts e2e/particle-atlas.spec.ts
```

Palette replacement is now an available rendering building block. Composition, spark birth/motion, native sampler state, target attachment, saved impact history and gameplay integration remain unfinished.

## Ring and flash component playback

`/tools/qa/lux-impact-rings.html` now composes the two shared ring layers and the two critical additions. The source exporter preserves float precision for lifetime, scale and color keyframes, lookup settings, atlas selection and birth rotation. It asserts that shared normal/critical definitions match except for names. Disabled normal layers are never exported. `luxImpactRings` samples one birth's age directly, so reverse seeking and repeated reads do not accumulate simulation drift.

The preview follows the existing reconstruction's uniform-X scale policy and unit conversion (a two-unit quad times source scale times 0.01), ADD tint premultiplication and SrcAlpha/One mode-4 flash blending. The ring and flash use birth chance times 360 degrees; the blast ring uses its fixed 45 degrees. The display adapts that source angle into a negative camera-plane Z rotation. Native orientation, flex-shape behavior and target binding remain unverified, and the component preview explicitly holds all particles at a stationary origin. It begins at **particle birth**, not a claimed native impact-event emission time. No spark particles are included yet.

The normal view has two layers until the outer ring expires at 0.25 seconds, then one until the blast ring's exact authored lifetime `0.30000001192092896`. The critical view also has the flash until `0.10000000149011612` and expanding ring until 0.5 seconds. GPU rendering uses the previously verified color product and atlas path, with raw linear texture sampling. The screenshot at 0.045 seconds was visually reviewed; it is a component reconstruction rather than native parity evidence.

Three unit tests check exact source lifetimes/scales, expiry boundaries, scale keyframes, chance rotation, deterministic seeking, shared normal/critical state, and constant-versus-lifetime lookup coordinates. The browser test checks rendering, reverse seek, playback controls and successive retirement of all four layers. All 684 unit tests pass. The QA module also passed a direct TypeScript check because normal application compilation excludes that directory.

```sh
python3 tools/assets/export-lux-impact-rings.py
npx playwright test e2e/lux-impact-rings.spec.ts
```

Next integration work is still spark emission/motion and direction alignment, followed by target-attached saved impact playback and comparison with native captures.

## Five-spark burst and composed component preview

The component preview now includes the shared five-spark burst alongside all four ring/flash profiles. `export-lux-impact-sparks.py` checks that both complete spark records match, verifies the single-particle flag and rate of five, and exports exact birth distributions, drag, color/scale curves, binding and direction-scale fields. In the [pinned emission reconstruction](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/emit.ts), `isSingleParticle` makes the first emission a burst of `max(trunc(rate),1)`, then suppresses later births. The inspector continues to use age since that common birth, not impact-event timing.

Each indexed spark draws one stable visual hash value, reused across all of its birth probability channels. The distribution gives lifetime endpoints approximately 0.16–0.4 seconds, velocity endpoints `[800,-400,-1800]` to `[-800,800,1800]`, and anisotropic scale endpoints `[10,20,0]` to `[20,60,0]`. The zero/empty Z-scale table remains zero. A single shared chance intentionally correlates these channels. The visual hash is the existing hoop hash; it does not consume combat randomness or claim to reproduce the native sequence.

`luxImpactSparks` reconstructs positions with 60 Hz drag: decay velocity by `1-8/60`, then advance position. Fractional display time interpolates the next position segment. Velocity for direction and stretching is the derivative of that displayed segment. Particle color and relative scale sample their authored lifetime curves, and particles expire at their individual exact lifetimes. Binding is exported but unapplied in this stationary-source stage.

`LuxImpactSparkCloud` draws up to five instances with the verified green-channel palette replacement at row 0.95, source alpha, lifetime color and ADD tint premultiplication. Camera-plane up follows projected velocity. The [direction-stretch reconstruction](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/docs/plans/vfx-particle-renderer.md#251-a-stop-waits-on-emitterlinger-a-system-builds-up-before-it-draws-and-travel-stretches) uses `max(directionVelocityMinScale, speed*directionVelocityScale)` on the up extent; its author explicitly notes that the scale formula lacks a native reading. This implementation preserves that limitation rather than treating the stretch heuristic as certified. The native basis, sampler state, pass ordering, flex shape and moving target attachment also remain unverified.

The preview shows equal spark states in normal and critical hits, allows changing the spark seed independently of ring birth chance, and retires all particles by 0.401 seconds. The composed screenshot was visually reviewed. New tests verify correlated distribution endpoints, a separate iterative drag reference including fractional age, seek stability, individual expiry, camera-facing normals and long-axis alignment under a rotated camera, instance retirement and borrowed texture ownership. The browser checks seed changes, equality across variants, seeking and retirement. All 687 unit tests and both focused browser tests pass; the QA module passes its direct TypeScript check.

```sh
python3 tools/assets/export-lux-impact-sparks.py
npx playwright test e2e/lux-impact-rings.spec.ts e2e/particle-palette.spec.ts
```

The next step is saved impact state and moving-target binding, followed by gameplay composition and native capture comparison. No gameplay hit effect has been replaced by this component preview yet.

## Confirmed-hit state and target history

Snapshot schema 54 adds `luxImpactVisuals`. A confirmed Lux basic-attack contact records its projectile ID, source/target IDs, team, contact tick and captured critical flag. The record is created only in the accepted projectile contact branch, before damage so lethal hits still produce presentation state. A homing projectile removed because its target disappeared does not create an impact. The ID deliberately matches its retained flight history; no new gameplay entity or random draw is introduced.

Each record keeps target-centre coordinates at fixed ticks for 32 ticks: the longest 0.5-second impact particle, a potential first-step birth and display interpolation. This is a presentation retention policy, not a claim about native emission timing. Live target motion is recorded after simulation movement/damage. On death or disappearance, `detachedTick` freezes the last available target location; subsequent revival/respawn cannot move that old effect. Critical identity comes from the released projectile and does not depend on the attacker's later inventory.

The strict decoder verifies unique impact IDs, the matching stopped Lux flight, source/team identity, target team when present, exact consecutive frame count/ticks, retention bounds and detachment ordering. Attached histories must end at the current target centre; frames after detachment must remain stationary. Source histories remain longer than impact histories, so the required flight record is available throughout impact retention. The schema and simulation fingerprint change intentionally invalidates older checkpoints.

Three new unit cases cover both hit variants, continued moving-target histories through restoration, individual expiry, lost-target suppression, lethal hits, disappearance, death/revival freezing, and malformed histories. The real browser checkpoint test now also asserts confirmed impact state and restores its full snapshot. All 690 unit tests, that browser test and the production subpath smoke check pass.

This step stores simulation-space target centres. Native target-bone height/orientation, per-emitter binding and rendering from saved frames remain unfinished; gameplay still uses the existing generic impact feedback.

## Gameplay rendering from saved impacts

`LuxImpacts` now renders confirmed basic-attack hits in the game: shared blast/outer rings and five sparks, with the additional flash/expanding ring on critical hits. Startup loads the nine distinct active texture inputs through the deployment base URL. Textures are shared; expired impact meshes, geometry and materials are disposed. The existing damage-number UI remains intact.

The presentation samples `world.tick-1+alpha` and assumes first-step particle birth at `startTick+1`. Ring profiles now explicitly export `bindWeight`: zero for the shared rings, one for the critical additions. Shared rings remain at their saved birth position; bound critical rings use the current interpolated target position. Spark binding accumulates each saved movement segment using the emitter-phase curve rather than multiplying total displacement by the current weight. Previously inherited movement therefore remains when binding reaches zero. Parent-motion velocity contributes to the direction/stretch adapter; saved frame interpolation provides that velocity, with the last known segment at an integer display tick.

Rendering uses the same source atlas, lookup and palette materials verified in the component inspectors. Camera-facing meshes depth-test against the scene. Enemy rings and individual sparks are suppressed by current point visibility; allied effects retain the existing allied-presentation policy. Retiring a saved effect removes its entire render cloud. No mutable renderer-only RNG or accumulated motion is needed to restore it.

This adapter deliberately uses target centres plus the existing `ground+0.9` height convention, and world-axis spark emission. The native target-bone transform, system orientation, flex-shape contribution, complete material/pass ordering, sampler state, emitter timing and stretch formula still need native capture comparison. The implementation is a source-informed gameplay reconstruction, not a pixel-parity claim.

The browser checkpoint test now compares normal-hit ring transforms/colors and spark instance matrices/tints across a real save/reload and checks complete retirement. A separate critical-hit test verifies four visible rings, five sparks, bound-versus-unbound movement, exact restored spark matrices and fog suppression/reappearance for every layer. The gameplay critical screenshot was visually reviewed. An additional unit test verifies saved-frame interpolation, cumulative binding and reverse-seek stability; all 691 unit tests pass. Both focused browser tests pass. The initial browser run exposed an outdated expected empty-result shape after adding impact buffers; that test expectation was corrected and rerun successfully.

## Authored hit bones and target-pose audit

The two ordinary Lux basic-attack spell records both set `bHaveHitBone=true` and name `C_BuffBone_Glb_Center_Loc`. The critical spell also enables its hit bone but names `C_BUFFBONE_GLB_CHEST_LOC`. This is a material normal/critical attachment difference beyond the emitter additions. `lux-hit-bones.json` is generated from those preserved records; `luxHitBone` resolves the requested name with case-folding, leaves missing attachments explicit, and rejects ambiguous duplicate matches.

`audit-lux-hit-attachments.mjs` checks each of the sixteen shipped unit GLBs against its existing metadata byte count and SHA-256 before inspecting nodes. The resulting reference report pins the input spell JSONs and GLBs and records the actual node name, model-local rest position, ancestor chain and clips with varying ancestor channels. Both attachments exist in Ashe, Lux, all eight minion models and both turrets. Neither exists in either nexus or inhibitor model. Procedural fixture targets are outside this source-model inventory.

The centre is not universally static: both champion models have varying ancestor channels affecting the centre attachment, as do some minion and turret clips. A chest attachment generally follows additional animated joints. In model-local rest transforms, Ashe's centre is near Y=1.21 and chest near Y=1.452; Lux's centre is near Y=1.181 and chest near Y=1.450. These are **rest positions**, not constant replacement heights or sampled gameplay poses. The varying-clip report identifies authored changing channels, not a measured positional range.

`/tools/qa/lux-hit-attachments.html` now loads a selected target and animation and displays the actual posed centre/chest nodes as cyan/gold markers. It supports all sixteen models, reversible pose seeking and explicit missing-bone status. Replaced and superseded model loads release their geometry, materials and textures. The browser test verifies distinct animated attachments, exact reverse-seek state, both champion models, a minion model and missing inhibitor nodes. The Ashe run-pose screenshot was visually reviewed; the QA module also passes its direct TypeScript check.

```sh
node tools/assets/audit-lux-hit-attachments.mjs
npx playwright test e2e/lux-hit-attachments.spec.ts
```

The next attachment change must reconstruct the target pose at particle birth and subsequent bound frames, including death and save/load. Simply reading the target's current bone for an unbound old ring would drag that ring with later animation. A rest-height substitution would discard the newly verified animation. Native missing-bone fallback also remains unresolved. The gameplay centre-height adapter is therefore still present pending that historical-pose work.

## Isolated target-pose sampling

`TargetPoseSampler` now samples an explicit set of clip-local times and normal-animation blend weights on a private skeleton cloned from an **unposed reference scene**. It never advances or modifies the live target, geometry, materials or clips. Each request stops the previous actions, restores rest contributions, applies the requested layers and updates the private hierarchy at zero elapsed time. Sampling order therefore does not become part of attachment state. Reference-root transforms are included; instance placement and world transforms remain caller-owned.

The sampler clamps explicit times to clip duration and leaves loop mapping to the caller. Normal Three blending supplies rest contribution for underweight properties and normalization for overweight properties. Duplicate clip layers are rejected because a single mixer action cannot represent two times of the same clip. Unknown clips, nonfinite values and negative weights are rejected before changing the previous sample. Missing hit bones return false without overwriting the caller's output vector. Disposal releases mixer bindings without disposing borrowed render assets.

The attachment inspector now compares each visible posed bone against this isolated sampler and displays the error. Its browser test checks every exported clip at five nonsequential phases (including both endpoints) on Ashe, Lux, red melee and blue inhibitor. Errors remain below `1e-7` model units; missing-bone behavior agrees. Three unit cases independently verify hierarchy translation/rotation against known transforms, weighted rest contribution, repeated mixed poses, time clamping, validation before mutation, absent bones and borrowed-resource ownership. All 694 unit tests pass; the expanded browser test and direct QA TypeScript check pass.

This is an attachment sampling building block, not yet a replacement for gameplay height. The live renderer still maintains some locomotion and transition clocks locally. The next step must make the target's historical animation state recoverable from simulation history so the sampler receives the correct birth and bound-frame poses, including transitions, death and restoration.

## Saved run phase as historical-pose groundwork

Schema 55 adds a nullable per-unit run clock with movement-segment start tick and previous/current clip seconds. The simulation advances it at 60 Hz using the existing gameplay-speed/nominal-speed ratio; changing speed preserves accumulated phase rather than recomputing all earlier time at the latest speed. Nonmoving, dead and fixed-structure units clear the clock. A new movement segment starts fresh. Snapshot validation rejects future segment starts and reversed clock intervals.

The live renderer now seeks the run action from the saved clock, interpolated by display alpha and wrapped by source clip duration. Missed render frames, paused re-renders and reloads no longer change steady run phase. Once the movement segment is at least 80 ms old, the existing run entry fade is treated as complete rather than starting another fade on first visibility/restoration. Outgoing run actions retain the old mixer-driven transition policy. This is the current local animation adapter; native graph phase/transition behavior remains uncalibrated.

Two unit cases verify speed changes, continuation after restoration, stopping/restarting, death and malformed saved clocks. The browser speed test now checks both actual clip phase and per-step playback rate across forty champion/minion speed/slow/haste combinations. A separate browser checkpoint test deliberately skips run renders, repeats rendering at the same tick with large elapsed-time changes, saves/reloads, and verifies exact run time, full weight and chest-bone world matrix. All 696 unit tests, both browser tests and the production subpath smoke check pass.

This removes the frame-dependent steady run clock, but full historical attachment poses still need idle clocks, transition layers, target pose fields in impact history and attachment sampling at those saved states. The first 80 ms of transitions are not yet deterministic from saved state alone.

## Saved mobile-unit idle phase

Schema 56 adds the idle counterpart to the saved run clock. Mobile living units advance idle seconds at fixed ticks only while stationary and outside an active attack cycle, recall or cast clip. An interruption clears the clock, and returning to idle starts a fresh segment. Fixed structures keep their separate animation path. The decoder validates both clock intervals and segment start ticks.

`export-champion-clip-durations.mjs` verifies the existing Ashe/Lux GLB hashes and sizes and extracts every animation's exact final input timestamp. The generated duration table is used to detect cast completion in simulation. A shared cast-clip-name function keeps the renderer and simulation's Q/W/E/R mapping consistent. The browser compares every exported duration with the actual loaded Three animation clips, so the simulation is not relying on a separately rounded timer. Cast-to-idle clock activation is still a fixed-tick policy; sub-tick native graph transitions remain uncalibrated.

The renderer now seeks either steady run or idle from its saved previous/current seconds, modulo the selected source clip duration. Once the existing 80 ms entry fade has elapsed, late rendering/restoration applies full action weight. Outgoing run and idle layers retain their old mixer-driven fade behavior until transition history is implemented.

Two new unit cases cover saved idle continuation, interruption/restart on movement, source-duration cast completion, recall cancellation, death and invalid saved timing. Browser checks verify exact idle time, weight and chest-bone world matrix across skipped renders, repeated same-tick renders and a real checkpoint reload for both champions. All 698 unit tests, four browser tests (idle, run and attack-release regression checks) and the production smoke check pass.

```sh
node tools/assets/export-champion-clip-durations.mjs
npx playwright test e2e/idle-clock.spec.ts e2e/run-clock.spec.ts e2e/attack-release-pose.spec.ts
```

Steady mobile idle/run phase is now recoverable. Remaining historical-pose work includes transition layer weights/times, per-impact target pose capture, structure animation state and applying the isolated bone sampler to the saved impact path. This does not certify native animation-graph parity.

## Shared primary mobile-pose selection

`mobilePose` is now the live renderer's single primary-pose selector for mobile source rigs. It resolves death, an active cast, recall sequencing, attacks and locomotion in that priority order, using the existing attack-cycle conditions, champion clip mapping and source durations. It returns the chosen clip, explicit local time, playback rate, loop mode and the current cut/fade policy. Loaded models cache their clip-duration map once. Recall sequence selection is now a shared pure function; the unused separate mixer-driven recall implementation was removed.

The selector preserves Lux's deterministic ordinary attack variants, critical clips, Ashe empowered-attack priority, saved run/idle clocks, cast timestamps, source recall ordering and terminal death age. It distinguishes the primary action from a transition mixture: incoming/outgoing fade layers still live in the renderer. A missing required duration fails explicitly rather than silently choosing a different pose. Initial or newly entered locomotion with no clock uses phase zero until its fixed-step clock exists.

The renderer applies that descriptor through the existing mixer. Cast/recall use immediate full-weight selection. Normal transitions keep the current 80 ms fade, and already-settled primary poses do not restart a fade on late visibility/restoration. This also makes late death poses correct on a render with zero elapsed render time; the death browser regression now exercises that case directly, including fresh restored rigs.

Two pure-selector unit tests check mode precedence, explicit attack timing, recall hold, run interpolation/rate and missing-clip errors. All 700 unit tests pass. Fourteen distinct browser checks cover both steady clocks, all mobile rig speed variants, normal/critical attacks, source attack variants, cast/recall, death and terminal playback; the production smoke check also passes. No snapshot schema change was needed for this consolidation.

This provides a common primary-pose description for the forthcoming saved transition history. It does not yet save mixtures of outgoing and incoming animations, nor replace the impact renderer's target-centre height with historical bone positions.
