# Development Double Strike controller

This document records the schema-139 passive checkpoint. The later
[Wuju Style](MASTER-YI-E.md) controller adds E and its interaction with the child
at schema 140; references below to unimplemented E describe this earlier checkpoint.

The isolated `/?scene=fixture&npc=masteryi` NPC now owns a Double Strike counter
and a separately timed secondary melee contact. Ashe remains the human player;
Master Yi Q/W/E/R, player controls, role AI and production selection remain open.
This is a development behavior implementation, with native counter/caller timing,
retargeting, proc order, animation transitions, source particles and audio still
unverified.

## Source and controller policies

`tools/assets/export-masteryi-passive.py` verifies the frozen complete character
package before projecting count 4, duration 4 seconds, the 0.5/stat-2 damage
formula and the separately bound `MasterYiDoubleStrike` child. The child declares
`canCastWhileDisabled` and `UseAutoattackCastTimeData`; those permissions belong
to the child. Its legacy 0.225-second cast time and frame 7 are retained without
treating either as a recovered native contact callback.

The exact animation graph binds `Passive` to a parallel containing a default body
pose. The adapter selects that exported `entry_85dac0b3` clip. It does not infer
the other track's runtime dispatch or source effects from the graph name.

The explicit local controller counts accepted basic contacts, including shields,
wards and structures. Three contacts prepare the counter; the fourth consumes it.
Cancelled windups add or consume nothing. Every counted contact refreshes the
four-second deadline; expiry runs before commands and combat on the boundary tick.
The fourth primary schedules a child only if its original target is still valid
after the primary's damage and on-hit effects. No corpse hit or automatic
retarget is invented.

The child captures half total AD using the existing stat mapping, an independent
ordinary critical roll against eligible non-structures, and the current shared
attack-speed-scaled windup. Base level-one delay is 22 updates after primary
contact. Its presentation ends at the primary's next attack deadline, or one
update after child release if later. Damage, critical state and deadlines remain
captured if stats change during the delay. The child neither resets nor consumes
the primary attack cooldown and creates no projectile.

Once committed, the child survives movement orders, stun, root and silence.
This local completion policy applies only to the secondary: an ordinary pending
primary still cancels normally on movement or stun. Child release uses the
shared live-target/visibility/protection checks, including ordinary melee's
existing lack of a second range check. Target death or loss of sight discards it;
caster death and victory clear the counter and child. A successful child uses
the shared armor/shield/on-hit pipeline and contributes one stack toward the next
cycle, without recursively dispatching another child. Native differences in any
of these policies remain open.

Cinders now classifies melee champions through the integrated attack profile,
including Master Yi. Primary and secondary contacts apply the melee slow and
refresh the burn while retaining its pulse phase. No extra immediate burn tick
is added on a refresh. The strict slow validator uses the same classification.

## Saved and rendered continuation

Schema 139 adds an own counter, expiry and optional bounded current child to each
champion state; non-Master Yi owners must retain null. Decoding rejects foreign
ownership, impossible counter/expiry combinations, invalid result phases,
hostile-target errors, expired/future action clocks and live state after death
or victory. Old schemas and ruleset hashes remain incompatible under the existing
same-build policy. This change adds no migration.

The child has independent pending/hit/lost phases. Its source pose uses absolute
saved clocks while stationary; movement keeps the regular run pose. Sampling
does not change gameplay, identity allocation or RNG. Only one child record is
retained, and it retires at its presentation deadline. Ordinary scenes allocate
no passive controller and load no additional model, effect, image or audio asset.

## Reproduction

```sh
python3 tools/assets/export-masteryi-passive.py --check
python3 -O tools/assets/export-masteryi-passive.py --check
python3 tools/assets/test-masteryi-passive.py
python3 -O tools/assets/test-masteryi-passive.py
npx vitest run tests/masteryi-double-strike.test.ts tests/masteryi-development.test.ts tests/red-buff.test.ts
npx playwright test e2e/masteryi-double-strike.spec.ts e2e/masteryi-development.spec.ts
npm run check
npm run build
```

Behavior cases cover real fourth-contact dispatch, repeated cycles, cancellation,
disabled completion, target death/fog, lethal primaries, exact expiry/contact
boundaries, level-derived speed, building critical exclusion, separate critical
rolls, shields/armor, Cinders, death/victory cleanup and malformed saves. Counter,
pending, hit and recovery saves must round-trip byte-for-byte and preserve a
300-update future. Browser cases exercise real private Save/reloads and compare
all 90 bone matrices plus complete world bytes and futures for three child phases.
See the latest validation results in [progress](PROGRESS.md).

The cloud checkpoint passes 28 passive cases and 74 final focused cases in total,
TypeScript, three Node QA cases and eight exporter mutation cases in each Python
mode. Six existing NPC browser cases pass; after repairing the independent
attack-clock reader, all three added phase Save/reloads pass. Pending/contact
captures were visually reviewed. The production build and nested-host smoke pass
with 32 recordings and zero Master Yi preloads. This run uses system Chromium
154 on Debian 13 through temporary launcher overrides; assertions and deadlines
are unchanged. It does not certify Chrome/macOS, native visuals, performance,
the full browser suite or a fresh offline audit.

The broad unit run passes 2,213 of 2,219 cases, before one additional passing
terminal case was added. All six failures reproduce in the same six audit cases
on untouched `9c2b451`: missing Garen encoded audio/recovery sources, missing
particle shader provenance, a missing local Python/native-reader environment,
and the same Lux sampler digest difference. The existing assertions remain
unchanged. The last terminal visual-cleanup adjustment is covered by the final
74-case focused run and production build.

[passive-verification.json](reference/masteryi/passive-verification.json)
records the changed runtime/test hashes, phase clocks and matching save/future/
bone digests, full-run limits, reproduced baseline failures and production result.
Raw logs, phase snapshots and screenshots remain in the local
`.cache/masteryi-passive-cloud` directory. Schema is 139; ruleset is
`7329f9a3be5432313a2689a9d24a0b0b0e035e043099b61f885996c1c72ad1bd`.
