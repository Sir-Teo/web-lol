# Demacian Justice integration contract

R is not yet available to cast. This source contract precedes its targeted-cast,
reveal, animation, AI and save integration.

`tools/assets/export-garen-r.py` reads the frozen character BIN and the versioned
[Data Dragon R record](reference/garen-r-ddragon.json). The latter was retained
from an earlier successful session download; a fresh fetch returned HTTP 403.
Its version, full-response hash and cached status are explicit in the pin. The
exporter checks matching three-rank declarations and cooldowns across both sources.

| Property | Value and source |
| --- | --- |
| Base damage | 125/200/275, character named values |
| Missing-health ratio | 25/30/35%, character named values |
| Damage type | True, Riot notes and client tooltip |
| Cooldown | 120/100/80 seconds, both records |
| Cost | Zero, client record |
| Cast range | 400, client record |
| Target reveal | 1 second, character named value |
| Authored cast/total time | Approximately 0.435/1.74 seconds |
| Animation marker | Frame 18.5, `Spell4`; animator framerate flag enabled |

[Riot patch 26.14](https://www.leagueoflegends.com/en-au/news/game-updates/league-of-legends-patch-26-14-notes/)
confirms the base damage and missing-health ratios. [Riot patch 9.20](https://www.leagueoflegends.com/en-us/news/game-updates/patch-9-20-notes/)
establishes true damage, removal of the Villain dependency, and the one-second
target reveal intended to avoid cancellation on loss of line of sight. Older
damage values in that historical article do not replace the frozen current values.

## Fields that must not be conflated

- The character record has no explicit `castRange` or `mTargetingTypeData`.
  Its `castRadius: 100` is not evidence of a 100-unit cast range. Use the separate
  client range as a range reference, with native edge/center distance rules still
  to verify.
- The source contains an unresolved required-unit tag and affected-type flags.
  The intended target is an enemy champion according to the official tooltip;
  do not silently extend R to practice dummies, minions or structures.
- `spellCastTime`, `spellTotalTime` and `castFrame` are distinct source fields.
  Do not infer native timing precedence from one field. The verified graph
  sequences `Spell4_Base` then `Idle1_Base`. The exporter checks the pinned ANM
  hash and its v1 header: 30 FPS and approximately 1.5667 seconds duration. Thus
  frame 18.5 represents about 0.6167 seconds of source animation, which differs
  from `spellCastTime`. Native precedence and playback rates remain unresolved.
  The base clip also has a `Garen_R_Cas` particle event at frame 10; that event
  must not automatically be treated as the damage event.
- `missileSpeed: 900` alone does not establish a gameplay projectile. R should
  not become an Ashe arrow or a delayed homing missile merely because that field
  is present.
- The separate `BotData` calculation includes unresolved fields and nested
  multiplication involving `ExecuteDamage`. It is not a safe replacement for the
  documented damage formula without understanding its stat units and semantics.

## Runtime work

1. Add explicit target identity to the cast command or a dedicated validated
   champion-target command. Capture the target at acceptance; do not reselect
   whichever unit happens to be closest to an old ground point at release.
2. Validate enemy champion, visibility, vulnerability, range, learned rank,
   cooldown and control gates before accepting the cast.
3. Preserve a committed cast through ordinary movement/retarget commands under
   the selected adapter; verify native hard-CC, displacement, death and target
   disappearance behavior. Determine failure cooldown/refund and range-leash
   policy from PC evidence, not Wild Rift rules.
4. Add target-specific reveal through existing team vision. Do not use a broad
   area reveal that leaks nearby units or hidden terrain. Native true-sight
   semantics remain separate from ordinary fog visibility.
5. Sample target missing health at the established damage event, use the captured
   rank, and route true damage through shared shields, kill credit and Courage
   stacking. Verify healing during windup, lethal/nonlethal boundaries and a target
   dying before release.
6. Retain target, rank, release and reveal deadlines in versioned snapshots with
   ownership, chronology and reference validation.
7. Teach bots to estimate the supported true-damage formula including shields,
   without reading hidden target health or casting through an unsafe approach.
8. Add source animation, particles, audio and browser checks. Keep Garen out of
   player selection until his full kit and input/presentation flows are integrated.
