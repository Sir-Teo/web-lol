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
