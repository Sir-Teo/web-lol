# Gromp emergence

Scheduled Gromps now enter through the source spawn animation. The existing
camp deadline denotes readiness: a provisional protected lead-up starts 3.2
seconds earlier, including after a clear. Initial emergence therefore starts at
63.8 seconds and becomes targetable at 67 seconds. The respawn ready deadline
remains death +135 seconds. The controlled development encounter still starts
with an idle, immediately targetable monster.

These are local policies informed by static legacy data. Current native timer
semantics, feature flags, timing calibration and visibility dispatch are not
verified. The full source spawn effects/audio, other camps, native scaling,
Smite and jungle-role matches remain unfinished.

## Source contract

`reference/gromp-spawn-source.json` links the existing script/character/model
pins by SHA-256. It retains NeutralMinionDeath PCs 371–392: the legacy call to
InitNeutralMinionTimer subtracts SpawnDuration from GroupsRespawnTime and passes
SpawnDuration separately. Gromp's literal SpawnDuration is 3.2 seconds. This
supports a lead-up interpretation without proving the engine's implementation
or active flag values. The initial camp uses the same local interpretation.

The graph's spawn atomic clip `{e4cb0f58}` references
`sru_gromp_spawn.anm`. Its already-converted GLB animation is 4.5 seconds.
The source ready-flash event starts at frame 90, and the graph records a
0.03333333879709244-second tick duration. Neither the 3.2-second protection nor
the event frame is substituted for the full clip length. The source event is
retained as data; the ready-flash particle and spawn sound are not dispatched.

The graph's cascade blend value and two explicit spawn-related TimeBlendData
entries are zero. The adapter enters and leaves spawn directly. This does not
implement the graph's separate transition clips for normal/aggro idle changes.

The source skin initially hides `Toad_Spawn_Mat` and `SRU_Gromp_Mini_Mat`.
During the spawn clip the adapter shows the former, using the existing geometry,
texture and animated bones. It hides it on completion/interruption; the mini
mesh remains hidden. This visibility interval is an explicit local policy.
Keeping the spawn mesh hidden produced an empty early-frame capture. No geometry,
texture, rig, clip data or model binary was changed to compensate.

Reproduce after script extraction:

```sh
PYTHONPATH=tools/assets python3 tools/assets/extract-gromp-spawn.py
python3 tools/assets/export-gromp.py
```

Both outputs repeat identically. Extraction statically parses the original
hashed Lua chunk; it uses no Lua VM or decompiler and never invokes native game
functions. The runtime JSON participates in the simulation fingerprint.

## Simulation, rendering and continuation

A scheduled monster stores spawn start and ready ticks. The fixed step retains
its home, full health and idle order during protection. Damage, root/silence and
projectile collision reject it; skillshots pass through without consuming hit
slots or adding control/mark state. A command accepted on the ready tick can
start an attack before the monster's controller runs later in the unit loop.

After readiness the source clip continues at unit rate. Positive health damage
interrupts it and starts normal retaliation. Without an interruption, playback
ends after 4.5 seconds and starts a fresh idle clock. The generic 80 ms mobile
blend is bypassed at spawn transitions using the source zero-blend evidence.
Match end retains the existing frozen simulation behavior.

Schema 95 retains both protected emergence and the ready animation tail. It
checks duration, phase, home, health, ownership and compatible motion/attack
clocks. An overdue waiting calendar cannot replace an already-due emergence.
Source clip aliasing and target-pose sampling include spawn, so saved pose
history remains available to later impact effects.

Validation includes exact protection/readiness/clip-end boundaries, commands on
the ready tick, Binding's two hit slots behind a protected Gromp, Volley, control
immunity, interruption, resets, lethal hits and malformed saved clocks. Chrome
compares sampled deformed vertices across a protected reload, checks the spawn
submesh's GPU contribution and cleanup, and covers normal camp combat/respawn.
These scripted boundary probes do not certify native playback or a full match.

The emergence increment passed 1,101 checks, TypeScript, five focused Chrome cases and
the nested-host production smoke. Source/capture hashes and commands are retained
in [the verification ledger](reference/gromp-spawn-verification.json).
