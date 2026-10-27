# Legacy Troy color-key preparation

The original Gromp death Troy resource is restored and matches its older
SHA256 pin: 2,720 bytes and all 272 typed rows, including the original numeric
strings. This checkpoint traces those strings through a conditional native
color component. It changes no game arithmetic or rendered value.

The complex Troy reader at `10189a314` reads `p-type` through the same primitive
factory established by the [legacy mapping](NATIVE-LEGACY-PRIMITIVE-TYPES.md).
It calls the common curve reader at `10189be6c`. That reader passes `p-xrgba`
to the color wrapper for definition `+388`; the complex reader separately
passes `e-rgba` for birth color at `+150`.

The restored eight emitter sections contain 27 ordered color keys. Base RGBA
and numbered time/RGBA tuples are original strings. Python float32 conversion
and host C `sscanf` agree on every supplied source word. The native key reader
multiplies each key RGBA by the base in float32 before appending it. Supplied
`e-rgba` base strings additionally use a 1/255 factor; missing defaults bypass
that conversion.

The wrapper initializes the curve cache flag and cache length to zero. The
key appender updates time/value arrays and counts without changing those
fields. The lower reader skips uniform resampling when that flag remains zero,
leaving the compiled cache pointer null. This binds the initialized raw-key
branch; it does not observe all later runtime state or live parser modes.

All 80 checked birth/probability keys are absent from the complete typed source,
including unlabeled rows. When no R/G/B/A probability field is supplied, the
reader frees and nulls the four probability objects. The sample dispatcher
returns the evaluated curve directly when the first pointer is null.

The raw-key evaluator returns a stored vector for a single key, clamps to the
endpoint keys, and computes interior intervals with float32 subtraction,
division, multiplication and addition. That interpolation sequence contains
no fused multiply-add. The alternative uniform-cache branch uses a different
operation sequence and is not treated as interchangeable.

The draw-data producer at `1018fbd24` derives a clamped float32 lifetime phase
and evaluates the color component through vtable slot `+40`. It then multiplies
by per-particle birth RGBA and separately by external color values. The latter
comes through a state object's `+E0` pointer; it is distinct from the emitter
**definition** `+E0` modulation checked in the
[modulation witness](NATIVE-LEGACY-MODULATION-DEFAULT.md).

Seven complete function spans and 231 selected instructions supplement the
inherited native witnesses. Twenty-two guard groups check every span and
selected word, function bounds, literals, vtable linkage, original source bytes,
source-reader identity, typed rows, section/index linkage, compiled keys,
source arity/storage and finite values. Normal and optimized Python replay the
record; offline observation blocks sockets and subprocesses.

A separate diagnostic host-C projection uses the exact source strings and
retained local phases, with contraction disabled. Among 59,204 Ray states it
changes intermediate float32 colors in 18,085 `pop` and 8,733 `popshards` cases.
Packed BGRA differs for one `popshards` sample, by one blue byte, at retained
phase approximately 0.7291666666666665. This is conditional component evidence,
not a native-game framebuffer comparison or an application correction.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/restore-gromp-death-source.py
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/native_legacy_color_curves.py --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/test-native-legacy-color-curves.py
```

`--restore-source` on the witness can restore its missing source first. Downloads
use frozen SHA256 values, exact manifest range binding and bounded response
validation. Existing resource bytes are checked and retained. The restore covers
one Gromp resource, not all 36 older resources or the missing Leona certificate.

Live configuration modes, later curve-cache state, native event/RNG clocks,
external colors, FPCR, draw/shader selection and complete composition remain
outside this checkpoint. No native game code or Metal shader executes. The
[record](reference/native-legacy-color-curves.json) and
[verification ledger](reference/native-legacy-color-curves-verification.json)
retain the source identities and replay evidence. Application acceptance is
inherited from the unchanged [curve-view optimization](GROMP-CURVE-VIEWS.md).
