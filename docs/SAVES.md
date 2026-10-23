# Local match checkpoints

Current schema 108 adds bounded shared team jobs: actor/target, kind, copied
last-seen point, score, issued/observed/expiry ticks and next planning tick. Each
team has at most five unique assignments. Validation rejects foreign actors,
wrong target types/factions, missing match plans, invalid refresh deadlines and
future/expired memory. See [team strategy](BOT-TEAM-STRATEGY.md).

Winning schema-108 checkpoints also reject active Lucent Singularity flights or
zones. Nexus destruction cancels that gameplay state and retains only an
unexpired, already-detonated visual tail. Result playback retires the tail without
changing saved state. The field layout is unchanged; earlier simulation
fingerprints remain incompatible. See [Lux E](LUX-E.md).

Lux wave-clear decisions use the existing copied queued point and ordinary E
state; they add no schema fields. Lux/Gromp targeted missiles now capture their
actual birth position and direction at release, before any later actor can end
the match on that same tick. Normal projectile advancement replaces that frame;
winning cancellation retains one complete stopped frame without applying damage.
Strict history validation remains intact. The wave-clear/birth-history changes
keep schema 108 while changing the simulation fingerprint. See the
[wave-clear evidence](reference/lux-wave-clear-verification.json).

Source E layers reuse existing flight/arrival/detonation clocks. Three moving
detonation emitters now join the twenty static layers. Their maximum sampled life
after the last accepted birth requires a conservative 108-tick presentation-only
retained interval, replacing the initial static adapter's 43 ticks. Schema 108
fields are unchanged; the fingerprint changes. Winning cancellation still removes
active E and retains only accepted unexpired bursts. Source buffers and indexed
births restore without replaying damage, slow, sight or simulation randomness;
terminal presentation retires them independently of saved simulation. A late
0.9-second tail also survives real graphics loss with identical buffers and
framebuffer bytes. See [E detonation motion](LUX-E.md#moving-detonation-particles--october-23-2026).

Schema 107 introduced five-position assignments and bounded observed camp memory.
Each 5v5 team has one of every role; junglers retain a route cursor, current home
camp, quiet clock and at most six observed-empty records. Validation rejects
missing/duplicate roles, mismatched lanes, missing Smite, foreign camps and future
observation clocks. See [bot roles](BOT-ROLES.md).

Schema 106 extended Oracle presentation history through the complete audio
ending (up to 190 ticks after stopping), while particles retain their existing
visual retirement clock. Schema 105 introduced these histories: accepted start/origin/facing,
nullable stop tick/reason and the captured child point/facing. A stopped effect
survives equipment swaps, subsequent scans and reloads. Child roots capture after
movement on the derived dispatch tick and remain fixed independently of later
owner movement. Expired histories retire on a conservative source-derived bound;
unborn same-tick/first-update recasts coalesce without inventing a child. Validation
rejects missing or reordered histories, conflicting active scans, invalid stop
reasons, premature/missing child anchors and expired tails. Full profiles and assets
prepare even when only a tail remains with a Ward equipped. A frozen match-ending
clock retains stopped histories; the view derives future children from the frozen
owner and plays them without mutating or advancing simulation. Oracle audio
restores at its pitch-adjusted sample offset, including an audio-only ending with
a Ward equipped; its result tail uses the paused AudioContext clock. All timing,
attachment and stop adapters remain explicitly local. Earlier schemas and
fingerprints remain incompatible. See [Oracle Lens](ORACLE-LENS.md).

Schema 104 added trinket equipment kind, captured recharge duration and
starting progress for resource-conserving swaps, and nullable Oracle scan state.
Scans retain their original start/end, radius, sampling phase and bounded hidden
champion samples (origin, position, facing and exact expiry). The actual nullable
first-pulse time preserves activation between steps. Samples must belong to the
last completed pulse. Expired samples are removed before combat; a Nexus kill at
expiry or before the initial sample therefore retains a restorable frozen
checkpoint. Ward detection/disabled sight is derived from live
scan positions, without altering ward lifetime or replaying placement. Active
scans remain independent of equipment swaps, death and practice resource refill.
Saved restoration prepares required Oracle assets before play resumes. Earlier
schemas and fingerprints remain incompatible. See [Oracle Lens](ORACLE-LENS.md).

Schema 103 added default trinket charges/recharge spans and placement
intent, committed ward deliveries with captured origin/range/lifetime, and placed
ward ownership/reveal/expiry clocks. Resetting practice cooldowns can refill the
trinket while a previously accepted delivery remains in flight. Saved restoration
retains those deliveries without replaying or duplicating placement. Ward health,
control immunity, owner limits and the Garen Q no-silence recipient case are
validated. Earlier schemas and fingerprints remain incompatible.
See [Stealth Ward](WARDING-TOTEM.md) for source boundaries and validation.

Schema 102 introduced the requirement for all twelve ordinary camp calendars and the shared
river controller in every Rift checkpoint, including practice. Map initialization
creates the same calendars for practice and lane matches; restoration replaces
the defaults with validated saved clocks and ownership. Controlled development
fixtures retain their separate encounters. Earlier formats and fingerprints
remain incompatible. [Rift practice](RIFT-PRACTICE.md) records current validation.
The purchased-companion acquisition and consumed-item state introduced in schema
101 remains required; see [companion purchases](COMPANION-ITEMS.md).

Version 87 adds required neutral Gromp attack presentation histories: projectile
and source identity, original launch point/tick, optional stop and contiguous
position/heading frames. The 34-frame path and 31-tick stopped tail preserve
source missile particles through contact/target loss, fog and reload. Active
records must match a real neutral Gromp projectile; missing, duplicate, crossed,
future/gapped, mismatched and expired histories are rejected. Normal matches
retain an empty array. Presentation does not replay damage. Earlier formats
remain incompatible. See [Gromp attack playback](GROMP-ATTACK.md).

Version 82 adds required per-champion `garenQVisuals` intervals, including captured
activation rank, stop tick/reason and committed swing start/release pairs. Cast,
one-shot active, ending and both bank-delayed attack cues reconstruct independently
of later orders, target loss or caster death. Stopped intervals remain for 200
ticks, covering all source tails. Practice recasts retain earlier intervals.
Validation checks Garen ownership, learned rank, active Q correspondence, ordered
clocks, expiry/consumption/death/match-end/recast consistency and compatible
captured windups. Missing, foreign, future, duplicate, contradictory or expired
records are rejected. An ongoing captured Q attack cycle must have its matching
rank/start/release pair in retained history. Earlier formats are incompatible.
See [Q audio](GAREN-Q-AUDIO.md).

Version 81 adds required per-champion `garenWDeflects` records with reaction and
originating cast ticks. The local damage-reaction policy coalesces reduced
physical/magic hits per victim/tick. Records remain for 51 simulation ticks,
covering the source float32 lifetime, first-update birth and interpolation.
Independent clocks preserve earlier reactions through practice recasts, buff
expiry, death and reload. Validation enforces Garen ownership, learned W,
chronology, source defense-window bounds, retained presentation consistency and
the bounded history; missing, duplicate, foreign, future or expired records are
rejected. Native trigger/coalescing remains unverified. Earlier versions remain
incompatible under the existing same-build policy. See [Courage particles](GAREN-W-PARTICLES.md).

Version 80 adds required nullable Courage presentation history: original start,
stop and end reason. Active records must agree with learned W and its live
defense buff; stopped records distinguish exact natural expiry from earlier
death or match end. History remains for 189 ticks after stop, covering source
cast/ending/stop-fade tails even after immediate caster death. Restore seeks
the original cast, authored loop span and remaining fade. Shield depletion does
not end this interval. Missing, foreign, contradictory, future or expired records
are rejected. Earlier same-build saves remain incompatible. See
[GAREN-W-AUDIO.md](GAREN-W-AUDIO.md).

Version 79 records whether R's own release damage killed its recipient. The
required `killed` flag cannot accompany a pending/canceled R, and a later target
death never promotes an earlier hit into a kill. Shared R presentation history
now remains for 303 ticks after release/cancellation to cover the full 5.03735-second
stereo kill recording; particles retain their shorter source lives. Restore seeks
source cast/hit/kill audio from the original clocks, independent of later caster
death or target disappearance. The field remains named `garenRVisual`.
Older saves remain incompatible. See [GAREN-R-AUDIO.md](GAREN-R-AUDIO.md).

Version 78 adds required nullable Demacian Justice presentation history: accepted
start/target/facing/point and mutually exclusive release/cancellation clocks.
Release captures the actual recipient point before damage, survives target kills,
later caster actions/death and reveal expiry, and retires after 180 ticks.
Validation checks Garen ownership, learned R, exact deadlines, pending cast/reveal
consistency, references and unexpired history. Keyed source particles reconstruct
identically after restore. Older checkpoints remain incompatible under the
same-build policy. See [GAREN-R-PARTICLES.md](GAREN-R-PARTICLES.md).

Version 77 retains Judgment's shared particle/audio interval for 154 ticks after
stop, covering the source cast/ending recordings as well as the shorter particle
and active-sound fades. Decoder expiry checks use that bound; particle lifetimes
remain unchanged. Ongoing cast/active/ending voices resume at their saved age.
Hit cues remain transient events and are not replayed after restoration. Earlier
builds remain incompatible. See [GAREN-E-AUDIO.md](GAREN-E-AUDIO.md).

Version 76 adds Garen Judgment's required nullable visual interval: original start,
captured facing and nullable stop tick. Active intervals must agree with the
ongoing spin; stopped intervals must have valid bounded timing and expire after
one second. Recast, R, death and natural completion preserve particle tails
through save/reload. Earlier builds remain incompatible under the same-build
policy. See [GAREN-SPIN.md](GAREN-SPIN.md).

Version 75 permits a Garen player only on `practice-fixture`, retaining all existing kit, targeted-cast, rank and ownership checks. The constructor/decoder reject a Rift Garen player, and fixture imports cannot cross the battlefield boundary. Matching Garen fixture saves restore paused, and restart retains the diagnostic champion. Production selection still excludes Garen. Earlier builds remain incompatible under the same-build policy. See [GAREN-PLAYER.md](GAREN-PLAYER.md).

Version 74 adds active Judgment state: captured rank/count/cooldown, completed-strike cadence and per-champion contact counts, plus required per-unit source-owned armor debuffs. Validation checks ownership, ranks, exact timelines, reachable counts/cooldowns, unique enemy recipients and incompatible actions. Stored armor is restored without reapplying the derived debuff. This version also rejects Courage stacks before W is learned, following Riot's 25.23 bug fix. All Garen spell ranks are now supported for NPCs; player Garen remains unavailable. Earlier formats are incompatible.

Version 73 adds Garen R's required nullable target-only reveal record and optional target identity on queued/pending casts. The decoder checks champion ownership, enemy champion references, exact cast/reveal deadlines, captured rank and reveal/cast consistency. Reveals can survive caster death; dead target windups finish without redirecting damage. Garen R ranks are now accepted; E and player Garen remain unavailable. Earlier formats are incompatible.

Version 72 adds the independent Courage stack counter. It accepts integer values from zero through the source-derived 150-stack cap on Garen only, including pre-learning and dead owners. Existing unit resistance totals are restored without reapplying the counter. Earlier formats are incompatible.

Version 71 adds Garen Courage active state: captured rank, activation tick, upfront deadline and defense deadline. Validation checks live Garen ownership, learned rank and exact source-duration relationships. W ranks are now accepted; E/R remain unavailable. Earlier formats are incompatible.

Version 70 requires Garen’s independent Perseverance-ready tick. The decoder rejects foreign/dead ownership and future deadlines beyond one interruption interval. Past deadlines are retained, and restore preserves the recovery boundary. Earlier formats are incompatible.

Version 69 captures Garen Q’s release tick in its attack cycle. The decoder requires rank/release pairing, checks release and cycle deadlines against the unit, and permits only timing pairs produced at the owner’s current or earlier levels. This preserves a swing started before level-up and keeps its animation contact marker aligned after restoration. Earlier formats are incompatible.

Version 68 adds independent Garen Q buff state and captured empowered-attack ranks. It validates champion ownership, learned ranks, exact activation-relative deadlines, consumption and live buff ownership. Already committed attacks retain their rank through buff expiry and save/restore. Garen remains unavailable as the player, and W/E/R ranks remain rejected. Earlier formats are incompatible.

Version 67 adds Garen as a non-player simulation champion and includes his source animation clips in validated pose state. Garen cannot carry Ashe Focus/Hawkshot state, pending foreign casts or learned unfinished spells. Player selection remains Ashe/Lux; an imported player identity of Garen is rejected until his player kit is integrated. Earlier checkpoint versions remain incompatible.

Version 66 requires a nonnegative integer `silenceUntil` deadline on each unit. Silence resumes with the match clock and clears on respawn. Missing, fractional, negative or null deadlines are rejected. Earlier formats remain incompatible under the same-build checkpoint policy.

Version 52 replaces Lux history frame `distance` with `trailDistance`. It begins at zero at the first trail emission and sums planar distances between emission batches, remaining unchanged on non-emitting and impact ticks. Validation checks the forced first-birth schedule, retained batch anchors and unchanged counters between batches. A retired prefix owns its unavailable absolute history. Earlier formats are incompatible; the source-derived 37-tick tail and 40-frame history remain.

Version 51 requires cumulative planar travel on every Lux attack history frame. The counter includes the first launch step and clipped contact distance, remains absolute when older frames retire, and freezes when movement stops. Validation checks adjacent distance increments, the launch-origin distance when retained, and a minimum origin-to-point distance for a truncated prefix. Earlier checkpoints remain incompatible under the same-build policy.

Version 50 requires `luxAttackVisuals`: released Lux attacks retain their launch origin, a bounded contiguous homing path, and an explicit stop tick after impact or removal. Active records must match their projectile; stopped records survive for 37 ticks, then retire. Duplicate identities, missing active history, conflicting origins/endpoints, invalid participants, gaps and stale tails are rejected. These records support presentation replay and do not apply damage or replay sound events.

Champion choice is stored in the existing player unit identity. New-match selection initializes Ashe or Lux; restarting preserves the current champion and mode. Ashe practice keeps the existing clear-checkpoint restart, while Lux practice writes a fresh Lux checkpoint before reloading. Schema 62 retains the corrected emission-batch trail odometer and successful critical rolls, and adds confirmed Lux impact identities with bounded target-position histories. Impact histories now retain target rig identity and an independent facing/animation timeline at each tick as well as position. Capture runs after recall placement and animation clocks, including the first contact frame. The complete placement and pose freeze on target death or disappearance and survive save/load without attaching to a later respawn. Structure targets now retain their rig identity, a copied authored map matrix when available, and the selected structure pose in every history frame. Their mobile timeline remains null; practice dummies have neither rig nor pose. Validation checks pose kind/clip/loop consistency, source clip bounds, transform identity and frozen structure poses after detachment. Validation checks historical clip names and chronology, attached endpoints against live target state, and frozen pose equality after detachment. Per-unit run and mobile-unit idle clocks preserve segment timing and interpolated clip seconds across restoration. Idle clocks exclude active casts, attacks and recalls; exported source clip durations determine cast completion. Each source mobile rig also saves its primary animation and weighted outgoing transition layers, including their bounded clip times, unclamped elapsed clip seconds, rates and fade start tick. The unclamped clock preserves interpolation across loop boundaries and after a one-shot animation has reached its held endpoint; historical impact frames retain the same field. The decoder checks that bounded time agrees with the unclamped clock under the saved loop mode and source clip duration. The decoder rejects unknown clips, duplicate layers, invalid weights and future capture times. Older capture ticks remain valid for explicit time extrapolation; transition chronology is checked at capture time. Structure knowledge now stores a nullable destruction tick per team: null means known intact, and an integer retains the public destruction event through hidden regrowth. Validation rejects future events, disagreement with an actually destroyed structure, and impossible ordering against idle entry. Structures additionally retain their idle-entry tick and each team's last observed idle-entry tick. Regrowth resets the actual entry; sight updates the observer's copy. Validation requires the clock on structures only and rejects future entry/observation times. The simulation fingerprint also changes, so checkpoints from earlier builds remain incompatible.

Version 49 previously added the required match mode (`practice` or `lanes`). Lane matches are accepted only on Rift. Starting either mode writes a fresh checkpoint before reloading into the ordinary paused restore flow; a failed write preserves the current match and previous checkpoint. At that version, **Restart lane match** created a new lane roster, while **Restart practice** retains its existing clear-and-start behavior. File previews identify the saved mode. Earlier formats are incompatible.

Version 48 adds ordered inventory copies to team observations. Known empty slots remain null and never-observed inventories remain unknown. Observed inventories use the same catalog, six-slot and unique-item validation as current inventories, but need not match current ownership: hidden purchases, sales and recipes must retain old knowledge. Earlier formats are incompatible.

Version 47 replaces level-only observations with nullable per-team `{ level, cs }` records. Both fields are captured together when observed and retained through hidden gains and reloads. Creep score must be a nonnegative integer no greater than actual CS; the existing level bounds remain enforced. Earlier formats are incompatible.

Version 46 adds per-team nullable observed champion levels. Observations must be integers from 1 through the champion’s current level. Hidden level gains retain the earlier observation, and save/load preserves that knowledge exactly. Earlier formats are incompatible under the existing same-build checkpoint policy; old diagnostic checkpoints must be regenerated.

Version 45 adds nullable per-champion Enlighten restoration with captured total mana and a three-second interval. It rejects invalid timelines and dead owners, permits committed restoration after selling Chapter, and resumes the remaining ticks exactly. Earlier formats are incompatible. See [LOST-CHAPTER.md](LOST-CHAPTER.md).

Version 44 permits captured, integer Hawkshot recharge durations produced by current item haste at any E rank. A duration may reflect equipment sold after recharge began; validation enumerates reachable six-slot catalog haste instead of using current inventory alone. Spell cooldowns retain captured integer deadlines. Earlier formats are incompatible. See [ABILITY-HASTE.md](ABILITY-HASTE.md).

Version 43 adds Lux E windup detonation requests and saved singularity instances with source/team, origin/endpoint, flight position, damage/slow capture, arrival, zone deadline and retained explosion time. It validates flight positions, identity, unique active ownership and lifecycle deadlines. Lux E ranks are now permitted without Hawkshot charges; Hawkshot recharge validation is champion-specific. Earlier formats are incompatible.

Version 42 requires independent slow contributions with source/effect identity, start/end ticks and linear strength endpoints. The decoder validates champion ownership, enemy nonstructural living recipients, unique source/effect pairs, active lifetimes and nondecreasing speed multipliers. Target death/respawn clears contributions; source death does not. Earlier formats are incompatible.

Version 41 adds Prismatic Barrier cast shield payloads, outgoing/returning flight phases, per-pass hit histories, captured shield amount, launch identity and a retained dead-caster return point. Shield grants optionally identify their originating W cast for remaining-capacity refresh. The decoder validates Lux ownership, allies, unique per-pass hits, source self-hit state, flight speed/range limits and launch timing, and rejects duplicate same-cast shield grants. W ranks are now permitted; Lux E remains unavailable. Earlier formats are incompatible.

Version 40 requires per-unit shield grants, preserving remaining capacity, allied champion ownership and active deadlines. Dead/nonchampion recipients, invalid owners, nonpositive amounts, expired grants and nonfinite total capacity are rejected.

Version 39 adds Final Spark's retained beam visuals and required origin/endpoint on Lux R windups. Cast timing is validated per champion; beam range, lifetime, owner and entity identity are validated across save/load. Lux R ranks are now permitted while W/E remain unavailable.

Version 38 requires per-unit Illumination marks with enemy Lux ownership and active deadlines. It rejects duplicate owners, dead or structural targets, unknown/non-Lux/allied sources, expired marks and deadlines beyond the six-second maximum. Target death and respawn clear marks; caster death does not remove marks on other units.

Version 37 adds a required identity on champions (`ashe` or `lux`) and prohibits it on other units. Lux Q windups and animations are retained with their 15-tick release timing, captured rank/aim/damage and champion ownership. The decoder rejects crossed cast identities, unavailable Lux W/E/R ranks, Ashe Focus/charge state on Lux, and empowered attacks without an Ashe source. Earlier snapshot versions are incompatible.

Version 36 adds binding projectiles with a required prior-hit list of length zero or one. A second contact retires the projectile. The decoder checks source team/ownership and rejects impossible retained participants while permitting a removed victim's allocated ID. This allows saving between Light Binding contacts without hitting the first victim twice.

Version 35 adds the required per-unit `rootUntil` deadline. Roots retain movement orders and can expire identically after restoration; respawn clears them. Earlier versions are incompatible, consistent with the existing conservative ruleset policy.

Full-Rift navigation now returns position-only waypoints even when a caller passes a complete unit as its destination. Previously the walkable-endpoint fast path spread the whole unit into the returned point. Chases consequently embedded combat fields in `path` and `pathDestination`, making otherwise valid live matches fail the strict save decoder. This was reproduced in a five-minute ten-champion simulation and two focused regressions. Navigation now explicitly copies `x` and `y`; schema validation remains strict. A browser scenario saves an active Rift chase, reloads through IndexedDB, and matches uninterrupted continuation through an actual attack.

Queued commands store only their declared payload fields. When a UI or simulation caller supplies a unit as a coordinate argument, the queue captures its `x` and `y` at dispatch time rather than copying the full entity. This keeps pending casts and movement orders valid under the strict snapshot schema and prevents subsequent unit movement from changing their destinations. Regression cases restore each command type before execution and compare continued state. A browser case holds simulation steps, clicks the actual HUD Heal button, and restores the resulting pending cast before resuming.

Pausing releases held input and unfinished aiming gestures, but preserves commands already accepted into the simulation queue. This applies to manual pause, focus interruption, graphics recovery and the restored-match pause screen. Previously `setPaused` emptied that queue: a Heal clicked between fixed steps disappeared when opening Save, and loading an otherwise valid pending-command checkpoint also discarded its command. The browser regression now clicks Heal with simulation steps held, opens Pause, saves through the actual menu, reloads, checks exact frozen state through another blur event, then clicks Resume and compares the first resulting tick against uninterrupted continuation. The existing held-cast cancellation checks remain required. This repairs local checkpoint behavior; it does not assert native League pause policy.

The pause menu's **Save match** action writes one checkpoint per battlefield to this browser's IndexedDB storage. After the write completes, reloading the same build restores that match and leaves it paused. The camera recenters on the saved player; the welcome banner is omitted. **Restart practice** clears that battlefield's checkpoint before starting a new match. Manual file export/import is available through **Match files**. There is no automatic save, cross-device sync, or offline asset cache yet.

## Simulation format

Snapshot version 28 records units, champion-owned resources and inventory (the human record plus other champion records), orders and paths, pending commands and wave spawns, projectiles, random state, match outcome, clocks, scheduled attack cycles with their captured animation empowerment, pending W/E/R cast deadlines/aim/damage and independent recoverable cast animation epochs, recipient-specific Summoner Heal reduction and speed deadlines, bot retreat state, applied slow multipliers and critical-slow decay state, Hawkshot charge count and serial recharge deadline, traveling scouts with per-cast animation launch ticks, origins and retained arrival trajectories for particle tails and typed timed vision areas, independent scout visual descriptors, and team-specific structure knowledge. Positive infinity is encoded as an explicit disabled-deadline token; it is never confused with a nullable timer. NaN and negative infinity cannot be serialized. Object keys are canonicalized, enabling exact continuation comparisons independent of parser property order.

Scout visual descriptors retain endpoint/team, flight identity and trajectory, emission stop tick and retirement tick. They persist for 1.25 seconds after the five-second reveal ends, without entering vision-source or targeting queries. Version 24 rejects duplicate visual IDs, future arrivals, reversed flight timing, unallocated IDs, expired descriptors and changed stop/retirement deadlines. Prior version 25 and older saves are intentionally incompatible; no migration is implemented. These descriptors drive sustained particle/audio playback without renewing sight.

The decoder uses a strict schema, rejects invalid resource bounds and identities, verifies the player and battlefield lanes, and checks both the format version and a SHA-256 compatibility fingerprint. The fingerprint covers simulation/content TypeScript sources, the pinned map layout/navigation files, and package declarations. Renderer and HUD edits alone do not invalidate saves. Development restarts refresh the fingerprint when simulation files change. Compatibility is intentionally conservative; there is no migration from another ruleset or the older diagnostic snapshot formats.

`World.fromSnapshot` creates an independent world using the supplied battlefield's terrain queries. It restores validated gameplay fields and random state. Transient presentation events are cleared so loading cannot replay old combat text or sounds. Active attack clips reconstruct their phase from the saved cycle and simulation tick, including after missile release. Mobile death clips seek from the saved death tick; a late first render does not restart the death sequence. Animated structure destruction seeks from a saved death tick and enters its destroyed idle stage when due. Camera settings, crossfade weights, other animation phases (including remembered rubble loops after hidden regrowth), and preference persistence remain separate presentation work; a restored framebuffer is not guaranteed to be pixel-identical.

## Storage behavior

Writes and deletions succeed only after the IndexedDB transaction completes. Failures keep the current match intact and report an error instead of claiming success. An unreadable or incompatible checkpoint is retained; the new match starts paused, and no checkpoint is overwritten until the player explicitly saves. Browser storage can still be cleared or evicted. A local checkpoint does not establish reload availability without network access to the game's assets. [IndexedDB transactions](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)

## Verification scope

Thirteen simulation scenarios cover exact future-state agreement after restoring missiles, queued commands, random state, queued three-lane waves, recall, hidden inhibitor regrowth, terminal state, and disabled deadlines. Invalid versions, rulesets, identities, resources, lanes, unknown fields, malformed JSON, and invalid numeric state are rejected without mutating the active world.

Browser scenarios cover a full-Rift save/reload/resume/restart flow, preserving the prior checkpoint on a failed write, and retaining an incompatible checkpoint. The restored pause screen is visually reviewed. These are same-build checks in the tested runtime; cross-browser deterministic replay, migrations, autosaves, and automatic recovery from storage eviction remain unfinished. Manual exported files can be retained outside browser storage; their compatibility still depends on the same simulation build.

## Portable match files

Open **Pause → Match files → Download current match** to export the exact current snapshot as JSON. This does not write or replace the browser checkpoint. Downloads are also available on victory/defeat and graphics-recovery dialogs, so a stopped match can be retained before restarting. Files contain simulation state and pending commands; they do not bundle art, sound, browser settings or the application itself.

**Choose match file** opens the native file picker. Selection only validates and previews elapsed match time and completion state. **Load this match** explicitly replaces the current match and its stored checkpoint, after the preview explains that consequence. The importer rejects files over 16 MiB before reading their contents, then uses `World.fromSnapshot` for the existing version, simulation fingerprint, battlefield and state-invariant checks. It serializes the validated world and retains that exact candidate for loading. No migrations or relaxed validation were added at that milestone (format 48); the current format is described above.

Loading waits for the storage transaction to complete before reloading into the ordinary paused restore path. Controls cannot resume or restart the match during this write. A failed transaction reports its error, leaves the live match and previous checkpoint intact, and permits retry. If graphics interruption replaces the import dialog before a failed write, the HUD rebuilds the current recovery or pause dialog and retains the error as an inline alert through restoration. The match only resumes explicitly. Invalid replacement selections clear an earlier valid preview; stale asynchronous read completions cannot replace a newer selection or reopen a dismissed dialog.

Browser verification transfers a real downloaded file through the native picker into an isolated Chrome context, checks identical frozen snapshots and saved data, and compares the next simulation tick with an accepted Heal against uninterrupted continuation. Rejection cases cover malformed JSON, an old version, a valid different-map snapshot and oversized content. A transaction-abort case verifies retained state and successful retry. Actual WebGL context loss permits an exact download; victory and defeat exports retain valid frozen terminal snapshots and both result buttons remain in the modal Tab cycle. The file-preview, rejection, recovery and result screenshots are visually reviewed. This establishes same-build Chrome transfer, not cross-engine deterministic replay or offline asset availability.

## Champion ownership

Version 24 adds `otherChampions`, with the same validated resource/state shape as the human `player` record. Together they must own every champion exactly once, with no duplicate or unrelated identities. Nonhuman pending-cast and animation chronology are checked against their own unit, death state and recall state. Restore rebuilds independent runtime records and keeps `World.player` as the human record; old presentation events remain discarded. Charge regeneration and Focus expiry continue independently after reload. Cast execution and recall now consume each owner independently, including saved windup release and team fountain destinations. Autonomous bot spell decisions remain outstanding.

## Damage contribution history

Version 24 adds `damageContributors` to each champion record: one opposing champion ID and latest positive damage tick per contributor. Positive opposing champion damage updates the record, including lethal hits. Zero damage, friendly damage and nonchampion damage do not create entries. Death retains the record for reward resolution; respawn clears it for the new life. No assist expiration is inferred yet.

Checkpoint validation requires unique existing opposing champion sources and timestamps no later than the match tick or the victim's death tick. Histories restore independently of transient combat events, which remain discarded. This records damage provenance only; support/CC contribution, assist eligibility and champion-kill XP integration remain unfinished. Version 23 checkpoints are retained as incompatible rather than migrated with fabricated history.

## Assist counters

Version 25 adds a nonnegative integer `assists` counter per champion. Version 24 checkpoints are incompatible. Damage assists currently increment on a direct opposing champion kill when another contributor's most recent damage is within the pinned 15-second window. The contributor can be distant or dead. Counter and damage history both survive checkpoints; presentation events are not used as reward history. Support-only assists, execution attribution and assist gold remain unfinished.

## Hawkshot reveal contributions

Version 26 adds per-champion `revealContributors` and optional `sourceId` on scout vision areas. Runtime Hawkshots retain their caster when landing; manually authored/unowned scout areas remain supported without attribution. Source IDs must resolve to champions on the scout's team. Reveal contribution IDs must be unique opposing champions, and their timestamps cannot exceed match time or the victim's death tick. Respawn clears reveal history. Version 25 saves are incompatible.

Reconstruction retains reveal credit without replaying a reveal event. Visibility transitions are sampled from simulation state at the start of the next step, so a continuously visible enemy does not receive a renewed deadline merely because a checkpoint was loaded.

Damage contributor arrays now preserve latest-hit order: refreshing an attacker moves its entry to the end, even for multiple attacks in one tick. The decoder rejects decreasing timestamps; equal-tick array order is retained. This adds no fields to version 26, but the simulation fingerprint changes and conservatively rejects earlier builds.


## First-blood match state

Version 27 adds the required boolean `firstBloodClaimed`. It starts false and becomes true when the first opposing champion kill receives its bonus. Restoration preserves the flag without replaying gold events. Subsequent kills cannot pay the bonus again; uncredited nonchampion final blows do not consume it. The decoder rejects missing or nonboolean values. Version 26 saves are incompatible and remain subject to the existing retained-save policy.


## Stable inventory slots

Version 28 accepts `null` as an empty position in each champion's inventory array. Arrays retain a maximum of six entries; omitted trailing entries also mean empty slots. Sales clear the selected position and trim only trailing empties, so later occupied slots do not move. Purchases fill the first null before appending. The decoder still rejects unknown item IDs and arrays longer than six. Earlier snapshot versions are incompatible; restoration preserves holes and subsequent purchase placement for both teams.
