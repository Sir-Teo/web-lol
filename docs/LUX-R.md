# Final Spark

## Source audit

`reference/lux-r.json` retains the parent R ability/spell, visual missile child and legacy `LuxRMis` record from the hash-verified 16.18 Lux response. The parent has rank 1–3 damage 300/400/500 plus 1.2 AP, mana 100 and standard cooldown 60/50/40 seconds. Arena/ARAM overrides, older child damage, reset-percent fields and visual-missile travel fields do not replace those standard values. [Pinned character response](https://raw.communitydragon.org/16.18/game/data/characters/lux/lux.bin.json)

Timing fields conflict: the parent declares 1.375 seconds with animator-frame flags; the legacy spell declares one second. Riot's unversioned 30 FPS demonstration shows initial pose change around frame 4 and the fired beam around frame 35, supporting approximately a one-second windup. The implementation uses 60 simulation ticks. This observation does not establish exact modern animation events or recovery timing. The reference pin includes the clip hash. The local timing contact sheet is `artifacts/lux-r-timing-sheet.png`. [Official demonstration](https://lol.dyn.riotcdn.net/x/videos/champion-abilities/0099/ability_0099_R1.mp4)

Geometry also remains provisional: the parent display range is 3340, its targeter 3410, input range 25000 and legacy range 3500. This adapter uses a 3340-unit beam and half of the parent's 190 line-width field as its collision radius. A swept capsule includes victim radius and rounded endpoint caps. Exact native length, width, endpoints and targeter alignment require controlled boundary comparisons; this is not a claim of verified native collision geometry.

## Cast and impact

Lux R can now learn through ordinary rank/level gates and cast through the command queue. The practice fixture unlocks rank one as it does for Ashe. The cast captures rank, AP damage, original position and full-length aim endpoint, spends its own mana/cooldown, cancels an unreleased attack/recall and waits one second. Movement orders can be retained during the windup. Stun applied after commitment does not cancel release; caster death does. Source `spell4` presents the cast.

At release, every living vulnerable enemy nonstructure intersecting the beam receives magic area damage, using current victim positions and resistance. Physical terrain and sight do not filter hits. Existing owner-specific Illumination triggers for additional magic damage, then surviving victims receive a refreshed six-second mark; unmarked victims receive a mark without an immediate passive proc. R does not root, stun or apply Ashe slow.

Flash is allowed during a committed R when its normal root/stun/cooldown rules permit it. Lux relocates while the beam retains its original origin and direction. The saved cast animation also persists. Riot explicitly documents this exception. [Patch 10.4](https://www.leagueoflegends.com/en-au/news/game-updates/patch-10-4-notes/)

## Presentation and persistence

Snapshot 39 validates champion-specific windup timing, R origin/endpoint geometry and retained beam identity/owner/lifetime. Saves can resume before release or during the short beam fade. The presentation retains a 0.3-second beam after impact, with a narrow warm charge ribbon beforehand. This is an interim procedural effect; it does not reproduce native particles, audio, rainbow layers, charging width indicators or height/weapon attachments. Enemy strips require both sampled endpoints to be visible; this coarse 64-segment visibility policy still needs native fog comparison. The effect grants no additional vision yet.

The Ashe ultimate planner explicitly excludes Lux. Her own R AI, native hit-area vision and the reported short-lived Illumination extension at R cast start remain unfinished. W/E, champion-selection UI and complete Lux production integration also remain open. Passive component ordering and impact-time AP sampling still need controlled reference comparisons.

## Validation

All 538 source/simulation checks pass. Five new R cases cover resource ownership/captured damage, all-target impact/passive refresh, saved windup and beam continuation, current hit positions/structure exclusion, committed stun/death behavior, malformed saves and Flash retaining the original beam. Three focused Chrome scenarios cover Lux Q/passive/recall and R's source animation, charge, impact, damage and effect cleanup. The in-match beam capture was inspected. Nested-path production smoke passes. Full browser, full-match and performance suites were not repeated.
