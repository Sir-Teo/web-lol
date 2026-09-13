# Damage-absorbing shields

## Combat foundation

Every unit now carries a saved shield list. `World.applyShield(source, target, amount, durationTicks)` grants an independent shield to a living allied champion, including self. It rejects invalid resources/deadlines, external unit objects, enemy targets, nonchampions and ended matches. A dead caster remains an eligible owner for a future committed-flight application. This helper does not implement a spell's mana, cast, flight, application count or stacking/refresh policy.

Damage is mitigated by armor/magic resistance before reaching universal shields. Physical, magic and ordinary true damage can all consume them; only overflow reduces health. Earlier deadlines absorb first, with insertion order breaking ties. Expired shields are removed before commands/combat on their deadline tick. Target death/respawn clears shields; caster death preserves them.

Fully absorbed damage keeps the existing attack/assist contribution and turret-retaliation paths active. It preserves recall unless health is lost. Doran omnivamp includes the absorbed amount plus actual health lost, retaining the existing overkill cap policy. Basic attack, slow/root and Illumination effects remain separate from health absorption. These ordering choices and shield-related recall/omnivamp behavior are implemented adapter policies that still require controlled native comparison; the tests establish deterministic local behavior, not native conformance.

The bot's finish check adds active shields to victim health, preventing a shielded target from being classified as immediately lethal. It does not predict shield expiry during projectile travel.

## Persistence and display

Snapshot 40 requires shield arrays and validates positive finite capacity, allied champion ownership, living champion recipients and active finite deadlines. It preserves partially depleted grants and their order across save/load.

Overhead health bars show a white shield segment after current health. When health plus shield exceeds maximum health, the display scales to fit both; otherwise it retains the normal maximum-health scale. The segment title reports capacity, and health divisions use the displayed capacity. This introduces shield readability; its colors, pixel dimensions and scaling still need native calibration. The bottom HUD shield treatment, spell-specific shield particles and sound are unfinished.

## Prismatic Barrier evidence and integration

`reference/lux-w.json` pins the full W ability and five related spell records from the verified 16.18 Lux response. Parent named values give 40/55/70/85/100 base shield at ranks 1–5, a 0.4 AP ratio and 2.5-second duration. The parent cast time is 0.25 seconds and standard cooldown is 12/11.5/11/10.5/10. [Pinned Lux response](https://raw.communitydragon.org/16.18/game/data/characters/lux/lux.bin.json)

Data Dragon's W costs are 60/65/70/75/80. The parent mana array starts directly at 60, unlike its named shield/cooldown arrays with leading entries; a generic uniform rank index would be incorrect. Child flight metadata includes an outgoing initial speed of 2200 with −2300 acceleration/minimum 500, and a returning initial speed of 50 with +1800 acceleration/maximum 2400. Source missile width 110 and input/display ranges have different meanings that still need reconciliation. [Lux Data Dragon](https://ddragon.leagueoflegends.com/cdn/16.18.1/data/en_US/champion/Lux.json)

Riot's 10.18 notes specify a maximum of two W shield applications. The [W adapter](LUX-W.md) now connects the outgoing/returning wand, moving-owner return targeting and separate per-pass application limits. Self-shield timing and remaining-capacity refresh are explicit provisional policies awaiting native comparison. The recently found 26.17 Lux shield-timing change is in the League Classic section and was not applied to this standard ruleset. [10.18 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-10-18-notes/), [26.17 notes](https://www.leagueoflegends.com/en-gb/news/game-updates/league-of-legends-patch-26-17-notes/)

Spell shields, damage-type-specific shields, shield breaking/reduction, executes that bypass shields remain separate unfinished systems. W now records shield support through the existing support-contribution path; its broader native eligibility rules remain under review.

## Validation

All 545 source/simulation checks pass. Seven new shield cases cover three damage types, resistance ordering/overflow, expiry/save continuation, recall/combat credit/omnivamp, caster and victim death, and invalid data. The bot ultimate regression now includes a shielded target. Five focused Chrome cases cover the visible shield/absorption/expiry, Lux integration and champion selection. The shield health-bar capture was inspected. Nested-path production smoke passes. Full browser, full-match and performance suites were not repeated.
