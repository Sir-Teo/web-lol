# Native atlas frame and quad vertex packing

The later [camera-quad packet trace](NATIVE-CAMERAQUAD-PACKETS.md) adds explicit
color-input and conversion evidence for legacy, optimized-local and optimized
billboard routes. The atlas observations below retain their original scope.

The frozen ARM64 renderer calculates a continuous atlas frame, converts it to
half precision in a quad vertex, and lets the quad vertex shader floor it.
[The static record](reference/native-atlas-runtime.json) retains five complete
function spans, 34 selected instruction checks, direct calls, native import
bindings and freshly decoded default quad shader text. The executable, original
shader pin and constructor/default witnesses remain immutable.

For the selected quad routine, the CPU calculation is:

```text
animation = frameRate > 0 ? frameRate * difference : 0
combined = randomStart ? fma(fraction, numFrames, animation) : animation
continuousFrame = startFrame + fmodf(combined, numFrames)
```

These are float32 operations. `difference` subtracts the per-particle array at
`+0x10` from emitter field `+0xf0`; the fraction comes from array `+0xa0`.
Their use is consistent with particle age and a random start fraction, but this
record does not prove their producers, clock units or RNG distribution. The
registration witness supplies the field offsets and random-start flag mask.
Mach-O indirect-symbol tables identify the called stub as `_fmodf`, rather than
assuming its meaning from an address or disassembler label.

The quad routine accepts primitive kinds 0 and 1. Its two packing helpers write
four 28-byte vertices with position float3 at byte 0, packed color at byte 12,
UV0 half4 at byte 16, and lookup UV half2 at byte 24. The continuous frame is UV0.z.
Particle-local orientation selects between these helpers; both convert that
frame to half. Color calculation and packing semantics are outside this atlas
reading. Ray emitters require their own trace.

At `0x10188efe8`, the binding routine loads definition `texDiv` at `+0x8c` and
constructs the literal `TEXTURE_INFO` value:

```text
[columns, columns == 0 ? 0 : 1/columns, rows == 0 ? 0 : 1/rows, 0]
```

The no-define quad VS, program 1, has the original pinned Metal payload checksum
`236469863433fb3bc58b4ac5077c1af050e2d375d0ee4679088c0427a82f7703`.
Its AIR instructions calculate:

```text
frame = floor(ATTR8.z)
row = floor(frame * TEXTURE_INFO.y)
u = (frame + ATTR8.x - row * TEXTURE_INFO.x) * TEXTURE_INFO.y
v = (row + ATTR8.y) * TEXTURE_INFO.z
```

Thus the frame is floored **after** vertex half conversion. Under nearest-even
rounding, continuous frames `0.9999`, `3.9996` and `15.999` become half values 1,
4 and 16. Flooring before conversion gives 0, 3 and 15. The unit examples use
Python's independent binary16 conversion; they do not claim to have measured
native FPCR or GPU execution. UV0.xy and lookup coordinates are also half values.
The mesh routine instead converts its continuous frame with `FCVTZS` before
forming `vParticleUVTransform`, so the quad packet must not be generalized to it.

At evidence checkpoint `c0f7504`, the primary-hit sampler still used its
integer-first atlas policy. The later [primary-hit packet correction](PRIMARY-HIT-HALF-PACKETS.md)
applies the recovered ordering to the retained quad profiles, whose unit UV
corners are exact in half precision, and quantizes their lookup inputs. Mesh and
ray paths retain separate scope. Native live shader selection and actual Yi
dispatch remain unverified.

The later [ray packet witness](NATIVE-RAY-PACKET.md) connects its candidate
type registration, two constructors, virtual dispatch and vertex builder. It
records half UV stores and a distinct clamped, rounded color path; its input
record producers and live GPU bindings still require separate tracing.

The producer reads the restored native executable and reconstructs two shader
resources from authenticated cached RMAN chunks. It checks the shader TOC's
empty-define selection, Metal payload, bitcode wrapper and bitcode hash. LLVM
19.1.7's C API prints fresh AIR text without compiling target code or changing
the AIR triple. The record identifies this reader and retains its text. This
additional evidence does not replace any missing historical LLVM archives.
The producer requires cached inputs and rejects a missing manifest before the
archive helper could attempt a download.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/native_atlas_runtime.py --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/test-native-atlas-runtime.py
```

Sixteen guard cases include per-span byte corruption and per-instruction changes,
wrong function bounds/import names/stub alignment/call targets, a changed uniform
literal pointer, changed shader resources/program/define selection, an offline
replay with network and child processes blocked, and half-frame counterexamples.
The [verification ledger](reference/native-atlas-runtime-verification.json)
retains normal/optimized checks, unchanged runtime outputs and the application
certificate inherited from the preceding rendering optimization.
