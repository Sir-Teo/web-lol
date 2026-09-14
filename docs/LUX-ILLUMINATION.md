# Lux Illumination

## Evidence

`reference/lux-illumination.json` retains all three passive ability/spell records from the same hash-verified 16.18 response as Lux's champion stats. The standard-mode parent has `DebuffDuration = 6` and `APRatio = 0.35`; the Arena override is 0.5 and is not used. Its `ByCharLevelFormulaCalculationPart` contains a level-zero entry of 20, followed by 30 through 200 for levels 1–18. Indexing that array as a zero-based playable-level list would understate every level by ten. [Pinned character data](https://raw.communitydragon.org/16.18/game/data/characters/lux/lux.bin.json)

Riot describes damaging spells charging a target and Lux's next attack igniting that energy for bonus magic damage. Its 13.17 notes independently establish the 30–200 level endpoints, but their older AP ratio is not the current source value. [Champion description](https://www.leagueoflegends.com/en-gb/champions/lux/), [13.17 notes](https://www.leagueoflegends.com/en-gb/news/game-updates/patch-13-17-notes/)

## Implementation

A surviving enemy hit by Lux Q receives a mark with source ID and a six-second deadline. A subsequent Q refreshes that owner's deadline instead of stacking or detonating it. Allies and structures are excluded. The existing generic binding diagnostic can still use Ashe as its caster; that does not apply Illumination.

Lux's basic attack checks the mark at impact, removes it once and deals ordinary physical attack damage followed by separately mitigated magic passive damage if the victim survives. Passive damage samples Lux's level and AP at impact. An already committed attack can trigger after caster death. Another champion's attack cannot consume the mark. Multiple Lux actors have independent marks; this is an explicit local ownership policy pending native duplicate-champion comparison.

Expiry occurs before combat on the deadline tick. Target death clears every mark; caster death preserves marks on other targets. Marks neither grant sight nor change targeting eligibility. Health bars show `ILLUMINATED` once higher-priority protected/stun/root/slow statuses are absent, using the existing visibility boundary.

Snapshot 38 requires a mark list on every unit and validates distinct enemy Lux owners, living nonstructure victims and deadlines strictly after the current tick but no more than six seconds ahead. It supports saving during both the mark lifetime and a basic attack's flight.

## Validation and remaining work

All 533 source/simulation checks pass. Seven new cases cover level 1/18 mixed damage and repeat attacks, Q refresh, exact saved continuation, expiry on the impact tick, owner isolation/caster death/target respawn, and malformed snapshots. Three focused Chrome cases cover binding, the Lux rig/cast/recall and Q → mark readout → attack consumption. Production build and nested-path smoke pass.

At this simulation milestone, mark/trigger particles, passive attack animation selection and any special attack projectile behavior were unfinished. The later mark integration is described below; the separate trigger remains outstanding. The child spell's older-looking missile metadata is retained without replacing the independently pinned basic attack. Impact-time AP sampling, component ordering, duplicate-Lux ownership and native visual timing remain comparison targets. R now consumes and refreshes marks (`LUX-R.md`); E application, spell shields, cleanse and other unimplemented systems still need integration; this milestone does not complete Lux's kit. No full browser, full-match or performance rerun was performed.

## Native mark asset extraction

The complete base mark definition and original textures are now pinned in [lux-illumination-vfx.json](reference/lux-illumination-vfx.json). The Skin0 resource alias `Lux_P_debuff` points to `Characters/Lux/Skins/Skin0/Particles/Lux_Base_P_debuff`, inside `lux_multi_skins_skin0_skins_skin1_skins_skin2_skins_skin3_skins_skin4_skins_skin5.bin`. The selective extractor verifies the original six source files against the frozen release manifest, re-parses the binary and requires exact equality with the complete recorded definition. This is the persistent mark, not the separate `Lux_P_tar` trigger burst.

