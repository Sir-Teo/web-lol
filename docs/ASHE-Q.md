# Ashe Q fidelity

The prototype's Ranger's Focus active duration now uses six seconds from the standard Ashe spell record in pinned 16.18 character data. The tooltip derives its duration from the same generated constant. This corrects the previous four-second active window. [Riot's patch 13.5 notes](https://www.leagueoflegends.com/en-sg/news/game-updates/patch-13-5-notes/) explicitly increased the empowered duration from four to six seconds, corroborating the current source's `BuffDuration` data value.

The complete selected spell record is retained in `docs/reference/ashe-q.json`, with source URL and SHA-256. `python3 tools/assets/export-ashe-q.py` verifies the cached whole source and selected record before exporting the rank-independent duration. Rank-dependent attack speed and damage values and missile behavior remain available in that pin for subsequent work. Stack duration/falloff are now applied as described below.

Casting schedules an absolute deadline 360 simulation ticks later. Active attack-speed evaluation and the HUD already use a strict deadline comparison, so the buff ends on that exact tick. Existing attacks retain their scheduled cycles across expiry. Saves retain the original deadline, and death clears the active buff through the existing cleanup path.

The prototype still lacks spell ranks and the complete five-arrow damage/animation behavior, and requires reference calibration of attack-event timing. These remain fidelity gaps. Six-second duration alone does not establish complete Q parity.

One simulation test casts Q, verifies it remains active after four seconds and immediately before expiry, and compares saved continuation through the exact deadline. One browser test verifies the corresponding empowered HUD state. Existing attack-cycle and death-cleanup regressions remain relevant.

## Focus decay and active-window exclusion

The exporter now verifies the string-table source and selected legacy `game_spell_tooltip_asheq` alongside the complete spell record. The tooltip explicitly describes individual stack falloff and no Focus accumulation during Q. This is retained legacy text, not independently captured runtime evidence. Current spell `DataValues` supply four-second `StackDuration`, one-second `StackFalloffDuration`, and four `MaxStacks`.

The implementation removes the first stack at the four-second deadline and one additional stack each second thereafter. The existing `qStackExpiry` field now stores the next decay deadline; after the final stack it resets to zero. A new eligible released attack adds a stack up to the cap and refreshes the full four-second window. Active Q blocks new Focus, and casting clears the old stack deadline. Death cleanup remains unchanged. No additional snapshot field is required; source-version matching handles saves from older implementations.

Exact first-falloff timing and same-tick attack/expiry ordering remain authored policy pending reference capture. The simulation processes attack release before decay, so a release on the expiration tick refreshes the window. Target restrictions and complete Q rank/flurry behavior require further work.

Three additional simulation cases cover individual decay, saved continuation, impact refresh, and active-window damage without stacks. A browser case verifies the pips falling from four to three to two rather than disappearing together.

## Focus at attack release

Focus generation now runs at the successful attack-release event, before creating the arrow, rather than on projectile contact. This makes readiness independent of travel distance and lets the fourth released attack unlock Q while its arrow is still traveling. Canceled windups, dead/invalid targets before release, stun interruption and death before release grant no stack. Impact never grants or refreshes Focus; an arrow fired during active Q cannot grant a delayed stack merely because it lands after the active window ends.

The pinned tooltip establishes attacks granting Focus, but does not encode the precise event callback. Mapping that behavior to successful release is an implementation interpretation pending controlled capture, not a claim that the static record contains server script logic. The current target eligibility follows the existing attack system; specialized blind/dodge/projectile destruction and target-class cases are not fully implemented.

Three new simulation cases cover release before impact, no duplicate/refresh on impact, saved arrows, canceled/invalidated windups, and casting Q after the fourth release before contact. A browser case checks four visible pips with an arrow in flight and an undamaged target. Existing active-Q and death tests remain green.

## Additive rank-one attack speed

The source exporter now retains all five normal-rank `BonusAS` values (20/30/40/50/60%) and verifies the character root's `attackSpeedRatioModifiable` field, normalized to 0.658. The current prototype uses rank one until skill-point allocation is implemented. Q therefore adds 0.658 × 0.20 = 0.1316 attacks/second to the existing baseline, rather than multiplying the entire baseline by 1.4. The HUD calls the same effective-speed calculation as combat. Other champion prototypes do not inherit the player's buff.

The existing baseline remains represented by integer attack-period ticks, so this change does not remove baseline quantization or implement the full attack-speed stat/cap system. The helper converts the additive amount to a scheduling multiplier, then existing cycle creation rounds the period and windup. Scheduled cycles remain immutable across buff expiry. At level one this schedules a 76-tick cycle; at level 18 a 53-tick cycle. Full spell ranks, attack-reset behavior, cap interactions, and flurry damage still require implementation and reference testing.

A new simulation case checks equal absolute speed gain across early and late levels and the resulting scheduled cycles. Existing saved-duration and animation-cycle tests use the corrected values. The Q browser case now verifies the HUD changes from 0.79 while active to 0.66 on expiry.

## Empowered aggregate damage

The exporter now emits the five normal-rank `DamagePerStrike` values, normalized to six decimals. The pinned `EmpoweredDamage` calculation combines this value with attack damage. Rank one therefore captures 110% of the attacker's AD at release. The arrow stores that amount in its existing damage field, so later Q activation/expiry, AD changes or source death do not alter it. Physical resistance remains sampled at impact through the normal attack damage path. This does not change non-player champion or minion attacks.

This is **aggregate damage**, not the completed flurry: the renderer and simulation still represent one arrow and one damage application. Five-arrow sequencing, individual mitigations, per-hit interactions, critical-strike stat scaling, attack reset and rank allocation remain unfinished. This intermediate change establishes the source-backed total coefficient without claiming full Q combat parity.

Three simulation cases compare normal/empowered attacks against armor, preserve empowered damage through expiry/AD changes/death and saved continuation, and ensure activating Q after release does not retroactively empower an arrow. A browser case casts Q and checks damage after expiry in flight.

## Attack projectile speed and remaining flurry research

`docs/reference/ashe-attack-projectiles.json` pins the complete ordinary attack, alternate ordinary attack, Q attack and Q no-on-hit attack records. All four select fixed-speed movement at 2,500 units/second. `python3 tools/assets/export-ashe-projectiles.py` verifies the cached character source hash, each selected record, movement type and agreement before generating the shared speed constant. Champion prototypes, which currently all use Ashe's stats, now use this speed instead of the provisional 2,000. Other units retain their own projectile rules. Speed is captured in each projectile and preserved through checkpoints.

The records specify a right-hand start bone and target-height offsets. The Q records also expose distinct on-hit/no-on-hit spell identities and the `Ashe_Q_mis` effect key. They do not encode an inter-arrow launch delay in the selected missile specifications. These facts alone are insufficient to implement the complete five-arrow sequence, animation/event binding or damage classifications. Those remain research/implementation work; the current aggregate Q representation remains explicit.

A simulation case checks ordinary and empowered arrows moving exactly 2,500/60 units on their first flight tick, impact timing from the current collision geometry, and identical saved continuation. These are local simulation guarantees, not proof of reference collision-radius parity.


## Source empowered attack animation

The pinned `AsheQAttack` spell record selects `Spell1`, distinct from Q activation's `Spell3`. The Q exporter now verifies that record against the existing attack-projectile source pin and confirms its clip exists in the base animation graph. It exports the lowercase runtime clip name. The model loader requires the selected source clip.

Each attack cycle records whether the player's Q was active when that cycle began. The renderer plays the 1.800000-second Spell1 clip for those cycles, while ordinary attacks retain Attack1. Both clips use the existing scheduled-cycle speed and phase calculation. Buff expiry and later activation do not change an animation already underway. The flag describes animation selection at attack start; aggregate damage is still sampled at release as documented above.

Snapshot version 16 requires a boolean empowerment flag on every non-null attack cycle and rejects empowered cycles on non-champion rigs. Late rendering and fresh restored rigs seek the same pose even after Q expires. Cancellation, stun, invalid targets and death still clear the scheduled presentation. Tests cover both ordinary and empowered phases, frozen/restored bone transforms, immutable selection across buff changes, and malformed checkpoint rejection. The generated parameter file rebuilds byte-identically.

This adds the original attack clip, not the complete Q flurry. Source event attachment, five-arrow timing, animation release-frame calibration, transition blending, activation/reset behavior and W/E/R cast windups remain unfinished. Inspected browser captures are `artifacts/browser-basic-attack-pose.png` and `artifacts/browser-q-attack-pose.png`.


## Q attack reset

Riot's [patch 9.19 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-9-19-notes/) explicitly restored a full attack reset to Ranger's Focus. The pinned 16.18 Q record retains `Trait_AttackReset`; the exporter now verifies that tag before emitting `resetsAttackTimer`.

A successful activation clears the pending release, target binding and presentation cycle, and makes the next attack ready on the activation tick. It retains the current order and path. Normal unit advancement then starts a new empowered attack if the ordered target is eligible and in range. An unreleased ordinary attack is replaced without emitting an arrow; an already released arrow keeps its identity and captured damage. Movement continues, and idle does not become an unsolicited attack. Failed activation changes none of these attack fields beyond effects that would occur without the cast, such as stun interruption.

The existing integer-tick scheduling determines the new empowered windup and recovery. At the current level-one baseline this is a 17-tick windup and 76-tick cycle. If Q is activated during an early windup, replacing it can move the next release later; this is a fresh windup, not an immediate projectile. Commands are processed before attack release on the same simulation tick. This ordering and precise native release-frame alignment remain capture-calibration work.

Four simulation tests cover recovery reset with an arrow in flight, exact saved continuation, unreleased windup replacement, rejected activation, movement and idle. A browser case verifies the ordinary-to-Spell1 transition, zero initial phase, earlier cycle start and preservation of the flying arrow; a repeated invalid Q cannot restart the clip. Q/attack/recall regressions also pass. The inspected screenshot is `artifacts/browser-ashe-q-reset.png`.

Q activation's own animation, complete five-arrow flurry, native animation transition events and general spell windups remain unfinished. No snapshot fields were added; the source-hash compatibility policy applies to this gameplay change.

## Prepared source ice-arrow mesh

The base skin resolves `Ashe_Q_mis` to `Ashe_Base_Q_mis`. Its active `icearrow` emitter uses `Ashe_Base_AA_Arrow.scb` and `Ashe_Base_AA_ArrowText.tex`; the separate flat `arrow` emitter is explicitly disabled. The full effect record and selectively extracted asset provenance are retained in [ashe-q-arrow.json](reference/ashe-q-arrow.json). Q's spell data also specifies five `ShotsPerStrike`, but this effect record does not establish the inter-arrow launch schedule.

`node tools/assets/convert-ashe-q-arrow.mjs` verifies the pinned definition and asset hashes, decodes SCB 3.2 and TEX, and produces `public/assets/models/ashe-q-arrow.glb`. The conversion preserves 244 triangles, all UV seams, vertex RGBA including five authored alpha levels, and the original 256×256 texture. Source positions are scaled by 0.01; pivot remains zero. The source emitter's rotation, scale and offset remain metadata and are not baked into the mesh. The [conversion record](reference/ashe-q-arrow-conversion.json) identifies those boundaries.

The 49,788-byte GLB passes Khronos validation with no errors or warnings. Read-back checks preserve exact float32 positions, UVs, vertex colors, face order and embedded texture bytes. An isolated Chrome preview uses one draw call; `artifacts/ashe-q-arrow-asset.png` was visually inspected for texture placement, silhouette and transparency. This is prepared source artwork, not an in-combat screenshot or native rendering comparison. The current attack renderer still uses its provisional geometry; projectile identity, emitter placement, complete Q particle layers and five-arrow sequencing must be integrated separately. Spell ranks and skill allocation have since been implemented, superseding the earlier rank-one-only notes above.

## Source ice arrow in combat

Empowered attack projectiles now capture an `empowered` flag at the same release event that captures damage. The renderer uses the prepared source mesh for those projectiles, preserving that choice through Q expiry, source death and saved continuation. Ordinary arrows remain ordinary if Q is activated after release. Snapshot 33 validates the optional flag as attack-only and requires a champion source for true empowerment.

Loading participates in the existing asset-ready barrier. Instances share cached geometry, texture and material; removal does not dispose those shared resources. The mesh receives the emitter's authored 1.5/1.5/2 scale. Its measured -Z tip is rotated to this renderer's +Z forward direction. The existing projectile center and flight height remain in use: interpreting the native particle attachment rotation, right-hand launch and emitter offset still requires calibration. The source blue texture is retained for both teams.

The inspected combat capture is `artifacts/ashe-q-arrow-combat.png`. Browser checks exercise real Q input, expired-buff flight, textured 244-triangle geometry, vertex RGBA and shared-resource survival after removing another instance. This replaces the provisional Q cone; it does not implement the full flurry, its other particle layers or individual damage applications.

## Ordinary attack shares the source mesh

The skin's `Ashe_BA_mis` resolver selects `Ashe_Base_BA_mis`, whose active `icearrow1` emitter uses the same mesh, texture, rotation and blend mode as Q. Its scale differs: approximately 1.7/1.7/2 instead of 1.5/1.5/2. [Pinned ordinary emitter](reference/ashe-basic-arrow.json) retains the exact source floats, resolver and definition hashes. `python3 tools/assets/export-ashe-basic-arrow.py` checks the resolver, complete emitter and shared-asset identity before exporting that scale.

The shared attack-arrow renderer now selects the ordinary or empowered scale from captured projectile identity. Both teams retain source blue artwork; nonchampion projectiles keep their existing presentation. The current champion prototypes all use Ashe; future champions require their own projectile identities and assets. No second mesh or texture download is needed. Inspected browser captures include `artifacts/ashe-basic-arrow-red.png`; cases for both teams verify ordinary geometry/scale and independence from Q activation after release. Source WindTunnel, trails, glows and precise attachment remain unfinished.

## Official flurry video reference

Riot's [Ashe champion page](https://www.leagueoflegends.com/en-us/champions/ashe/) embeds a [Q demonstration](https://lol.dyn.riotcdn.net/x/videos/champion-abilities/0022/ability_0022_Q1.mp4). The retrieved 1056×720, 30 FPS clip is 11.033333 seconds long. [The video pin](reference/ashe-q-video.json) records its bytes/hash, the referring page hash, selected frame ranges and observation limits. The recording patch, rank and attack speed are not established.

Frame-by-frame inspection shows staggered projectiles with separated paths converging on the target. Replacing the aggregate projectile with five simultaneous coincident copies would therefore fail even this visual reference. Frames 135–164 include the transition from an ordinary attack into the Q pose; frames 156–171 provide a useful close inspection of the demonstrated flurry and arrivals. These are inspection windows, not measured start/end boundaries. Launch flashes and trails overlap arrowheads, so visible glow alone cannot reliably count shots or locate each release.

Run `python3 tools/assets/audit-ashe-q-video.py` with the pinned cached video/page to verify provenance and reproduce ordered contact sheets in `artifacts/ashe-q-reference/`. Cells are zero-based decoded frames in row-major order, with each range encoded in its filename. Cropping preserves frame order and original time spacing; it supplies no additional temporal precision.

The current animation graph's Spell1 entry attaches `Ashe_Q_Buf_attack` but does not list five projectile-launch events. The two attack spell records contain different cast-frame fields (15 and approximately 22.605); those two fields are not a five-shot schedule. Keep visual launch/flight observations separate from server hit classification and per-shot mitigation. The source `ShotsPerStrike` establishes five shots, while exact sequencing, attack-speed dependence, launch offsets, cancellation rules and individual-hit callbacks remain unresolved. No guessed launch interval was added to the runtime in this audit.
