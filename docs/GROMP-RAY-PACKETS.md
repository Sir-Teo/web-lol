# Gromp Ray packet streams

Gromp's death `pop` and `popshards` batches now carry owned, normalized Uint8
BGRA color attributes and binary16 lookup coordinates. The
[legacy loader witness](NATIVE-LEGACY-PRIMITIVE-TYPES.md) maps their source
`p-type=2` through the native primitive factory to the previously checked
[Ray builder](NATIVE-RAY-PACKET.md). Its
[vertex declaration](NATIVE-PARTICLE-VERTEX-FORMAT.md) specifies normalized
byte colors, with the shader restoring RGBA through a BGRA swizzle.

The renderer reuses the existing finite Ray color writer. `pop` uses mode 1;
`popshards` uses mode 0, which premultiplies float32 RGB and replaces alpha with 1
before byte conversion. Each particle writes six contiguous vertex words.
Lookup rounding happens once per particle. Source tuples are borrowed without
modification. Six other batches retain their float color attributes. Draw
counts, atlas cells, dimensions, attachments and texture bindings are preserved.

Across both Ray batches, allocated color storage is 1,200 bytes per corpse,
down from 4,800 bytes. This describes those two attributes, not total rendering
memory, draw cost or FPS.

The independent comparison freezes source and lockfile at
`4ebf87e10cabf9f7eeafc94929b9486165cc5b79` (archive SHA256
`46af3e7b372318b0a65cf692fd4a7b015a0c0b2697f8c9a3c2c7ce359b70b5c5`).
All sampled states remain exact across 6,507 calls: 255,500 non-Ray states and
59,204 Rays. C/Python checks every Ray's finite byte projection, binary16 lookup
and neighboring vertex sentinels.

| Batch     | Ray states | Changed color packets | Changed lookup pairs |
| --------- | ---------: | --------------------: | -------------------: |
| pop       |     32,523 |                29,100 |               32,110 |
| popshards |     26,681 |                25,736 |               25,729 |

Browser calibration instantiates the actual Gromp loader and batched renderer
with real textures, then clones its geometry for an independent C-backed color
and lookup reference. Seven visible source phases, three cameras, two image
sizes and raw/runtime blending cover 84 cases per batch. A float counterfactual
uses identical geometry. The initial `pop` phase selection extended beyond its
authored alpha fade; those zero-visibility cases remain recorded as diagnostics.
Final phases keep every comparison nonempty.

The game-flow regression checks contribution from all eight batches, exactly
eight effect draws, posed-bone anchoring, exact active buffer bytes across fog
and Save/reload, and material/geometry disposal. Buffer hashes account for the
actual typed-array element size and include its type and normalization.

The save schema remains 163: this presentation correction introduces no saved
field. Existing textures, white fallback, curves, clocks, RNG, geometry and blend
factors retain the local implementation. The legacy fallback DDS contents,
native prepared-color producers, optional modifiers, sampler state and actual
live native Gromp dispatch remain unresolved. Packet calibration does not
establish full native composition or involve executing native game/Metal code.

```sh
node tools/qa/verify-gromp-ray-packets.mjs --output-dir .cache/gromp-ray-check-new
npx playwright test e2e/gromp-ray-packets.spec.ts e2e/gromp-death.spec.ts
```

Acceptance records 3,104 passing unit tests out of 3,106 across 394 files, with
the same two baseline failures. All 24 focused tests, TypeScript, six Node QA
checks, two normal/optimized legacy witness checks and six browser cases pass.
The 168 nonempty GPU comparisons differ by zero channel bytes; the earlier
float path differs by 2,311 and 26,569 bytes in the two respective fixtures.
All 543 asset/data files retain their bytes and modification times. Production
validation passes 32 recordings with eight fresh screenshots and no unintended
private preloads. The [verification ledger](reference/gromp-ray-packets-verification.json)
records source identities and archived evidence.
