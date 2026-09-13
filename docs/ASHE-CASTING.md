# Ashe cast timing audit and implementation requirements

W/E/R now have saved 15-tick windups, movement locks and their source Spell2/Spell3/Spell4 poses, described below. Their source clips now continue after release while idle. Native interaction rules, release-frame alignment and transition blending remain material calibration gaps.

## Verified selection

`python3 tools/assets/audit-ashe-cast-timing.py` verifies the cached character response against all four existing spell pins, resolves the character root's Q/W/E/R spellbook slots, joins each selected animation to the pinned base graph, and verifies the shipped GLB hash. The resulting [cast timing profile](reference/ashe-cast-timing.json) records exact values and hashes. Missing fields remain null; they are not silently interpreted as false or as engine defaults.

| Slot | Declared spellCastTime | castFrame | useAnimatorFramerate | Cannot cancel during windup | Source clip | Full clip duration |
|---|---:|---:|---|---|---|---:|
| Q | 0.25 s | absent | absent | absent | Spell3 | 1.633333 s |
| W | 0.25 s | 7.5 | true | true | Spell2 | 1.800000 s |
| E | 0.25 s | 11.3100004196167 | absent | true | Spell3 | 1.633333 s |
| R | 0.25 s | 7.5 | true | true | Spell4 | 2.100000 s |

Q additionally has `flags: 4` and `Trait_AttackReset`. The bitmask's complete meaning is not established by this audit. Q activation and E both reference Spell3; Q's empowered attack references Spell1 separately. Animation suffixes cannot safely be treated as ability-slot identifiers.

The [animation authoring guide](https://wiki.divineskins.gg/en/docs/lol/animations/animation-frame-rate) describes a 30 fps animation convention. That provides context for frame-valued data, but does not establish precedence between spellCastTime, castFrame, useAnimatorFramerate and spell-script overrides. In particular, E's frame value differs from W/R and its animator flag is absent. Do not derive a universal delay from castFrame alone. The current source profile preserves the distinction for implementation and capture comparison.

Q's explicit reset is corroborated by [Riot's patch 9.19 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-9-19-notes/). Its existing immediate reset must not acquire a generic quarter-second movement lock merely because the spell record has that declared cast-time field. Its activation animation and any animation mask/transition treatment remain separate research.

## Required runtime work

Introduce a renderer-independent pending cast containing ability identity, start/release deadlines, selected target point/direction and any required origin policy. Persist it in the strict snapshot schema. Successful cast validation must happen once, and spending mana/cooldown/charges must not happen a second time when releasing the projectile.

Separate cast start, release and recoverable animation playback. W/E/R must not release before the resolved windup deadline. Their full 1.6–2.1-second clips must not become movement locks. Render from saved simulation timing so late frames, pause, graphics recovery and restored games seek the same stage. Keep the source release-frame mapping separate from total clip length and attack-speed scaling.

Movement/attack orders issued during an uninterruptible windup need a defined deferred-order policy, rather than being dropped or cancelling the pending spell accidentally. Resolve native behavior for stun, death, Flash, Heal, other ability input, target invalidation and rapid queued commands before claiming complete interruption parity. `mCantCancelWhileWindingUp` alone does not classify each of those causes. Record any provisional policy explicitly.

Resolve whether direction, origin and target point are sampled at start or release, particularly when Flash or another displacement occurs during the windup. E's per-flight animation/particle launch epoch must begin at actual release; its charge spending and recharge deadlines need explicit start/release semantics. Existing minimap aiming should feed the same cast path.

## Acceptance coverage

- Check no projectile exists before release, exactly one release occurs at the deadline, and first-tick travel follows the chosen epoch.
- Verify mana, cooldown and ammo are spent exactly once through save/restore and repeated input.
- Verify movement and attack lock/deferred order behavior, cancel/reject cases, stun and death, and permitted summoner-spell interactions.
- Compare start/direction/origin behavior for battlefield and minimap targeting, including displacement during a cast.
- Check source animation phase at start, just before release, release, recovery and interruption; repeat after a late first render, pause, fresh saved rig and graphics loss.
- Update projectile-travel tests to use actual release as their epoch. Do not weaken their distance, collision, reveal or expiry assertions merely to accommodate the added windup.
- Capture reference spells at known simulation/animation phases and record tolerances before claiming exact timing or pixel parity.

The audit prepares the source contract and exposes unresolved semantics. Runtime integration now covers W/E/R.


## Volley windup implementation

The W exporter verifies that declared spellCastTime is 0.25, castFrame / 30 is the same value, useAnimatorFramerate is true, and mCantCancelWhileWindingUp is true. Runtime uses that agreement for a 15-tick windup. Successful validation spends mana and starts cooldown once, captures aim point and damage, cancels an unreleased basic attack, and stores the start/release ticks. Full existing attack recovery is not reset by W. An order already in progress is retained.

