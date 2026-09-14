# Courage source contract

This is preparation for W integration. W is still unavailable in the simulation;
these exported constants do not make Garen's kit complete.

`tools/assets/export-garen-w.py` reads only the root `GarenW` record in the
[frozen character pin](reference/garen-character.json). It checks the five-rank
declaration, self targeting and exact shield calculation shape. Arena/ARAM
overrides and rank-zero/extra array slots are excluded.

| Effect | Pinned value |
| --- | --- |
| Shield | 65/85/105/125/145 + 18% bonus health |
| Shield and tenacity window | 0.75 seconds |
| Tenacity | 60% |
| Damage reduction | 25/29/33/37/41% |
| Damage-reduction window | 4 seconds |
| Cooldown | 22/19.5/17/14.5/12 seconds |
| Passive resistance per stack / cap | 0.2 / 30 |

Original floating-point values remain in the generated module. The shield's
health basis is corroborated by [Riot's patch 12.10 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-12-10-notes/),
which changed its base values and explicitly retained bonus-health scaling.
The older Garen record pinned in the Q audit uses the old shield values and
`mStatFormula: 2` with health stat 11; the current record uses health stat 12
and the same formula ID. Neither supports treating this shield as maximum-health
scaling. Level-growth health must not be counted as bonus health.

This contradicts the `formula2: total` label in the historical calcrev decoder
previously cited for Q. That decoder's labels are research, not native execution
evidence. The Q audit now records this conflict. It is not enough to infer a
universal replacement enum, or Q attack-speed units, from one health calculation.

## Integration requirements

- Keep the shield/tenacity deadline independent of the longer reduction deadline.
- Verify damage-type exceptions and mitigation/shield order before wiring damage.
- Verify which controls tenacity shortens, minimum duration and application timing.
- Verify W's cast permissions during stun and an existing Q windup.
- Track passive stacks independently of ordinary CS; establish eligible kill
  classes, behavior before learning W, and death/respawn persistence.
- `NormalResistKillValue` has no values in the root source. Do not invent its value.
- Current named data does not contain the historical 10% bonus-resistance cap
  reward; do not import that old mechanic without additional current evidence.
- Preserve all active deadlines and passive stacks in validated snapshots.
- Add observed-threat AI, source visuals and browser verification with integration.
