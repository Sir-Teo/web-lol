# Local bot combat and remaining match work

## Emergency Flash during retreat

A retreating bot below 12% HP, outside its 400-unit fountain area, can use a ready Flash when a visible vulnerable enemy champion is within 350 units. It evaluates four directions: away from the nearest threat, toward home, and 45 degrees to either side of escape. Each candidate uses the same terrain endpoint resolver as the actual spell. It must move at least 200 units, increase clearance from nearby visible enemy champions by at least 200 units, and avoid visible turret danger. Clearance dominates the score, with a smaller preference for proximity to home.

The selected point enters the ordinary cast queue; the bot holds its evaluated starting position until execution. Normal stun, death and cooldown validation still applies. Successful Flash consumes only that champion's cooldown and retains retreat state so movement resumes on the next decision. This emergency choice precedes defensive R.

Six simulation cases cover both teams' actual escape and exact saved continuation, health/visibility/range/cooldown/terrain/fountain exclusions, turret danger, a second enemy closing the escape direction, and an intervening stun. A Chrome case verifies the teleport, independent cooldown and resumed retreat. Thresholds and scoring are authored tactics, not native bot constants. This is endpoint selection, not full route planning or skillshot prediction; Flash does not disjoint existing homing missiles or confer invulnerability. Offensive Flash and broader tactical use remain unfinished.

## Hawkshot during lane travel

On the full Rift, a bot with learned E and both charges available can scout an unrevealed point ahead on its assigned lane. It scans authored waypoints in team-relative travel order, selecting the furthest qualifying point in that order between 1,350 and 4,000 straight-line units away. Current allied vision excludes already visible destinations. Hidden enemy locations are never inputs to this choice.

The bot queues the ordinary fixed-point E cast after choosing its lane movement order. Cast validation, source animation, travel, reveal and serial recharge remain shared gameplay rules. Movement pauses for the cast and resumes afterward. Requiring both charges preserves one for future tactical scouting and prevents routine travel from immediately emptying the charge pool. The distance thresholds and charge-reserve policy are authored tactics, not native AI constants.

Four simulation scenarios cover both teams' forward scouting, actual reveal with saved continuation, charge reservation, unchanged decisions across different hidden-enemy locations, and unlearned/already-visible exclusions. A browser case exercises the real Rift grid, the `spell3` source clip, arrival vision, one remaining charge and continued movement. Objective/camp scouting, last-seen target reactions, the tactical use of the reserved charge, and team coordination remain unfinished.

## Defensive Crystal Arrow during retreat

A retreating bot outside its 400-unit fountain area can now use R against a visible enemy champion within 650 units when that champion has a committed basic-attack windup targeting the bot or a visible basic-attack missile already headed toward it. This responds to observable attack cues rather than reading movement orders or assuming an idle nearby champion is pursuing. An already stunned attacker does not consume another defensive ultimate.

The shared ultimate planner retains the finishing tactic's rank, mana, cooldown, visible blocker and tower-safety checks. Defensive mode does not require lethal damage. It queues the normal fixed-point cast and preserves the retreat flag; after the cast delay, normal thinking resumes movement toward the fountain. As with existing low-health retreat, defense may cancel the bot's own windup. Stun and pending-cast execution remain governed by shared simulation rules.

Three simulation scenarios cover an actual nonlethal stun followed by escape with saved continuation, exclusion conditions, and a visible projectile cue after the attacker's windup ends. A browser case verifies the source `spell4` animation, stun, both champions surviving, and resumed fountain movement. The 650-unit threshold is local policy. The tactic does not infer unobserved pursuit, predict skillshots, peel for teammates, optimize crowd-control chains, or guarantee survival through every incoming attack. The existing retreat/recall safety limits still apply.

## Finishing Crystal Arrow

Bots can now use R against a visible vulnerable enemy champion within the existing 1,150-unit combat decision horizon when its current HP is at or below the ultimate's rank/AP damage after magic resistance. The spell must be learned, affordable and ready. Low-health retreat, a committed attack windup and current tower danger take precedence. The nearest qualifying unobstructed target is selected; minions do not hide the opportunity merely by being closer.