The hero cannot move or start attacks during windup. New movement/attack/stop orders update the retained order, which ordinary unit advancement handles at release. The spell releases before that advancement, then arrows make their first travel interval on the release tick. This preserves the existing first-flight distance of 25 units. A late animation frame seeks directly to elapsed simulation time in Spell2; pause and fresh restored rigs retain identical poses. After release movement and attacks can resume immediately; idle playback now continues through the recovery timeline described below. Native transition blending is not yet calibrated.

Snapshot version 17 includes the pending cast. Validation checks its ability, 15-tick duration, active time interval, living player and absence of simultaneous recall or terminal result. Death and match completion cancel it. A pending cast is completed before the stun gate at release, so stun does not erase an already accepted Volley. No refunds are applied after accepted casts.

Current interaction policy allows Heal during windup and rejects Q/E/R/Flash, repeated W and recall. It does not implement a general spell-input buffer. Movement orders are retained, but orders received while stunned are still subject to the existing command gate. These rules, cast-start damage capture, cooldown start, no refunds and source release-frame mapping require native capture comparison before claiming complete parity. The explicit source cancellation flag supports an uninterruptible windup but does not prove every listed interaction.

Tests cover no early projectiles, one release, preserved damage/speed/travel assertions, deferred movement, attack cancellation, stun/death, single spending, invalid snapshots, and exact saved continuation. Browser coverage checks the source pose, pause, restored bones and release timing. Native displacement/origin semantics and exact spell animation calibration remain outstanding.


## Enchanted Crystal Arrow windup

R now uses the same pending-cast path as W. Its exporter independently verifies the source agreement between 0.25-second spellCastTime, frame 7.5 and useAnimatorFramerate, plus the windup cancellation flag. Its animation comes from Spell4, which the pinned base graph maps to the critical-attack source file. The renderer requires that clip and seeks it from saved cast timing.

Snapshot version 18 accepts W/R pending casts, with duration checked against the selected source profile. Both spells retain the existing single-spending, deferred-order, stun/death and restricted-input policies described above. R captures its current 200 damage at acceptance; rank/AP damage work remains separate. The accelerating missile starts only at release, and its travel distance, sight and stun calculations use flight distance rather than elapsed cast time.

Shared simulation and browser tests now exercise both windups. R travel/vision/caster-displacement fixtures wait until actual launch; their original speed cap, distance, hit, splash and stun assertions remain intact. The minimap input path successfully aims and releases through the new delay. The inspected source-pose screenshot is `artifacts/browser-ultimate-windup.png`. Spell buffering/Flash interactions and native frame calibration remain unfinished.


## Hawkshot windup and flight epoch

E now uses the source-declared 0.25-second cast time. Its exporter checks that value, the windup cancellation flag and the absence of enabled animator-frame timing. Its separate castFrame value remains in the audit; the implementation does not convert it into a different gameplay delay. Native animation-speed/release-frame alignment still needs measurement.

`ASHE_CASTS` is the shared profile lookup used by simulation, renderer and snapshot validation. Snapshot version 19 accepts W/E/R pending states. E captures aim and spends its charge once at acceptance, retaining the existing cooldown/recharge epoch. It constructs the scout at release, which supplies the actual launch tick and origin to flight, animation, vision and wind particles. A cancelled cast retains spent ammunition under the existing no-refund policy.

All three windups share the documented movement/attack, stun/death and restricted-input policies. Tests now exercise all three, including pending E restoration without another charge debit. Existing Hawkshot flight and tail tests measure from actual release/arrival rather than acceptance. The source pose is inspected in `artifacts/browser-hawkshot-windup.png`. Complete spell buffering, native interruption/refund semantics and exact animation/pixel calibration remain unfinished.


## Post-release animation recovery

Snapshot version 20 stores a separate nullable castAnimation with ability and acceptance tick. Releasing a projectile clears the gameplay pendingCast but retains this presentation epoch. While idle, rendering seeks the full selected source clip from simulation time and returns to idle at its actual GLB duration. The full clip never extends the 15-tick movement lock. Pause, late rendering and a freshly restored rig produce the same recovery pose.

Orders received after windup cancel recovery immediately. Orders received during windup remain deferred; actual movement or attack startup cancels recovery at release. Stun after windup, death, match completion, recall, successful Q/Flash and another accepted spell also take control. Heal preserves the timeline. Rejected spells do not cancel it. Cancelled recovery cannot reappear after movement or stun ends. An expired timeline may remain as one inert saved record until the next action; the renderer reads clip duration directly rather than duplicating asset timing in simulation.

Snapshot validation requires a living player, no terminal result or recall, no future animation start, and matching ability/start for any pending cast. Existing older checkpoints remain incompatible under the strict version policy. The browser checks each W/E/R clip at release and 0.6 seconds, pause and fresh-rig restoration, then eventual idle. Simulation cases exercise interruption and preserved launch timing. This is direct source-clip playback with local transition policy, not a verified reproduction of native blend graphs, E playback scaling or release-frame alignment.
