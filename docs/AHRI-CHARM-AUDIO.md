# Charm source audio staging

The isolated `dev/ahri-charm-audio` branch stages nine unchanged mono 44.1 kHz float masters from the frozen Ahri SFX graph and decoded corpus. Three source play profiles retain their container gains and voice limits. The flight play action fades in over 50 ms with Linear curve 4; the stop action fades over 1.55 seconds with Exp1 curve 6. Export preflight verifies the complete output closure before writing.

`wwise145-linear-exp1-reference.json` records 90 direct evaluations of the pinned external reader's interpolation implementation. The app helper matches those evaluations, including the Exp1 midpoint of 0.625 for a fade from one to zero.

`ahri-charm-gameplay-reference.json` contains 48 full gameplay projection hashes generated with the frozen 7ae8e0 cohort source. Six scenarios cover hit, miss, death during windup, death during flight, Flash and overlapping casts. Only schema version, ruleset and the proposed root audio history are excluded. This independent baseline will check that audio tracking preserves gameplay, IDs and RNG.

Validation at staging: 12 asset/fade tests, the 48-projection comparison and TypeScript pass. This stage adds no playback or simulation history. Native dispatch, shuffle, global bus, listener behavior and virtualization remain unverified. The running 100-seed roster cohort remains on the primary branch and frozen ruleset.
