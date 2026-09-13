# Champion-kill experience audit

The executable game still grants a flat 180 XP (or a unit override) to the human near a red champion death, within 1,400 units. It does not share this reward with nearby allies or award equivalent XP to red champions. The independently implemented minion sharing table must not be reused for champion deaths.

## Verified source records

The pinned 16.18 map SHA is `ad684528be94c3f6981daa2c1ff3e32724596a24e8c4f21ab8df8c291ca980f7`. Standard mode `Maps/Shipping/Map11/Modes/CLASSIC` links its experience curve to `{c6f6a84c}` and game constants to `{6cf687be}`. Full original records, including unnormalized floats and values beyond the currently supported level cap, are retained in [the reference pin](reference/champion-kill-xp.json).

Run `python3 tools/assets/verify-champion-kill-xp.py` to verify the source hash, both mode links, the complete curve, selected constants and the first ten published reward values. This is an asset/reference verifier, not a runtime payout test.

| Victim level | Base kill XP | Victim level | Base kill XP |
| --- | ---: | --- | ---: |
| 1 | 42 | 10 | 590 |
| 2 | 114 | 11 | 640 |
| 3 | 144 | 12 | 690 |
| 4 | 174 | 13 | 740 |
| 5 | 204 | 14 | 790 |
| 6 | 234 | 15 | 840 |
| 7 | 308 | 16 | 890 |
| 8 | 392 | 17 | 940 |
| 9 | 486 | 18 | 990 |

Riot's [13.4 release notes](https://www.leagueoflegends.com/en-gb/news/game-updates/patch-13-4-notes/) corroborate levels 1–10 and describe a 20% comeback increment per level difference beyond the first. The pinned `LevelDifferenceExperienceMultiplierPerLevel` array is `[0, 0.20000000298023224]`. The documentation supplies intended comeback behavior; it does not establish every runtime multiplier or negative level-difference rule.

The source `mExperienceGrantedMultForSharedKillPerLevel` array contains six entries of approximately 0.666, two of approximately 0.82, and one of approximately 0.90. Preserve these authored values rather than silently replacing 0.666 with the mathematical fraction 2/3. The record alone does not prove whether its level index is evaluated from victim or recipient, how its last entry extends to higher levels, or the exact order of shared-pool and comeback calculations.

The selected standard-mode constants are `ai_ExpRadius2 = 1600` and `aiExp_timeForKillCreditAfterDeath = 10`. The latter names credit after death: it must not be treated as an assist-contribution lifetime without additional evidence. Cumulative level thresholds in this curve also match the current level-1–18 progression formula.

## Required implementation boundary

A complete replacement needs a single death transaction that captures victim level and eligible recipients before any award levels a champion up. Eligibility must account for proximity, actual contributors outside proximity, dead contributors and their allowed posthumous interval, the killer, and duplicate membership. Champion damage, crowd control and ally support contribution rules need evidence and explicit state; transient presentation events are unsuitable because they expire and are discarded on checkpoint reload.

That contributor state must survive checkpoints with validated unit identities and timestamps. Respawn must clear contributions from the previous life. Awarding XP must neither revive a dead recipient nor alter an already-scheduled respawn deadline. Each recipient's level modifier must use its pre-award level, and capped recipients must have an explicitly verified effect on sharing. Executions and nonchampion final blows require a resolved killer/contributor policy rather than assuming the last damaging unit owns all rewards.

Verification must include both teams, solo equal-level kills, each base-reward boundary, positive/negative level differences, multiple recipients with different levels, proximity boundaries, distant contributions, posthumous eligibility boundaries, expired contributions, execution attribution, support assists, checkpoint continuation and simultaneous deaths. Test assertions need to distinguish source-proven values from local interpretation.

This audit supplies the source curve and identifies the missing ownership transaction. It deliberately does not present an unverified sharing formula as native behavior. The existing flat runtime approximation remains a known fidelity defect until the complete eligibility and payout path is implemented.

## Implemented contribution foundation

Each champion now records the most recent positive damage tick from each opposing champion in `damageContributors`. Lethal damage is included, death retains the entries, and respawn clears them. Version 24 checkpoints validate unique opposing source identities and tick/death chronology, preserving this history without replaying visual events. Entries are bounded by distinct champions rather than growing for every attack.

This does not yet decide eligibility or award assists/XP. It does not track crowd-control-only or support contribution, infer an assist window, or resolve execution credit. Those rules still require the evidence and death transaction described above.

## Verified damage-assist window and counters

The standard mode's `Configs` list includes `{4fd6b68d}`, whose explicit `AssistDurationOverride` is 15 seconds. Its full record and map/link identity are pinned in `reference/assist-window.json`; `tools/assets/export-assist-window.py` verifies the record and generates the runtime constant. This is distinct from the ten-second XP credit-after-death constant. Hashed bounty fields in the same record are retained without assigning them speculative meanings.

Direct champion kills now increment every other eligible opposing damage contributor's assist counter exactly once. The runtime uses an inclusive 900-tick boundary; exact boundary inclusivity is a local discrete-time convention pending a matched native test. The killer is excluded, and nonchampion final blows do not yet resolve execution credit. Assist counters appear in the HUD and scoreboard and are persisted by version 25. No assist gold is awarded yet. Support contributions, including Heal and Hawkshot's special reveal assist behavior, remain outstanding; Riot's [9.1 notes](https://www.leagueoflegends.com/en-gb/news/game-updates/patch-9-1-notes/) document Hawkshot's distinct reveal-assist rule, which should not be inferred from damage history.

Hawkshot reveal assists are now integrated separately; see [Hawkshot reveal credit](ASHE-E.md#reveal-assist-credit). They use a ten-second contribution deadline and deduplicate with damage assists. Heal support credit, execution attribution, assist gold and the complete XP payout transaction remain outstanding.