| Emitter | Authored behavior retained in the record |
|---|---|
| `luxdebuff1` | One six-second starburst; half-size 60; X rotation velocity −10 degrees/second; pass 1; full target binding; `color-eyefade` lookup. |
| `luxdebuff2` | Same lifetime/size/lookup; initial X rotation 20 degrees and velocity +10 degrees/second. |
| `rays` | `VfxPrimitiveRay`; rate 10, six-second emitter lifetime, particle lifetimes sampled from 0.5–1 second; random rotation/scale, alpha and size curves. |
| `smallball` | Rate 1, six-second emitter lifetime, 0.4-second particles; pass 3, blend mode 4, color curves and scrolling rainbow multiplier. |

The small glow's hashed filtering record resolves to `VfxEmitterFiltering.keywordsExcluded = ["SteelLegionLux"]`; it is an exclusion, not an instruction to render this layer only on that skin. The exporter verifies those field/type hashes directly. The ray type hash is also verified against `VfxPrimitiveRay`. Raw fields and all probability curves remain in the audit; the extract does not flatten them into guessed playback defaults.

Five texture payloads are exported with exact decoded RGBA verification, including alpha: 512×512 `starburst-spectral`, 64×64 `color-eyefade`, 256×256 `Lux_Base_P_RainbowRay`, 256×256 `Diana_Base_R_Glow`, and the existing 64×4 rainbow multiplier shared with Final Spark. Four new PNGs are checked in; the multiplier reuses `lux-r-4.png`. The starburst texture was visually inspected.

