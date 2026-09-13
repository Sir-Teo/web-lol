# Ashe Q fidelity

The prototype's Ranger's Focus active duration now uses six seconds from the standard Ashe spell record in pinned 16.18 character data. The tooltip derives its duration from the same generated constant. This corrects the previous four-second active window. [Riot's patch 13.5 notes](https://www.leagueoflegends.com/en-sg/news/game-updates/patch-13-5-notes/) explicitly increased the empowered duration from four to six seconds, corroborating the current source's `BuffDuration` data value.

The complete selected spell record is retained in `docs/reference/ashe-q.json`, with source URL and SHA-256. `python3 tools/assets/export-ashe-q.py` verifies the cached whole source and selected record before exporting the rank-independent duration. Rank-dependent attack speed and damage values and missile behavior remain available in that pin for subsequent work. Stack duration/falloff are now applied as described below.

Casting schedules an absolute deadline 360 simulation ticks later. Active attack-speed evaluation and the HUD already use a strict deadline comparison, so the buff ends on that exact tick. Existing attacks retain their scheduled cycles across expiry. Saves retain the original deadline, and death clears the active buff through the existing cleanup path.

The prototype still uses a fixed 1.4 attack-speed multiplier, lacks spell ranks and the complete five-arrow damage/animation behavior, and still grants Focus on arrow impact rather than a separately verified attack event. These remain fidelity gaps. Six-second duration alone does not establish complete Q parity.

One simulation test casts Q, verifies it remains active after four seconds and immediately before expiry, and compares saved continuation through the exact deadline. One browser test verifies the corresponding empowered HUD state. Existing attack-cycle and death-cleanup regressions remain relevant.

## Focus decay and active-window exclusion

The exporter now verifies the string-table source and selected legacy `game_spell_tooltip_asheq` alongside the complete spell record. The tooltip explicitly describes individual stack falloff and no Focus accumulation during Q. This is retained legacy text, not independently captured runtime evidence. Current spell `DataValues` supply four-second `StackDuration`, one-second `StackFalloffDuration`, and four `MaxStacks`.

The implementation removes the first stack at the four-second deadline and one additional stack each second thereafter. The existing `qStackExpiry` field now stores the next decay deadline; after the final stack it resets to zero. A new eligible impact adds a stack up to the cap and refreshes the full four-second window. Active Q blocks new Focus, and casting clears the old stack deadline. Death cleanup remains unchanged. No additional snapshot field is required; source-version matching handles saves from older implementations.

Exact first-falloff timing and same-tick impact/expiry ordering remain authored policy pending reference capture. The simulation processes impacts before decay, so an impact on the expiration tick refreshes the window. Stack generation is still impact-based; attack-release timing, target restrictions, canceled attacks and complete Q rank/flurry behavior require further work.

Three additional simulation cases cover individual decay, saved continuation, impact refresh, and active-window damage without stacks. A browser case verifies the pips falling from four to three to two rather than disappearing together.
