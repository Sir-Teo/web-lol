# Ashe Q fidelity

The prototype's Ranger's Focus active duration now uses six seconds from the standard Ashe spell record in pinned 16.18 character data. The tooltip derives its duration from the same generated constant. This corrects the previous four-second active window. [Riot's patch 13.5 notes](https://www.leagueoflegends.com/en-sg/news/game-updates/patch-13-5-notes/) explicitly increased the empowered duration from four to six seconds, corroborating the current source's `BuffDuration` data value.

The complete selected spell record is retained in `docs/reference/ashe-q.json`, with source URL and SHA-256. `python3 tools/assets/export-ashe-q.py` verifies the cached whole source and selected record before exporting the rank-independent duration. Rank-dependent attack speed and damage values, stack duration/falloff, and missile behavior remain available in that pin for subsequent work; they are not all implemented by this change.

Casting schedules an absolute deadline 360 simulation ticks later. Active attack-speed evaluation and the HUD already use a strict deadline comparison, so the buff ends on that exact tick. Existing attacks retain their scheduled cycles across expiry. Saves retain the original deadline, and death clears the active buff through the existing cleanup path.

The prototype still uses a fixed 1.4 attack-speed multiplier, lacks spell ranks and the complete five-arrow damage/animation behavior, and has incomplete Focus generation/decay rules. These remain fidelity gaps. Six-second duration alone does not establish complete Q parity.

One simulation test casts Q, verifies it remains active after four seconds and immediately before expiry, and compares saved continuation through the exact deadline. One browser test verifies the corresponding empowered HUD state. Existing attack-cycle and death-cleanup regressions remain relevant.
