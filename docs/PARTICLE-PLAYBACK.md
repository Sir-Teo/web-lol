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

The six pinned beam emitters use blend modes 1 and 4. `Beam_Core2`, `warning_beam_1` and `Beam_Core_FLASH` use mode 1; `Beam_Core1`, `warning_beam_2` and `Beam_Core_Glow` use mode 4. Correction: all six store decoded `miscRenderFlags = 1`. The earlier hash-only lookup incorrectly reported zero; the depth correction below supersedes that finding. The [pinned LeagueToolkit blend reconstruction](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/blend.ts) specifies source-alpha / one-minus-source-alpha for mode 1 and source-alpha / one for mode 4, applied to both RGB and alpha. The cached file was rechecked against SHA-256 `d01381d75d574c7c31c8ac2f09d44a746a9aed6523db0af90fa507afe3dc72d9`.

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

Two analytical tests check reflected handedness, full 3D orthogonality, unit width, nonmutation and degenerate inputs. A browser geometry check covers both warning layers and all four fired layers from cameras on opposite sides of the beam: all twelve samples preserve source width and remain perpendicular to the beam and view directions. Normal R playback/reload and terminal cleanup pass. The updated gameplay screenshot was reviewed; part of the camera-facing beam was occluded by terrain under the then-incorrect depth-test setting; the source depth correction below resolves that occlusion. Native source/target attachment height, terrain treatment and full beam appearance remain unresolved rather than compensated with an invented height.

```sh
npx playwright test e2e/lux-beam-facing.spec.ts e2e/lux-r.spec.ts e2e/lux-beam-terminal.spec.ts
```


## Final Spark decoded depth flag correction

Re-extraction of the pinned binary confirmed that every selected beam emitter stores `miscRenderFlags = 1` under the decoded field name. The earlier inspection checked only `{6563bee8}` and incorrectly treated this decoded field as absent. The exporter had dropped the field, leaving Three.js depth testing enabled. The relevant older audit statement above is corrected rather than retained as valid evidence.

The exporter now carries the decoded flag into all six runtime profiles, and materials derive depth testing from mask `0x1`, using the already pinned bit interpretation. The original six definitions were revalidated against the binary and all six textures were losslessly re-exported. No source attachment height was inferred from the unrelated child missile's `L_hand` / target-height fields: its mapping to this beam's anchors remains unverified.

A GPU regression checks the decoded flags directly in the source pin and tests every actual gameplay material behind an opaque wall. Authored settings produce the particle; explicitly enabling depth testing produces the wall. The updated gameplay screenshot was visually reviewed and the beam is no longer cut by terrain or props. Camera-facing geometry, normal charge/release/reload, all 720 unit tests and the production smoke test pass. Fog filtering remains independent. Full attachment dispatch/height, missing emitter layers and native pixel parity remain unfinished.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/export-lux-beam-layers.py
npx playwright test e2e/lux-beam-depth.spec.ts e2e/lux-r.spec.ts e2e/lux-beam-facing.spec.ts
```

## Complete effect audit and delayed dark flash

`export-lux-beam-layers.py` now preserves the entire decoded particle system in `reference/lux-beam-complete.json`, including the binary SHA-256 and a per-emitter coverage inventory. The source contains 45 emitters, six disabled; 17 are explicitly decoded beam primitives. Unknown primitive/field hashes remain visible in the record rather than silently assigned meanings. Seven beam emitters are now selected for runtime playback; the remaining active layers are still missing.

The newly selected `Beam_DARK_FLASH1` uses already exported textures and the supported beam/material path. Its source delay is `1.059999942779541` seconds from cast presentation start, lifetime `0.03999999910593033`, alpha blend mode 1, pass 15, no depth test, and dark-purple birth tint. Source width/scale and translation curves pass through the existing adapter unchanged. Thus a brief dark flash overlays the early core roughly 60 ms after release; no new texture download or guessed appearance constant is introduced.

The exporter revalidates all seven selected definitions against the binary. GPU checks now iterate the selected layer count, covering seven color products, seven depth/blend cases and 42 translation texels. A dedicated gameplay check verifies absence before the delayed interval, presence with the exact source tint and pass, stable repeated rendering, and expiry immediately after the interval. Its screenshot `artifacts/lux-r-dark-flash.png` was retaken after the loading overlay cleared and visually reviewed. Six distinct browser checks, all 720 unit tests and production smoke testing pass. This adds one missing source layer; native timing, attachment and the complete composition are not yet calibrated.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/export-lux-beam-layers.py
npx playwright test e2e/lux-beam-dark-flash.spec.ts e2e/lux-beam-depth.spec.ts e2e/lux-beam-color.spec.ts e2e/lux-beam-uv.spec.ts e2e/lux-beam-blending.spec.ts e2e/lux-r.spec.ts
```