The decision sweeps the existing 65-unit missile radius against visible enemy champions and practice dummies, matching the current projectile's blocker categories. A nearer/equal intersection prevents the attempt; minions and structures do not block. Hidden blockers are not available to the planner and can still intercept the real missile. The shared radius constant avoids disagreement between simulation and prediction without claiming new native collision evidence.

The bot queues the ordinary cast command with a copy of the observed point. Mana, cooldown, stun and pending-cast rules still validate on execution. The aim does not follow a target after sight is lost. Source animation, delayed release, projectile collision, damage and kill attribution use the existing spell implementation.

Five simulation scenarios cover a saved queued cast through an actual kill, independent blue-team ownership, rank/resource/resistance/visibility/range exclusions, visible and hidden blockers, fixed aim and rejection after an intervening stun. A Chrome case verifies the `spell4` clip, pending R, actual projectile, kill and independent cooldown. This is an authored finishing tactic: it does not predict movement/regen/shields during flight, lead moving targets, consider multi-target splash value, initiate teamfights, peel for allies or perform long-distance scouting shots.

## Rift lane progression

On the full Rift, a champion with no current combat target now follows its assigned lane's authored points toward the opposing base. Existing `lane` and `laneWaypoint` fields retain the assignment in saves. Unassigned champions choose mid. Blue traverses forward and red backward. During uninterrupted travel the bot retains its waypoint, advances within a 150-unit arrival margin, and holds at the final endpoint. It uses the normal navigation/movement path and does not teleport between points.

After combat or returning to base, the bot chooses the nearest point on its assigned route and rejoins it before continuing forward. Retaining a waypoint during travel is essential: recomputing the nearest point every decision caused oscillation near the arrival margin in the first implementation. The short practice fixture retains its sparring destination; the full-Rift fixed midpoint has been removed.

Four simulation cases cover complete forward/reverse traversal, assigned-lane combat interruption plus checkpoint continuation, and base return without a direct shortcut to the old front. A browser case follows the actual Rift navigation grid beyond the previous fixed midpoint, with opponents disabled to isolate navigation. This is route execution, not a five-role assignment planner: unassigned bots still default to mid, the roster is unchanged, and coordinated pressure, jungle routes, wave objectives and strategic lane changes remain outstanding.

## Tower safety during combat and farming

Before preserving a windup or choosing a combat target, bots now check nearby visible living enemy turrets. A turret is treated as dangerous when it is targeting the bot, when the bot is about to attack a protected champion, or when no living allied lane minion is inside that turret's attack range. The local safety boundary is turret range plus champion radius plus 100 units. A bot inside it moves radially out to an additional 100 units of clearance; tower danger may interrupt a committed windup.

Before chasing a selected target, the bot also estimates the position at which its basic attack would enter range. If that position is protected, it holds instead of walking back into danger. Allied minion cover permits tower pressure, but champion aggression does not receive that exemption because it draws retaliation. Hidden and destroyed towers do not drive this decision. All state remains derived from current observations, so no new save fields are required.

This is an intentionally cautious local tactic, not a native AI reconstruction or a complete danger-aware navigation system. It does not forecast the remaining lifetime of the minion wave, score dives, use last-seen tower knowledge, search around overlapping danger circles, or validate an entire retreat path against tower zones. The pre-existing low-health fountain retreat remains separate. Safe ranged poke at a target whose basic-attack approach is dangerous still needs a separate decision. Those limitations remain team-planner work.

Six simulation cases cover stable unsupported disengagement with saved continuation, pushing behind minions and reacting to their death, tower focus interrupting a windup, newly revealed protection interrupting champion aggression, hidden/destroyed towers, and refusing a chase. A browser case exercises unsupported retreat and holding outside range. That fixture delays tower shots to isolate decisions; it does not certify survival against every tower attack sequence.

