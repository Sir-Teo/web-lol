# Leona implementation

Target: standard PC Summoner's Rift 26.18, frozen Riot build 16.18.8175716.
The canonical source package, payload calculations and a non-player development
simulation fixture for melee attacks and Q are implemented. Leona's complete
playable kit, player selection, bot policy and presentation remain required work.
This partial fixture does not establish native behavior or roster acceptance.

## Retained source and reproducibility

`reference/leona/character.bin` retains all 24,399 source bytes. The manifest,
archive, bundle ranges and hashes are in `reference/leona/character.json`, along
with the complete 51-record decode. `names.json` is the original naming export;
`ddragon-16.18.1.json` is the original versioned client response. Existing research
cache files remain untouched. A complete offline BIN decode compares every
record, number, list and field; names may align only at matching lowercase FNV
hashes. Numeric dictionary keys use their JSON string representation.

Rebuild or verify the exports using Python's standard library:

```sh
python3 tools/assets/export-leona-kit.py
python3 tools/assets/export-leona-kit.py --check
```

The first command writes `src/content/leona-progression.ts`,
`src/content/leona-spells.ts` and `reference/leona/declared-values.json`. The second
checks identical bytes without writing. Both reject changed frozen input hashes,
rank indexing, formula shapes or the known source disagreements. CDTB is needed
only for the independent BIN decode. In the existing asset-tool environment:

```sh
PYTHONPATH=.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/verify-leona-character.py
```

That command performs no network access. Append `--archive-output` and a fresh,
nonexistent output directory to repeat extraction through the pinned Riot
manifest and compare its bytes and provenance too. Asset dependencies remain in
`tools/assets/requirements.txt`; the recorded CDTB checkout is
`ba981db2a2c814a0d78e55f6483e0636b527850f`.

## Value selection

Cooldown and named-value arrays use source indices 1 through the learned rank
count. Mana arrays start at index 0. Thus R rank three costs 100 mana; the zero
after that is not its rank-three cost. Q/W/E have five ranks and R has three.
Unlearned ranks must be handled by command validation; the payload functions
reject rank zero, fractional ranks, nonfinite ranks and extended-mode ranks.

| Ability | Exported damage by rank | AP ratio | Other declared values |
| --- | --- | --- | --- |
| Q, Shield of Daybreak | 10 / 35 / 60 / 85 / 110 bonus magic | 0.3 | Attack reset tag; one-second stun |
| W, Eclipse | 55 / 85 / 115 / 145 / 175 magic | 0.4 | 8 / 12 / 16 / 20 / 24 flat reduction; 50% cap; three-second resistance duration |
| E, Zenith Blade | 50 / 90 / 130 / 170 / 210 magic | 0.4 | Half-second root; cannot cast while rooted |
| R, Solar Flare | 150 / 225 / 300 magic | 0.8 | 80% slow; 1.75-second crowd control; 1,200 cast range |

The generated constants retain source float32 precision. The rounded ratios in
this table describe the intended coefficient, without changing exported bytes.
`simulation/leona-spell-values.ts` computes magic payloads and resources. Q's
bonus magic damage remains separate from the basic physical hit. W adds
20 / 27.5 / 35 / 42.5 / 50 armor and magic resist, plus 20% of the corresponding
bonus resistance supplied by its caller. That input must exclude Eclipse's own
bonus. Its formula references `ArmorBaseBonus` for both resistance calculations;
the two named base arrays are equal and remain retained separately in the audit.
The helpers do not schedule casts, apply shields/reduction or select targets.

## Melee and Q development simulation

`World.spawn('champion', team, point, 'leona')` is permitted only on the
development practice battlefield. It creates Leona's own stats, mana and an
unlearned kit. Constructor/player selection, ordinary Rift spawning and browser
save loading reject this incomplete fixture. Missing presentation fails
explicitly; it never substitutes an Ashe model or animation. W/E/R commands
return a development message before entering any other champion's spell path.

After learning Q, a World cast command validates mana, cooldown, silence and
stun. Activation costs mana, starts a haste-adjusted cooldown, cancels recall and
resets the ordinary attack timer. Existing roots and slows remain. The next
valid attack captures its Q rank and activation tick. It deals the ordinary
physical hit, then Q's separate magic payload and a one-second stun. Critical
damage affects the physical portion only. Dead targets cannot take a second
payload; structures/wards cannot be stunned. Shields, shared Courage tenacity,
kill credit and target loss use the existing combat paths.

An already committed Q can finish through movement orders, a later stun or
empowerment expiry. Target loss cancels the attack and retains an unexpired
empowerment. Death/victory clear the state. Q's release clears the ordinary
attack cooldown: a fresh explicit attack order can start the next swing, while
automatic attacks wait through recovery. A movement order queued during windup
resumes after contact. Flash retains the committed swing through the shared
order path; native displacement/contact behavior still needs comparison.