## Longer-lived core glow

`Beam_Core_Glow1` is now selected from the complete source record, bringing implemented coverage to eight of the 39 active emitters. It reuses existing textures and carries the authored 0.6000000238-second lifetime, warm birth tint, fading alpha curve, widening scale and pass 7. The exporter revalidates all eight selected records against the pinned binary.

Beam retention previously ended at a fixed 0.3 seconds after release. `LUX_R.presentationSeconds` now derives from the maximum selected layer delay plus lifetime, relative to the cast interval. Simulation cleanup and snapshot validation already share this value, so both now retain the full selected effect. Saved fields remain unchanged; same-build compatibility still applies. This bound covers currently selected layers, not the still-missing longer post-beam layers.

The simulation regression checks retention at 18 and 36 ticks after release, removal on the next tick, and identical continuation from a save taken inside the tail. Gameplay checks confirm that only the new glow remains after the original layers end, that it survives reconstruction from a snapshot, and that all render resources eventually retire. The dedicated `artifacts/lux-r-glow-tail.png` capture was reviewed; the remaining glow is faint at that sampled phase. All eight material variants pass color, blend, depth and UV checks; the facing check covers fourteen warning/fired camera samples. Nine browser checks, 720 unit tests and production smoke testing pass.

## Warning glow and static beam atlas cells

`warning_beam_glow` is now selected, bringing coverage to nine active emitters. Its two additional textures were extracted from the pinned Lux archive; existing extracted file records were checked for identity before updating the provenance. The normal exporter then revalidated all nine selected definitions, nine original files and eight lossless texture exports. Its authored warm color/alpha progression, pass -1, width curve, negative scroll and depth flag are retained.

The source schema resolves `86a84509` as `texDiv` and `164b5733` as `texDivMult`. The exporter now preserves both fields, accepting decoded or hashed spelling. The pinned `uvTransform.ts` reconstruction rounds division counts and bounds them below at one. This yields one base cell for `[1, 0.5]` and a two-row multiplier for `[1, 2]`. Both have the default static frame zero. The shader wraps or clamps local coordinates before scaling them into that cell. Existing one-cell layers retain their UV domain. General frame animation, nonzero cell origins and exact native atlas-edge filtering remain unsupported.

The source schema also identifies `27d40903` on the still-missing `warning_beam_3` and `warning_beam_4` as `isGroundLayer`. These are not interchangeable with this camera-facing warning glow; their projection needs its own supported implementation.

The gameplay warning-glow test verifies visibility, pass, both cell sizes and evolving source alpha. Its charge screenshot `artifacts/lux-warning-glow.png` was visually reviewed. GPU translation checks now cover 54 samples across nine base/multiplier materials, including the first atlas row. Sixteen camera-facing geometry samples, all nine color/blend/depth material cases, normal R playback/reload, 720 unit tests and production smoke testing pass. Full effect coverage and native composition remain unfinished.

## Charge wisp birth UV variation

The first `CHARGE_BEAM_PRETTINESS` layer is now selected, bringing coverage to ten active emitters. Its wisp texture was extracted and pinned without changing existing extracted file identities, then the exporter revalidated ten selected definitions and nine lossless textures. Its source color/alpha, width, lifetime and integrated scroll curves use the existing beam path.

