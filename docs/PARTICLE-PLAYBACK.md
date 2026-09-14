# Particle playback

Lux basic attacks now render all three reconstructed source emitters with saved trajectory replay. Their ordinary type-0 lifetime caps preserve natural particle lives; see the latest audit below. Native-client visual parity remains unverified. The sections retain the implementation and verification history.

## Initial lifetime appearance

The hoop color lookup now follows a documented renderer reconstruction instead of a manually chosen coordinate. The pure evaluator in `src/render/particle-lookup.ts` supports constant, lifetime, velocity and birth-random axes. Constant returns the scale alone; the other modes multiply their driving value by scale and add offset. Velocity means the magnitude of actual travel per second in source units. The evaluator leaves coordinates unbounded for the texture sampler to address.

The reference is LeagueToolkit/ltk-manager at revision `65a7d2a746b9d02d65dab788b5f7b8198d5e555e`: [enum definitions](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/enums.ts), [lookup evaluator](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/colorLookup.ts), and the [renderer research](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/docs/plans/vfx-particle-renderer.md). This is an external source-reconstruction reference, not our own instrumented native-client capture. Its distinction between a mesh uniform and quad vertex coordinates agrees with the pinned shader disassembly already checked locally.

A separate renderer, ReyEngine, documents an approximate lookup mapping with different enum assignments and a velocity divisor in its [simulator](https://github.com/TheKillerey/ReyEngine/blob/8a47ce55a3c99fbf75e8715437b11aef4f40a080/src/ReyEngine.Rendering/Vfx/VfxParticleSimulator.cs). We do not adopt those heuristics. The disagreement is why the implemented semantics are explicitly tied to a pinned reference and why matching the native client remains a separate validation task.

`src/content/lux-basic-lookups.ts` holds the hoop's nominal lifetime, RGBA birth color, relative scale endpoints and lookup settings. Tests match those values against the existing binary-verified Lux emitter. Its absent lookup-type fields use the pinned schema defaults: X is lifetime, Y constant. The source scales `[1,0.5]` therefore yield `(age01,0.5)`. Normalized age 0.5 produces relative scale 0.75 and retains source birth alpha 0.6500037908554077.

The development inspector at `/tools/qa/particle-color-preview.html` exposes this isolated lifetime only for Hoop. It supports forward/backward seeking and nominal-lifetime playback at 0.1× speed. Switching off source appearance restores manual lookup coordinates, white tint and full relative size. Other texture pairs keep manual controls. This clock belongs only to the inspector; it does not change game time or saved-match state.

Five source/evaluator checks cover constant-zero behavior, ignored constant offsets, unbounded lifetime coordinates, source-unit velocity magnitude, stable birth random and the actual hoop profile. The browser test checks endpoint and midpoint states, exact backward-seek restoration, play/pause, manual override and disabled controls on a different emitter. The 36 shader GPU comparisons still pass. The full source/simulation check is 622 passing tests across 127 files; the production build passes. The lifetime screenshot was visually reviewed.

This preview omits probability draws, emission count, spawn shape, orbital motion, drag, binding, world transforms, linger and actual native blending. The endpoint at normalized age one is an inspection of the terminal curve value, not a claim that a dead particle remains visible. A sampled lifetime may differ from the nominal 0.15 seconds. The next component must supply deterministic birth state, integrate the source motion, and feed this evaluator actual age and travel; it must not invent speed normalization or regenerate birth randomness at draw time.

The same reference also identifies the arbitrary trail's mode 1 as a wake based on emitter travel at birth and documents cutoff, tiling and smoothing. That is useful evidence for the subsequent trail builder; it is not yet implemented or validated against a native Lux capture. The basic attack remains a generic projectile in gameplay.

## Emitted hoop cloud

The next component is `lux-hoop-particles.ts`, a deterministic local-emitter reconstruction, rendered by `LuxHoopCloud` in `lux-hoop-cloud.ts`. Open `/tools/qa/lux-hoop-playback.html` to inspect emitted particles over time. This is the stationary hoop emitter, not yet a moving missile effect.

A single stable chance per birth drives the authored probability tables for lifetime, upward velocity, spawn angle and uniform size. The source's empty X/Z velocity tables yield zero; they do not preserve the constant X velocity of 50. Lifetimes span approximately 0.075–0.600 seconds, with the authored probability knot retained at 0.8999999761581421. Sizes use the first axis under `isUniformScale`. The profile checks compare these fields and distributions directly with the pinned emitter.

The latest probability and orbital readings in the [pinned LeagueToolkit renderer plan](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/docs/plans/vfx-particle-renderer.md) support shared birth multipliers, zero-valued empty tables, radian orbital rates and translation rotated around the system origin. The reconstruction implements those mathematical rules independently. Its indexed hash is this project's deterministic choice; it does not reproduce the client's random generator.

The model uses the game's existing 60 Hz simulation frequency as an explicit reconstruction policy. Emission is quantized onto that grid, starting at tick one. Y velocity decays by `max(0,1-drag/60)` before advancing position. A geometric sum reproduces that discrete recurrence without replaying all preceding steps; the final display interval interpolates its next step. Tests compare it against an independently iterated recurrence. Orbital displacement is evaluated from age in radians. This is not the analytic-drag engine branch, whose flag is absent from the pinned definition and unset in the referenced system default. The native update rate and birth-step scheduling still require client comparison.

Only the potentially live birth window is reconstructed, bounded by the maximum source lifetime. Seed, age and stop time therefore reproduce the same particles regardless of intervening seeks. Stopping emission leaves existing particles to age out; the inspector stops at 0.5 seconds and reaches an empty cloud by 1.2 seconds. This explicit stop does not yet implement the source's particle-linger modes or missile impact lifetime.

The renderer uses one instanced draw, borrowed source textures, source-unit conversion of 0.01 and a per-instance lookup coordinate. It currently interprets size as the half-extent of a camera-facing quad. Its ADD reconstruction premultiplies the particle tint by birth alpha and adds with ONE/ONE, following the reference's blend-mode-0 interpretation; the mote PNG has opaque alpha throughout. Texture data stays unconverted, with top-row UV convention and linear sampling. Native orientation, extent, blend state, sampler state and appearance still need comparison. The class disposes its own geometry/material/instance resources, leaving borrowed textures to their owner.

Validation: 627 checks across 128 files; three focused browser cases including the existing 36 GPU color comparisons; production build; and visual review of the 1440×900 cloud inspector. The cloud test checks two scene draw calls while populated (one cloud, one grid), one when empty, exact backward-seek state, changed/recovered seed state, play/pause, stop retirement, restart and stable geometry count. It does not certify GPU timing, native pixels, full-world performance or match-file restoration of an integrated Lux effect. Evidence: `reference/lux-hoop-emission-verification.json`.


## Saved Lux attack trajectories

Real Lux basic attacks now retain their launch origin and a contiguous, bounded history of missile positions and headings. Each frame records the post-step pose at its world tick. Swept hits retain the contact point rather than the full-step overshoot; disappearing targets stop the effect at its last position. Stopped records survive 37 ticks, covering the longest currently reconstructed natural particle lifetime. The 40-frame history includes interpolation margin. These limits are reconstruction policy, not a verified native linger rule.

The frame evaluator interpolates position and the shortest angular turn, rejects requests before the retained prefix and freezes at the terminal pose. Schema 50 saves this history and rejects missing active records, duplicate identities, invalid owners, inconsistent endpoints/origins, gaps and expired tails. The records do not apply damage or replay sounds. Gameplay particle attachment is still the next step; the generic Lux projectile remains visible.

Validation: 632 checks across 129 files, nine focused browser cases and the nested-path production smoke passed. Real browser checkpoints restored exact world state both during flight and after impact, continued deterministically and retired the tail on schedule. Other focused cases covered existing saves, champion selection and Lux HUD. No visual rendering changed in this step. Evidence: `reference/lux-attack-history-verification.json`.


## Hoop particles attached to real Lux attacks

`lux-attack-hoops.ts` now reconstructs the hoop's particles from each real attack's saved history. A mote's local offset is rotated through the heading at its birth tick and translated to that birth position. Later missile turns do not drag previously emitted motes. Impact stops new births while the retained record allows old motes to finish aging. Each effect uses its projectile identity as the deterministic seed. The shared instanced renderer accepts either local inspection particles or world-positioned particles.

The game loads the pinned mote and spectral textures under Vite's deployment prefix, with the same raw color, top-row UV and linear sampling policy as the inspector. Enemy motes are filtered individually against current point visibility. When a saved effect retires or a checkpoint removes it, its scene object and owned geometry/material/instance resources are disposed; textures remain shared. No new snapshot format is needed beyond version 50.

This is one integrated emitter of three. The generic missile core still remains while crescent and ribbon integration are pending. Current terrain-relative missile height of 0.9 world units, source-to-world heading interpretation, native billboard extent, RNG, update scheduling, blending and linger semantics still need native-client comparison. Ground height is sampled beneath each mote; a native missile-height trajectory is not yet captured. This does not claim complete or pixel-identical Lux attack presentation.

Validation: 635 checks across 130 files, two focused browser scenarios and nested-path production smoke passed. Model checks verify birth-position/heading transforms, independence from later path changes, JSON replay, stop behavior and unavailable-history handling. The real attack checkpoint scenario verifies identical instance counts and matrices after post-impact reload, enemy visibility removal/reappearance and complete scene-object retirement. The stationary inspector remains deterministic. Both 1440×900 in-flight and post-impact gameplay screenshots were inspected. Evidence: `reference/lux-attack-hoops-verification.json`.


## Lux ribbon birth state and persistent wake distance

The pinned trail definition uses mode 1 (WAKE): the ribbon's longitudinal UV depends on emitter distance at particle birth. Recomputing distance from the retained path would make the texture shift when old frames retire. Each Lux attack history frame now stores absolute cumulative planar travel, including the first launch step and the swept contact segment. Format 51 validates the distance progression and preserves it through saves and bounded-history retirement. The frame evaluator interpolates that counter alongside position and heading. This is planar simulation distance; native height-dependent travel still needs an actual missile-height trajectory.

`lux-basic-trail.ts` records the exact source rate, lifetimes, emitter offset, blend identifier, wake mode, cutoff, tiling, multiplier scroll and authored birth/lifetime curves. `lux-trail-particles.ts` reconstructs live points in newest-first order using the existing explicit 60 Hz emission policy. Birth time drives width, color and Y-axis rotation; particle age drives relative width, color and multiplier scroll. Each point retains its birth pose and unwrapped distance/500 wake coordinate. Old points retire at exactly half a second; computing age from tick differences avoids a floating-point subtraction tail at that boundary.

The source interpretation follows the previously pinned [LeagueToolkit ribbon research, sections 2.12 and T7](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/docs/plans/vfx-particle-renderer.md). The implementation is independent and its profile tests compare directly with the binary-verified local Lux definition. Geometry expansion along each point's local +X, walked cutoff, UV packing/addressing, native material selection and blend validation remain subsequent work. The ribbon is not yet rendered in gameplay; the hoop integration is unchanged.

Validation: 641 checks across 131 files, six focused browser save cases and nested-path production smoke passed. The tests cover curved cumulative travel, bounded history, clipped impact, malformed distance records, exact source curves, separate birth/age clocks, wake-coordinate stability after prefix removal, exact JSON replay and terminal retirement. An initial test exposed the age-boundary rounding defect; the final run includes the repair. No new visual claim is made for this state-only step. Evidence: `reference/lux-trail-state-verification.json`.


## Integrated Lux ribbon geometry and material

The ribbon now renders alongside Lux's hoop particles. `lux-trail-ribbon.ts` expands each retained trail point along its own local +X axis, preserves its authored half-width and RGBA, and walks newest to oldest without smoothing. It stops before the first point whose cumulative walked distance reaches the 1,000-unit cutoff; it does not invent an interpolated end cap. Wake UVs subtract the leading point's even cell, preserving repeating/mirrored parity while keeping coordinates small. The base layer spans V=0–1 because this emitter's tiling Y is zero. The multiplier receives its independent age-based scroll. Hidden points remove adjacent segments rather than joining across the gap.

The material uses raw source textures, top-row UVs, linear repeat sampling and per-vertex RGBA. For this emitter's absent/default-white ramp, the quad product reduces to base × tint × multiplier. Mode 4 uses SRC_ALPHA/ONE additive blending on RGB and alpha, with depth testing and no depth writes. This follows the pinned [ribbon material reference](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/materials.ts), [blend reference](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/blend.ts) and [section 2.45's multiplier reading](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/docs/plans/vfx-particle-renderer.md), implemented independently. Native-client capture remains necessary to certify these reconstructions.

