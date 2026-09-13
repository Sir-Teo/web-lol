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

Player state stores `eCharges` and nullable `eRechargeTick`. At full capacity the timer is null; below capacity it is a finite integer deadline. Snapshot version 14 rejects missing, fractional, out-of-range or inconsistent ammunition state. Save/restore retains recharge progress. Respawn does not refill charges. Practice's reset-cooldowns action restores both charges and clears the recharge timer.

The E icon shows its charge count and a thin progress bar toward the next charge. With ammunition available, its main countdown shows only the five-second cast delay; with none, it shows the longer wait for cast eligibility. A shared simulation query computes that wait for cast validation and the HUD. The accessible label also reports charges and time until replenishment. The bar/count layout is authored UI, not a claim of reference pixel parity.

Five simulation cases cover serial recharge/cap, exact cast and replenishment boundaries, rejected casts, recall preservation, death/respawn, save continuation and invalid ammunition snapshots. A Chrome case uses actual keyboard casts and verifies the charge badge, countdown, accessible label, recharge visibility and practice reset.

## Traveling scout and destination vision

Hawkshot now launches a non-damaging projectile toward the selected point, clamped to 25000 units from the cast position. It travels at 1400 units/second, ignores unit and terrain collision, and grants its team unobstructed moving sight. It stops exactly at its destination instead of continuing for the entire maximum range. A zero-length cast creates its destination reveal immediately. Arrival removes the flight model and creates a separate five-second scouting area. Multiple flights and destination areas coexist; caster movement, death or respawn do not relocate or cancel them.

The verified exporter now checks `FixedSpeedMovement`, agreement between component speed and `missileSpeed`, disabled target tracking, `mProjectTargetToCastRange`, matching uniform range arrays, and `VisionDuration`. These establish the 1400 speed, 25000 range and five-second lifetime. The first flight interval occurs during the accepted-cast tick in our fixed-step simulation. Exact cast/arrival timing remains a policy until windup is implemented and measured.

Both moving and destination sight currently retain the earlier **provisional 650 radius** and unobstructed terrain/brush policy. No lingering path trail is implemented. The source exposes `luaOnMissileUpdateDistanceInterval` of 100, but it does not by itself establish the radius or lifetime of trail reveals. Do not interpret the spell's `castRadius` or particle dimensions as verified vision geometry.

Scouting areas share the existing timed vision-area collection, now with explicit `scout`/`attack` kinds. Queries that exclude attack-reveal feedback still include scouting, so an attacker already seen by Hawkshot does not create a spurious hidden-attack reveal. Snapshot version 14 stores the new projectile type and requires the area kind. Saved flights preserve direction, position, speed and remaining range; saved areas preserve their own lifetime. The legacy `world.reveal` slot remains for existing diagnostic fixtures; Hawkshot no longer writes it.

The renderer now uses the original Owl1 mesh, skeleton, texture and flight animation. Each scout has a private skeleton and animation mixer; geometry, material and texture are shared. Phase derives from its saved `launchTick`, so concurrent casts animate independently, pause freezes the pose, and restoration recreates the same phase. Removing a scout releases its private skeleton GPU texture without disposing shared assets. Snapshot version 14 requires a nonnegative integer launch tick for every Hawkshot. This is the source body layer, **not the complete original effect or a visual-fidelity certification**.

Four simulation cases cover fixed speed, collision exclusion, exact arrival/expiry, range clamping, self-targeting, team ownership, scouting versus attack-reveal queries, two concurrent flights, caster death and saved flight/endpoint continuation. Browser coverage checks visible flight, stationary paused pose, delayed distant-unit visibility, removal of the flight model, destination visibility and expiry; charge/reset coverage remains active.

## Remaining Hawkshot fidelity work

Verify and implement sight radius, lingering path vision, the source 0.25-second cast windup and its cancellation/movement rules, independent rank allocation/haste, complete layered particles and audio. The current moving bubble can reveal the destination during approach before the projectile arrives; the separate five-second destination lifetime begins only at arrival. Complete spell parity remains unverified.


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

Run `node tools/assets/convert-hawkshot.mjs` after extraction. It verifies all 21 source hashes and exports `public/assets/models/hawkshot.glb` plus a provenance manifest: **73,856 bytes, 642 triangles, five bones and a 1.333333-second flight clip**. Conversion bakes the source uniform scale (1.6) and centimeters-to-render-units factor into geometry, joint translations, inverse binds and animation translation tracks. Runtime applies the source 90-degree X rotation. Exact transform alignment still needs reference capture.

The body uses the source owl texture and RGBA tint with an unlit, double-sided, normal-alpha material and disabled depth writes. Normal alpha is a provisional interpretation: the source blend enum value 4 has not been verified. Reflection/Fresnel, trailing mesh copies, both glows, wind, dust, smoke, arrival and lingering effects remain absent. The current body alone is faint and can be occluded by scenery; screenshot inspection does not establish reference legibility or pixel parity.

Browser checks cover separate skeletons and per-cast phases, shared GPU resources, frozen pause state, exact restored pose, resumed motion and private-resource disposal. A simulation case rejects missing, null, negative, fractional and nonnumeric launch ticks.