The exporter preserves its `birthUVOffset` distribution: a fixed birth vector with per-axis probability multipliers. The new sampler interpolates those tables, treats an empty authored table as zero and retains constant values when no tables exist. One birth chance is shared across axes. Each runtime profile carries its original full-system emitter index; the visual hash combines caster identity, original cast tick and that index, so adding another selected layer does not renumber existing random streams. Repeated draws and saves reproduce the same phase, and later casts vary. This hash is the project's deterministic reconstruction policy, not the native client random generator.

The birth translation is added before animated scroll and the existing beam-axis transpose. Unit checks cover distribution endpoints, an interior knot, empty axes, constant fallback and invalid chances. A gameplay test confirms the source offset range, integrated scroll contribution, exact repeated and saved reconstruction, and a different later-cast phase. The charge screenshot was visually reviewed. Ten material variants, sixty UV probes, eighteen camera-facing samples, normal R playback/reload, seven browser checks, 721 unit tests and production smoke testing pass. Remaining wispy and ground layers, native random sequence and full effect composition remain unfinished.

## Additional charge wisps and signed width

`CHARGE_BEAM_PRETTINESS1` and `CHARGE_BEAM_PRETTINESS2` are now selected, bringing coverage to twelve active emitters. Both reuse the pinned wisp and multiplier textures. Their distinct birth alpha, animated color, scale and scroll curves pass through the existing source-profile pipeline. Original full-system emitter indices preserve each layer's deterministic random stream.

The second layer authors a negative birth width of -160. The geometry already retained that sign, but the visibility condition incorrectly required positive width and would have discarded the layer. Visibility now rejects zero width while allowing either sign. This retains reversed vertex/UV orientation rather than replacing the authored width with its magnitude. Camera-facing tests now compare magnitude and handedness separately.

Twenty-two warning/fired camera samples check source width, orthogonality and the expected orientation sign. The wisp browser test now verifies all three charge layers are visible, the two added layers use distinct offsets, and every sampled offset/tint reproduces through repeated rendering and snapshot reconstruction. Twelve material variants and 72 UV samples pass the GPU checks. The updated charge screenshot was reviewed; seven browser checks, 721 unit tests and production smoke testing pass. Native random sequence, remaining ground and post-release layers, and full effect parity remain unfinished.

## Post-release wisps and alpha erosion

The three `Beam_Post_Prettiness` layers are now selected, bringing coverage to fifteen of 39 active emitters. Their source widths, colors, scale and scroll curves are retained. The additional `Lux_Base_Z_EinsteinMul_1.tex` erosion map was extracted from the pinned archive, checked against existing extraction provenance and exported losslessly. The normal exporter revalidated the selected records and textures.

All three source erosion definitions animate drive from zero to one and author both feather widths as 0.30000001192092896. The pinned external reconstruction supplies defaults for alpha-channel mixing, slice width 1.5 and mirrored sampling. The shader multiplies alpha by the difference between the upper and lower clamped feather ramps; RGB remains unchanged. Source URLs, fresh file hashes, field names and the equation are recorded in `reference/lux-beam-erosion.json`. This supports the selected source blocks; additional erosion fields fail export until interpreted explicitly. Native erosion shader execution and exact spatial sampling remain unverified.

The longest source lifetime extends the derived presentation retention to 1.2999999523162842 seconds after release. Simulation checks retain the record through tick 77, retire it at tick 78 and reproduce continuation from saves. Gameplay checks reproduce all three wisps at 0.75 seconds, retain only the longest at 1.1 seconds and retire resources by 1.3 seconds. The late screenshot `artifacts/lux-post-wisps.png` was reviewed; it shows a faint patterned tail, without establishing native visual parity.

Forty-five GPU probes verify the erosion alpha equation over three materials, five drive values and three sampled alpha values. The selected materials also pass existing blend, raw-color, depth and UV checks; camera-facing checks cover 28 samples. Ten browser checks, 721 unit tests and production smoke testing pass, including terminal beam playback. Twenty-four active emitters, ground projection, native attachment height, random sequence and full composition comparison remain unfinished.

## Erosion spatial sampling regression

