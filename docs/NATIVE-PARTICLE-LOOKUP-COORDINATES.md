# Native particle lookup coordinates

The checked legacy producer has separate lookup X/Y selectors, scales and offsets.
It writes those coordinates at offsets32/36 in the 44-byte draw record. The inline
28-byte CameraQuad and plane paths can read that pair into UV1 and convert each
component to half. This is a conditional source reading, not a runtime UV change.

The [bounded record](reference/native-particle-lookup-coordinates.json) retains
seven complete functions (11,596 bytes), 253 selected words, four FNV field
candidates and the constructor literal. It replays against the pinned native
ARM64 image without native game or shader execution.

| Definition field candidate | Offset | Producer representation |
| --- | --- | --- |
| `colorLookUpTypeX` | `0xcc` | Byte selector |
| `colorLookUpTypeY` | `0xcd` | Byte selector |
| `colorLookUpScales` | `0xd0` | Two float32 components |
| `colorLookUpOffsets` | `0xd8` | Two float32 components |

The constructor stores little-endian type bytes `[1,0]` and copies the literal
float4 `[1,1,0,0]` into the scale/offset block. These are constructor values;
later legacy loader writes and live overrides remain separate.

| Selector | Checked arithmetic/drive |
| --- | --- |
| 0 / default fallthrough | Return stored scale; ignore offset |
| 1 | Float32 FMADD(scale, clamped normalized lifetime, offset) |
| 2 | Selected float3 plus per-particle float3, float32 norm, then FMADD |
| 3 | FMADD(scale, scalar at+32 in the 36-byte particle record, offset) |

Mode2 includes an optional curve sample and auxiliary paths. The physical vector
and clock meanings are not certified here. Mode3 does not by itself attest the
random generator, seed or distribution. The draw record's offset0 is separately
filled by atlas frame logic; it is not a direct copy of normalized lifetime.

On the inline path, the null UV1-context branch loads the draw pair and zeros
its affine coefficients. Each corner then uses that base pair before half
conversion at vertex offsets24/26. Optional affine data follows another branch.
A separate context byte at offset40 selects alternate packet helpers when equal
to1; their bodies are outside this reading. Actual branch admission, layout and
shader binding are not observed. FPCR, rounding and flush modes remain unmeasured.

The existing [fallback resource reading](LEGACY-PARTICLE-DEFAULT-TEXTURES.md)
already proves that DefaultColorOverLifetime is opaque white at all texels in
its only mip. Its sampled color is coordinate independent under matching binding
and sampling, supporting the existing white substitution conditionally. The
nonwhite, mip-dependent DefaultFalloff resource remains a distinct unresolved use.
This increment changes no game asset, arithmetic, UV, shader or rendering buffer.

```sh
python tools/assets/native_particle_lookup_coordinates.py --check
python -O tools/assets/native_particle_lookup_coordinates.py --check
python tools/assets/test-native-particle-lookup-coordinates.py
python -O tools/assets/test-native-particle-lookup-coordinates.py
```

All 17 guards pass in each interpreter mode. They mutate complete functions,
selected words, bounds, source pins, field candidates/offsets/descriptors,
constructor bytes and literal address, mode arithmetic/stores, both conditional
UV1 paths, half outputs, inline packet selection and inherited dispatch.
Identical files keep their bytes and modification times; conflicts and missing
`--check` outputs reject without mutation or creation. The
[verification ledger](reference/native-particle-lookup-coordinates-verification.json)
retains the source freeze, earlier provisional reading and inherited application
acceptance. The match cohort runs throughout this source-only work.
