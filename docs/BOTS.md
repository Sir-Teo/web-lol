# Local bot combat and remaining match work

The current sparring champion uses local decision rules, not a reconstruction of Riot's bot AI. It can navigate, select visible valid targets, attack, move during attack recovery and retreat to its team's fountain. Decisions run every 18 simulation ticks. The map/vision/navigation and combat state machines remain authoritative; bot logic issues normal orders.

## Close-range attack correction

Previously, a champion target within 380 units caused retreat whenever the bot was not in a windup, including when an attack was ready. A pursuing opponent could therefore keep the bot fleeing without firing. The bot now attacks when ready and considers moving away during cooldown recovery. A valid committed windup is retained rather than canceled merely because another opponent becomes nearer. Hidden/invalid targets still cancel normally, and low-health retreat can interrupt a windup. If the opponent occupies the exact same point, the bot uses the direction toward its team's fountain instead of a zero-length escape vector.

The current 380-unit proximity threshold, 180-unit escape order and health retreat thresholds are local heuristics. This change does not claim native bot behavior or a complete tactical policy. Terrain, tower safety, incoming spell prediction, coordinated focus and lane objectives still need additional decision logic.

Six deterministic regression cases cover ready attacks at close range, commitment through a nearer target, repeated firing during pursuit, cancellation when vision is lost, low-health retreat plus saved-state determinism, and escape direction for coincident opponents. The first three failed against the prior behavior. A Chrome scenario exercises the real simulation/renderer, observes repeated projectiles/damage and recovery orders, and confirms that rendering a paused windup leaves simulation state unchanged. Its inspected capture is `artifacts/browser-bot-kiting.png`.

## Shared champion commands and remaining match work

Each champion owns an independent `ChampionState` containing cooldowns, pending casts, Focus, ammunition, recall, progression and inventory. `World.player` remains the human record. Cast execution now accepts any champion through the same command validation, using that owner's resources and deadlines. Nonchampions cannot cast. Pending casts release from the owning unit, and source model cast/recall animation reads that record. Recall returns to the caster's team fountain. Rejection and recall messages carry the caster's team audience.

The sparring AI still issues attack/movement orders only. Enabling its ability decisions requires a team-observation policy, reaction limits and tactical conditions; support for commands alone does not provide those. Minion XP, level growth, ambient gold and last-hit gold/CS/kill credit now resolve independently; champion-kill XP and purchasing still require further work. Full duels and 5v5 still require that progression work, jungle routes, coordinated objectives, complete kits/roster and full seeded-match completion/performance tests.

## Ownership verification

Five source/simulation cases verify mutable-record independence, per-owner charge/Focus deadlines including death, exact multi-owner snapshot continuation, rejection of missing/duplicate/foreign/malformed ownership and nonhuman cast chronology. A Chrome checkpoint scenario saves enemy resources through the real pause-menu action, reloads, advances independent deadlines and verifies that the human HUD remains bound to its own champion. Existing save failure/incompatibility and bot-kiting scenarios pass. The initial ownership milestone prepared independent records. Shared spell execution is now implemented; autonomous casting decisions and AI purchasing remain unfinished.

## Combat ownership

Basic attack releases now build the attacking champion's Focus, and active Q uses that champion's timer for attack speed, attack-cycle empowerment and captured projectile damage. The initial combat tests seed Q state to verify the shared attack machinery; subsequent command tests verify enemy Q activation directly. Projectile slow strength, natural regeneration and respawn timing resolve the owning champion's level instead of assuming every nonhuman champion is level one.

Orders, movement, attack starts and stun interruptions clear the appropriate champion's presentation state. Damage cancels the victim's recall. Death increments that champion's death counter and clears its pending cast, animation, recall and Focus while preserving cooldown and charge recharge deadlines. Match completion clears every champion's pending cast and animation before freezing simulation. Gold, kill/CS credit and minion experience allocation now use the owner records; champion-kill XP remains the legacy human-only approximation.

Four deterministic regressions cover enemy Focus accumulation with exact saved continuation, independent Q timing/damage, level-18 enemy Frost Shot, and enemy death cleanup/respawn timing with ongoing recharge. All four fail against the previous commit. These checks establish shared local rules, not native-client parity or a complete bot kit.

## Shared cast verification

Seven simulation cases exercise enemy W/E/R resource spending, windup release and exact saved continuation; independent cooldown rejection with team-private feedback; Q Focus consumption and attack reset; red recall returning to its own fountain; and level-scaled Heal during a pending Volley, with ally selection restricted to the caster's team. A Chrome case checks the enemy's source Volley and recall clips, restores its cast checkpoint without changing the human pose, observes actual damage, and checks damage interruption of recall. Existing human spell and recall browser scenarios remain part of focused regression coverage. No native-client parity is inferred from sharing these local mechanics.
