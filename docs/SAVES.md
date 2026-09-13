# Local match checkpoints

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

The pause menu's **Save match** action writes one checkpoint per battlefield to this browser's IndexedDB storage. After the write completes, reloading the same build restores that match and leaves it paused. The camera recenters on the saved player; the welcome banner is omitted. **Restart practice** clears that battlefield's checkpoint before starting a new match. There is no automatic save, cross-device sync, file import/export, or offline asset cache yet.

## Simulation format

Snapshot version 28 records units, champion-owned resources and inventory (the human record plus other champion records), orders and paths, pending commands and wave spawns, projectiles, random state, match outcome, clocks, scheduled attack cycles with their captured animation empowerment, pending W/E/R cast deadlines/aim/damage and independent recoverable cast animation epochs, recipient-specific Summoner Heal reduction and speed deadlines, bot retreat state, applied slow multipliers and critical-slow decay state, Hawkshot charge count and serial recharge deadline, traveling scouts with per-cast animation launch ticks, origins and retained arrival trajectories for particle tails and typed timed vision areas, independent scout visual descriptors, and team-specific structure knowledge. Positive infinity is encoded as an explicit disabled-deadline token; it is never confused with a nullable timer. NaN and negative infinity cannot be serialized. Object keys are canonicalized, enabling exact continuation comparisons independent of parser property order.

Scout visual descriptors retain endpoint/team, flight identity and trajectory, emission stop tick and retirement tick. They persist for 1.25 seconds after the five-second reveal ends, without entering vision-source or targeting queries. Version 24 rejects duplicate visual IDs, future arrivals, reversed flight timing, unallocated IDs, expired descriptors and changed stop/retirement deadlines. Prior version 25 and older saves are intentionally incompatible; no migration is implemented. These descriptors drive sustained particle/audio playback without renewing sight.

The decoder uses a strict schema, rejects invalid resource bounds and identities, verifies the player and battlefield lanes, and checks both the format version and a SHA-256 compatibility fingerprint. The fingerprint covers simulation/content TypeScript sources, the pinned map layout/navigation files, and package declarations. Renderer and HUD edits alone do not invalidate saves. Development restarts refresh the fingerprint when simulation files change. Compatibility is intentionally conservative; there is no migration from another ruleset or the older diagnostic snapshot formats.

`World.fromSnapshot` creates an independent world using the supplied battlefield's terrain queries. It restores validated gameplay fields and random state. Transient presentation events are cleared so loading cannot replay old combat text or sounds. Active attack clips reconstruct their phase from the saved cycle and simulation tick, including after missile release. Mobile death clips seek from the saved death tick; a late first render does not restart the death sequence. Animated structure destruction seeks from a saved death tick and enters its destroyed idle stage when due. Camera settings, crossfade weights, other animation phases (including remembered rubble loops after hidden regrowth), and preference persistence remain separate presentation work; a restored framebuffer is not guaranteed to be pixel-identical.

## Storage behavior

Writes and deletions succeed only after the IndexedDB transaction completes. Failures keep the current match intact and report an error instead of claiming success. An unreadable or incompatible checkpoint is retained; the new match starts paused, and no checkpoint is overwritten until the player explicitly saves. Browser storage can still be cleared or evicted. A local checkpoint does not establish reload availability without network access to the game's assets. [IndexedDB transactions](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)

## Verification scope

Thirteen simulation scenarios cover exact future-state agreement after restoring missiles, queued commands, random state, queued three-lane waves, recall, hidden inhibitor regrowth, terminal state, and disabled deadlines. Invalid versions, rulesets, identities, resources, lanes, unknown fields, malformed JSON, and invalid numeric state are rejected without mutating the active world.

Browser scenarios cover a full-Rift save/reload/resume/restart flow, preserving the prior checkpoint on a failed write, and retaining an incompatible checkpoint. The restored pause screen is visually reviewed. These are same-build checks in the tested runtime; cross-browser deterministic replay, migrations, autosaves, export/import, and recovery from storage eviction remain unfinished.

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
