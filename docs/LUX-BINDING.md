# Light Binding source audit and root foundation

`reference/lux-binding.json` pins the 16.18 Lux root spell, missile child and shared Flash record, plus the 16.18.1 Data Dragon Q entry. Both binary-export responses were fetched and their hashes verified. The records are separate because their fields are not interchangeable. [Lux spell records](https://raw.communitydragon.org/16.18/game/data/characters/lux/lux.bin.json), [shared spells](https://raw.communitydragon.org/16.18/game/shared.cdtb.bin.json), [Data Dragon Lux](https://ddragon.leagueoflegends.com/cdn/16.18.1/data/en_US/champion/Lux.json)

The Q root spell's standard-mode named values specify 80/120/160/200/240 base damage for ranks 1–5, a 0.75 AP ratio and a two-second root. Its cast time is 0.25 seconds. Data Dragon describes up to two enemy units, with 50 mana and a ten-second cooldown at all ranks. The child missile specifies fixed speed 1,200, width 70, a weapon launch bone and range projection. It also carries older-looking coefficient/cooldown fields (0.9 and 12 seconds), which must not silently replace the parent spell's named damage calculation and Data Dragon cooldown.

Range metadata also differs: parent targeting range 10,000, displayed range 1,175, child range 1,300 and a 1,310-unit client targeter. These fields are preserved as evidence; the final flight distance, collision radius and indicator relationship still need reconciliation. The native secondary-hit mechanism and its visual change after the first hit remain unimplemented. This audit is not a complete projectile specification.

## Shared root state

Units now have a saved `rootUntil` deadline, distinct from `stunUntil`. `World.applyRoot` extends to the later deadline and rejects dead units, structures, invalid durations and ended matches. During root, movement orders remain queued but walking is blocked. In-range attacks, committed attack windups and ordinary spells continue. Expiry restores movement without issuing a replacement order. Respawn clears the deadline. This separation is consistent with Riot's fixes explicitly preserving basic attacks while rooted. [Riot patch 14.7](https://www.leagueoflegends.com/en-au/news/game-updates/patch-14-7-notes/)

Flash's pinned `cantCastWhileRooted` flag now participates in ordinary cast validation, before resource/cooldown consumption. A queued Flash can therefore be rejected if root arrives before execution. The emergency bot planner also avoids selecting Flash while rooted. Unit bars show `ROOTED`, with stun taking precedence when both restrictions overlap.

Snapshot version 35 requires the root deadline and rejects earlier formats. Five simulation scenarios cover saved expiry, attack continuity, non-movement casting, queued Flash validation, overlapping duration and respawn/invalid applications. A browser case checks the actual status, delivered attack and resumed movement; related Flash and save cases pass.

No existing playable spell applies root yet. Lux champion identity, Q dispatch, two-target collision, damage/passive integration and source effects/audio remain next integration work. Tenacity, cleansing, immunity, movement-spell exceptions and root-only interactions with channels/recall have not been audited. The generic deadline is a foundation rather than a complete crowd-control system.