The erosion GPU check now also uses a four-quadrant alpha mask across 42 samples: all three post-release materials, both scroll axes and seven translations spanning negative and positive texture tiles. Expected texels are calculated from tile parity independently of the shader modulo expression. This verifies mirrored addressing and the beam-axis transpose, beyond the earlier uniform-mask alpha checks. Temporarily substituting ordinary wrapping fails the spatial assertion; the source shader was restored afterward. Both focused browser tests pass and the late-wisp screenshot was reviewed again. These diagnostic texels use nearest filtering; exact native edge filtering and full native composition still need comparison evidence.

## Native erosion shader inspection and ground-warning audit

The shader exporter now selects six additional Metal programs: quad and mesh alpha erosion, each with default, disabled-fog and multiplier variants. Extension verifies all existing pinned files and selections. All 2,576 variant hashes are checked; 24 selected programs are now pinned and disassembled offline. No native program is executed or shipped.

Inspection traces the erosion sampler through a saturated RGBA mixer dot product, band subtraction, two feather-rate multiplications, clamping and multiplication into the existing alpha. Quad drive arrives through interpolated TEXCOORD3; mesh drive is uniform parameter X. Parameter Y supplies band width and Z/W the feather rates. This independently supports the implemented arithmetic, including the multiplier case. It does not prove which program Lux binds, native default uniform values or sampler states. Program and disassembly hashes are recorded in `reference/lux-beam-erosion.json`.

The two missing ground warning beams were also audited. The reference viewer explicitly describes its vertical projection as a chosen approximation. The four inspected particle shader tables expose no ground define, and a string search of the cached shader registry did not identify the native technique. This is limited negative evidence, not proof that the native pass is absent. `reference/lux-ground-warning-audit.json` records the source flags, inspection scope and evidence needed before selecting a projection and composition path. Both layers remain missing.

## Final Spark moving flash and burst counts

`WOOSH` is now selected, bringing coverage to sixteen of 39 active emitters. It is an arbitrary quad, distinct from the beam geometry. The pinned source specifies a 90-degree X rotation, half-extents 350 by 800, offset 2,800 along the cast and velocity -20,000 units per second. Its two particles last 0.1299999952 seconds, use the extracted Diana glow texture, warm constant tint, pass 60 and disabled depth testing. The quad is placed in the cast frame with the source UV transpose and signs. It shares the existing approximate attachment height; native height and complete composition remain unverified. The exporter intentionally restricts arbitrary-quad support to this record and orientation.

Source `isSingleParticle` denotes a single emission event whose initial count uses the authored integer rate. This restores two particles for WOOSH, Beam_Core_FLASH and Beam_DARK_FLASH1. These particles have identical deterministic geometry, so their triangles repeat inside one draw call, preserving separate blend contributions. This is not a general implementation for independently randomized burst particles. Missing multiplier textures use an explicit raw white texel with matching texture settings.

The exporter revalidates sixteen selected records, twelve original files and eleven lossless texture exports. The moving-flash browser test checks positions at two ages, half-extents, UV orientation, tint, pass, duplicate burst geometry, beam-flash vertex count, repeated/saved reconstruction and retirement. The gameplay capture `artifacts/lux-r-woosh.png` was reviewed; the core remains strongly saturated, so the capture alone does not isolate the moving flash. Ten browser checks, 721 unit tests and the final production smoke pass. Source interpretation and limitations are recorded in `reference/lux-r-quad-playback.json`.

## Rainbow glow and quad UV transforms

`RainbowGlow` is selected, bringing coverage to seventeen of 39 active emitters. It reuses the pinned rainbow and Diana glow textures. The two arbitrary quads span source half-extents 300 by 1,600, center 1,500 units along the cast and fade from alpha 0.6200045943 over 0.3000000119 seconds. They share the existing approximate cast attachment height.

The exporter resolves `eddebb48` as `uvScale` and `cd124686` as `uvScaleMult`, retaining constant scales and rejecting animated scale until supported. Runtime scaling acts about the default UV center [0.5, 0.5]. Quad scale and scroll operate directly on their already-oriented UV coordinates; beam transforms retain their axis transpose. This restores the rainbow layer's U scale 0.4 and U scroll 2. Missing velocity defaults to zero for this static quad.

