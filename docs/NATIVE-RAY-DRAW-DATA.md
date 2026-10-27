# Native prepared ray scale data

The [draw-data record](reference/native-ray-draw-data.json) tracks four complete
native functions and 48 selected instruction words. It connects the prepared
particle scale writes to the ray builder's loads, temporary spills and corner
math. X controls width, Y controls length, and Z controls near-edge displacement.
This agrees with the game's existing component mapping; no geometry changes.

| Data | X | Y | Z |
| --- | --- | --- | --- |
| Initializer input byte offset | 104 | 108 | 112 |
| 36-byte birth record byte offset | 16 | 20 | 24 |
| 44-byte prepared draw record byte offset | 20 | 24 | 28 |
| Ray temporary spill byte offset from SP | 128 | 112 | 96 |
| Ray role | Full width | Length | Near displacement |

Candidate `scale0`, registered at definition offset `0x420`, supplies either a
constant vector or a vector evaluated at clamped particle phase. The writer
multiplies each lane by the matching birth-record component and a shared emitter
factor. It writes XY together and Z separately without changing their order.
An optional external uniform factor can subsequently multiply all three lanes.
Candidate `birthScale0` is separately registered at `0x3e8`; both candidates use
the wrapper that registers descriptor tag `0x83`.

The ray builder iterates backward. Its cursor points at draw-record byte 24,
so loads at cursor minus four, cursor, and cursor plus four read X, Y, and Z.
After a shared factor, the builder spills Y/X together at SP+112/SP+128 and
Z at SP+96. It reloads Z/Y into Q5/Q6 for axial math and X into Q7 for half-width.
Tracking this spill is necessary to identify each component correctly.

The earlier [ray packet checkpoint](NATIVE-RAY-PACKET.md) prose assigned the
axial and width roles incorrectly. Its original JSON remains unchanged as a
historical record. This new record explicitly corrects the interpretation with
the full write/load/spill/reload sequence. Existing game size mapping already
agrees with the corrected reading.

The birth initializer copies input floats into the birth record; the producer
of that input remains unresolved. This does not establish native transform,
attachment, orientation, axis fallback, UV orientation, live FPCR or visual
parity. No native executable or shader was run. Missing historical archives
are neither replaced nor certified.

The later [birth-scale trace and correction](NATIVE-RAY-BIRTH-SCALE.md) follows
the initializer input back through the native birth-preparation routine. It
preserves the primary ray's independent `[80,180,0]` birth vector and X/Y scale
curves, correcting a local uniform-fill shortcut. External vector modifiers,
shared factors, orientation and live dispatch remain separate evidence.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/native_ray_draw_data.py --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/test-native-ray-draw-data.py
```

Eleven guard cases cover offline replay, complete functions, every selected
instruction, function boundaries, both field hashes and offsets, wrapper and
registry branches, descriptor tag, the historical record pin and inherited ray
dispatch. The [verification ledger](reference/native-ray-draw-data-verification.json)
records normal and optimized replay with the
accepted application and production pack unchanged.