`LuxRibbonMesh` reuses fixed-size GPU attribute buffers; each active effect has one mesh and draw. Effects reconstruct their vertices from saved state after reload, and dispose owned geometry/material when their retained record expires. Shared textures load beneath the deployment prefix. The development preview at `/tools/qa/lux-trail-playback.html` provides seeking, play/pause, restart and textured/wireframe inspection on a curved authored path. Its path stops at 0.7 seconds and its points retire by 1.2 seconds.

Validation: 645 tests across 132 files, four focused browser scenarios and nested-path production smoke passed. Geometry tests cover rotated widths, cutoff, wake-cell packing, independent multiplier scroll and hidden-point gaps. Synthetic GPU probes check all RGBA channels of both the vertex-tinted product and source-alpha additive result within one byte; all 36 prior source-texture GPU comparisons also pass. The GPU probe explicitly disables premultiplied canvas alpha so its nonopaque clear color matches the independent reference. Real checkpoints restore all ribbon attributes/counts exactly after impact, preserve fog hide/reveal and retire both effect maps. The preview verifies deterministic seeks, play/pause, retirement, two scene calls (one grid, one ribbon) and stable geometry counts. Gameplay flight/tail and close-up textured/wireframe screenshots were inspected at 1440×900.

Remaining: crescent integration and removal of the generic projectile core, native birth orientation/height, sampler/material capture, full native linger policy and pixel comparison. Terrain height is still sampled beneath the geometry using the current reconstructed missile height. This completes a rendered ribbon component, not full native attack parity. Evidence: `reference/lux-trail-ribbon-verification.json`.


