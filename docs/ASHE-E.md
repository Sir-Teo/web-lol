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

The missile has eight emitters. Three use the same **animated mesh**: `Ashe_Skin06_E_Hawk.skn`, its skeleton, and `Ashe_Skin06_E_Dove.anm`, under the base skin's particle directory. The names do not imply a different skin should be selected: the base effect explicitly references them. `Owl1` supplies the owl texture and tint, `Owl2` adds a reflection/Fresnel layer, and `Owl3` emits short-lived trailing mesh copies. The other emitters provide two background glows, a wind mesh, dust and smoke. Arrival has five emitters; lingering vision has four.

This evidence rules out reproducing the complete effect as a flat bird sprite or two procedural wings. Conversion must retain the rig and animation, then reconstruct layered materials, transforms, blend order, trails and arrival/linger effects. The mesh emitters mark uniform scaling and carry both a rotation and three-component birth scale; do not treat all three scale components as independent axes without resolving that flag. Visual particle lifetimes and dimensions are not proof of gameplay vision duration or radius.

Rebuild and verify the sources with:

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-hawkshot-effects.py
```

The verified CDTB checkout was `ba981db2a2c814a0d78e55f6483e0636b527850f`. The extractor derives minimal name tables from the pinned records, re-decodes the raw binaries, checks the exact skin/resource mappings and linked records, and rejects missing asset dependencies. It needs no mutable global hash dictionary. Archive reads verify compressed chunks and final file hashes. The archive reader now accepts an explicit archive name and isolates its header cache; its default Map11 path remains supported.

The selected 21 files total **907,219 bytes** (17 asset dependencies and four binary definitions). They require **468,831 compressed patch bytes**, rather than downloading the entire 148,431,276-byte champion archive. The hawk mesh is 28,768 bytes, skeleton 664 bytes and animation 6,060 bytes. All selected files were re-extracted and verified; the default archive-reader regression also revalidated all 40 existing base-structure source files. The source-recovery milestone itself changed no runtime visuals. The subsequent body conversion below replaces the procedural bird.


## Source body conversion

Run `node tools/assets/convert-hawkshot.mjs` after extraction. It verifies all 21 source hashes and exports `public/assets/models/hawkshot.glb` plus a provenance manifest: **80,440 bytes, 1,284 rendered triangles across two layers (642 shared source triangles), five bones and a 1.333333-second flight clip**. Conversion bakes the source uniform scale (1.6) and centimeters-to-render-units factor into geometry, joint translations, inverse binds and animation translation tracks. Runtime applies the source 90-degree X rotation. Exact transform alignment still needs reference capture.

The body uses the source owl texture and RGBA tint with an unlit, double-sided material and disabled depth writes. Mode 4 now uses alpha-weighted additive blending, based on the explicit factor table discussed below. The GLB carries the source mode in material extras; its portable alpha-BLEND fallback cannot express this additive state by itself. The Owl2 Fresnel rim is now present. Trailing mesh copies, both glows, dust, smoke, arrival and lingering vision effects remain absent. WindTunnel playback is now integrated as described below. The body is more visible with additive blending but can still be occluded by scenery; screenshot inspection does not establish reference legibility or pixel parity.

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
