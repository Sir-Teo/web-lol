# Champion recovery and bot retreat

All living champion prototypes now receive health and mana regeneration, including allies and enemies. The player uses its source-backed Ashe level-growth factors; other champion prototypes currently use level-one Ashe regeneration because independent bot leveling is not implemented. Dead champions do not regenerate. Non-champion regeneration retains its separate rules.

Within 220 center-distance units of a champion's own team spawn, the existing fountain policy restores 9% maximum HP and 12% maximum mana per second. An opposing team's fountain does not grant that bonus. These radius/rate values were already used for the player and remain provisional, not newly verified source values. Ordinary regeneration outside the fountain comes from the pinned Ashe data. The old bot-only addition of 20 HP per AI decision near red spawn has been removed, so healing no longer depends on the bot decision frequency.

The current tactical bot starts retreating below 22% health and remains in that state until reaching at least 85%. It replaces unrelated movement orders with a move toward its own team's spawn and waits within 100 units of home while recovering. This prevents leaving the fountain as soon as the initial low-health threshold is crossed. The 22%/85% thresholds and waiting radius are authored bot policy, not a claim about Riot's bot AI.

`aiRetreating` persists in snapshot version 9 and clears on respawn. This state is independent of current movement orders, so arrival, an idle order, or checkpoint restoration cannot accidentally end recovery. Full team strategy, safe retreat-route selection, enemy-fountain danger, recall decisions, mana-driven retreats, purchases, role assignments, and independent bot progression remain unfinished.

Four new simulation cases cover each team's recovery, waiting until healthy, saved continuation, replacing unrelated move orders, ordinary regeneration at an opposing fountain, and death exclusion. Existing damage tests now distinguish damage from subsequent champion regeneration; the ally-Heal browser test accounts for elapsed regeneration while still requiring the intended 80-point heal.

## Respawn placement

Champion respawn placement now uses the unit's team, including non-player blue champions. Previously only the player used the blue spawn and every other champion used red. Structures and practice dummies continue respawning in place. Position and interpolation history both reset to the chosen spawn, resources refill, and combat orders, navigation, stun, slow, and retreat state clear through the existing respawn path.

Three additional simulation cases cover both champion teams at the exact deadline, checkpoint continuation immediately before respawn, cleared state, and unchanged dummy placement. The browser case checks both authored Rift fountains and confirms an enemy respawn remains hidden from the blue player's live vision. Champion death timers are still a fixed ten-second approximation; level/time scaling, role rules, fountain protection, and respawn presentation remain unfinished.