Target safety is now part of selection rather than a veto after choosing one opponent. The nearest-target, close-champion and last-hit searches consider safe attack positions, allowing a farther safe enemy or a covered minion last hit to win over a protected opponent. If all observed candidates are unsafe, the bot holds; it does not resume lane movement into the protected area. Three additional simulation regressions cover those alternatives and hidden-candidate exclusion, and a browser case observes actual pursuit away from the tower. Two of those scenarios reproduced idle behavior before this correction. Mobile-unit and turret targeting outside champion AI do not use this tactical filter.

## Visible last-hit choices

When a basic attack is ready and no valid windup is already committed, the champion bot now considers visible, vulnerable enemy lane minions within its current attack range whose present HP can be removed by the next attack impact after armor. Selection prioritizes their current gold bounty, then shorter travel distance. The damage estimate and actual damage resolution share the same resistance function. During Q, the estimate uses only the first arrow's damage; it does not assume the full staggered burst lands immediately.

A visible champion within the existing 380-unit close-threat threshold takes priority, even if a minion is closer. A committed valid windup remains protected by the earlier combat rule. Otherwise the existing nearest-target and recovery behavior remains available. This policy uses current team-visible observations; it does not predict from hidden minion HP or positions.

Five simulation scenarios cover both teams securing the farther last hit with exact checkpoint continuation, armor/visibility/range exclusions, high-value minion selection without interrupting a committed attack, close-threat priority, and conservative Q estimates. A browser scenario verifies target choice, delivered kill, CS/gold gain and the nearer minion retaining full HP.

This is a local farming heuristic, not a native bot implementation. Minion HP at impact, allied pending damage, deliberate waiting to freeze a wave, tower safety, lane assignments, and role-specific farm sharing still require tactical policies. In particular, a currently lethal target may die to another unit during windup or projectile travel; the bot does not yet forecast that race.

## Safe retreat recalls

Retreating champions now queue the shared recall command when distance to their fountain exceeds the distance they could walk at their base movement speed during the eight-second recall. The bot preserves an active safe channel across its 18-tick decisions rather than repeatedly resetting it. A visible approaching threat changes the order back to fountain movement, which cancels recall through normal order handling. Existing recall completion and fountain purchasing then let the bot recover and resume its plan.

The current local safety heuristic excludes visible living enemy champions within 1,150 units, other combat units within their attack range plus the bot's radius plus a 400-unit margin, and visible enemy targeted projectiles already headed toward the bot. It also waits two seconds after recorded enemy-champion damage. These checks use the bot's team visibility and its own damage history; nearby hidden opponents do not influence the decision. Pending recall commands retain normal stun, death and cast validation.

These are authored tactics, not native AI reconstruction or guaranteed safety. The travel comparison uses straight distance and base speed rather than a complete route cost. The recent-damage window uses existing champion contribution records; it does not yet track all environmental/minion damage. The current policy does not predict untargeted skillshots, remember last-seen danger zones, or find cover. Those remain part of the broader team/role planner.

Six simulation cases cover both teams' completion and saved continuation, visible/hidden threat handling, shorter-walk and minion exclusions, damage interruption/retry, and visible incoming missiles after their source leaves sight. A browser case runs the autonomous channel to completion, renders the active channel, verifies arrival/recovery, and checks that the bot resumes movement. Existing recall animation and bot combat browser scenarios remain passing.

The current sparring champion uses local decision rules, not a reconstruction of Riot's bot AI. It can navigate, select visible valid targets, attack, move during attack recovery and retreat to its team's fountain. Decisions run every 18 simulation ticks. The map/vision/navigation and combat state machines remain authoritative; bot logic issues normal orders.

## Close-range attack correction

Previously, a champion target within 380 units caused retreat whenever the bot was not in a windup, including when an attack was ready. A pursuing opponent could therefore keep the bot fleeing without firing. The bot now attacks when ready and considers moving away during cooldown recovery. A valid committed windup is retained rather than canceled merely because another opponent becomes nearer. Hidden/invalid targets still cancel normally, and low-health retreat can interrupt a windup. If the opponent occupies the exact same point, the bot uses the direction toward its team's fountain instead of a zero-length escape vector.

