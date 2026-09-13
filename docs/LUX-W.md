# Lux Prismatic Barrier

## Source and interpretation

The complete parent ability and five child spells are pinned in [reference/lux-w.json](reference/lux-w.json), from the hashed [16.18 Lux export](https://raw.communitydragon.org/16.18/game/data/characters/lux/lux.bin.json). Parent named values establish rank shields 40/55/70/85/100 plus 0.4 AP, duration 2.5 seconds, cast time 0.25 seconds, and cooldowns 12/11.5/11/10.5/10. [Data Dragon 16.18.1](https://ddragon.leagueoflegends.com/cdn/16.18.1/data/en_US/champion/Lux.json) corroborates costs 60/65/70/75/80. The parent mana array has no rank-zero prefix; the named shield/cooldown arrays do.

Outbound flight starts at 2200, decelerates at 2300 to 500, and uses child range 1175. Return starts at 50, accelerates at 1800 to 2400, and has a 25000 travel budget. Width 110 is provisionally interpreted as collision radius, consistent with the current binding adapter; parent display range 1150 is not silently substituted for child travel range. These interpretations still require native geometry measurements.

Riot documents a maximum of two shield applications in its [10.18 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-10-18-notes/). The [official champion page](https://www.leagueoflegends.com/en-us/champions/lux/) describes the wand protecting friendly targets. Neither establishes every callback boundary. The 26.17 shield timing change previously found belongs to League Classic and does not verify standard-mode timing.

## Current simulation

Normal W commands spend the owning Lux's mana, start its cooldown, capture rank/AP shield capacity, cancel recall and an unreleased attack, and enter a 15-tick windup. The first self shield is granted at cast start. Source Spell2 plays in the renderer. E remains unavailable; W can be learned normally or used at fixture rank one. The human champion remains Ashe, and Lux tactical shield AI is unfinished. Ashe's offensive Volley planner is explicitly restricted to Ashe.

Release creates an independently saved projectile. Its outbound direction is fixed; its return follows the caster's current position each tick. Swept champion-circle contacts shield living allies only, once per pass, without damage, CC, Illumination, or additional vision. The caster gets the second application at return-center arrival. A dead caster's position is retained as the return endpoint, and that caster receives no return shield. Death before release cancels the pending spell; death afterward preserves flight and allied shielding.

Return adds the captured shield amount to unconsumed capacity from the same cast and refreshes that grant to 150 ticks. A depleted or expired grant receives only the new amount. Independent casts/casters retain separate grants. Support applications use the existing support-contribution path; the shared assist window and eligibility still need native review. Shared [shield damage ordering](SHIELDS.md) applies.

Self-shield at cast start, same-cast refresh, collision radius, corpse-return behavior, exact center arrival and turn cadence are **provisional adapter policies**, not verified native behavior. Speed integration handles acceleration limits within each tick; the outward turn occurs at a tick boundary and discards that tick's unused travel time. Native wand, shield particles and W audio are unfinished. The visible projectile is temporary gold-colored geometry; the overhead white shield segment is shared UI.

Snapshot 41 retains pending capacity, flight phase/speed/origin, cast identity, pass hit histories and corpse return point. It validates compatible cast payloads, Lux ownership, allied participants, duplicate hits/grants, launch timing and bounded speed/travel state. Saves during windup, outbound or return resume identically to uninterrupted local simulation.

## Verification

All 551 source/simulation checks pass. Six new W tests cover captured resources/AP and saved windup; two-pass capacity, expiry and support; moving-caster return and outbound misses; depletion and separate casters; pre/post-release death; and malformed persistence. Four focused Chrome scenarios pass for Lux Q/recall, R, W and shared shields. The W scenario verifies source Spell2, both visible flight phases, projectile retirement and two self applications. Inspected `artifacts/lux-w-shields.png`; it is the diagnostic practice battlefield, not the production Rift reference scene. Nested-path production build/smoke passes. Full browser, full-match, native comparison and performance suites were not repeated.
