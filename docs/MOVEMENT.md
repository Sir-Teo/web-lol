# Movement distance and run playback

Movement consumes its effective speed times the fixed simulation interval along the navigation path. Reaching a waypoint now spends only that segment's distance and carries the remainder into the next segment, including around a turn. Repeated points are skipped. The unit stops at the final reachable endpoint instead of spending remaining distance beyond the path. This removes an artificial slowdown caused by routes containing short segments. Navigation generation, reachability, and the existing arrival tolerance remain separate policies.

One `World.movementSpeed` function supplies the existing movement modifiers to both travel and run playback: the current slow factor and the player's Heal haste compose, and their integer-tick deadlines use the same rules. Base stats remain unchanged. This does not implement additional reference movement-speed caps, stacking rules, or missing crowd-control effects.

Run playback scales relative to the battlefield's unmodified unit speed, falling back to the current practice baseline of 325 when no source speed is configured. Thus a Rift minion's 350-to-450 speed progression changes its run rate proportionally, as do existing slows and haste. This is relative rate consistency; the authored nominal stride and exact foot contacts still require controlled reference capture. Run-cycle phase is not saved.

Four simulation scenarios compare sparse and dense straight paths, exercise zero-length segments and corners, enforce endpoint stopping, and verify slow/haste composition and exact expiration. A browser scenario covers 36 combinations across Ashe and all eight imported lane-minion rigs, comparing actual per-tick displacement and source run playback rate. It uses a controlled unobstructed path to isolate speed; existing navigation and full-map movement tests remain required.

## Explicit attack clicks

Pressing A and left-clicking a visible enemy issues a targeted attack, including on a practice dummy. It does not discard the selected enemy in favor of the ground attack-move acquisition rule. Clicking ground or an ally with A armed still issues attack-move. Escape cancels the armed input, and accepting either command clears its range/aim cursor. Ground acquisition remains the existing nearest-to-unit policy; configurable attack-move-on-cursor and target-champions-only controls remain unfinished.

The browser tests click an enemy champion, caster, and dummy with another enemy closer to the player, then verify the chosen unit takes damage and the nearer unit does not. A fourth case covers ally/ground routing and Escape cancellation. These checks verify this implementation; precise input buffering, targeting tolerances, and windup behavior still require matched reference comparison.


## Movement-speed soft caps: research checkpoint

Status: **unimplemented; candidate formula requires reference verification**. Research checked September 13, 2026. The current runtime multiplies base/item speed by the active slow and Heal haste, then uses that result for displacement and run playback. Consequently, enhanced Volley slows can produce lower movement speeds than the candidate reference rule predicts.