## Integrated crescent and complete three-emitter playback

Lux basic attacks now use the crescent, ribbon and hoop renderers together. The generic cone/cylinder projectile core is removed for Lux attacks. `lux-basic-crescent.ts` pins the exact crescent emission/lifetime, birth velocity, drag, binding, offset, rotation, scale and lookup fields. `lux-crescent-particles.ts` reconstructs up to six naturally live meshes from saved history. Each post-birth missile displacement contributes its sampled binding weight; multiplying total travel by the current weight would give a different result and is covered by an independent iterative test. Birth velocity uses the emitter's birth phase, drag advances at the existing fixed grid, and the final display interval interpolates the next integrated state. Rotation retains the birth heading and applies the authored local Z half-turn. Scale multiplies the source birth scale by its lifetime curve.

This binding follows the [pinned integrator research](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/integrate.ts). That reference explicitly treats the emitter-phase binding clock as a reconstruction reading rather than an instrumented per-particle native transform. We retain that distinction. Default X lookup uses lifetime with authored scale/offset; constant Y evaluates to one. The source float lifetime is slightly longer than exactly 0.6 seconds, so a particle remains alive at that exact boundary and retires on the following tick.

The renderer loads the verified source GLB and raw Ring04/ramp-down textures under the deployment prefix. The GLB's inspection material and redundant embedded texture are disposed. Each effect owns an instanced geometry clone, lookup attribute, material and six-instance buffer, and disposes them at retirement. Source geometry already contains the 0.01 unit conversion, so its animated scale is dimensionless. The original central point, face-color block and uninterpreted source flags remain preserved but unapplied while their native use remains unresolved. The initial color product and ADD reconstruction are shared with prior particle work. Enemy crescents are filtered against point visibility.

