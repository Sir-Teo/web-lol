# Local bot combat and remaining match work

The current sparring champion uses local decision rules, not a reconstruction of Riot's bot AI. It can navigate, select visible valid targets, attack, move during attack recovery and retreat to its team's fountain. Decisions run every 18 simulation ticks. The map/vision/navigation and combat state machines remain authoritative; bot logic issues normal orders.

## Close-range attack correction

Previously, a champion target within 380 units caused retreat whenever the bot was not in a windup, including when an attack was ready. A pursuing opponent could therefore keep the bot fleeing without firing. The bot now attacks when ready and considers moving away during cooldown recovery. A valid committed windup is retained rather than canceled merely because another opponent becomes nearer. Hidden/invalid targets still cancel normally, and low-health retreat can interrupt a windup. If the opponent occupies the exact same point, the bot uses the direction toward its team's fountain instead of a zero-length escape vector.

The current 380-unit proximity threshold, 180-unit escape order and health retreat thresholds are local heuristics. This change does not claim native bot behavior or a complete tactical policy. Terrain, tower safety, incoming spell prediction, coordinated focus and lane objectives still need additional decision logic.

Six deterministic regression cases cover ready attacks at close range, commitment through a nearer target, repeated firing during pursuit, cancellation when vision is lost, low-health retreat plus saved-state determinism, and escape direction for coincident opponents. The first three failed against the prior behavior. A Chrome scenario exercises the real simulation/renderer, observes repeated projectiles/damage and recovery orders, and confirms that rendering a paused windup leaves simulation state unchanged. Its inspected capture is `artifacts/browser-bot-kiting.png`.

## Shared champion commands and remaining match work

Each champion owns an independent `ChampionState` containing cooldowns, pending casts, Focus, ammunition, recall, progression and inventory. `World.player` remains the human record. Cast execution now accepts any champion through the same command validation, using that owner's resources and deadlines. Nonchampions cannot cast. Pending casts release from the owning unit, and source model cast/recall animation reads that record. Recall returns to the caster's team fountain. Rejection and recall messages carry the caster's team audience.

The sparring AI issues attack/movement orders and now queues Q, W and defensive Heal under the policies below. Other spells still require their own observation, reaction and tactical policies. Minion XP, level growth, ambient gold and last-hit gold/CS/kill credit now resolve independently; champion-kill XP and complete item builds still require further work. Full duels and 5v5 still require that progression work, jungle routes, coordinated objectives, complete kits/roster and full seeded-match completion/performance tests.

## Ownership verification

Five source/simulation cases verify mutable-record independence, per-owner charge/Focus deadlines including death, exact multi-owner snapshot continuation, rejection of missing/duplicate/foreign/malformed ownership and nonhuman cast chronology. A Chrome checkpoint scenario saves enemy resources through the real pause-menu action, reloads, advances independent deadlines and verifies that the human HUD remains bound to its own champion. Existing save failure/incompatibility and bot-kiting scenarios pass. The initial ownership milestone prepared independent records. Shared spell execution is now implemented; autonomous decisions beyond Q/W/Heal and complete AI item builds remain unfinished.

## Combat ownership

Basic attack releases now build the attacking champion's Focus, and active Q uses that champion's timer for attack speed, attack-cycle empowerment and captured projectile damage. The initial combat tests seed Q state to verify the shared attack machinery; subsequent command tests verify enemy Q activation directly. Projectile slow strength, natural regeneration and respawn timing resolve the owning champion's level instead of assuming every nonhuman champion is level one.

Orders, movement, attack starts and stun interruptions clear the appropriate champion's presentation state. Damage cancels the victim's recall. Death increments that champion's death counter and clears its pending cast, animation, recall and Focus while preserving cooldown and charge recharge deadlines. Match completion clears every champion's pending cast and animation before freezing simulation. Gold, kill/CS credit and minion experience allocation now use the owner records; champion-kill XP remains the legacy human-only approximation.

Four deterministic regressions cover enemy Focus accumulation with exact saved continuation, independent Q timing/damage, level-18 enemy Frost Shot, and enemy death cleanup/respawn timing with ongoing recharge. All four fail against the previous commit. These checks establish shared local rules, not native-client parity or a complete bot kit.

## Shared cast verification