A firsthand investigation by Caenen_ reports measuring the otherwise obscure negative-raw-speed branch through a PBE Lillia bug. The researcher also states that multiplicative bonuses and slows precede the soft caps. This supports the existence and ordering of the correction, but it is an older observation, not a controlled standard Summoner’s Rift 26.18 capture. The opening post reproduces a community formula; its positive thresholds are a research lead, not independently verified source data. [Original discussion and researcher’s observations](https://www.reddit.com/r/leagueoflegends/comments/1dlr2vx/i_think_many_of_us_never_knew_that_movement_speed/)

Candidate effective speed for raw speed `r`:

| Raw interval | Candidate result | Boundary cases |
|---|---|---|
| Below 0 | `110 + 0.01 * r` | Negative modifiers require a separate supported-stat policy |
| 0 through 220 | `110 + 0.5 * r` | 0 → 110; 180 → 200; 220 → 220 |
| 220 through 415 | `r` | 325 → 325; 415 → 415 |
| 415 through 490 | `415 + 0.8 * (r - 415)` | 490 → 475 |
| Above 490 | `475 + 0.5 * (r - 490)` | 600 → 530 |

Recursive numeric searches of the cached 16.18 globals and shared records found no relevant rule containing the 220/415/490 thresholds. Absence in these two caches does not prove the rules are absent from the game, nor does unrelated spell or particle data verify them.

### Implementation design and acceptance cases

Once verified, place the stat transformation in a pure simulation helper and invoke it after the supported haste/slow composition in `World.movementSpeed`. Keep movement and animation on this shared result. Verify applicability separately for champions, lane minions, and other unit kinds; do not automatically extend a champion observation to every unit. An immobile practice dummy with configured speed zero must remain immobile. Stuns, roots, death, and movement permission are separate from a numerical speed floor.

Capture effective displacement over unobstructed straight paths with fixed timing, excluding arrival tolerance, path turns, unit collisions, and animation as measurement sources. Record patch, mode, unit, level, items, modifier deadlines, raw speed, HUD speed, and measured distance. Include these cases:

- Below, at, and above 220, 415, and 490, using fractional values to distinguish continuity from displayed rounding.
- Level-one Ashe Volley against a 325-speed champion: current initial speed 195; candidate floor result 207.5. Check decay through the 220 threshold rather than asserting a constant percentage slowdown.
- Level-18 Volley at the same target speed: current initial speed 130; candidate result 175. Check halfway decay, ordinary slow, and expiry independently.
- Heal at 325 raw base speed: 422.5 before caps; candidate result 421. Repeat with boots and simultaneous ordinary/enhanced slow to distinguish modifier ordering.
- A stationary dummy, minions at each existing speed upgrade, and a stunned champion to establish scope and movement permission.
- A save during decay, exact expiration, and matching renderer playback after restore. Caps should be derived from saved state, not introduce another independent deadline.

Do not update existing tests to these candidate numbers until the rule and scope are accepted. Existing tests establish the current implementation’s consistency; they do not establish agreement with League. General strongest-slow priority, slow resistance, and arbitrary movement modifiers remain separate missing systems.


## Minimap spell targeting

Hawkshot (E) and Enchanted Crystal Arrow (R) now use minimap coordinates when aimed and released over the minimap. Both pinned standard spell records explicitly set `mUseMinimapTargeting: true`; the existing hash-verified exporters now expose that flag to ability metadata. Other targeted abilities do not inherit it. Source: [16.18 Ashe records](https://raw.communitydragon.org/16.18/game/data/characters/ashe/ashe.bin.json).

The HUD's minimap coordinate conversion is shared by spell aiming, camera clicks and movement orders, using the displayed rectangle and battlefield extent. Pointer tracking spans the battlefield and HUD, allowing a held E/R to move between them. Releasing over another HUD panel, or releasing a spell without minimap support over the minimap, submits no cast; it does not reuse the last battlefield position. Actual canvas hit-testing also prevents Heal from selecting a unit behind a HUD panel. Minimap hover and spell release do not move or unlock the camera. Right-click minimap movement cancels a held cast, consistent with battlefield right-click cancellation. Escape still cancels targeting.

This implements the current hold-to-aim/release-to-cast input mode. Reference parity for alternate cast modes, minimap unit-target priority, modifiers and detailed pointer cancellation remains unverified. The controls panel now describes E/R minimap use.

Four Chrome scenarios verify both spells on the full Rift at laptop size, projected aim/cast direction and Hawkshot endpoint, unchanged camera, transitions through HUD/minimap/battlefield, unsupported casts, Escape, and right-click cancellation. Existing control and hovered-ally Heal checks remain passing.


## Effective movement-speed readout

The champion HUD now reads `World.movementSpeed`, the same effective value used for travel and run playback, instead of displaying `hero.speed` without active modifiers. Ordinary Frost, the enhanced slow's decay and Heal haste therefore appear in the stat readout as they change and expire. The display normalizes to the existing six-decimal stat precision before rounding to a whole unit; this prevents binary floating-point noise from displaying the mathematical 227.5 midpoint as 227. This is display policy only: movement calculations and the stored base/item stat are unchanged.

Two browser scenarios cover an actual enemy attack slow, a subsequent Heal, both exact expiration boundaries, and the enhanced-slow midpoint while preserving the stored 325 speed. The existing run-playback comparison also passes. This establishes consistency with the current simulation, not reference soft-cap or HUD rounding parity; the soft-cap investigation above remains unresolved.
