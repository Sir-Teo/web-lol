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

## Next evidence and implementation contract

Measure an isolated one-assistant kill in the pinned standard mode at times bracketing 55, 90, 175 and 210 seconds. Keep champion levels, items, runes and prior reward history fixed; record fractional starting balances and account separately for ambient income. Repeat with two assistants, a high-level victim, a devalued victim and a positive bounty. Include a first-blood pair to establish which components affect the pool. Retain the exact client build and hotfix cutoff.

The calculation needs independently resolved inputs: eligible unique assistant IDs, victim base value after applicable devaluation, excluded bonuses, match-time adjustment, recipient division and rounding. Damage and reveal contribution types must deduplicate into one recipient. Dead or distant assistants must follow contribution eligibility rather than being silently replaced by the XP proximity list.

Capture these inputs before awarding XP or changing bounty state. Apply each recipient's gold once, emit team-scoped feedback, and update future bounty accounting from explicit reward categories. Save continuation must reproduce the same result at timing boundaries and during posthumous kills. Do not derive payouts from HUD-rounded balances or from the already combined killer gold event.

Remaining uncertainties are a research task, not a claim that the overall project is blocked. Complete champion XP, support contributions, execution attribution and the rest of the match economy remain separate outstanding work.