Seven simulation cases exercise enemy W/E/R resource spending, windup release and exact saved continuation; independent cooldown rejection with team-private feedback; Q Focus consumption and attack reset; red recall returning to its own fountain; and level-scaled Heal during a pending Volley, with ally selection restricted to the caster's team. A Chrome case checks the enemy's source Volley and recall clips, restores its cast checkpoint without changing the human pose, observes actual damage, and checks damage interruption of recall. Existing human spell and recall browser scenarios remain part of focused regression coverage. No native-client parity is inferred from sharing these local mechanics.

## Ranger’s Focus decision

On its existing 18-tick decision cadence, a healthy bot with four Focus stacks considers Q against a currently visible, vulnerable enemy champion within attack range. It requires sufficient mana, no active Q and a ready personal cooldown. It waits through a committed attack windup, then activates during recovery so the ordinary Q reset can begin an empowered attack. Low-health retreat takes precedence. The decision restores an attack order if necessary and queues a normal cast command, processed and revalidated on the next tick. This is a local tactical policy, not Riot's native AI or a measured human reaction model.

Four simulation checks cover the queued activation/reset, exact checkpoint continuation, visibility/range/resource/retreat exclusions, windup preservation and stun rejection between decision and execution. The browser pursuit scenario runs ten simulated seconds from zero stacks and checks natural Q activation and empowered attacks, alongside continued kiting and paused-state preservation. Other abilities, prediction, tower safety and team coordination remain unfinished.

## Volley pursuit decision

On the existing decision cadence, after preserving a committed windup and considering retreat/Q, the bot may queue W against its nearest visible, vulnerable champion target beyond basic-attack range and within Volley range. The current nearest-target search remains limited to 1,150 units of edge distance. It requires its own available mana and cooldown, retains an attack pursuit order and copies the observed target position into the queued command. It does not lead movement or update that aim from hidden target state. A target disappearing after the decision does not cancel an already aimed ground cast. Stun/death/resource checks still apply when the queued command executes.

This conservative pursuit rule avoids replacing in-range basic attacks. It does not yet estimate projectile obstruction, predict dodges, weigh mana reserves or choose lane-clear targets, so it may waste a cast into intervening units. Four simulation cases cover owned delayed release with exact checkpoint continuation and actual hit/slow, visibility/resource/range/retreat exclusions, aim retention after lost sight, and intervening stun. A Chrome case checks the autonomous source animation, pending cast, damage/critical slow and independent cooldown.

## Fountain purchases

The shared `buy(itemId, championId)` operation now checks the buyer's team fountain, own balance, six-slot capacity and duplicate boots, then updates only that champion's stats and inventory. Omitted IDs retain the human shop API. Buying while dead remains allowed but health items only increase maximum HP until respawn; they no longer accidentally restore current HP. Missing champion IDs are rejected.

After its retreat handling, a bot inside its own 400-unit shop radius attempts one purchase per thinking decision from the local plan: Doran's Blade, Boots, Pickaxe, Long Sword. It saves for the next missing item instead of repeatedly filling slots with components. Returning bots still prioritize recovery while in the retreat state. Purchases survive checkpoints through the same champion state and unit stats. The current four-item catalog, prices/stats and this fixed plan are practice approximations; recipes, complete builds, selling, role choices and adaptive itemization remain outstanding.

Five simulation cases cover independent spending/stats, fountain and other rejection rules, dead purchases through respawn on both owners, deterministic automatic purchase continuation and saving/away-from-fountain behavior. A Chrome scenario verifies an automatic enemy purchase and checkpoint identity while the human inventory display and balance remain unchanged.

## Defensive Heal

On an AI decision tick, a champion below the existing 22% retreat threshold, outside its own 400-unit shop area, with Heal ready, queues Heal if a living enemy champion is currently visible within 1,150 units. The point is the caster's current position, so the shared Heal execution uses its existing lowest-health eligible ally fallback. Retreat movement remains active. Hidden/distant opponents, healthy state, home recovery and cooldown prevent this decision. Threat distance and health thresholds are local policy, not native AI reconstruction.

Defensive decisions now occur before pending-cast and stun handling, allowing Heal while disabled or casting as the shared spell rules permit. The 18-tick AI deadline advances even while stunned or winding up. Offensive/movement decisions still wait until those states permit them. Commands execute next tick and retain ordinary validation.

Four simulation scenarios cover defensive activation/haste with exact checkpoint continuation, stunned decisions without movement, Heal during Volley windup, and exclusion conditions. A Chrome case observes the bot's actual cast, health gain, haste deadline and independent cooldown while its stunned position remains unchanged. R, E and Flash decisions, threat damage estimation, coordinated healing and incoming-projectile anticipation remain outstanding.