Reproduce and verify:

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/export-lux-illumination-vfx.py
```

At this extraction milestone, the complete source asset set was prepared but mark particles were not yet rendered in gameplay; see the later integration below. Native attachment origin/bone, lookup coordinates, default blend/sampler behavior, the ray primitive basis, emission cadence and refresh/restart policy require explicit treatment. Current simulation records only owner and expiry; reconstructing a particle age from expiry would restart it on refresh, which must be labeled and checked rather than silently treated as native behavior. The eventual renderer must respect visibility, expiry, target death and passive consumption without granting sight. Source/texture re-extraction and exact equality pass; runtime suites were not repeated for this asset-only addition.

## Ray geometry groundwork

`src/render/ray-quad.ts` now implements the `VfxPrimitiveRay` geometry used by the mark's `rays` layer. It follows the [pinned LeagueToolkit quad reconstruction](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/shaders/quad.ts): the particle's transformed +Z axis determines length, the camera determines the transverse direction, and the transformed source X axis handles a camera exactly on that axis. The reflected source frame determines the cross-product sign.

For this primitive, `size.x` is the **full width**, `size.y` the length, and `size.z` the near-edge axial displacement. Applying the ordinary camera-quad half-extent rule would double the ray width. Source UVs span width horizontally and run from V=1 at the near edge to V=0 at the far edge. The helper writes six vertices into caller-owned position/UV buffers without allocating replacement GPU buffers. Callers supply an orthonormal world-space source frame and converted dimensions; it does not guess the attachment bone or character transform.

Four numerical regressions cover dimensions/displacement/UVs, camera rotation, degenerate eye alignment, buffer boundaries and invalid input. A GPU regression projects the same ray from two orthogonal camera positions and verifies the exact expected 4×8-pixel coverage in a 12×12 framebuffer, with one geometry allocation throughout. TypeScript and all 755 unit tests pass. These checks validate the primitive independently of the later Illumination renderer; they are not a complete-mark native visual comparison.

The [pinned emitter reader](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/readVfxSystem.ts) reconstructs omitted color-lookup selectors as lifetime on X and constant on Y, with unit scales and zero offsets. The exported `color-eyefade` image has 64 identical rows, so its row selection does not change sampled pixels. Its alpha is 255 at the inspected lifetime samples; the ramp changes RGB brightness, not alpha. Native attachment/refresh behavior and complete effect composition remain open.

## Deterministic particle playback

The extraction command now generates `src/content/lux-illumination-vfx.ts`: all four emitters' birth distributions, lifetime color/scale curves, rotation rates, texture references, multiplier coordinates, source pass/blend flags and exclusion keywords. Birth sampling and lifetime curves remain separate, so a per-particle lifetime drives each ray's fades rather than the six-second emitter clock. Omitted probability-table values use the existing verified multiplier default of one; scale uniformity is applied after lifetime scaling.

`luxIlluminationParticles` reconstructs live particle state directly from a seed and effect age. It uses the existing Lux 60 Hz emission policy and indexed random stream; native PRNG/cadence parity is not asserted. Each particle's shared birth chance drives its authored distributions. Both starbursts rotate over their six-second particle lives; ray color/size follow sampled particle age; the small glow multiplies birth color by its color curve and scrolls the rainbow texture relative to its own birth. Lookup coordinates use normalized particle age on X and the reconstructed constant Y selector.

An optional stop time suppresses future births without deleting particles already emitted. It is deliberately separate from the gameplay buff's removal/refresh decision. This sampler can therefore be checked independently before the renderer chooses the correct buff teardown behavior. Passing the `SteelLegionLux` keyword excludes only `smallball`, preserving the other three source layers.

Five new regressions cover first emission and dimensions, exact starburst expiry/counter-rotation, per-particle ray curves and coupled birth distributions, stopping/seek order, and glow motion/color/filtering. TypeScript and all 760 unit tests pass. Binary/texture re-extraction still verifies exact source equality. This prepared playback data ahead of the renderer and gameplay integration below.

## Complete isolated mark renderer

`LuxIlluminationCloud` now draws all four layers from the shared sampler. Camera-facing starbursts use negative source-X roll and authored half-extents; rays use the explicit source frame and full-extents ray writer. The small glow uses its centered UV multiplier scale, randomized birth offset and particle-relative scroll. The shader multiplies raw source RGBA, the lifetime lookup, multiplier and particle tint. Additive layers premultiply particle RGB by particle alpha before One/One blending; the small glow uses source-alpha/One. Source passes and depth-disable flags remain per layer, and the reconstructed default alpha test is 5/255. These follow the pinned renderer reconstruction and do not certify native sampler/composition parity.

The cloud accepts an explicit world attachment position and reflected orthonormal source frame. It does not choose a bone, restart a buff, or inspect visibility on its caller's behalf. Textures are borrowed and shared; each emitter allocates a fixed-capacity geometry based on its maximum live population, then reuses those buffers. Disposing a cloud releases its geometry/materials without disposing the caller's textures.

With the development server running, open `/tools/qa/lux-illumination.html` to play, pause, scrub, or apply the Steel Legion keyword. The preview keeps a continuous playback clock separate from the slider's rounded value. This is a fixed attachment study, not gameplay integration.

TypeScript and 760 unit tests pass. Three GPU/browser checks verify every layer contributes pixels, exact framebuffer equality after seeking away and back, stable allocations over repeated playback, empty geometry after all particles expire, texture ownership on disposal, keyword filtering, and ray dimensions from two camera directions. The preview's Play/Pause controls also pass. The combined 0.22-second capture was visually reviewed. Gameplay integration follows below. Native attachment, refresh/restart policy, removal tails and comparison against native captures remain outstanding.


## Gameplay mark integration

`LuxIllumination` now attaches the four-layer cloud to visible marked units after their model and animation updates. Its shared textures load with the game's asset readiness barrier, using the configured base path. It derives the current effect age and deterministic seed from the owner, victim and saved deadline, so no snapshot schema change is needed. Each owner/victim pair has one cloud.

The adapter reuses the existing normal-hit `C_BuffBone_Glb_Center_Loc` lookup, including case-insensitive matching, and follows its current world position. **This is a provisional local mark anchor:** the authored normal attack impact bone does not prove the passive mark uses that bone. Procedural targets or missing bones use root position plus 0.9 world units vertically. Rays follow translation without inheriting target rotation, matching the record's `isLocalOrientation=false` flag.

The following buff lifecycle choices are explicit local policies pending native comparison. Refresh infers a new start tick as deadline minus six seconds and restarts the particle clock. Consumption, expiry and target death immediately remove the entire cloud, including existing particles; the standalone sampler's optional emission-stop tails are not used. Caster death preserves the target's mark. A frozen terminal match freezes this persistent buff's age with the simulation clock.

Rendering observes existing unit visibility and never grants sight. Hidden targets release their clouds; revealing a still-marked target reconstructs its saved age and seed rather than starting a new effect. Removal disposes each cloud's geometry and materials while preserving shared texture ownership.

Two focused gameplay browser checks cover a real queued Q and attack consumption, all four active layers on a rigged target, live bone movement, the procedural fallback, fog hide/reveal with exact geometry recovery, exact snapshot-based particle reconstruction, refresh without duplicate clouds, caster death, deadline removal, target death, and stable geometry/texture allocations across twelve apply/remove cycles. The gameplay capture was visually reviewed separately from the isolated emitter study. TypeScript, 760 unit tests, five focused browser checks (including the isolated renderer and ray primitive), and the production build/nested-path smoke pass. Native pixel parity is not asserted.

## Passive detonation source audit

The distinct `Lux_P_tar` resource now has its complete record pinned in [lux-illumination-trigger-vfx.json](reference/lux-illumination-trigger-vfx.json). This is the consumption burst, not the six-second persistent mark. The verifier resolves the resource through Lux's Skin0 map, extracts the original BIN and seven texture payloads from the frozen 16.18.8175716 manifest, and requires exact equality with the entire parsed record. All five emitters are active; none can be omitted on the basis of a disabled flag.

| Layer | Source requirements for playback |
|---|---|
| `innerring` | Rate 1, emitter lifetime 1 second, particle lifetime about 0.4 seconds; source offset `[0,50,0]`; random initial rotation, uniform scale growing from 0.6 to 1, four-point alpha curve, `Lux_Base_StarFilter_01`. |
| `outerring` | Rate 1, emitter lifetime 1 second, particle lifetime 0.5 seconds; source offset `[0,50,0]`; rainbow lookup scales `[0.5,1]` and offsets `[0.5,0]`; 2×3 atlas, six frames and authored start frame 4; scale curve 0.4 → 0.85 → 1. An additional hashed block remains unresolved. |
| `sparks` | **Single-particle emitter flag with rate 20:** the rate must be considered when reconstructing the burst population, not replaced by one particle. Random lifetime about 0.2–0.5 seconds, velocity and size distributions, drag 8, binding falling from 0.5 to 0, directional stretching and pass 105. Palette selector 9 of 10, driven by the source green channel. |
| `motes` | Rate 100 over about 0.2 seconds; random particle lifetime about 0.35–1.4 seconds; orbital velocity, rotated spawn direction, drag 5 and integrated world acceleration `[0,40,0]`. Blend 4, directional stretching, uniform size and lifetime color/scale curves. Palette selector 6 of 10, driven by the source red channel. |
| `rays` | Rate 60 over about 0.2 seconds; random particle lifetime about 0.125–0.25 seconds; full binding, source offset `[0,50,0]`, world orientation, `VfxPrimitiveRay`, random rotation/size and the authored ray growth curve. `color-rampdown` lookup and the shared passive rainbow-ray texture. |

The [pinned emission reconstruction](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/emit.ts) emits `max(trunc(rate) & 0xffff, 1)` on the first emission for a single-particle emitter. For this spark layer that is 20 particles, not one; native cadence/PRNG parity is still not asserted.

The source also names `Play_sfx_Lux_LuxIlluminationPassive_hit` as its creation sound. This pins the event name only; the event's audio payload and playback integration have not been verified here. Authored particle/emitter linger values are retained verbatim and must not be equated automatically with visible particle lifetime.

All seven decoded textures already exist in the shipped basic-impact and persistent-mark assets. The verifier checks their dimensions, exact RGBA bytes (including alpha), and checked-in PNG hashes; this addition introduces no duplicate images or runtime downloads. The palette texture is shared, but its selected row and source-channel mixer differ between sparks and motes. [Pinned palette reconstruction](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/palette.ts)

The outer ring's `{4ffce322}` block, containing `{95111b29}` and type `{b13097f0}`, remains intentionally hashed. Those hashes do **not** match `distortionDefinition`, `distortion`, or `VfxDistortionDefinitionData`; calling it distortion would be an unsupported interpretation. Likewise, the raw spawn-shape type and other unresolved fields remain in the complete record rather than being discarded during normalization.

Reproduce source and shared-asset verification:

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/verify-lux-illumination-trigger.py
```

