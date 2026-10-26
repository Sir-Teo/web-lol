# Native emitter atlas and flag defaults

The frozen native constructor supports the existing Yi primary-hit atlas and
orientation defaults. The [record](reference/native-emitter-scalar-defaults.json)
retains exact bytes for the emitter registration, constructor and three selected
wrappers. Its producer checks the complete frozen executable and extracts the
selected instructions directly, without a disassembler or target execution.

| Candidate field | Definition offset | Descriptor/storage | Constructor value |
| --- | --- | --- | --- |
| `startFrame` | `0x260` | 5 / unsigned 16-bit | 0 |
| `numFrames` | `0x262` | 5 / unsigned 16-bit | 1 |
| `frameRate` | `0x264` | 10 / float32 | 0 |

At `0x1018ac9f0`, `MOVZ W11, #0x10000` supplies the following 64-bit store
through the saved definition pointer at offset `0x260`. Its little-endian bytes
are `00 00 01 00 00 00 00 00`. Registration offsets and wrapper tags distinguish
the two 16-bit fields from the float. This supports a one-frame fallback when
Yi's fluid emitter omits `numFrames`; its explicit 2×2 texture grid does not
establish a four-frame animation.

The constructor stores `0x00202000` at offset `0x2d0`. Twenty-two registrations
supply distinct masks through the same packed-flag wrapper. The set candidates
are `useEmissionMeshNormalForBirth` (`0x2000`) and `isLocalOrientation`
(`0x200000`). Particle-local, direction-oriented, uniform-scale, random-start
and single-particle candidates are clear by default. One registered bit remains
unlabelled: hash `d1ee8634`, mask 1. No name is invented for it.

The Yi profile compiler consumes the immutable record for omitted flag defaults
and frame rate, and checks the shared atlas reader's omitted frame-count,
start-frame and random-start defaults against it. Explicit source controls
remain explicit. The float zero retains the existing integer JSON spelling;
all eleven generated profiles and fourteen accepted runtime exports are unchanged.

Field labels remain FNV/layout candidates. Native descriptor tags align with the
pinned BIN reader's unsigned-16 and float types. These observations establish
constructor storage, not actual Yi loader dispatch, later overrides or native
orientation/rendering semantics. The existing renderer's heading, attachment,
force, culling and shader policies retain their separate evidentiary scope.
Full constructor bytes include exception cleanup after the successful return at
`0x1018acbb0`; cleanup does not represent successful object construction.
Original missing historical LLVM archives are neither replaced nor certified.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/native_emitter_scalar_defaults.py --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/test-native-emitter-scalar-defaults.py
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/test-masteryi-primary-hit-profiles.py
```

Fifteen native extraction/corruption guards and 35 primary profile guards cover
changed native spans, store widths/bases/offsets, constructor values, registered
types/masks, immutable witness changes and shared atlas reader drift. The earlier
27 constructor/loader guards remain applicable. Check/replay details and retained
source snapshots are in the [verification ledger](reference/native-emitter-scalar-defaults-verification.json).