The source attack child now exports its explicit 0.25-second cast and the
uncancellable/disabled-release declarations separately from its legacy timing.
`leona-combat-policy.ts` makes the remaining **provisional local policies**
visible: a six-second empowerment, +50 attack range, the conventional basic
windup calculation, fixed fifteen-tick Q windup and a 53-tick automatic cycle.
The cycle is a local recovery adapter; no native recovery, input reset timing or
attack-speed equivalence is certified. These policies require native comparison
before player/production acceptance. They must not be mistaken for additional
fields recovered from the character BIN.

Schema 116 saves the empowerment and captured activation/rank/release clocks.
It rejects foreign ownership, missing tuple members, changed durations,
unlearned ranks, inconsistent release/cooldown clocks and invalid battlefield or
player use. Tests compare restored futures before/after contact and across
expiry, stun and recovery cancellation. No gameplay random sample is added by Q;
ordinary critical rolls keep their existing place in the attack pipeline.

Sunlight application/consumption is **not implemented yet**, including on Q.
Ward-specific empowered-hit behavior and exact structure effects also remain
open. The fixture therefore does not certify complete Q/passive behavior.

Sunlight's playable-level damage is 32 through 151, in increments of seven.
The 31-entry source table has a dummy level-zero entry of 25 and extended-level
entries after level 18. Riot's [14.15 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-14-15-notes/)
corroborate the 32–151 endpoints and current W damage. Its frozen mark duration
is 2.5 seconds, corroborated by Riot's [25.09 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-25-09-notes/).
The versioned Data Dragon description still says 1.5 seconds. It is preserved
as conflicting text rather than used as the duration.

Leona's BIN declares 3 AD growth, while the frozen Data Dragon response says 0.
The progression export uses the BIN value and retains the disagreement. The
other 17 compared stats agree within float32 tolerance after unit conversion.
Attack-speed growth is converted once from 2.9 percent to a fraction. Health
and mana regeneration remain per second; Data Dragon reports per five seconds.
The basic attack has a cast-offset declaration, but omits Garen's explicit
attack-speed timing coefficient. No coefficient or release tick is invented.

## Geometry, legacy data and mode boundaries

| Source declarations | Treatment |
| --- | --- |
| W display range 450; raw cast radius 500 | Both retained distinctly. Actual explosion collision boundary remains to be established. |
| E root display range 875, legacy speed 1,200 and line width 80 | Retained in the source audit. These do not override the child missile declaration. |
| E child missile fixed speed 2,000, width 70, cast range 900; projects to cast range | Exported together as authored missile values. Whether width denotes collision radius and endpoint inclusivity remain behavior questions. |
| R primary radius 120 and secondary radius 300 | Retained as authored inner/outer radii; collision tests and native impact timing remain open. |
| Q root cast range 100 | A self-cast declaration, not evidence of an empowered attack-range increase. |
| Q attack child old damage/AP fields | Retained in full source; current root named damage/calculation drives the Q payload. |
| R on-hit damage/stacks/duration/range fields | Retained in source and audit, excluded from payload exports. The current frozen client tooltip describes the explosion and crowd control only. Active behavior must be established before adding any such effect. |
| R `cherry` AP override 1.0 | Retained in the audit; standard Rift payload uses 0.8. |

Cast-frame, explicit cast-time, legacy cast-time and animation fields remain
separate audit entries, including omitted values as null. No R impact delay,
W instantaneous cast policy or E dash speed is inferred from unrelated fields.
Q's provisional lifetime/range/recovery adapter is identified separately above.
R's `mSpellRevealsChampion=false` does not by itself
settle area vision or hit-reveal rules.

## Remaining executable acceptance

Every row below still has required work, including the partially implemented Q.

| System | Required implementation and evidence |
| --- | --- |
| Basic attacks and Q | Melee profile, source release timing and attack selection; reset and empowered window; range; separate physical/magic damage; stun/CC precedence; cancellation, target loss and consumption. |
| W | Cast/expiry/explosion order; actual radius; resistance recomputation on stat changes; flat reduction order, cap, damage-type exclusions and shields; hit-based extension and its exact affected bonuses. |
| E | Swept unique hits; last-champion selection; root recipients/timing; dash destination, terrain, target death, displacement and interrupts; Flash/cast overlap; no turret-aggro reset near walls. |
| R | Windup and delayed impact; center stun versus outer slow boundaries; cast-range clamping; reveal; shields/CC immunity, death and interruption behavior. |
| Sunlight | Ally-only consumption; refresh and ownership; repeated/multiple Leona interactions; minion/monster eligibility; contribution and kill-credit attribution; shields and blocked/zero damage. |
| Integration | Shared player/bot command validation; support-role decisions; HUD and input; strict saved states and restored futures; victory and respawn cleanup. |
| Presentation | Prepared rig/animation import, conservative animated bounds, source effects/audio, visibility and ownership, load/dispose/context recovery, native comparison and full-match performance. |

The future fixture must exercise these through World commands and strict saved
states, including failures and timing boundaries. Production selection and the
complete six-character milestone cannot pass from payload-only tests.