The verifier passes for all eight original files, five complete emitters and seven shared textures. This is source groundwork; **the detonation burst is not yet rendered or played in gameplay**. Event capture at passive consumption, saved continuation, attachment history, burst population, orbital integration, palette composition, atlas/default behavior, unresolved fields, visibility and terminal cleanup still require implementation and appropriate visual/runtime verification. Runtime suites were not repeated for this source-only addition.

## Detonation playback profiles and birth timeline

`tools/assets/export-lux-illumination-trigger.py` runs the complete source/shared-image verifier before generating `src/content/lux-illumination-trigger-vfx.ts`. All five profiles keep birth distributions separate from lifetime curves. They retain emitter and particle lifetimes/linger, offsets and spawn rotation, velocity/orbital/drag inputs, integrated world acceleration, binding, lifetime size/color, orientation/stretching, texture/lookup/atlas/palette settings, and the unresolved outer-ring block. Identity probability tables on lifetime curves are checked before being simplified; a non-identity table fails generation rather than being silently dropped.

Omitted lookup types use the pinned reader's lifetime-X/constant-Y defaults (enum values 1/0). The outer ring explicitly overrides Y to lifetime. Omitted minimum directional stretch is one, so the motes must not shrink along the velocity axis merely because their speed falls. Palette and lookup remain separate operations. These defaults follow the [pinned reader](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/readVfxSystem.ts); unresolved native behavior is not certified by normalization.

