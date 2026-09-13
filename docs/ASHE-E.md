# Hawkshot ammunition and scouting

Hawkshot now stores two charges. A successful cast consumes one and starts a five-second cast cooldown. Rank-one recharge restores one charge every 90 seconds, serially, until both are available. Spending the second charge preserves the active recharge deadline. The previous prototype used one 45-second cooldown.

## Source and interpretation

`docs/reference/ashe-e.json` pins the complete standard spell selected by slot 2 of Ashe's character spellbook, together with the current Hawkshot tooltip and whole-file SHA-256 hashes. `tools/assets/export-ashe-e.py` verifies the selection, complete record, tooltip and hashes before generating `src/content/ashe-e.ts`.

- `mMaxAmmo` is uniformly 2.
- Both `cooldownTime` and `Cooldown.values` are uniformly 5 seconds.
- `mAmmoRechargeTime` and `BaseCooldown` agree at normal ranks 1–5: 90/80/70/60/50 seconds. Their unused rank-six values differ and are deliberately excluded.
- The current tooltip explicitly describes two charges and a recharge interval. Its separate Jade/Classic counterpart is not selected.

Sources: [16.18 Ashe record](https://raw.communitydragon.org/16.18/game/data/characters/ashe/ashe.bin.json), [16.18 English strings](https://raw.communitydragon.org/16.18/game/en_us/data/menu/en_us/lol.stringtable.json).

The current all-abilities-unlocked practice mode starts with both charges; first learning, skill ranks and ability haste remain unimplemented. Serial recharge, starting the timer at accepted cast, continuing it through death, and resolving recharge before commands on the exact deadline tick are explicit runtime policies pending controlled reference comparison. Static fields establish capacity and durations, not all server event ordering.

## State and presentation

Player state stores `eCharges` and nullable `eRechargeTick`. At full capacity the timer is null; below capacity it is a finite integer deadline. Snapshot version 15 rejects missing, fractional, out-of-range or inconsistent ammunition state. Save/restore retains recharge progress. Respawn does not refill charges. Practice's reset-cooldowns action restores both charges and clears the recharge timer.

The E icon shows its charge count and a thin progress bar toward the next charge. With ammunition available, its main countdown shows only the five-second cast delay; with none, it shows the longer wait for cast eligibility. A shared simulation query computes that wait for cast validation and the HUD. The accessible label also reports charges and time until replenishment. The bar/count layout is authored UI, not a claim of reference pixel parity.

Five simulation cases cover serial recharge/cap, exact cast and replenishment boundaries, rejected casts, recall preservation, death/respawn, save continuation and invalid ammunition snapshots. A Chrome case uses actual keyboard casts and verifies the charge badge, countdown, accessible label, recharge visibility and practice reset.

## Traveling scout and destination vision

Hawkshot now launches a non-damaging projectile toward the selected point, clamped to 25000 units from the cast position. It travels at 1400 units/second, ignores unit and terrain collision, and grants its team unobstructed moving sight. It stops exactly at its destination instead of continuing for the entire maximum range. A zero-length cast creates its destination reveal immediately. Arrival removes the flight model and creates a separate five-second scouting area. Multiple flights and destination areas coexist; caster movement, death or respawn do not relocate or cancel them.

The verified exporter now checks `FixedSpeedMovement`, agreement between component speed and `missileSpeed`, disabled target tracking, `mProjectTargetToCastRange`, matching uniform range arrays, and `VisionDuration`. These establish the 1400 speed, 25000 range and five-second lifetime. The first flight interval now occurs on the release tick, after the 15-tick windup. Exact native release-frame and arrival timing remain reference-calibration work.

Both moving and destination sight currently retain the earlier **provisional 650 radius** and unobstructed terrain/brush policy. No lingering path trail is implemented. The source exposes `luaOnMissileUpdateDistanceInterval` of 100, but it does not by itself establish the radius or lifetime of trail reveals. Do not interpret the spell's `castRadius` or particle dimensions as verified vision geometry.

Scouting areas share the existing timed vision-area collection, now with explicit `scout`/`attack` kinds. Queries that exclude attack-reveal feedback still include scouting, so an attacker already seen by Hawkshot does not create a spurious hidden-attack reveal. Snapshot version 15 stores the new projectile type and requires the area kind. Saved flights preserve direction, position, speed and remaining range; saved areas preserve their own lifetime. The legacy `world.reveal` slot remains for existing diagnostic fixtures; Hawkshot no longer writes it.

The renderer now uses the original Owl1 body and Owl2 Fresnel rim, with source mesh, skeleton, textures and flight animation. Each scout has a private skeleton and animation mixer; geometry, material and texture are shared. Phase derives from its saved `launchTick`, so concurrent casts animate independently, pause freezes the pose, and restoration recreates the same phase. Removing a scout releases its private skeleton GPU texture without disposing shared assets. Snapshot version 19 requires a nonnegative integer launch tick for every Hawkshot. These are the source body and rim layers, **not the complete original effect or a visual-fidelity certification**.

Four simulation cases cover fixed speed, collision exclusion, exact arrival/expiry, range clamping, self-targeting, team ownership, scouting versus attack-reveal queries, two concurrent flights, caster death and saved flight/endpoint continuation. Browser coverage checks visible flight, stationary paused pose, delayed distant-unit visibility, removal of the flight model, destination visibility and expiry; charge/reset coverage remains active.

## Remaining Hawkshot fidelity work

Verify and implement sight radius, lingering path vision, native cancellation/movement and input-buffering rules, source release-frame alignment, independent rank allocation/haste, complete layered particles and audio. The current moving bubble can reveal the destination during approach before the projectile arrives; the separate five-second destination lifetime begins only at arrival. Complete spell parity remains unverified.


Minimap aiming/release is now supported through the source `mUseMinimapTargeting` flag. See [input behavior and validation](MOVEMENT.md#minimap-spell-targeting).


## Original effect asset recovery

The base skin resolves `Ashe_E_mis`, `Ashe_E_tar_explode` and `Ashe_E_tar_linger` to three `VfxSystemDefinitionData` records. Their linked binary definitions were absent at the expected public JSON URLs, so they were recovered directly from `DATA/FINAL/Champions/Ashe.wad.client` in the existing pinned patch manifest. `docs/reference/hawkshot-effects.json` records the source skin JSON/hash, all three decoded records, binary paths, archive/chunk provenance and SHA-256 hashes for every selected file.

The missile has eight emitters. Three use the same **animated mesh**: `Ashe_Skin06_E_Hawk.skn`, its skeleton, and `Ashe_Skin06_E_Dove.anm`, under the base skin's particle directory. The names do not imply a different skin should be selected: the base effect explicitly references them. `Owl1` supplies the owl texture and tint, `Owl2` adds a reflection/Fresnel layer, and `Owl3` emits short-lived bound mesh copies with downward velocity. The other emitters provide two background glows, a wind mesh, dust and smoke. Arrival has five emitters; lingering vision has four.

This evidence rules out reproducing the complete effect as a flat bird sprite or two procedural wings. Conversion must retain the rig and animation, then reconstruct layered materials, transforms, blend order, trails and arrival/linger effects. The mesh emitters mark uniform scaling and carry both a rotation and three-component birth scale; do not treat all three scale components as independent axes without resolving that flag. Visual particle lifetimes and dimensions are not proof of gameplay vision duration or radius.

Rebuild and verify the sources with:

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-hawkshot-effects.py
```

The verified CDTB checkout was `ba981db2a2c814a0d78e55f6483e0636b527850f`. The extractor derives minimal name tables from the pinned records, re-decodes the raw binaries, checks the exact skin/resource mappings and linked records, and rejects missing asset dependencies. It needs no mutable global hash dictionary. Archive reads verify compressed chunks and final file hashes. The archive reader now accepts an explicit archive name and isolates its header cache; its default Map11 path remains supported.

The selected 21 files total **907,219 bytes** (17 asset dependencies and four binary definitions). They require **468,831 compressed patch bytes**, rather than downloading the entire 148,431,276-byte champion archive. The hawk mesh is 28,768 bytes, skeleton 664 bytes and animation 6,060 bytes. All selected files were re-extracted and verified; the default archive-reader regression also revalidated all 40 existing base-structure source files. The source-recovery milestone itself changed no runtime visuals. The subsequent body conversion below replaces the procedural bird.


## Source body conversion

Run `node tools/assets/convert-hawkshot.mjs` after extraction. It verifies all 21 source hashes and exports `public/assets/models/hawkshot.glb` plus a provenance manifest: **80,440 bytes, 1,284 rendered triangles across two layers (642 shared source triangles), five bones and a 1.333333-second flight clip**. Conversion bakes the source uniform scale (1.6) and centimeters-to-render-units factor into geometry, joint translations, inverse binds and animation translation tracks. Runtime applies the source 90-degree X rotation. Exact transform alignment still needs reference capture.

The body uses the source owl texture and RGBA tint with an unlit, double-sided material and disabled depth writes. Mode 4 now uses alpha-weighted additive blending, based on the explicit factor table discussed below. The GLB carries the source mode in material extras; its portable alpha-BLEND fallback cannot express this additive state by itself. The Owl2 Fresnel rim is now present. Owl3 mesh particles and both background glows are now present. Smoke, arrival and lingering vision effects remain absent. WindTunnel playback is now integrated as described below. The body is more visible with additive blending but can still be occluded by scenery; screenshot inspection does not establish reference legibility or pixel parity.

Browser checks cover separate skeletons and per-cast phases, shared GPU resources, frozen pause state, exact restored pose, resumed motion and private-resource disposal. A simulation case rejects missing, null, negative, fractional and nonnumeric launch ticks.


## Blend-state evidence

`docs/reference/hawkshot-blending.json` pins DAKA's [Bin & Particle Dictionary](https://github.com/DivineSkins/divine-wiki/blob/86d9eb9ad46595f1e533eb50183b08e5aad8b190/content/docs/en/lol/vfx-bins/bin-dictionary.mdx#blendmode-values), including its full-file hash and selected mode. Its explicit table maps mode 4 to source-alpha / one with addition and no depth writing. The renderer adopts that table: RGB output equals destination RGB plus source alpha times source RGB. It replaces the earlier normal-alpha approximation, which attenuated the background. Black source RGB contributes nothing under the corrected state.

This resolves the implementation choice, not independent reference verification. The dictionary describes engine behavior and identifies patch 16.16 for its layout checks; our emitter is pinned to 16.18. No direct 16.18 output-merger capture has been obtained. An older guide on the same wiki labels modes 3/4 standard transparency and conflicts with the explicit table. ReyEngine's [texture census](https://github.com/TheKillerey/ReyEngine/blob/cdf014d0b584f65b579211b522c5ed1dfe5687a5/docs/research/q1-blendmodes.md) expressly cannot establish pipeline blend state, so its visual classifications are not used as proof.

A Chrome GPU readback test uses the loaded body's blend state with controlled color and opacity over two backgrounds. It verifies the additive equation within one byte and checks that black leaves the background intact. Existing animation, shared-resource, charge and travel checks remain passing. Neither the numerical test nor the flight screenshot proves complete effect parity.


## Owl2 Fresnel rim

The second source emitter reuses the body mesh, rig, animation and transform. Its black birth color supplies no diffuse light; the source `common_color-hold` texture remains included. The rim uses exponent 0.05 and RGB approximately (0.5490, 0.8275, 1). The fourth `fresnelColor` component is zero but is **not opacity**.

The adopted formula comes from [ReyEngine's published shader transcription](https://github.com/TheKillerey/ReyEngine/blob/cdf014d0b584f65b579211b522c5ed1dfe5687a5/src/ReyEngine.Rendering/Vfx/VfxParticleRenderer.cs), pinned by file hash in `docs/reference/hawkshot-fresnel.json`. The vertex stage computes `1 - pow(clamp(dot(surfaceToCamera, normal), 0, 1), exponent)` times rim RGB. Fragment processing adds the interpolated rim times particle alpha before the source-alpha blend. Thus alpha also weights the rim at the blend stage. This is attributed shader evidence; we have not independently decoded the original bytecode or verified reference pixels. No cubemap reflection is inferred from the emitter's reflection-definition name.

The custom unlit shader uses the skinned, transformed normal and view-space position. Optimization explicitly preserves source normals, which ordinary unlit pruning would remove. Both layers disable back-face culling in a single pass. Three's usual two-pass transparent rendering flips back-face normals and conflicts with this source equation, as the GPU test exposed.

The GLB contains two primitives sharing source attributes, two materials and five bones. Both layers remain synchronized to the same flight clip. GPU checks cover camera-facing and opposite views, object rotation, and half-alpha fading; asset/pose checks require source normals and matching layer bone poses. A graphics-loss case compares every restored framebuffer byte while a layered hawk is in flight. Remaining effect layers, transform calibration and complete spell fidelity are still outstanding.

## WindTunnel asset preparation

`node tools/assets/convert-hawkshot-wind.mjs` now builds the original wind mesh and texture assets. It invokes `decode-hawkshot-wind.py` with the pinned CDTB environment, verifies the three source-file hashes against the existing effect pin, and reads the specific SCB 3.2 layout documented by the pinned LeagueToolkit mesh readers. Unsupported flags, nonzero pivot, unknown materials, invalid indices or trailing payload are rejected.

The source has 96 vertices and 124 triangles, including eight vertex-alpha values (0, 56, 84, 149, 185, 206, 218, 255). Export expands face corners to 372 vertices to preserve UV seams, retains face order and winding, maps BGRA vertex bytes to normalized RGBA, and scales positions by 0.01. Emitter birth scale and rotation remain unapplied runtime parameters. The 41,400-byte `hawkshot-wind.glb` embeds the 128×512 color texture. A separate 512×512 erosion PNG is 150,143 bytes; its hash and byte count are checked by asset validation. Erosion must be treated as linear data using the source's green-channel mixer.

Decoded PNG pixels are checked against decoded TEX pixels. Reading the GLB back verifies position, UV, vertex-color, face-index and embedded texture data. The browser asset preview confirms all eight alpha values and vertex-color support and was visually inspected. Rebuilding the GLB, erosion PNG and manifest is byte-identical. These checks establish asset conversion integrity, not in-game particle parity.

**Wind playback is now integrated**, with the interpretation policies below. The prepared scene stores the complete pinned emitter record. It specifies 15 emissions/second after an approximately 0.05-second delay; a 0.6-second lifetime value with a probability table; birth velocity, drag, randomized rotation/scale, rotational velocity, an alpha envelope, erosion-drive curve and particle linger. The runtime now reconstructs these properties together, including natural-life particles still alive after arrival. Owl1, Owl2 and WindTunnel are active; exact coordinate and shutdown parity remain unverified.


## WindTunnel playback

`src/content/hawkshot-wind.ts` is generated from the full pinned emitter plus `docs/reference/hawkshot-wind-playback.json`. Per-particle birth sampling yields 0.3–0.6-second lifetimes, independent axis scale, randomized Y rotation, and the authored 200-degree/second Y spin. Alpha follows the source envelope; an analytic drag policy integrates the 100-unit/second vertical birth velocity with drag 5. Particles retain their birth world positions rather than following the missile. One instanced draw handles visible wind particles, preserving source vertex alpha and reusing its allocation after expiry. Enemy particles obey point visibility; friendly particles remain visible.

The green erosion channel is sampled as linear data with mirrored wrapping. The adopted two-ramp equation uses the declared default feather widths 0.1/0.1 and slice width 1.5 from the pinned LeagueToolkit class layout. Erosion drive follows its source 0–0.3 curve. A GPU test checks full, half and zero coverage with a controlled green-channel input, rather than merely inspecting shader parameters. Published shader transcription supports the equation; CPU parameter packing and reference pixels have not been independently captured.

Snapshot version 19 requires the Hawkshot launch origin and preserves an optional source trajectory on destination scouting areas. Arrival metadata includes original direction/speed, launch/arrival ticks and traveled distance. It permits reconstructing wind after the projectile is removed, including fresh save restoration. Expired particles submit zero instances while the small reusable buffer remains allocated.

Emission starts at the source delay on a fixed 15/second grid; its epoch is the beginning of the accepted-cast tick, consistent with the simulation's first travel step. Hash-based per-particle randomness replaces unknown engine RNG. Birth positions clamp to traveled distance at arrival. Natural lifetime and the authored shutdown cap both limit surviving particles; no extra second is added to every particle. Exact first-emission phase, drag integration, inherited orientation/height, shutdown semantics and final color are local policies pending reference comparison. The rendered wind is subtle; successful reconstruction checks do not establish complete effect parity.


## Saved Hawkshot windup

Hawkshot now joins W/R in the pending-cast state. It uses the source's declared 0.25-second cast time and Spell3 animation; unlike W/R, it does not explicitly enable useAnimatorFramerate. The different castFrame value remains preserved in the timing audit. Playing Spell3 at elapsed source time is a current presentation policy, not proof of native animation scaling or release-frame alignment.

The charge, cast cooldown and serial recharge deadline are committed when the cast is accepted. The bird is created at release, so launchTick, origin, moving vision, per-bird animation and particle emission start with the actual flight. Death before release cancels the bird without refunding the charge or restarting recharge. A zero-distance cast resolves at release. Existing flight travel, endpoint lifetime, independent scouts and arrival tails retain their durations measured from the new release epoch.

Snapshot version 19 supports a saved pending E cast. Shared windup tests check both charge and recharge preservation across restoration and death, alongside movement lock, deferred orders, stun behavior and malformed-state rejection. Browser tests cover the source windup pose and exact restored bones, independent bird animation, additive/Fresnel materials, graphics-loss recovery, wind tails, erosion and minimap casting. Flight fixtures now wait for launch while retaining their distance, sight, lifetime and disposal assertions.

The windup screenshot is `artifacts/browser-hawkshot-windup.png`. Complete spell buffering, Flash/displacement interactions, post-release animation recovery and native frame/pixel calibration remain unfinished. See [shared timing evidence and policy](ASHE-CASTING.md#hawkshot-windup-and-flight-epoch).

## Source background glow layers

The flight model now includes Background_Arrow and Background_Arrow1 from the pinned base missile effect. `tools/assets/export-hawkshot-glow.py` verifies the extracted TEX hash, decodes its 256×256 RGBA payload without pixel changes, and exports both emitter profiles. The 23,194-byte PNG, decoded pixel hash, original emitter records and definition hash are recorded in `docs/reference/hawkshot-glow.json`.

Both source emitters are single particles, bound to the moving effect, with an approximately 0.1-second birth delay, 50-second particle lifetime and the same glow texture. Their source colors, vertical offsets (-50/-30 units), pass values (-6/-5), birth scales and scale multipliers are preserved. No gameplay state or launch epoch changes. Shared geometry/materials survive scout removal; visibility is reconstructed from saved flight age, including after graphics recovery. Both quads disappear with the flight model at arrival; arrival effects remain separate unfinished work.

Rendering interpretations are explicit: the quad occupies emitter-local XY, follows missile facing, and uses X for uniform birth scale and scale multiplier (a 180-unit square). This follows the pinned ReyEngine simulator/quad adapter, not a native capture. Missing texture division is treated as one full-image cell; the authored numFrames=2 does not justify inventing a two-cell atlas from this single radial glow image. Random start therefore makes no visible difference. Mode 1 uses straight alpha and mode 4 uses alpha-weighted additive blending. Quads render on both sides without depth writes; that culling policy, color-space handling, orientation and relative pass ordering require native capture calibration. ReyEngine's interpretations are external implementation evidence, not proof of Riot engine defaults.

The browser checks delayed appearance, pause, exact saved restoration, shared-resource survival, and actual pixels from each decoded layer against a neutral background. Existing independent-rig, Fresnel, wind and graphics-loss checks continue to pass. The inspected screenshot is `artifacts/browser-hawkshot-glow.png`. Smoke, explosion/linger layers and audio remain incomplete.

## Owl3 bound mesh particles

The flight now emits Owl3 at the source rate of 10 particles/second. Each particle uses the existing source hawk rig, animation and color-hold texture, with the selected blue Fresnel color and a linear alpha fade from approximately 0.54 to zero over 0.3000000119 seconds. The exporter verifies that mesh, skeleton, animation, texture, scale, rotation, black birth color, culling and blend mode exactly match the already shipped Owl2 assets. No extra asset download is needed; `docs/reference/hawkshot-echo.json` preserves the complete source emitter.

This is a bound effect: bindWeight=1 follows the scout horizontally, while birth velocity (0,-300,0) produces a downward offset within each particle's lifetime. It does not leave stationary hawks along the traveled path. At arrival the bound origin stays at the endpoint, emission stops, and existing particles finish their own lifetimes. The existing saved arrival trajectory supplies reconstruction; no new snapshot fields or gameplay rules are introduced.

The adapter starts births at the first flight interval, using the same launchTick-minus-one epoch as WindTunnel. A fresh particle starts its own source animation at age zero. World-time seeking reconstructs alpha, position and bone pose without render history. These birth-phase, animation-phase, binding and shutdown interpretations require native capture calibration; source values alone do not prove all engine execution semantics.

A maximum of four reusable rig/material slots per flight prevents continuous GPU-resource churn. Each visible particle adds one 642-triangle draw. Geometry and textures remain shared; each slot has private bones, mixer and fading material. Slots become hidden between births and are released when no particle remains, including after arrival, removed flights or match reset. Enemy particles use the existing visibility query.

Simulation/source tests cover binding, descent, fade, bounded counts, stateless restoration, stopping births and tail expiry. Browser coverage checks independent poses, pause, fresh-rig restoration, bounded pooling, disposal, and tail cleanup. Existing graphics-loss pixel comparison, glow, wind and Fresnel cases also pass. The inspected capture is `artifacts/browser-hawkshot-echo.png`. Smoke, endpoint effects and audio remain unfinished.

## Dust and smoke sprite preparation

`PYTHONPATH=.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/export-hawkshot-sprites.py` now verifies and decodes the remaining flight sprite sources. The export checks every TEX against its extracted archive hash and byte size, preserves decoded RGBA exactly through PNG, and records each top-left row-major atlas cell's rectangle and pixel hash. All four cells in each atlas are distinct. The source emitters, selected authored parameters and output hashes are preserved in `docs/reference/hawkshot-sprites.json`.

| Output | Size | PNG bytes | Intended sampling |
|---|---:|---:|---|
| hawkshot-dust.png | 128×128 | 10,401 | sRGB artwork, 2×2 atlas |
| hawkshot-smoke.png | 256×256 | 65,502 | sRGB artwork, 2×2 atlas |
| hawkshot-smoke-erosion.png | 256×256 | 30,511 | Linear data, authored red channel |

Dust playback is now integrated as described below; smoke remains prepared. Together they add 106,414 bytes to built static files; the dust atlas accounts for 10,401 runtime-requested bytes. All three decoded images were visually inspected. The preparation step itself made no rendering change; subsequent dust playback is documented below.

Dust authors 60 births/second, randomized 0.5–1-second lives, downward velocity, drag, randomized three-axis orbital velocity, a 100-unit box Size, uniform randomized 4-unit birth scale, growth, and a fading ice-blue color. Smoke authors 30 births/second, randomized approximately 0.3–0.6-second lives, separate 195/250-unit birth scales, growth, a fade-in/out color curve, red-channel erosion and a 35-unit soft-particle intersection parameter. Both author four frames and random start, with frameRate and bindWeight absent. Missing fields remain null in the profile; no default or animation cadence is invented by the exporter.

Preparation established the following playback requirements; dust integration is now described below, while smoke and native calibration remain incomplete:

- A camera-facing instanced quad path with independent per-particle atlas cell, rotation, size and alpha. Atlas selection must not mutate a shared texture offset between particles.
- Stable birth sampling and arrival-tail reconstruction from the existing saved flight trajectory, independent of rendering frequency. Native birth phase and random-stream agreement remain unverified.
- Dust box/orbital integration with documented space and units. The pinned ReyEngine shape reader explicitly calls half- versus full-extents unknown; its simulator also rotates around a changing emitter origin. Those interpretations need calibration rather than a stationary-position shortcut.
- Smoke's red-channel erosion with its authored feather-out value, plus explicitly sourced defaults for omitted erosion fields. The reference quad shader samples erosion at its transformed vUv; do not assume an independent full-image erosion UV without checking native behavior.
- Smoke intersection fading that accounts for scene depth and the source deltaIn value, with graphics-loss recovery and a defined quality fallback.
- Pixel checks for distinct atlas cells, erosion progression, soft intersections and blending, followed by source capture comparison. Asset hashes and passing code tests alone cannot establish visual parity.

## Dust atlas playback

Dust is now loaded and rendered from the prepared 128×128 atlas. One instanced camera-facing quad draw carries all visible particles, with independent shader attributes for frame and alpha. Texture offset remains shared and unchanged. The 10,401-byte atlas is the only newly requested asset; smoke assets remain prepared but unused. Four-cell selection is fixed at birth because frameRate is absent, following the documented adapter policy rather than inventing animation speed.

The runtime exports authored rate (60/second), randomized lifetime (0.5–1 second), box Size, velocity, drag, orbital ranges, rotation range, uniform scale/growth and color. Stable hashes of flight identity, birth index and component select local random values without consuming gameplay RNG. Existing saved flight/arrival trajectories reconstruct particles and stop births at arrival. Actual lifetimes and the one-second shutdown bound remove the tail; allocated geometry/materials remain reusable with an instance count of zero.

Motion uses explicit local policies pending native measurement: box Size is treated as half-extents, orbital values as radians/second, and absent bindWeight as unbound. Each particle reconstructs motion from birth in fixed 1/60-second steps plus a final fractional interval. Vertical velocity receives exponential drag before the position step; then the position rotates around the moving emitter origin using yaw/pitch/roll order, matching the inspected ReyEngine adapter structure. The emitter stops at its saved endpoint after arrival. The horizontal result rotates with scout facing. Birth ground height anchors the particle vertically; camera changes only rotate the display quad. This is a deterministic integration policy, not verified Riot engine execution or native RNG parity.

Source/simulation cases check stable sampling, four available cells, lifetime/growth/fade, directional covariance, restored state and tail expiry. Browser cases check frozen/restored instance buffers, bounded draw reuse, arrival cleanup and distinct GPU pixels from all four cells. A half-alpha check verifies fading and a zero-alpha check verifies transparency without shared texture mutation. The inspected screenshot is `artifacts/browser-hawkshot-dust.png`; the very small authored particle size is retained rather than enlarged for visibility. Existing Hawkshot context-loss pixel, mesh, Fresnel, wind and Owl3 tests pass. Smoke erosion/depth fading and endpoint/audio work remain unfinished.
