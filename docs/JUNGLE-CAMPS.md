# Interim Rift Gromp camps

The lane match now schedules one Gromp on each half of the actual Rift. A camp
becomes ready at 67 seconds, uses the existing neutral combat/reset simulation, and
schedules a fresh unit 135 seconds after death. The two calendars are independent.
Corpses can expire without losing a pending respawn. Practice and the controlled
Gromp fixture retain their existing behavior. A later
[Blue Sentinel increment](BLUE-SENTINEL.md) adds two independently configured Blue
camps. [Red Brambleback](RED-BRAMBLEBACK.md) adds two more, for six independent
calendars in the lane match. The later
[emergence increment](GROMP-SPAWN.md) begins a protected source animation 3.2
seconds before each ready deadline and retains the remaining animation tail.

This is an incremental jungle implementation. The first spawn uses Riot's
published [26.1 standard Rift baseline](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/).
Respawn is a provisional local policy adopted from a shipped legacy default.
Later-patch timing changes, current native activation, native spawn calibration,
level scaling, native attacks/rewards, Smite, remaining camps and jungle-role AI
remain unfinished. See [NEUTRAL-GROMP](NEUTRAL-GROMP.md) for combat and presentation
limits. This does not finish the full role match or certify native camp behavior.

## Original script evidence

`reference/jungle-script-source.json` pins nine Lua 5.1 members from frozen Riot
16.18.8175716's `DATA/FINAL/Scripts.wad.client`, manifest `29CE6E781C3B6368`.
The extraction retains manifest, compressed range and individual file digests.
It includes map/SRX wrappers, shared neutral and level initializers, the camp
marker, Gromp character/basic-attack scripts and JungleCampSpawn module.

`tools/assets/lua51.py` reads the stock little-endian Lua 5.1 ABI with 8-byte
size_t/numbers, following Lua 5.1.5's `lundump.c` and `lopcodes.h`. It requires
neither a Lua VM nor a decompiler. Ten retained instruction windows contain
one-based PCs, original words, decoded operands and complete-prototype code
hashes. A restricted decoder reads straight-line literal tables/arithmetic and
represents Make3DPoint as three numbers; branches and other calls are rejected.
It does not run the original scripts or evaluate native feature flags.

Independent investigation used [Lua 5.1.5](https://www.lua.org/ftp/lua-5.1.5.tar.gz)
(tar SHA-256 `2640fc56a795f29d28ef15e13c34a47e223960b0240e8cb0a82d9b0738695333`)
and [unluac](https://github.com/viruscamp/unluac) revision
`9c59af46483a932a47224bf2ac84ad8a63094da5`. Neither is an extractor dependency.
Stock `luac -l -l -p` agrees on all 103 prototype instruction counts and 10,252
opcode names across the nine members. Decompilation located candidate windows;
the retained evidence comes from original bytecode.

The shared script connects camps 13/14, Order/Chaos OwlBear, to one `SRU_Gromp`
with the `spawn` animation through `PredefinedCamps[CAMPTYPE_OWLBEAR]`. Its
`Get3DPointPosition` names match unique map locators case-insensitively. The
original map BIN matches the previous map pin; finite FNV-verified labels decode
the locators without discovery dictionaries or a JSON mirror.

| Camp | Source locator XYZ | Runtime XY |
| --- | --- | --- |
| Order | 2110.6279296875, 54, 8450.984375 | -5314.3720703125, -1025.984375 |
| Chaos | 12703.62890625, 54, 6443.98388671875 | 5278.62890625, 981.01611328125 |

The Chaos locator differs from its anchor and placed character. Runtime uses
the locator and source facing point with the existing Rift transform. Membership
is not inferred from proximity or the number of placed templates.

The legacy first spawn is **99 seconds**: 65 + 22 + 1×12. Camps inherit a
135-second respawn, 700-unit leash and 3.2-second SpawnDuration. An override runs
before dictionary construction. Exporting native camp dictionaries is guarded
by `RawLSDeprecationNeutralMinions ~= true`. The level initializer gets its spawn
script from a mutator parameter; the SRX wrapper loads the shared script with
empty overrides. The active parameter/flag values remain unknown. Therefore
the conflicting 99-second value is retained but does not drive the calendar.

Gromp's character script and JungleCampSpawn module each contain only RETURN.
The basic-attack script supplies buff names and a skin override; it does not
resolve missing native damage or attack-selection implementation.

## Runtime and continuation

`src/content/rift-gromp-camps.json` retains the pin hash, exact locator/facing
points, first-spawn source and separate respawn policy. The JSON participates
in the simulation fingerprint. Each camp stores its stable ID and either live
unit ownership or a deadline. Death sets the deadline immediately; leash resets
leave it unchanged. Respawn creates a new ID, full Root health and clean idle
state after the protected emergence sequence. Match end freezes the calendar with the simulation.

Schema 92 checks camp mode/cardinality/IDs, deadlines, live ownership and source
home points. Older saves remain incompatible without silent migration. Lane
matches preload existing Gromp rigs/effects, including a checkpoint with only
waiting camps. Ordinary practice still requests no Gromp assets. Calendars grant
no camp knowledge to the HUD, minimap or bots; neutral visibility is unchanged.

Reproduce after the existing map extraction:

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-jungle-scripts.py
python3 tools/assets/export-rift-gromp-camps.py
python3 tools/assets/test-lua51.py
```

Repeated extraction requires exact pin equality. Export rewrites changed output
only. Five synthetic reader checks cover malformed carriers, constants, opcode
operands, function bindings and jumps. Runtime checks cover boundary ticks,
independent clears, corpse removal, saves, resets, match end and invalid ownership.
Chrome covers real lane menus, both rigs, fog filtering and corpse-free reload
followed by respawn. Browser probes advance fixed-step time to boundaries and
script the final kill; they are not a full seeded jungle-match playthrough.
Verification outcomes are recorded in [PROGRESS](PROGRESS.md).