`luxIlluminationTriggerBirths` reconstructs live birth records at an arbitrary effect age, using the established local 60 Hz cadence and indexed random stream. All twenty sparks share the first emission time but have distinct indexed birth draws. Motes and rays accumulate at their source rates and stop at their short emitter deadlines. An earlier explicit stop suppresses new births while keeping already-born particles until their individual lifetimes end. Repeated seeks do not retain mutable playback state or expose shared profile arrays.

The returned values remain **untransformed birth data**. Spawn orientation, orbital integration, world acceleration, target movement/binding, lifetime appearance, palette/atlas composition and drawing are subsequent stages. In particular, source velocity is not presented as a finished trajectory, and source scale is not prematurely made uniform before its lifetime curve is applied.

Regenerate:

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/export-lux-illumination-trigger.py
npx prettier --write src/content/lux-illumination-trigger-vfx.ts
```

Five new numerical checks cover the twenty-spark first update, coupled distribution endpoints and empty-table defaults, mote orbital/spawn inputs, continuous emission budgets, stop/lifetime boundary behavior, exact repeated seeking, mutation isolation and invalid inputs. Source re-extraction/texture verification, TypeScript and all 765 unit tests pass. No gameplay rendering change or browser visual-parity claim is made by this stage.

## Detonation lifetime appearance

`luxIlluminationTriggerAppearance` now samples appearance from a live birth record and its individual particle age. It multiplies birth size by the lifetime size curve before applying source uniform scaling, multiplies birth tint by lifetime color, and preserves birth rotation. Lookup coordinates use the authored selectors/scales/offsets. Palette parameters are separate: sparks select row center 0.95 with the green-channel mixer, while motes select 0.65 with the red-channel mixer. Returned tint remains unpremultiplied until the eventual shader/blend stage.

The outer ring remains on atlas frame 4 in the 2×3 grid. Its six-frame count does not animate it: the source frame rate is absent, and the pinned reader defaults that rate to zero. The [pinned UV reconstruction](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/uvTransform.ts) advances the cell by particle age times frame rate, then adds the start frame. Generation now explicitly requires the pinned set's zero frame rates, nonrandom atlas starts and constant palette selectors/mixers.

Four numerical cases cover ring growth/alpha and uniformity, both outer-ring lifetime lookup axes, static atlas-cell corners, distinct palette row/channel selection, source tint preservation, ray lifetime size changes, expired/invalid ages and mutation isolation. Complete source/shared-texture verification, TypeScript and all 769 unit tests pass. Regeneration leaves the generated profiles unchanged. Motion-dependent directional stretch, geometry, texture/palette composition and gameplay event integration are still pending; these tests do not claim rendered pixel parity.

## Static detonation motion

`luxIlluminationTriggerStaticMotion` adds identity-frame, stationary-origin motion in source units. Spawn rotation precedes 60 Hz stepped drag, with interpolation between steps. Orbital angles use radians and rotate position around the origin. The constant world-acceleration offset is added afterward as `acceleration × age × lifetime`. Directional stretch uses pre-orbit travel velocity. These follow the [pinned reconstruction](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/particleRead.ts).

Generation requires stepped-drag flags and constant world acceleration. Four numerical checks cover drag/interpolation, spawn rotation, orbit/acceleration ordering, lifetime dependence, stationary layers, expiry and repeatability. Source verification and all 773 tests pass; generated profiles remain unchanged. Native numerical parity, moving attachment/binding, scene conversion, geometry and gameplay integration remain unverified or unfinished.

## Five-layer detonation preview

`LuxIlluminationTriggerCloud` combines the birth, appearance and static motion samplers into five fixed-capacity GPU meshes. Rings use camera-facing quads and the outer ring's fixed atlas cell. Sparks and motes project their orbit-turned travel direction onto the camera plane and apply travel-based stretching; rays use the existing full-width ray primitive. Source positions and dimensions convert at 0.01 through the supplied reflected coordinate frame.

The material reuses the verified particle color-product shader, including RGB palette replacement before lookup/tint multiplication. It retains source pass/blend/depth flags, additive tint premultiplication, and the reconstructed 5/255 alpha cutoff. Geometry/materials belong to the cloud; texture payloads are borrowed and remain alive on disposal. The unresolved outer-ring block is still not interpreted, and native sampler/composition parity remains open.

With the development server running, `/tools/qa/lux-illumination-trigger.html` provides Play/Pause and a 0–1.7-second age scrubber. It is a stationary-origin study, not gameplay integration. The wider preview camera keeps the inspected 0.12-second burst within the frame.

TypeScript and all 773 unit tests pass. Two Chrome cases verify every layer contributes pixels, exact framebuffer equality after seeking, stable geometry/texture allocations, empty draws after expiry, geometry disposal/shared texture ownership, visible palette changes and restoration, and preview controls. The combined screenshot was visually inspected after widening the camera. Moving-target attachment, gameplay consumption events, sound, unresolved fields and native capture comparison remain outstanding; no production gameplay behavior changed in this preview milestone.

## Moving-origin detonation study

`luxIlluminationTriggerAttachment` now reconstructs per-particle translation from a caller-supplied origin history in source units. It starts at each particle's birth origin and accumulates endpoint displacement multiplied by the emitter-phase binding curve on the local 60 Hz grid. Fractional steps interpolate the same interval; callback-owned vectors remain untouched. The callback supplies historical endpoint samples and fractional current-origin samples, rather than only the target's latest position.

Rays inherit full movement, rings retain their birth origin, and sparks accumulate their fading share of target travel. Applying the final binding weight to the entire displacement would erase movement inherited earlier, so the helper preserves that history. Motes additionally orbit their retained birth origin around the system's current origin. The renderer combines binding travel with static travel before directional stretching and orbiting the directional basis.

The preview's **Moving origin** control supplies a synthetic horizontal path. This demonstrates translation/binding only; it does not establish a native attachment bone or implement consumption events. A GPU check measures the ray near-edge midpoint, because the ray's camera-facing width correctly changes as its origin moves. It independently verifies the ring's retained birth placement and exact restoration when motion is disabled.

Five numerical cases cover full/zero/fading binding, later births, fractional interpolation, moving orbit centers, callback ownership, repeatability and expiry. TypeScript, all 778 unit tests and three preview browser cases pass. Gameplay event capture, saved target pose history, bone selection, sound and native comparison remain outstanding.

## Saved detonation events

The simulation now records `luxIlluminationVisuals` when Lux's basic attack consumes a valid mark or Final Spark hits an already marked target. Capture happens before damage, so lethal base hits retain a detonation event even when no separate passive damage survives to apply. Q application/refresh and unmarked hits create none. This is an explicit local presentation policy; native lethal-hit visual ordering remains a comparison target.

Each event has its own entity ID, owner/victim, creation tick, creation-time audience and target pose history. It shares the existing impact-frame representation and endpoint capture path but has its own 103-tick retention window, covering the latest mote birth and longest lifetime with a margin. Attached histories follow the target's finalized tick pose. Death freezes the captured endpoint rather than following a later respawn. Creation-time visibility is retained across saves and later sight changes.

Snapshot version 63 requires this event list. The shared strict target-history schema validates continuous frames, owner/victim/rig consistency, detachment and lifetime bounds; detonation-specific checks reject critical/structure records, empty/duplicate audiences and ID collisions with other entities. Basic attack impact validation continues to require its matching projectile history. Existing saves follow the project's strict version/ruleset compatibility checks; no migration was added.

Five simulation cases cover one-shot capture, exact saved continuation, tail expiry, Final Spark consumption/refresh, lethal target detachment with animation history, fixed audience and malformed snapshots. TypeScript and all 783 unit tests pass. Three focused browser checks cover existing Lux attack-history save/load and mark lifecycle; the production build/nested-path smoke passes. Detonation rendering is still confined to the preview: connecting these saved events to gameplay, selecting/verifying the native bone and resolving sound/native parity remain outstanding.

## Gameplay detonation rendering

`LuxIlluminationTriggers` now renders the saved consumption events in the game. The adapter loads the seven source textures and white fallback through the normal readiness barrier and configured base path, creates each event's cloud and historical pose sampler, and supplies the cloud with source-space origin history reconstructed from saved endpoints. Birth geometry, motion, changing binding, palette/tint and source passes therefore use the same tested paths as the preview.

The current origin provisionally reuses the normal-impact center bone, with the existing procedural/missing-bone root-plus-0.9 fallback. Source emitter offsets (including +50 source Y) remain additional offsets. This is explicitly a local attachment convention, not evidence that the passive uses the normal attack bone. Native attachment/vertical placement still requires comparison.

A blue viewer must belong to the saved creation audience; later sight cannot instantiate an originally hidden event. Existing clouds also require current sight at their sampled origin. This is an origin-based visibility policy, not native per-pixel fog certification. Target death freezes attachment history while particles finish their lives. Terminal presentation time continues aging the cloud over frozen simulation history, then releases its geometry, materials and historical pose sampler. Texture ownership remains with the loader.

Two gameplay Chrome checks cover actual queued attack consumption on the Ashe rig, all five active layers, exact geometry after snapshot reconstruction, fog hide/reveal, target death, terminal cleanup without saved-state mutation, ordinary expiry, and a hidden-at-creation event remaining absent after gaining sight. The combined gameplay capture was visually inspected. Three preview cases and all 783 unit tests also pass. The production build/nested-path smoke passes for this integration. Native bone choice, unresolved outer-ring fields, audio and native pixel comparison remain outstanding.

## Source detonation audio

Lux's pinned Skin0 audio properties explicitly name the base SFX audio/event banks and `Play_sfx_Lux_LuxIlluminationPassive_hit`. The selective extractor now verifies both banks against the frozen release manifest. Their complete inventories and the selected event graph are retained in `reference/lux-audio-extraction.json`, `lux-audio-inventory.json` and `lux-illumination-audio.json`.

Event 2823890895 plays action 126980300, targeting container 1149. That container has −12 dB makeup gain and three source sounds. Its preserved policy includes random/shuffle mode, avoid-repeat count 2, playlist reset at each play, global selection state, no continuous playback, disabled transition mode, equal listed weights with weight use disabled, and maximum instances 2. Inherited mixer and attenuation nodes are retained separately from playback edges so unrelated sibling sounds are not included. Shared bus 1259461568 remains unresolved; the exported gain is not a complete native mix.

| Media ID | Mono 44.1 kHz frames | Duration | Float peak |
|---|---:|---:|---:|
| 295508404 | 63,393 | 1.437483 s | 1.140944 |
| 575879865 | 52,368 | 1.187483 s | 1.114036 |
| 1047162027 | 69,250 | 1.570295 s | 1.187495 |

Pinned wwiser maps the event, actions, playlist, sound/media edges and inherited parameters. Encoded WEM slices are independently checked against bank DIDX/DATA boundaries and parser inventory. Pinned vgmstream decodes the streams without loop expansion, fade, normalization or dithering; its linked decoder libraries are recorded as well as its revision. `reference/lux-illumination-audio-decoded.json` retains encoded/WAV/PCM hashes and numerical diagnostics. The three float32 WAVs preserve above-unit sample headroom and ship with `src/content/lux-illumination-audio.ts`, which keeps playlist order, source IDs, gain and container flags.

Reproduce:

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-lux-audio.py
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/map-lux-illumination-audio.py
.tools/cdtb-venv/bin/python tools/assets/decode-lux-illumination-audio.py
.tools/cdtb-venv/bin/python tools/assets/export-lux-illumination-audio.py
```

