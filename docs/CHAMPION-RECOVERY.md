# Champion recovery and bot retreat

All living champion prototypes now receive health and mana regeneration, including allies and enemies. The player uses its source-backed Ashe level-growth factors; other champion prototypes currently use level-one Ashe regeneration because independent bot leveling is not implemented. Dead champions do not regenerate. Non-champion regeneration retains its separate rules.

Within 220 center-distance units of a champion's own team spawn, the existing fountain policy restores 9% maximum HP and 12% maximum mana per second. An opposing team's fountain does not grant that bonus. These radius/rate values were already used for the player and remain provisional, not newly verified source values. Ordinary regeneration outside the fountain comes from the pinned Ashe data. The old bot-only addition of 20 HP per AI decision near red spawn has been removed, so healing no longer depends on the bot decision frequency.

The current tactical bot starts retreating below 22% health and remains in that state until reaching at least 85%. It replaces unrelated movement orders with a move toward its own team's spawn and waits within 100 units of home while recovering. This prevents leaving the fountain as soon as the initial low-health threshold is crossed. The 22%/85% thresholds and waiting radius are authored bot policy, not a claim about Riot's bot AI.

`aiRetreating` persists in snapshot version 9 and clears on respawn. This state is independent of current movement orders, so arrival, an idle order, or checkpoint restoration cannot accidentally end recovery. Full team strategy, safe retreat-route selection, enemy-fountain danger, recall decisions, mana-driven retreats, purchases, role assignments, and independent bot progression remain unfinished.

Four new simulation cases cover each team's recovery, waiting until healthy, saved continuation, replacing unrelated move orders, ordinary regeneration at an opposing fountain, and death exclusion. Existing damage tests now distinguish damage from subsequent champion regeneration; the ally-Heal browser test accounts for elapsed regeneration while still requiring the intended 80-point heal.

## Respawn placement

Champion respawn placement now uses the unit's team, including non-player blue champions. Previously only the player used the blue spawn and every other champion used red. Structures and practice dummies continue respawning in place. Position and interpolation history both reset to the chosen spawn, resources refill, and combat orders, navigation, stun, slow, and retreat state clear through the existing respawn path.

Three additional simulation cases cover both champion teams at the exact deadline, checkpoint continuation immediately before respawn, cleared state, and unchanged dummy placement. The browser case checks both authored Rift fountains and confirms an enemy respawn remains hidden from the blue player's live vision. Champion base death timers now vary with player level as described below; exact match-time scaling calibration, role rules, fountain protection, and complete respawn presentation remain unfinished.

## Base death duration by level

The standard PC Rift mode `Maps/Shipping/Map11/Modes/CLASSIC` points to DeathTimes record `{9de5b46c}` in the pinned 16.18 map data. PRACTICETOOL selects the same record. Its level 1–18 base durations are **10, 10, 12, 12, 14, 16, 20, 25, 28, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50, 52.5 seconds**. These now replace the fixed ten-second champion deadline. Non-player champions remain level-one prototypes until independent progression exists. The level is sampled at death; subsequent progression does not revise an existing deadline. The simulation retains half seconds, and the existing HUD rounds the remaining countdown upward.

[Map data](https://raw.communitydragon.org/16.18/game/data/maps/shipping/map11/map11.bin.json) supplies the complete table. [Riot's patch 14.16 notes](https://www.leagueoflegends.com/en-ph/news/game-updates/patch-14-16-notes/) corroborate levels 1–9. The newer [26.16 notes](https://www.leagueoflegends.com/en-gb/news/game-updates/league-of-legends-patch-26-16-notes/) include death-timer changes under the separate Classic mode section; they must not overwrite the standard Rift table merely because its internal identifier also says CLASSIC. Swiftplay selects `{e7d5d256}`, a different table.

`docs/reference/champion-death-times.json` retains the whole selected record, mode link, source URL and SHA-256. Run `python3 tools/assets/export-champion-death-times.py` from the project root with the cached map present to verify the source bytes, selection and record before generating `src/content/champion-death-times.ts`.

### Match-time scaling

The generated data now includes the three scaling points, 30-second increment interval, and 1.5 multiplier cap. Runtime interpretation uses cumulative bands: 0.425% per interval after 15 minutes through 30 minutes; 0.3% thereafter through 45 minutes; then 1.45% until the total multiplier reaches 1.5. Completed bands retain their contribution. Explicit scaling points take precedence over the legacy 600-second start and 0.005 increase. This follows the structure of the selected record, but is an inference about runtime evaluation, not proof from a reference client capture.

The current boundary policy counts a started interval with `ceil`, with no increment at a band's exact start. The base and multiplier are sampled at death, then the final duration is rounded up to a 60 Hz simulation tick. Generated rate constants normalize source float noise to eight decimal places; a final eight-decimal tick rounding removes arithmetic noise before the ceiling. Existing deadlines remain fixed even when the match crosses another band. The cap is interpreted as 150% of base, not 150% added. A level-18 death at 30:00 therefore waits 3,552 ticks (59.2 seconds); at 45:00 it waits 3,836 ticks; the cap is 4,725 ticks (78.75 seconds). Non-player level-one prototypes also receive the time multiplier. Structures and dummies use their separate deadlines.

**The source establishes the numeric fields. Cumulative evaluation, precedence, rounding, and deadline sampling remain explicit implementation policies pending reference verification.** Role/quest modifiers are still absent. These limitations must remain visible when assessing fidelity; the local tests verify our chosen policy, not Riot runtime parity.

Next verification should record standard Rift deaths at a fixed champion level immediately before, at and after 15:00, 15:30, 30:00, 45:00 and the cap, with role/quest state recorded. Compare actual death-to-respawn timestamps as well as the rounded HUD. Repeat with more than one level and with deaths spanning a scaling boundary to distinguish sampling at death from a changing deadline. Keep these observations separate from the local regression suite.

Three simulation cases cover the complete table, an exact half-second deadline and restored continuation, and separation from other champions' provisional level. A browser case checks the level-18 countdown from 53 to 1 and its disappearance at respawn. Existing team-fountain and dummy respawn cases remain in place.

Three additional simulation cases cover scaling boundaries and cap, a saved death spanning the initial scaling boundary, and both champion teams without affecting dummy timers. An additional browser case checks the capped level-18 countdown and exact expiry. No snapshot field is needed: the existing absolute respawn deadline already persists the result.

## Focus state on death

Player death now immediately clears Focus stacks, their expiry, and the active Q deadline. Previously those fields remained until their ordinary timers expired, so the dead player's HUD could still show a charged or empowered Q. Already released arrows continue traveling and dealing damage, but cannot grant Focus while their source is dead. This is a targeted lifecycle policy for the current Ashe prototype; it does not establish complete reference parity for Q stacking, decay, active duration, or death-persistent effects. Cooldowns and inventory retain their existing behavior. Summoner Heal's reduction timer remains separate and is not cleared by this change.

Two simulation cases cover immediate cleanup, cooldown/inventory retention, saved respawn continuation, and damage from an arrow landing after death without posthumous Focus. A browser case verifies that charged pips and the empowered Q indicator disappear when the death overlay appears.