`/tools/qa/lux-attack-playback.html` shows all three emitters on a saved curved path, with individual layer toggles, time seeking, play/pause and restart. At 0.2 seconds it shows four crescents, eighteen ribbon triangles and thirty motes: three emitter draws plus the grid. The empty preview issues only the grid draw. The inspection path stops at 0.35 seconds; remaining particles age naturally. The source Ring04 texture contains rainbow bands; the preview preserves them rather than recoloring based on the emitter's name. Oblique and game-camera views show that the mesh can appear nearly edge-on. These are observations of this reconstruction, not native-image parity.

Validation: 650 tests across 133 files, three focused browser scenarios and nested-path production smoke passed. The source profile, weighted integration, drag recurrence, scale/lookup endpoints, interpolation, retained-history replay and float-lifetime boundaries pass. The gameplay case confirms no generic Lux projectile object, active crescents in flight, exact post-impact instance restoration, fog removal/reappearance and complete retirement of all three effect maps. The combined preview preserves particle/vertex state and geometry counts across seeks and layer toggles. All 36 prior GPU source-color comparisons still pass. Gameplay flight/tail and isolated/combined preview captures were reviewed at 1440×900.

Remaining fidelity work includes native frame/binding-clock and missile-height comparison, source mesh metadata interpretation, exact RNG/update scheduling, native sampler/blend capture and stop/linger modes. The 37-tick retained tail covers the reconstructed natural maximum lifetime; it does not implement the authored 10.6-second crescent linger. This completes the three-emitter reconstruction in gameplay, while native authenticity and the wider game remain unfinished. Evidence: `reference/lux-crescent-verification.json`.


## Resolved type-0 lifetime caps

The basic attack's authored linger numbers do **not** request that many additional seconds after impact. All three emitters omit `particleLingerType` and `emitterLinger`, including their hashed field identities. The pinned [LeagueToolkit schema](https://github.com/LeagueToolkit/LeagueToolkit/blob/76bf57bf4fd195343dec610bf0f912a06b910914/src/LeagueToolkit.Meta.Classes/Classes.cs) defaults these to type 0 and zero wait. The [pinned enum](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/enums.ts) names type 0 `maxLifetimeAfterEmitterDies`; the [settlement reconstruction](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/integrate.ts) caps total particle lifetime rather than resetting it from the stop. The [complex-emitter cap](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/systemModel.ts) also limits authored linger to nominal particle life plus ten seconds.

`lux-basic-linger.ts` now records and applies those three policies. Crescent's approximately 10.6-second cap exceeds its approximately 0.6-second natural life; Trail's 0.5-second cap equals its life; Hoop's one-second cap exceeds every sampled life (at most approximately 0.6 seconds). Thus ordinary type-0 stopping leaves all three natural lifetimes unchanged. It never grants a fresh 10.6 seconds to a crescent. This resolves the earlier documentation's outstanding interpretation of the authored crescent linger value; extending the saved tail to ten seconds would have been incorrect under this mode.

All three evaluators now use the explicit cap, and retained presentation duration derives from the maximum capped source life. It remains 37 ticks, with a 40-frame history including the existing three-frame margin. The maximum hoop lifetime factor is shared with its birth sampler, avoiding a separate handwritten retention bound. Format 51 remains unchanged; the simulation fingerprint changes under the existing same-build checkpoint policy.

Validation: 654 tests across 134 files, two browser scenarios and nested-path production smoke passed. Tests match authored caps, check absence of named/hashed override fields, distinguish total-life caps from added post-impact time, cover the nominal-plus-ten cap, sample 1,001 hoop probability inputs and verify the source-float retention boundary. Real attack saves, all-emitter replay, fog and retirement still pass. No visual appearance change is intended or claimed.

The primary schema/default evidence and external engine reconstruction are distinct from native-client observation. Whether a native Lux missile requests an ordinary soft stop or another termination operation remains to be captured. Exact attachment, orientation, height, binding clock, RNG/timing and shader/sampler comparison also remain open. Evidence: `reference/lux-linger-verification.json`.


## Corrected trail shape/frame rotation separation