The complete extraction/mapping/decoding/export chain passes on repeat. A Chrome check verifies every exported asset hash and exact decoded PCM, frame count, channel count, rate, duration and retained headroom. These recordings are **not yet connected to runtime playback**. Listening comparison, variant policy reconstruction, scheduling, pause/save behavior, attenuation and native bus/mix parity remain outstanding. Existing gameplay audio was not replaced by this asset milestone.

## Detonation attenuation evaluator

The audio graph independently resolves Lux's inherited positioning through mixer 413871746 to attenuation 339248780 and unresolved bus 1259461568. The parent enables attenuation and overrides positioning; the selected child sounds/container inherit it. The source has one six-point curve, no enabled cone or height spread, and routes its first three attenuation slots to that curve. This curve happens to match Hawkshot's, but Lux's hierarchy is verified independently.

`tools/assets/export-lux-illumination-attenuation.py` exports the complete curve and checks bank version 145. It executes the pinned wwiser conversion graph to generate comparison samples around knots and throughout the range. `wwise145Attenuation` shares the previously tested interpolation/scaling implementation; the Hawkshot wrapper retains its source profile. `luxIlluminationAttenuation` evaluates Lux's profile and adds the separate −12 dB container makeup gain.

Including that gain, output is −12 dB through 1,750 source units, approximately −24 dB at 2,000 and −36 dB at 2,300. Stored −1 values at/beyond 2,750 use the pinned parser's −96.3 dB attenuation floor, yielding −108.3 dB including makeup gain. Stored curve values are not treated as literal dB, and no extra cutoff or normalization is introduced.

