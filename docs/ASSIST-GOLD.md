# Assist-gold reconstruction

The game currently records damage and Hawkshot reveal assists but awards no assist gold. This audit preserves a concrete cross-version discrepancy that must be resolved before using an early-game payout formula. It does not promote unnamed client fields to verified server behavior.

## Verified source data

[The reference pin](reference/assist-gold-audit.json) retains full bounty configurations, mode links and SHA-256 values for Map11 exports 15.24 and 16.18. Both standard modes link to `{4fd6b68d}`. Run `python3 tools/assets/verify-assist-gold-audit.py` against the cached source files to validate the records.

| Field | Standard 15.24 | Standard 16.18 | 16.18 URF / Swiftplay / Ultimate Spellbook |
|---|---:|---:|---:|
| `{11f10a40}` | 90 | 55 | 90 |
| `{937cc95a}` | 210 | 175 | 210 |
| `{08c1b120}` | 0.25 | 0.25 | 0.25 |
| `{1eacb90a}` | 0.5 | 0.5 | 0.5 |
| `{ce073fe8}` | 1 | 1 | 1 |

The two candidate time fields moved earlier by 35 while retaining a difference of 120. These are observed numeric differences. Their units, their role in the payout calculation, and interpolation semantics remain unverified. The CommunityDragon field-name dictionary checked in this audit contains no names for these five hashes; its exact downloaded revision is identified by SHA-256 in the pin. [Source dictionary](https://raw.githubusercontent.com/CommunityDragon/Data/master/hashes/lol/hashes.binfields.txt)

Thus a remembered 90–210-second ramp cannot be copied into the current standard mode solely because those numbers still occur elsewhere in Map11. Conversely, proximity to plausible timers and multipliers is not enough to implement a 55–175-second ramp as fact. Pinning the record proves values and mode selection, not private server evaluation.

## Reward dependencies established by official documentation

Riot's 14.21 bounty overhaul distinguishes positive bonus gold for the killer from negative bounty devaluation, which also affects assist gold. It also explains that gold paid to assisters influences the victim's subsequent value. Those relationships require separating the assist pool from a kill's final gold event and recording the complete death transaction. Historical coefficients need reconciliation against later patches. [Official 14.21 bounty notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-14-21-notes/)

First blood is an additional reward specifically to the killer under the 26.1 notes. It must not accidentally enter an assist calculation through the existing combined gold event. [Official 26.1 notes](https://www.leagueoflegends.com/en-sg/news/game-updates/patch-26-1-notes/)

The same patch's **Game Start Time** section says most miscellaneous opening systems begin 35 seconds earlier. That corroborates the observed cross-version shift from 90/210 to 55/175, but does not name assist gold or distinguish an absolute endpoint from a duration. Treat it as supporting evidence for the timing hypothesis, not confirmation of the formula. [Official timing changes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/)

## Discriminating capture design

Use the following candidate models to choose informative observations. These are predictions to falsify, **not runtime rules or native measurements**. For this initial experiment only, assume a level-one victim worth 300 gold, one eligible assistant, no first blood and no prior bounty history. Both models hypothesize that the pool rises linearly from 25% to 50% of that base value.

| Candidate | Interpretation of 55 / 175 | 55 seconds | 115 seconds | 175 seconds | 230 seconds |
|---|---|---:|---:|---:|---:|
| A | Start time / absolute end time | 75 | 112.5 | 150 | 150 |
| B | Start time / duration | 75 | 100.714286 | 126.428571 | 150 |

The 115- and 175-second observations discriminate the models; a late-game capture alone cannot. Also capture just before and after 55, 175 and 230 seconds to locate transitions. Use the reference client's reported timestamps and their uncertainty; do not assume its tick rate matches this simulation's 60 Hz. If neither candidate fits, retain the observation and reject both rather than fitting a new constant from one sample.

For every capture, retain the original clip and a row containing build/region/hotfix cutoff, mode, observed death time, victim level and prior reward history, killer and assistant IDs, contribution type and last contribution time, each recipient's gold before/after, ambient-income interval, and uncertainty. Avoid purchases, passive gold items, runes and role rewards that can contaminate the delta. Record any unavoidable modifier explicitly. HUD integer differences cannot resolve fractional division or rounding; mark those conclusions unresolved when no finer observation is available.

After the timing experiment, vary one factor at a time:

| Case | Comparison or failure it detects |
|---|---|
| Two and three assistants | Equal division, fractional handling, total pool conservation |
| Victim levels 6, 7 and 18 | Whether the pool follows level-dependent base gold |
| First blood versus a later neutral kill | Whether first-blood bonus is excluded from the pool |
| Positive and negative victim bounty states | Shutdown exclusion versus devaluation; cannot be tested with the current local bounty model |
| Damage plus Hawkshot from one champion | One recipient despite multiple contribution types |
| Dead or distant assistant versus a nearby non-contributor | Contribution eligibility remains separate from proximity XP |
| Turret/minion final blow with credited killer | Killer exclusion, assistant eligibility and execution reward ordering |
| Just inside/outside each contribution window | Independent damage and reveal expiry policies |

The local acceptance suite should replay the same captured inputs, check every recipient's delta and emitted gold event, and compare uninterrupted versus restored execution. Expected amounts must come from the resolved reference policy, not be generated by the function under test.

## Next evidence and implementation contract

Measure an isolated one-assistant kill in the pinned standard mode at times bracketing 55, 90, 175 and 210 seconds. Keep champion levels, items, runes and prior reward history fixed; record fractional starting balances and account separately for ambient income. Repeat with two assistants, a high-level victim, a devalued victim and a positive bounty. Include a first-blood pair to establish which components affect the pool. Retain the exact client build and hotfix cutoff.

The calculation needs independently resolved inputs: eligible unique assistant IDs, victim base value after applicable devaluation, excluded bonuses, match-time adjustment, recipient division and rounding. Damage and reveal contribution types must deduplicate into one recipient. Dead or distant assistants must follow contribution eligibility rather than being silently replaced by the XP proximity list.

Capture these inputs before awarding XP or changing bounty state. Apply each recipient's gold once, emit team-scoped feedback, and update future bounty accounting from explicit reward categories. Save continuation must reproduce the same result at timing boundaries and during posthumous kills. Do not derive payouts from HUD-rounded balances or from the already combined killer gold event.

Remaining uncertainties are a research task, not a claim that the overall project is blocked. Champion XP and recent-damage execution attribution now have runtime implementations with documented limits; support contributions, assist payouts and full bounty state remain outstanding. See [champion rewards](CHAMPION-KILL-XP.md) and [progress](PROGRESS.md).