The initial ribbon state incorrectly added `SpawnShape.emitRotationAngles` to the particle's own facing. The [pinned birth path](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/emit.ts) instead applies the shape turn to its offset and birth velocity, saves the emitter frame separately, and reads particle rotation from `birthRotation0`. Lux Trail has no shape offset, birth velocity or birth rotation, so its Y-axis shape turn contributes no geometric rotation. Its emitter offset is added after the shape operation. The field is now named `shapeRotationDegrees` in the source profile, and each ribbon point keeps its birth heading. This supersedes the earlier claim that this curve should rotate the ribbon's local +X width.

Validation: 655 tests across 134 files, three browser scenarios and nested-path production smoke passed. The new regression follows several points born before and after a heading change and verifies that they retain their own birth frames without the shape angle. Source-profile matching remains intact. Isolated ribbon and combined previews were visually reviewed at 1440×900; their replay, layer controls, retirement and geometry counts pass. Real save/restore and fog handling also pass.

The parent-orientation default is a separate, unresolved question. Both sources default `particleIsLocalOrientation` to false, supporting retained rather than live particle heading. But the pinned [generated schema](https://github.com/LeagueToolkit/LeagueToolkit/blob/76bf57bf4fd195343dec610bf0f912a06b910914/src/LeagueToolkit.Meta.Classes/Classes.cs) gives `isLocalOrientation` false, whereas the newer pinned [renderer reader](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/readVfxSystem.ts) and its plan use true. The current parent birth-heading policy is unchanged pending stronger evidence. Native-client orientation parity is not claimed.

Two further differences found in this audit remain next: the reference forces at least one particle on first emission, and its emitter odometer measures between emission batches, whereas current scheduling waits for a full rate interval and current saved distance sums every simulation step. These need explicit reconstruction changes and regression coverage; they are not treated as already implemented. Evidence: `reference/lux-trail-orientation-verification.json`.


## First emission and batch-based wake distance

The [pinned birth routine](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/emit.ts) forces at least one particle on a first eligible update, charges that birth against the rate budget, and emits nothing on a stopped update. `lux-emission.ts` now applies these rules to the three constant-rate, zero-delay, non-single Lux emitters on the reconstruction's 60 Hz grid. The first crescent and trail point move to relative tick 1; later births keep their accumulated schedule. For example, the 20 Hz crescent starts at ticks 1, 6, 9 and 12, not 3, 6, 9 and 12. The 200 Hz hoop already emitted multiple particles on its first update. Ordinary emitter lifetime remains inclusive; an explicit system-stop tick is non-emitting. Active hoop playback now represents an unspecified stop as infinity instead of conflating it with the ten-second emitter lifetime.

The same routine measures travel between emitting batches and initializes the counter at the first batch position. The prior every-tick path sum included pre-emission travel and could measure a different arc across a curved gap. World history now stores `trailDistance`: zero before/at the first batch, then planar chord distances between actual batch positions. It holds its value on non-emitting updates, after emitter expiration and at impact. The frame evaluator holds this event counter until the next recorded tick rather than interpolating it. Ribbon particles read their birth frame's counter. Inspector paths use the same emission schedule and distance semantics.

Schema 52 names and validates this changed meaning. Validation checks early zero values, unchanged counters off the emission schedule, batch-to-batch increments where their anchors remain and monotonic progression where the retired prefix owns an unavailable anchor. The existing 40-frame path covers consecutive live emission anchors; long flights preserve the accumulated absolute value when older frames expire. The 37-tick retained tail still covers all naturally surviving particles.

Validation: 659 tests across 135 files, four browser scenarios and nested-path production smoke passed. An independent integer-credit stepper checks all three rates for 600 updates and every resulting birth tick. Tests separate lifetime and stop boundaries, verify real first-update particles, suppress impact-update births, and compare a long curved flight against an explicit trail emission schedule through prefix retirement. Malformed odometers are rejected; checkpoint continuation and all three renderer restores remain exact. Combined, ribbon and hoop previews retain deterministic seeks and retirement. Updated combined and isolated-ribbon screenshots were reviewed at 1440×900.

The fixed 60 Hz grid and arithmetic remain this reconstruction's policy; exact native update frequency, float accumulation and missile termination ordering still require observation. The saved batch distance remains planar because a native height trajectory is not yet captured. Parent-orientation defaults, attachment, binding clock, RNG and shader/sampler parity also remain open. These changes resolve the two specific scheduling/odometer differences identified in the previous audit. Evidence: `reference/lux-emission-verification.json`.

## Verified basic-attack start-bone trajectory

The pinned `LuxBasicAttack` spell explicitly names `r_hand` as its `FixedSpeedMovement` start bone. It also supplies `mTargetHeightAugment: 100`, `mOffsetInitialTargetHeight: 100`, velocity-matched vertical facing and the hit bone `C_BuffBone_Glb_Center_Loc`. These fields identify an attachment and preserve height evidence; their names alone do not establish a flight-height interpolation rule.

`tools/assets/export-lux-attack-origin.mjs` checks the converted champion GLB against its manifest and extracts the complete eight-node ancestor chain of `R_Hand` in `attack1`. It samples the original translation, quaternion and scale animation channels into an adaptive model-local position curve. Across 8,001 dense reference samples the maximum position error is 0.0000049836 world units, below the 0.00001 budget. The generated JSON has 2,278 points and is 181,350 bytes. Source and output hashes, the attachment fields and limitations are recorded in `reference/lux-attack-origin.json`.

`luxAttackOrigin(seconds)` samples this curve without a renderer, clamps finite times to the clip and rejects nonfinite input. A browser regression independently loads the full GLB through GLTFLoader and compares 2,049 reverse-order poses after world translation and yaw against the helper, all within the same error budget. Type checking and all 659 existing tests pass. Regeneration is byte-identical.

This is verified attachment data, not a completed missile attachment change. Gameplay does not yet import this curve, so it adds no shipped bundle weight. Current rendering still uses the existing planar trajectory and generic height. The curve covers unblended `attack1` only; animation transitions, alternate attacks, exact native release timing, target-bone handling and height movement still require reconstruction before integration. Reproduce with `node tools/assets/export-lux-attack-origin.mjs` and `npx playwright test e2e/lux-attack-origin.spec.ts`.

## Attack pose after missed transition frames

The first gameplay comparison against the extracted hand curve exposed a renderer defect: an attack first drawn at its release tick had the correct animation time but zero effective weight. Entering the clip started a fresh mixer-clock fade even though the saved attack had already passed the existing 80 ms transition. This also affected an attack whose early transition was rendered before subsequent animation frames were skipped.

`GameView` now stops outgoing actions and clears the attack's fade once its interpolated saved age reaches 80 ms, setting full attack weight. The initial transition remains in place. This uses the existing reconstruction transition duration; it does not certify native blending or release timing, and the first 80 ms are still mixer-clock blended. No simulation or checkpoint schema changes are needed.

The regression failed before the fix with effective weight zero instead of one. Both late-render cases now match Lux's extracted `R_Hand` curve within 0.00001 model-local world units at actual projectile release. The early-frame case also verifies that the initial fade is preserved. All 659 tests, both release-pose browser cases, Ashe Q reset, Lux flight/checkpoint continuation, and nested-path production smoke pass. Reproduce with `npx playwright test e2e/attack-release-pose.spec.ts e2e/ashe-q-reset.spec.ts e2e/lux-attack-history.spec.ts`.

## Lux's second ordinary attack

The pinned character weights both ordinary attack slots at 0.5. Its `LuxBasicAttack2` spell explicitly selects `Attack2` and names `LuxBasicAttack` as its alternate. Both spells have identical missile movement, start bone, cast frame, cast time and particle-effect key. `tools/assets/export-lux-attack-variants.mjs` verifies the cached full character document against the original SHA-256 before preserving these records in `reference/lux-attack-variants.json`.

The renderer now chooses `attack1` or `attack2` from a stateless hash of saved unit ID and attack-cycle start tick. This implements the equal visual weights without consuming combat randomness or changing a choice on frame skips or reload. The hash is a reconstruction policy, not a claim about the native RNG or exact variant sequence. Critical attack selection remains separate unfinished work. Both source clips are already in the champion GLB; the asset loader now requires the second clip as well.

The origin exporter accepts `attack2` and reads the corresponding pinned spell. Its second hand curve has 1,758 points, 140,473 bytes and a maximum error of 0.0000049703 world units over 8,001 dense samples. Both curves are checked independently against the full browser-loaded skeleton at 2,049 poses each. Gameplay still does not import these diagnostic curves; missile attachment and native height semantics remain unresolved. Searching the movement field names did not establish a native height solver implementation, and no height rule was inferred from them.

Validation: 661 tests pass, including source slot/spell consistency and selection stability under reordered evaluation. Seven browser scenarios pass, including both hand curves, both missed-transition cases, Ashe Q reset, Lux projectile checkpoint continuation, and a repeated-attack scenario that observes both clips and saves during `attack2`. A full browser reload reproduces that clip, animation time and hand transform. Nested-path production smoke passes. The first 80 ms of transition blending and exact native attack timing remain unverified as described above.

## Continuous combat and pose inspection

`e2e/lux-continuous-attacks.spec.ts` runs 1,100 simulation ticks, renders every third update, interrupts attacks with movement and resumes combat. It observes both repeated and switched attack variants and compares more than 250 post-transition hand poses against the extracted source curves. All remain within 0.00001 model-local world units. This checks continuous combat in addition to the isolated release and checkpoint cases above; it does not establish native timing.

Open `/tools/qa/lux-attack-poses.html` on the development server for side-by-side source clips with a phase scrubber, play/pause and a current-release shortcut. Gold paths show the extracted hand trajectories; cyan markers show the live skeleton's right hand. The status shows cycle time, clip time and measured positional error. At the current level-one release, 14/90 of a cycle corresponds to 0.233 seconds of simulation time and approximately 0.151 seconds of clip time. These are the current adapter's values, explicitly labeled as such rather than native measurements.

The inspector browser test checks seeking both endpoints and intermediate poses, playback, pause, path visibility, the release shortcut and absence of page errors. Its 1440×900 capture was visually reviewed and the camera tightened for readable silhouettes and hand markers. The inspector module also passes a direct TypeScript check. Both new browser cases pass. This turn adds development inspection and regression coverage; production gameplay and assets are unchanged.

## Lux flight depth flags

The preserved basic-attack record distinguishes depth policy by emitter: `crescentwhite` and `Trail` omit `miscRenderFlags` and use its zero default; `hoop` explicitly stores `1` in field hash `6563bee8`. The pinned LeagueToolkit `enums.ts`/`blend.ts` reconstruction identifies mask `0x1` as disabling depth testing. Its revision and verified file hashes are retained in `docs/reference/lux-flight-depth.json`, together with the definition and binary hashes. This is an external interpretation of the source field, not a locally captured native draw-state trace.

`export-lux-flight-depth.py` exports these three settings to `src/content/lux-flight-depth.json`. All three gameplay material factories read their own emitter flag. This corrects the hoop factory's forced depth test while preserving the crescent and ribbon's source-derived depth testing. Depth writes remain disabled for all three; gameplay fog filtering remains independent.

A GPU browser check uses each real material factory on a controlled probe behind opaque geometry. The hoop remains visible; the crescent and ribbon are occluded. Reversing each material's depth setting reverses its pixel result, demonstrating that the test exercises depth behavior. The existing hoop playback and ribbon color/blending checks also pass. All 718 unit tests pass. Native draw ordering and complete material-state parity remain unverified.

```sh
python3 tools/assets/export-lux-flight-depth.py
npx playwright test e2e/lux-flight-depth.spec.ts e2e/lux-hoop-playback.spec.ts e2e/lux-trail-material.spec.ts
```

## Lux flight tails after victory

The flight adapters now use the same session-local terminal presentation age as impact particles and structure destruction. `luxAttackPresentation` supplies a common display tick and effect list to crescents, hoop motes and ribbons. Confirmed projectile contacts keep their saved stop tick. If victory occurs before projectile cleanup and the saved emitter is still active, presentation supplies a stop at the frozen world tick without mutating the effect. No particles are emitted after that stop; retained frames continue to determine existing particle placement.

At the existing source-derived conservative tail bound, the effect leaves the presentation list and each adapter disposes its owned geometry/material resources. Saved history remains intact, allowing deterministic reconstruction when seeking backward. The terminal age is not persisted; native victory sequencing and the behavior of other spell/environment effects remain separate work.

Browser checks cover both a real projectile killing the Nexus and a direct Nexus death while Lux's projectile remains in flight. Every layer changes during terminal playback, matches its sampler's particle/vertex count with an explicit victory stop, disappears and releases its cloud/ribbon, and reconstructs exactly after seeking backward. Repeated timestamps are stable and serialized match state remains unchanged after rendering and attempted simulation steps. Both existing terminal impact checks and continuous attack playback pass, alongside all 718 unit tests and the production subpath smoke test.

```sh
npx playwright test e2e/lux-flight-terminal.spec.ts e2e/lux-impact-terminal.spec.ts e2e/lux-continuous-attacks.spec.ts
```

## Final Spark after victory

Already-fired Lux R beams now advance with terminal presentation age and retire once every exported layer's delay plus lifetime has elapsed. The adapter then removes the group and disposes its geometry/materials, even though the simulation's beam record remains frozen. Seeking backward reconstructs the same presentation. Normal simulation sampling and saved fields are unchanged.

Nexus destruction already clears pending casts in the simulation. An unfinished Final Spark therefore removes its charge group immediately at victory and never creates fired layers. This cancellation remains intact; no presentation-only cast release is synthesized. The beam spell itself still cannot damage structures.

Two browser cases cast real Final Sparks and destroy the Nexus through a separate direct-damage event, once during charge and once after release. They verify a visible pre-victory effect, charge cancellation, fired-layer progression, exact repeated/reconstructed frames, resource retirement and unchanged serialized state. The normal Lux R charge/release/reload scenario and terminal interpolation regression also pass. All 718 unit tests pass. Native victory/cancellation visual sequencing remains uncalibrated.

```sh
npx playwright test e2e/lux-beam-terminal.spec.ts e2e/lux-r.spec.ts e2e/terminal-interpolation.spec.ts
```

## Final Spark framebuffer blending

The six pinned beam emitters use blend modes 1 and 4. `Beam_Core2`, `warning_beam_1` and `Beam_Core_FLASH` use mode 1; `Beam_Core1`, `warning_beam_2` and `Beam_Core_Glow` use mode 4. Their depth flags default to zero, agreeing with current depth testing. The [pinned LeagueToolkit blend reconstruction](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/blend.ts) specifies source-alpha / one-minus-source-alpha for mode 1 and source-alpha / one for mode 4, applied to both RGB and alpha. The cached file was rechecked against SHA-256 `d01381d75d574c7c31c8ac2f09d44a746a9aed6523db0af90fa507afe3dc72d9`.

Beam materials now set those factors explicitly with custom blending. Three.js normal blending previously used ONE as the source alpha-channel factor, accumulating alpha differently for the three mode-1 layers. RGB factors were already equivalent. This correction establishes the reconstructed RGBA equation; it does not demonstrate a visible RGB change on the current opaque output surface or certify native beam shader parity.

A GPU regression clones all six actual gameplay materials and renders a known half-alpha tint over a quarter-alpha background into RGBA8. Readbacks match the independent equations within quantization tolerance. The probe explicitly disables renderer clear-color premultiplication so its background matches the stated inputs. Normal charge/release/reload and both terminal beam cases pass, alongside 718 unit tests and the production subpath smoke test. Texture color space, UV/sampler conventions and complete native material behavior remain to be verified separately.

```sh
npx playwright test e2e/lux-beam-blending.spec.ts e2e/lux-r.spec.ts e2e/lux-beam-terminal.spec.ts
```

## Final Spark texture translation axes

The [pinned ribbon reconstruction](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/ribbon.ts) applies a beam's texture transform to `(along, across)` and then transposes both base and multiplier coordinates. The pinned raw file was retrieved and matched the cached SHA-256 `adafe0f1866a6e74628d2cfa29d25e93357e55f3a9c99b110358c9e3586c682e`. The accompanying reconstruction plan's section 2.34 supports this through beam texture/scroll observations; this remains external evidence rather than a local native Lux capture.

Our generated geometry already stores `(across, along)` UVs. Adding untransposed source offsets therefore put authored U scroll across the beam. The shader now transposes both base and multiplier translation vectors before adding them. This includes integrated base scroll, multiplier scroll and multiplier birth offset; clamp addressing still applies after translation. Exported source values remain unchanged.

A GPU test clones all six gameplay materials and supplies a four-color texture. For each base/multiplier layer it reads the unchanged corner, an along-axis translation and an across-axis translation: all 36 readbacks match the expected texels. Blending and normal Lux R gameplay/reload checks pass, as do all 718 unit tests. The updated fixture screenshot `artifacts/lux-r-match.png` was visually reviewed. The beam remains bright and its texture color handling still requires verification; this axis correction does not certify complete shader or native visual parity.

```sh
npx playwright test e2e/lux-beam-uv.spec.ts e2e/lux-beam-blending.spec.ts e2e/lux-r.spec.ts
```

## Final Spark raw texture color pipeline

The pinned external renderer explicitly defines particle textures as `NoColorSpace`, uploads them with `flipY=false`, uses linear minification, and writes the ribbon fragment without output encoding. Freshly retrieved source files and their hashes are recorded in `reference/lux-beam-color.json`: the [particle texture loader](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/useVfxTextures.ts), [viewport color constants](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/viewport/world.ts) and [ribbon fragment](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/shaders/ribbon.ts). This supports matching the raw-byte pipeline already used by the reconstructed basic-attack particles.

Final Spark now samples both textures without sRGB decoding, uses the top-row UV convention and linear filtering, and omits the shader's output color conversion. Unused mip generation is disabled under that minification policy. This avoids nonlinear texture/tint multiplication and restores the source texture orientation. Existing blending and transposed translations remain in place.

A GPU regression checks both loaded texture settings on every actual material, substitutes known non-primary mid-tone inputs, and reads the default sRGB output canvas. All six layer results equal the raw texture-times-multiplier-times-tint product within byte quantization. This explicitly exercises output encoding, unlike a linear offscreen target. UV, RGBA blending, gameplay/reload, all 718 unit tests and production smoke checks pass. The updated fixture screenshot was reviewed; its core remains saturated at the captured early release phase. Full brightness, geometry, native shader variant and sampler/mip parity remain uncalibrated.

```sh
npx playwright test e2e/lux-beam-color.spec.ts e2e/lux-beam-uv.spec.ts e2e/lux-beam-blending.spec.ts e2e/lux-r.spec.ts
```

## Final Spark camera-facing width

All six selected source beam records omit `mMode`, using the default camera-facing mode. Their source widths already agreed with the adapter's total-width interpretation. The pinned `ribbon.ts` reconstruction instead revealed an orientation mismatch: default beam width is perpendicular to the beam and the source-to-eye vector, whereas the adapter placed it in the ground plane. After reflecting source Z into render space, that width is `cross(target-source, eye-source)`.

`luxBeamWidth` independently computes this direction with a stable side for a collinear eye and a zero vector for coincident endpoints. The beam adapter uses the actual camera and offsets vertices across this three-dimensional width, retaining authored width curves, endpoint offsets, segmented ground placement and fog filtering. Arbitrary beam mode is not implemented by this helper; none of these six records selects it.

Two analytical tests check reflected handedness, full 3D orthogonality, unit width, nonmutation and degenerate inputs. A browser geometry check covers both warning layers and all four fired layers from cameras on opposite sides of the beam: all twelve samples preserve source width and remain perpendicular to the beam and view directions. Normal R playback/reload and terminal cleanup pass. The updated gameplay screenshot was reviewed; the low current centerline causes part of the camera-facing beam to intersect terrain. Native source/target attachment height, terrain treatment and full beam appearance remain unresolved rather than compensated with an invented height.

```sh
npx playwright test e2e/lux-beam-facing.spec.ts e2e/lux-r.spec.ts e2e/lux-beam-terminal.spec.ts
```
