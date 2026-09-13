# Enchanted Crystal Arrow fidelity

The standard 16.18 spell record selects `AcceleratingMovement`: initial/minimum speed 1,500 units/second, acceleration 200 units/second², maximum speed 2,100. The prototype now uses these values instead of a constant 1,600 speed. `docs/reference/ashe-r.json` retains the entire spell record and source hash; `python3 tools/assets/export-ashe-r.py` verifies the cached source and selected record before exporting the movement constants.

The simulation integrates constant acceleration within each 60 Hz step and handles reaching the cap partway through a step. Collision sweeps use the resulting step distance. The projectile's existing speed field stores its current speed, so saves need no new field. Range consumption and terminal removal retain the existing behavior. Launch timing, source bone/height, missile model/effects and exact reference collision geometry remain unfinished.

At one second the model travels 1,600 units and reaches speed 1,700; at three seconds it travels 5,400 units and reaches 2,100; subsequent flight stays capped. These are local integration checks using source constants, not measurements from a League client capture.

The pinned record also includes minimum/maximum stun durations of 1/3.5 seconds, rank-dependent damage, splash data and visibility settings. The selected data does not expose the distance threshold needed to implement the stun curve confidently. The current fixed two-second stun remains provisional. Full distance scaling and rank/AP scaling remain unfinished. Splash behavior is described below. Missile vision is described below.

Two simulation cases cover launch acceleration, integrated distances, cap, range removal and saved continuation. A browser case advances and renders the arrow before and at the cap. Existing ultimate collision and save regressions remain relevant.

## Moving missile vision

The same pinned missile specification selects `Defaultvisibility` with `mPerceptionBubbleRadius` 750. The exporter now verifies that component and emits its radius. Each living projectile of type ultimate contributes a source at its current simulation position to its own team's shared `visionSources` result. Ordinary attacks and Volley do not gain this source. Because visibility consumers already use that shared method, targeting, unit visibility, fog rendering and structure observation use the same radius.

Missile sight follows the projectile even after its caster dies. It is derived from saved projectile state and therefore needs no additional snapshot field. Removal, impact or range expiry removes the moving source. No lingering reveal is added. Default visibility currently uses the battlefield's ordinary terrain/brush occlusion rule; this interpretation and any lingering reveal behavior need controlled reference verification. The source radius alone does not establish those runtime details.

Three simulation cases check both teams, inclusive radius boundaries, ordinary projectile exclusion, movement/removal, dead-caster saved continuation and occlusion. A browser case reveals a distant enemy through the missile source and verifies that it becomes hidden again after removal. This establishes local shared-vision behavior; reference fog shape and pixel parity remain unfinished.

## Surrounding damage and slow

An ultimate collision now applies area damage and basic Frost Shot slow to living enemy non-structure units within 400 center-distance units of the primary target. The direct target is excluded from the area loop and retains its existing stun; surrounding targets receive no new stun. Splash still occurs when the primary damage kills its target. Damage uses the projectile's captured damage multiplied by the pinned `AoECoefficient` (1.0), with each target's magic resistance applied independently. Basic slow strength is sampled from the caster's level before any impact damage grants experience.

[Riot's champion description](https://www.leagueoflegends.com/en-au/champions/ashe/) confirms surrounding enemies take damage and are slowed. The current spell record supplies `SlowRadius` 400 and an area calculation using `AoECoefficient` 1.0. Reusing that radius for both splash damage and slow, centering on the direct target, inclusive center-distance bounds and no additional line-of-sight test are implementation interpretations pending controlled capture. Do not replace the pinned coefficient with old secondary descriptions of half damage without reconciling patch dates.

There is no final explosion audiovisual effect yet. The existing single-slot slow model still lacks priority/stacking rules. Distance-dependent primary stun, full rank/AP scaling and reference collision calibration remain unfinished.

Two simulation cases check the radius edge/outside, exclusions, single primary damage, distinct stun/slow behavior, magic mitigation, minion splash after a lethal primary hit and pre-impact saved continuation. A browser case checks primary and nearby damage with a stun on only the direct target.

## Cross-map travel range

The exporter now verifies the uniform `castRange` array and emits its 25,000-unit value. The ability specification uses that generated range for projectile travel, replacing the provisional 10,000-unit cutoff. Aim points determine direction; an unobstructed arrow continues to its range limit. This enables the existing map to support cross-map shots instead of deleting them mid-flight.

With the source acceleration, an unobstructed arrow consumes its range after 740 simulation steps (12⅓ seconds). Projectile cleanup ignores residual distances of at most 1e-8 world units, avoiding an extra lifetime tick from floating-point accumulation without expanding collision travel. The full-speed endpoint and range budget remain governed by the collision sweep.

The flight regression now checks survival past 10,000 units, remaining range and exact removal at the terminal step. A new simulation case saves an arrow after six seconds and confirms identical impact on a target 15,000 units from launch. A browser case confirms that long-range hit. Distance-scaled stun, full audiovisual fidelity and complete match systems remain unfinished.
