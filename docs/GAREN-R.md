# Demacian Justice integration contract

Garen NPCs can now learn and cast R through an explicit champion-target command.
His source cast animation, target-only sight, execute decisions and checkpoint
continuation are integrated. Player selection remains Ashe/Lux while Garen's
complete audiovisual presentation and native comparison remain unfinished. The
[development player fixture](GAREN-PLAYER.md) now validates mouse-targeted input,
range guidance, HUD and checkpoint flows independently of production selection.

`tools/assets/export-garen-r.py` reads the frozen character BIN and the versioned
[Data Dragon R record](reference/garen-r-ddragon.json). A fresh October 21, 2026
download through the correct `data/en_US/champion/Garen.json` path matches the
earlier cached hash. The previous URL omitted `champion/` and returned HTTP 403.
The pin records the corrected URL, retrieval date and complete-response hash.
The exporter checks matching three-rank declarations and cooldowns.

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

## Initial runtime integration — October 21, 2026

The existing cast command accepts an optional `targetId`. Only Garen R consumes
that field; its target is required and is never inferred from the supplied ground
point. Acceptance checks a living, vulnerable, visible enemy champion, learned
rank, cooldown and control gates. Range currently uses a center-to-center 400-unit
check. Dummies, lane minions, structures and allies cannot receive R. No resources
or cooldown are spent on rejection. Learning uses the existing level 6/11/16 gates;
Garen's unsupported E remains blocked.

The local adapter rounds authored cast time upward to 27 ticks (0.45 seconds).
It captures target/rank at acceptance, starts the hasted cooldown immediately and
interrupts recall and ordinary basic-attack windups. An already committed Q strike
rejects R until its release. Accepted R persists through ordinary orders, a new
root/stun/silence, subsequent loss of sight, and target movement beyond cast range.
The caster stays still during the windup and resumes its retained order afterward.
Heal remains available; Flash and other new champion casts are blocked while R is
pending. Caster death cancels damage; a target dying or disappearing never redirects
R to another unit. These failures retain the cooldown under the current adapter.
Native cancellation, leash, displacement and refund behavior remain unverified.

One source-owned reveal record grants only the caster's team sight of the selected
champion for exactly 60 ticks from acceptance. Unit rendering, targeting, observed
stats and unit-attached combat feedback use this sight; terrain, neighboring units,
and unrelated projectile visibility receive no new vision source. The record
survives caster death and can retain the target's corpse until expiration. Target
disappearance retires it and its pending cast. This implements ordinary target-only
fog sight; stealth/true-sight rules are still outside the supported simulation.

Damage samples missing health at release using the captured rank. Shared true
damage processing supplies shields, kill/assist credit, Perseverance interruption,
and Courage's independent kill counter. R launches no gameplay missile and applies
no basic-attack on-hit or silence behavior. Source `spell4_base` playback maps its
18.5/30-second cast marker to the 27-tick release, then plays the remaining clip
at source speed. A subsequent action can replace the presentation. This piecewise
playback is a local contact-marker policy; neither the source total-time field nor
native animation precedence has been established by a matched capture.

Bots prioritize learning available R ranks and consider a visible champion already
within range only when current true damage covers health plus active shields.
Existing retreat/group-combat and tower-avoidance decisions take precedence. The
decision does not path into R range or read hidden health, and its queued command
passes ordinary cast validation on the following tick. Healing, future shield
expiry and other incoming damage are not forecast for this execute estimate.

Snapshot version 73 retains the optional queued target, captured pending target/rank/
release, and required nullable reveal state. Validation checks spell ownership,
target references/team, exact timing, learned ranks, reveal/cast consistency and
foreign payloads. The remaining windup and reveal continue identically on restore;
earlier checkpoints are incompatible under the existing same-build policy.

Validation: 14 new simulation cases cover all ranks, healing, shields/resistance,
range/target/control rejection, committed orders/CC, isolated sight, rewards,
death/disappearance, queued/pending restoration, forged saves, source animation,
Q interaction and both teams' execute decisions. The complete 886-test suite and
TypeScript pass. Four focused Q/W/R browser scenarios pass. The R capture at
`artifacts/browser-garen-r-contact.png` was visually reviewed. Production build and
nested static-hosting smoke pass with 17 source recordings and real Ashe/Lux casts.
The existing large-bundle warning remains.

Judgment is now integrated separately in [GAREN-E.md](GAREN-E.md). Next work includes
R particles/audio, native cast/reveal/cancellation comparison, player input/HUD,
and complete kit/role integration before roster selection.