Eight GPU probes check the sampled texels before and after scrolling against a diagnostic eight-column texture. Gameplay checks verify the fading alpha, two-particle geometry, exact repeated/saved reconstruction and lifetime retirement. Both combined and isolated captures were generated; the isolated `artifacts/lux-r-rainbow-isolated.png` was reviewed and shows a soft green glow at the sampled phase. Isolation is a test-only color-write override, restored immediately afterward. Ten browser checks, 721 unit tests and production smoke testing pass. Native attachment height, ground layers and full composition parity remain unfinished.

## Source erosion channel mixers

The renderer now uses the source RGBA erosion mixer instead of assuming alpha-only sampling. It clamps the texture/mixer dot product before applying the already verified feather equation, matching the native shader arithmetic. Existing wisp profiles retain [0,0,0,1]; the exporter also accepts the decoded or hashed `erosionMapChannelMixer` field.

Sixty-three additional GPU cases exercise each channel, a weighted mix and values that clamp below zero or above one across the three existing erosion materials. Existing arithmetic and spatial probes remain active. Three focused browser checks, 721 unit tests and production smoke testing pass. This is a prerequisite for `Streaks_Linger`, whose source uses the red channel. That emitter remains unimplemented: its 45 particles need independent lifetime, spawn, velocity, drag, scale and UV-offset playback. The exact remaining source requirements are recorded in `reference/lux-streaks-audit.json`; coverage stays at seventeen active emitters.

## Lingering streak birth and motion sampler

`tools/assets/export-lux-r-streaks.py` first runs the existing pinned-binary verification, then exports the full streak birth distributions and motion curves to `src/content/lux-r-streaks.json`. It checks the source system flags (198) do not select analytic drag (0x100). The source's 45-particle burst has correlated lifetime, velocity, offset, size and multiplier-offset tables.

`luxRStreakParticles` now samples all 45 particles independently with the existing indexed visual hash. It evaluates each particle's own lifetime and normalized color/scale curves, adds emitter translation and spawn offsets, integrates damped velocity on the 60 Hz reconstruction grid, and interpolates fractional frames. It retains the late alpha dip and recovery rather than replacing it with a smooth fade. There is no accumulated renderer state, so explicit seed and age reproduce the same result.

Three tests cover source distribution endpoints and the velocity knot, independent iterative drag comparison, fractional positions, distinct lifetimes, flicker, retirement and repeatability. All 724 unit tests and TypeScript checks pass. This sampler is not yet attached to gameplay; texture extraction, cast-frame geometry, materials and browser verification remain. Native PRNG, native update frequency and attachment parity remain unverified.

## Lingering streak gameplay adapter

The 45 `Streaks_Linger` particles now render in gameplay, bringing total coverage to eighteen of 39 active emitters. The existing seventeen layer profiles remain separate from this independently varied burst. The pin records the additional implemented emitter explicitly, and the complete source audit includes it. Two additional textures were extracted from the same pinned archive with existing file/chunk identities preserved; the exporter verifies fourteen original files and thirteen lossless texture exports.

`LuxRStreaks` draws one buffer containing each particle's own geometry, color and multiplier UV offset. The pinned basis implementation composes Ry Rx Rz; [90,90,0] places local X along source -Z and local Y along +X. The adapter carries those axes through the cast frame and the existing source-coordinate reflection. It applies the authored multiplier scale, direct quad UV transform, additive source-alpha blending, pass 9 and disabled depth testing. Source red-channel erosion uses drive zero and the documented external default feather/slice values. The current source values keep the erosion band open; the GPU diagnostic also exercises a nonzero drive.

The burst reconstructs from saved cast identity and age without adding save fields. Individual particles disappear at their sampled lifetime; all GPU geometry and material resources retire after the last one. Enemy particles use center visibility, and a fully hidden burst releases its render object. Victory advances the existing presentation clock, while canceled charge casts create no streak burst.