Reproduce with `.tools/cdtb-venv/bin/python tools/assets/export-lux-illumination-attenuation.py`. The generated profile and parser samples are retained in `reference/lux-illumination-attenuation.json`. Three added cases verify source linkage, independent distance samples plus makeup gain, and invalid inputs. TypeScript and all 786 tests pass, including the existing Hawkshot evaluator checks. This evaluator is not yet connected to playback; listener location/distance calibration, shared-bus mixing and native listening comparison remain outstanding.

## Runtime passive audio

Passive consumption now emits a transient `illumination` cue alongside the saved visual event. It captures visibility at the victim's position before damage; later sight does not expose hidden cues. The transient cue is not restored from snapshots, so loading an active visual burst does not replay its sound. The existing audio event cursor prevents duplicate starts and consumes intentionally muted/paused history.

`GameAudio` loads all three verified recordings through the configured base path and schedules a selected recording at its elapsed offset. Fully elapsed selections stay silent. Variant selection uses a cosmetic event hash and a global two-item exclusion history; this is a local reconstruction of the source policy, not native random/shuffle-state parity. Simulation RNG is unaffected. The source two-voice cap is interpreted for equal-priority passive cues as stopping the oldest voice. Completion, stealing and mute release their owned source/gain nodes; pause uses the existing serialized context lifecycle.

Distance uses the camera's ground focus as the local listener and the captured hit position as a fixed sound origin. The source attenuation and −12 dB makeup gain are multiplied by the existing 0.2 presentation mix. Camera movement updates gain with local 20 ms smoothing. These choices are explicit approximations pending native listener, moving-emitter and bus calibration; the source sound is integrated, but native audio parity and listening comparison are not claimed.

Two new unit cases cover repeat exclusion and non-replayed consumption cues, and the hidden-event history case also checks sound visibility after sight changes. Two new Chrome cases cover duplicate suppression, seek offsets, gain, variation, voice limiting, pause/mute handling, stale events, resumed events and natural completion. TypeScript and all 788 unit tests pass; all eleven audio browser cases pass, including existing Hawkshot regressions. The production build/nested-path smoke passes with all twelve source recordings loaded beneath `/nested/rift/`.
