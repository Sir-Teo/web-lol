# Charm source audio staging

The isolated `dev/ahri-charm-audio` branch stages nine unchanged mono 44.1 kHz float masters from the frozen Ahri SFX graph and decoded corpus. Three source play profiles retain their container gains and voice limits. The flight play action fades in over 50 ms with Linear curve 4; the stop action fades over 1.55 seconds with Exp1 curve 6. Export preflight verifies the complete output closure before writing.

`wwise145-linear-exp1-reference.json` records 90 direct evaluations of the pinned external reader's interpolation implementation. The app helper matches those evaluations, including the Exp1 midpoint of 0.625 for a fade from one to zero.

`ahri-charm-gameplay-reference.json` contains 48 full gameplay projection hashes generated with the frozen 7ae8e0 cohort source. Six scenarios cover hit, miss, death during windup, death during flight, Flash and overlapping casts. Only schema version, ruleset and the proposed root audio history are excluded. This independent baseline will check that audio tracking preserves gameplay, IDs and RNG.

Validation at staging: 12 asset/fade tests, the 48-projection comparison and TypeScript pass. This stage adds no playback or simulation history. Native dispatch, shuffle, global bus, listener behavior and virtualization remain unverified. The running 100-seed roster cohort remains on the primary branch and frozen ruleset.

## Saved history

Schema 168 adds bounded root Charm audio history for accepted cast, missile launch, swept contact and range or match-end stop. The history uses existing caster/projectile identities, with no allocated IDs or random draws. Birth audiences are saved separately for cast, launch and contact. A later reveal cannot rewrite an earlier audience. Unreleased casts cancel on death; released missiles retain their existing gameplay behavior. Tail pruning uses the longest selected source master and source stop fade, preserving late save playback.

Strict snapshot checks link pending casts and live projectiles to history and reject duplicate identities, detached clocks/points, conflicting cancellation and invented contacts. Seven history tests, the existing 23 Charm tests and the independent 48-projection comparison pass. The broader worktree suite is being checked separately; missing private reader fixtures are not acceptance evidence.
