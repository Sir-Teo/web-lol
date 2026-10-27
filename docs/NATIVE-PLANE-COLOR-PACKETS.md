# Legacy plane color packet route

The checked legacy `p-type=1` factory branch selects a distinct plane object and
vertex builder. Its color route multiplies modulation RGBA by prepared draw RGBA,
conditionally premultiplies, and calls the same truncating converter used by
legacy CameraQuad. Gromp's shadow is the single matching source profile. This
reading changes no application rendering.

The [bounded record](reference/native-plane-color-packets.json) retains the
complete 1,668-byte builder, 62 selected instruction words, the virtual-slot bytes,
and SHA-pinned parent evidence. It replays directly against the checked native
ARM64 slice without a disassembler, network access or target execution.

| Link | Checked result |
| --- | --- |
| Legacy switch entry 1 | `0x10189bb2c` |
| Allocation / stored kind | 16 bytes / kind 1 at offset 8 |
| Vtable / method slot | `0x102481c10` / offset 40 |
| Virtual builder | `0x1018d5924..0x1018d5fa8` |
| Modulation | Definition RGBA at offset `0xe0` |
| Draw color | RGBA at offset 4 in a 44-byte record |
| Truncating converter | Call `0x1018d5a30` to `0x10167faf0` |
| Output | One BGRA word at offset 12 in four 28-byte vertices |
| Gromp source | Group 4, compiled profile 4, `shadow`, Complex, mode 1 |

This factory branch stores its vtable and returns directly through the result
pointer. It does not use the Ray branch's common initializer at offset `0x10`.
The inherited [queue reading](NATIVE-PARTICLE-QUEUE-ROUTES.md) connects Complex
source definitions to the legacy draw consumer's primitive virtual dispatch.
The [Gromp group reading](NATIVE-GROMP-EMITTER-ROUTES.md) validates the omitted
GroupPart4Type key and checked Complex default against the original Troy bytes.

The builder loads two modulation pairs and two draw-color pairs, then performs
four float32 products. It compares `(blendMode | 2)` with 2. Equal modes multiply
RGB by alpha and replace alpha with 1. Gromp shadow's authored mode 1 skips that
branch. The converter multiplies float32 components by 255, applies unsigned
truncation, and retains low bytes; it has no rounding addition or explicit unit
clamp. This does not generalize the finite unit-color policy of the current
billboard writer to arbitrary native inputs.

```sh
python tools/assets/native_plane_color_packets.py --check
python -O tools/assets/native_plane_color_packets.py --check
python tools/assets/test-native-plane-color-packets.py
python -O tools/assets/test-native-plane-color-packets.py
```

The guard suite mutates complete bytes, selected words, function bounds, switch
entries, allocation/kind/result stores, vtable slots, helper and premultiply
branches, inherited queue dispatch, source bytes, profile/group links and blend
scope. Missing and conflicting output checks must preserve existing files and
avoid creating evidence under `--check`.

Static linkage does not establish actual native loader/draw admission, color
backing mode/cache mutation, phase, clocks/RNG, external modifiers, FPCR or live
material/layout/shader selection. The complete builder includes half conversion
sites, but this reading does not establish UV phase/frame inputs or geometry.
An independent arithmetic and rendered-pixel projection is still required before
changing the local plane policy. The accepted application remains at `395a4fe`,
with schema 163 and rules fingerprint
`1a1c286c5148bc1fef511cbf6ac28915e3638c0cd8834faed99ee2bc10fbb7d6`.

The [verification record](reference/native-plane-color-packets-verification.json)
retains the source freeze, both interpreter modes, immutable output-policy
checks, original guard diagnostic and inherited application acceptance.
