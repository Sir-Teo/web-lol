# Local bot combat and remaining match work

The current sparring champion uses local decision rules, not a reconstruction of Riot's bot AI. It can navigate, select visible valid targets, attack, move during attack recovery and retreat to its team's fountain. Decisions run every 18 simulation ticks. The map/vision/navigation and combat state machines remain authoritative; bot logic issues normal orders.

## Close-range attack correction

Previously, a champion target within 380 units caused retreat whenever the bot was not in a windup, including when an attack was ready. A pursuing opponent could therefore keep the bot fleeing without firing. The bot now attacks when ready and considers moving away during cooldown recovery. A valid committed windup is retained rather than canceled merely because another opponent becomes nearer. Hidden/invalid targets still cancel normally, and low-health retreat can interrupt a windup. If the opponent occupies the exact same point, the bot uses the direction toward its team's fountain instead of a zero-length escape vector.

The current 380-unit proximity threshold, 180-unit escape order and health retreat thresholds are local heuristics. This change does not claim native bot behavior or a complete tactical policy. Terrain, tower safety, incoming spell prediction, coordinated focus and lane objectives still need additional decision logic.

Six deterministic regression cases cover ready attacks at close range, commitment through a nearer target, repeated firing during pursuit, cancellation when vision is lost, low-health retreat plus saved-state determinism, and escape direction for coincident opponents. The first three failed against the prior behavior. A Chrome scenario exercises the real simulation/renderer, observes repeated projectiles/damage and recovery orders, and confirms that rendering a paused windup leaves simulation state unchanged. Its inspected capture is `artifacts/browser-bot-kiting.png`.

## Ability ownership is the next structural gap

`World.cast` currently rejects units other than `player.id`. Cooldowns, pending casts, Q stacks/buff deadlines, E ammunition, recall, level, progression and inventory are held in the single human `PlayerState`; several damage/animation paths also special-case that ID. Simply issuing a bot cast command cannot produce a correct independently timed opponent.

Before bot abilities are enabled, champion-owned combat/progression state must be separated from human input/HUD ownership. Existing player access should remain an explicit view of that champion's state. Every champion needs independent cooldowns/resources, pending casts, death/respawn resets and source-derived stats; snapshots must validate the ownership relationships and restore each timeline. Cast/release, attack empowerment, hit effects, presentation and reward attribution must consistently resolve the relevant champion's state. Bots should then submit the same validated commands using their own team's permitted observations and explicit reaction limits.

That work precedes a claim of complete duels or 5v5. There is still one sparring bot, not nine role-aware teammates/opponents. Jungle routes, coordinated objectives, purchasing, complete kits/roster and full seeded-match completion/performance tests remain part of the full production goal.