The current 380-unit proximity threshold, 180-unit escape order and health retreat thresholds are local heuristics. This change does not claim native bot behavior or a complete tactical policy. Terrain, tower safety, incoming spell prediction, coordinated focus and lane objectives still need additional decision logic.

Six deterministic regression cases cover ready attacks at close range, commitment through a nearer target, repeated firing during pursuit, cancellation when vision is lost, low-health retreat plus saved-state determinism, and escape direction for coincident opponents. The first three failed against the prior behavior. A Chrome scenario exercises the real simulation/renderer, observes repeated projectiles/damage and recovery orders, and confirms that rendering a paused windup leaves simulation state unchanged. Its inspected capture is `artifacts/browser-bot-kiting.png`.

## Shared champion commands and remaining match work

Each champion owns an independent `ChampionState` containing cooldowns, pending casts, Focus, ammunition, recall, progression and inventory. `World.player` remains the human record. Cast execution now accepts any champion through the same command validation, using that owner's resources and deadlines. Nonchampions cannot cast. Pending casts release from the owning unit, and source model cast/recall animation reads that record. Recall returns to the caster's team fountain. Rejection and recall messages carry the caster's team audience.

The sparring AI issues attack/movement orders and now queues Q, W, finishing R and defensive Heal under the policies below. Other spells still require their own observation, reaction and tactical policies. Minion XP, level growth, ambient gold and last-hit gold/CS/kill credit now resolve independently; complete item builds and role progression still require further work. Full duels and 5v5 still require that progression work, jungle routes, coordinated objectives, complete kits/roster and full seeded-match completion/performance tests.

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

## Shopping recalls while healthy

A healthy bot now considers returning when its fixed purchase plan has an unfinished item, it has inventory capacity, and banked gold reaches both that item's price and a 900-gold minimum. The minimum is a local policy intended to avoid frequent low-value trips, not a measured native bot constant. The same purchase-plan helper drives fountain buying and the recall decision, so a completed plan or full inventory does not trigger a useless trip.

Shopping uses the same team-visible threat, incoming-targeted-missile and recent-champion-damage checks as low-health recalls. It also requires distance greater than one recall's base-speed walking distance. A safe channel remains committed; new visible danger cancels it. A valid attack windup takes precedence over shopping. Completed recall uses normal purchases and returns to the existing lane/sparring plan without marking the bot as injured or adding new snapshot state.

Five simulation scenarios cover both teams' complete saved shopping trips, exclusion conditions, hidden/visible danger changes and committed-attack preservation. A browser case verifies a healthy return with 1,000 gold, the two purchases, their actual damage/movement stat gains, remaining balance, and resumed movement. This does not implement adaptive builds, recipe-aware future shopping plans, wave-timing costs, objective-aware recalls or coordinated team resets.

## Defensive Heal

On an AI decision tick, a champion below the existing 22% retreat threshold, outside its own 400-unit shop area, with Heal ready, queues Heal if a living enemy champion is currently visible within 1,150 units. The point is the caster's current position, so the shared Heal execution uses its existing lowest-health eligible ally fallback. Retreat movement remains active. Hidden/distant opponents, healthy state, home recovery and cooldown prevent this decision. Threat distance and health thresholds are local policy, not native AI reconstruction.

Defensive decisions now occur before pending-cast and stun handling, allowing Heal while disabled or casting as the shared spell rules permit. The 18-tick AI deadline advances even while stunned or winding up. Offensive/movement decisions still wait until those states permit them. Commands execute next tick and retain ordinary validation.

Four simulation scenarios cover defensive activation/haste with exact checkpoint continuation, stunned decisions without movement, Heal during Volley windup, and exclusion conditions. A Chrome case observes the bot's actual cast, health gain, haste deadline and independent cooldown while its stunned position remains unchanged. Broader Flash/E/R tactics, threat damage estimation, coordinated healing and incoming-projectile anticipation remain outstanding.
