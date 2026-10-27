# Native legacy primitive conversion

The frozen ARM64 client maps legacy Troy `p-type=2` to the same Ray class and
virtual vertex builder already checked for modern BIN emitters. This static
witness closes the type-conversion link; it changes no game rendering policy.

The complete loader at `1018a15ec..1018a3ae8` supplies the literal `p-type` to
reader `10162f7bc` with default zero, loads its returned low byte into W0, and
calls factory `10189bad8` with X8 pointing at the stack return slot. It then
stores the returned primitive pointer at definition offset `+0x60`.

The complete factory at `10189bad8..10189be6c` uses a 13-byte table at
`10213342b`, relative to branch base `10189bb14`. Entry 2 is 17, selecting
`10189bb58`. That branch allocates 24 bytes, writes kind 2 at offset `+8`, and
assigns vptr `102482228`. Its slot `+40` points to `1018d9178`, the separately
verified [Ray vertex builder](NATIVE-RAY-PACKET.md). The inherited first
[Metal declaration](NATIVE-PARTICLE-VERTEX-FORMAT.md) remains conditional on
actual draw selection.

The retained Gromp source pin identifies `pop` and `popshards` (compiled indices
5 and 7) as legacy type 2. Their decoded Troy fields and source-pin binding are
checked alongside the native conversion. This increment does not reconstruct
missing original Troy archive bytes or certify the entire legacy reader.

The loader also supplies `p-rgba` and
`DATA/Particles/DefaultColorOverLifetime.dds` as key/fallback arguments for
configuration destination `+0xa8`. It supplies `DATA/Particles/DefaultFalloff.dds`
for destination `+0xb8`. The fallback resource contents and live material/UV
selection remain unresolved. The local Gromp color/lookup paths stay unchanged.

The [record](reference/native-legacy-primitive-types.json) retains both complete
function byte spans, 43 separately checked instructions, every switch-table byte,
four literals and the linked Ray vtable method. Fifteen mutation/offline guards
run in normal and optimized Python. They reject function, instruction, table,
kind, literal, vtable, source-type and pin changes. Offline observation blocks
network sockets and child processes.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/native_legacy_primitive_types.py --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/test-native-legacy-primitive-types.py
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python -O tools/assets/test-native-legacy-primitive-types.py
```

This is bounded static evidence. Native game/Metal execution, live Gromp loader
selection, legacy defaults beyond the checked arguments, prepared-color producers,
samplers, external modifiers and complete visual parity remain unobserved.
Fresh checks replace no historical LLVM/source archive. Application validation is
inherited from the accepted modern-ray checkpoint when its fingerprint and
production pack remain unchanged; the
[verification ledger](reference/native-legacy-primitive-types-verification.json)
records that identity check and replay evidence.
