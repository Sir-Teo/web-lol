# Courage source contract

Courage's active defenses are integrated for Garen NPCs. Passive resistance
stacks, source presentation and native-client parity remain unfinished. Garen
is still excluded from player selection and the default roster.

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

## Active runtime adapter

W can be learned and activated by queued commands. Activation costs no mana,
starts the ranked cooldown (with existing item haste), cancels recall and
preserves movement orders and committed attacks. It grants the shield immediately,
with no attack reset or substitute Ashe/Lux cast animation. Existing silence and
stun gates reject activation; roots permit it and are not cleansed. These cast
permissions and instant activation remain a local adapter pending native tracing.

The shield samples rank and bonus health at activation. Bonus health is current
maximum health minus Garen's base plus level-growth health; negative values are
clamped to zero. Physical/magic damage is mitigated by resistance and then the
captured W reduction before shields absorb it. True damage bypasses those
reductions but can be absorbed by the shield. No current damage source represents
an execution or fountain exception, so those cases are not claimed as supported.

Tenacity samples the independent upfront deadline when a root, silence, slow or
Crystal Arrow stun is applied. Existing controls are unchanged; removing the
shield or expiring W does not lengthen an already shortened control. Slow strength
is unchanged. The local duration policy rounds to 60 Hz, uses a 0.3-second minimum,
and never lengthens an originally shorter control. This minimum and rounding,
continuous-zone refresh behavior, additional control categories and special-case
exceptions still need version-matched native validation. These rules are explicit
adapter choices, not proved by the exported numeric values.

Snapshot version 71 stores the captured rank and both deadlines. It rejects
foreign/dead ownership, unlearned ranks, future starts, expired defense state and
changed duration relationships. Shields use the existing independent shield
records. Death and respawn clear the active buff. Bots use a temporary Q-then-W
learning order instead of inheriting Ashe's recommendation; defensive W decisions are described below.

Ten simulation cases cover the independent deadlines, resource/cooldown behavior,
mitigation order and true damage, bonus-health basis, rank capture, tenacity and
its boundary cases, Q coexistence, cast rejection, death and checkpoint integrity.
The browser scenario uses an actual queued Lux Q: Courage absorbs its damage and
reduces the root to 48 ticks. Shield expiry leaves both the captured root and the
remaining defense window intact, with identical save continuation. The reviewed
fixture capture is `artifacts/browser-garen-courage-binding.png`.

No Courage-specific particles or source audio are added in this increment. The
existing generic cast tone and shared damage/status presentation remain temporary.

The follow-up Volley regression also checks the legacy slow diagnostics used by
movement. Actual Frost, critical Frost and Crystal Arrow splash now shorten those
clocks with the same sampled tenacity as their independent slow records. This
prevents a legacy timer from keeping the unit slowed after the reduced duration.

## Defensive bot decisions

On its existing think cadence, Garen observes hostile champion/turret attack
windups aimed at him and visible launched basic-attack missiles. It estimates
arrival against his current position and queues W only when arrival is more than
one tick away and within 42 ticks (the 45-tick shield window minus a small dispatch
margin). It does not inspect hidden attack intent, spend W solely on proximity,
or react to lane-minion attacks. The normal command path validates the queued
cast next tick; planning does not reset his attack or force an idle order.

Stun, silence, an unlearned W, cooldown and an existing Courage buff prevent the
plan. Visible windups that are currently stunned are ignored except for Garen's
already committed Q, which the combat adapter lets finish while stunned. Launched
missiles remain eligible after their source stops attacking. This is a local bot
policy, not a model of Riot bot behavior. Movement, skillshot trajectories and
teamfight threat aggregation remain improvements to make.

Four AI cases verify actual protected impact, deterministic queued-command save
continuation, launched missiles, hidden/other-target/distant threats, cast gates
and proximity without an attack. All 867 tests across 185 files pass. Production
build and the nested static-hosting smoke check pass; the existing large-bundle
warning remains. That production smoke covers loading and existing Ashe/Lux flows;
Garen-specific gameplay is covered by the simulation and dedicated browser checks.