Gameplay tests verify all 270 vertices, a diagonal cast's basis, independently varying attributes, repeated/saved reconstruction, partial and full visibility filtering, distinct lifetimes and resource retirement. Both charging and fired terminal cases reproduce after seeking back and leave simulation saves unchanged. The GPU material check verifies raw texture settings, texture/tint products and red-channel erosion. Six distinct browser checks, 724 unit tests and production smoke testing pass. `artifacts/lux-r-streaks.png` was visually reviewed and shows colored streaks along the fading cast. Native attachment height, PRNG/update cadence and complete visual parity remain unverified.

## Centered texture rotation

The layer exporter now preserves constant `uvRotation` and `uvRotationMult` in degrees, rejecting animated rotation until it has playback support. The shader scales about [0.5, 0.5], rotates, then translates. Quad coordinates use the authored angle directly; transposed beam coordinates reverse its sign. Existing profiles author zero rotation and retain their prior output.

A GPU regression covers 102 samples across seventeen materials, both texture slots and three signed angles. It checks rotation after nonuniform scale and before nonzero translation, including the existing atlas divisions. Four focused browser checks, 724 unit tests and production smoke testing pass. The rainbow isolation capture now also suppresses the separate streak renderer during its diagnostic frame and restores all color-write flags afterward.

This enables a prerequisite for the missing END_Beam_1 and END_Beam_Core charge glows, which author a 90-degree base UV rotation. They also require uniform-scale interpretation and independent multiplier birth/scroll values; they are not yet selected. The source requirements are recorded in `reference/lux-charge-glow-audit.json`. Coverage remains eighteen of 39 active emitters.

## Origin charge glows

`END_Beam_1` and `END_Beam_Core` are now selected, bringing coverage to twenty of 39 active emitters (nineteen shared layer profiles plus the separate streak burst). Each emits three quads, at source offset -120 along the cast, with a 0.9499999881-second lifetime, warm ramping color and pass 500. Both reuse existing pinned textures; nineteen layer records, fourteen original files and thirteen lossless texture exports are verified.

The pinned `particleRead.ts` reconstruction multiplies birth dimensions by animated scale before `isUniformScale` broadcasts the resulting X dimension. The adapter preserves that order, yielding square quads rather than retaining the authored Y birth dimension of 300. The source multiplier offsets vary independently per particle, with each particle sharing one chance across its two axes. New per-vertex attributes carry those fixed birth phases through the shader, while a shared uniform carries the integrated scroll. The texture rotates by the authored 90 degrees. Existing deterministic quad bursts retain identical geometry, and diagnostics without the custom attribute use an explicit zero fallback.

The focused gameplay check verifies all three particles per layer, square dimensions at source age, distinct bounded texture phases, exact repeated/saved reconstruction, fixed birth phases under later scrolling and retirement before release. The reviewed `artifacts/lux-charge-glows.png` capture shows a compact colored light at the beam origin. Eleven browser checks cover geometry, material color/blending/depth, rotation/UV transforms, terminal playback and existing R/WOOSH behavior. All 724 unit tests and production smoke testing pass. Native attachment height, exact random sequence and complete visual parity remain unverified.

## Rotating charge-particle sampler

The verified source profile for `END_Beam_ROTATING` now exports ten particles with independent correlated birth angles, sizes and multiplier offsets. The pinned `particleRead.ts` reads the first Euler component for a complex camera quad's spin; `Quads.tsx` sends its negative radians to the view. This differs from the arbitrary-quad basis used by the completed charge glows.

`luxChargeRayParticles` retains the source 150-degree/second birth angular velocity and accumulates the animated rotation rate with its separate factor of 60. Rate accumulation uses right-endpoint samples on the local 60 Hz reconstruction grid, with fractional next-step interpolation. The same policy advances the multiplier scroll. Color includes the authored birth alpha and each size axis follows its own source curve.

Three tests cover correlated endpoints, distinct deterministic particles, analytical first-segment angular/UV accumulation, terminal angular rate, anisotropic growth, fade and retirement. All 727 unit tests and TypeScript checks pass. This is the sampler only: camera-facing geometry, material composition and gameplay verification remain. `reference/lux-charge-rays-audit.json` records the source files and remaining adapter requirements; coverage stays at twenty active emitters.
