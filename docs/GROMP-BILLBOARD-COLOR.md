# Gromp complex billboard color

The three audited complex CameraQuad layers—`lightring`, `flashfrog`, and
`chunks`—now prepare/sample their raw color keys with the checked float32
sequence and submit normalized BGRA bytes using legacy truncation. Their source
render modes are 4/1/1, so this scoped writer does not premultiply or clamp.
It rejects colors outside its finite unit-RGBA contract.

The [source route audit](NATIVE-GROMP-EMITTER-ROUTES.md) is essential to this
scope: flash explicitly declares Simple, while seven other group types use the
checked Complex default. Shadow and skin shards have separate plane/mesh
primitives. Flash, plane, mesh and the two Rays retain their previous arithmetic
and storage paths. All local clocks, RNG, geometry, atlas, lookup coordinates,
textures and blend factors remain unchanged.

The [native curve reading](NATIVE-LEGACY-COLOR-CURVES.md) supplies exact original
Troy numeric strings and the conditional raw-key arithmetic. The
[CameraQuad packet reading](NATIVE-CAMERAQUAD-PACKETS.md) supplies float32 ×255
followed by unsigned truncation. This differs from the separate Ray rounding
rule: half intensity becomes byte 127 here. Native loading/drawing, later cache
mutation, color backing mode, clocks, external modifiers, FPCR and complete
appearance remain unobserved. This implements the checked components within the
existing local raw-key policy; it does not certify full native parity.

## Independent component verification

The new host-C reference scans original strings from SHA-pinned records,
prepares float32 base/key products, and evaluates each subtraction/division/
multiplication/addition separately. It compiles with contraction and fast math
disabled. It accepts only profiles 1/2/3 and normalized finite local phases,
checks their queue-class scope and unpremultiplied modes, and retains C source,
compiler identity, flags and source pins. No native game code is executed.

Across 6,507 sampler calls, all **118,988 target states** match C. Every other
field of those particles and all **195,716 states from the other five profiles**
match the frozen accepted source at `46e69f7`. Another 3,027 float32 key-neighbor
and randomized phases match independently. The 51 durable C fixtures cover
source knots, neighboring float32 phases and visible interpolation phases.

| Profile | States | Changed float32 color states | Different from previous float tint |
| --- | ---: | ---: | ---: |
| lightring (1) | 648 | 378 | 621 |
| flashfrog (2) | 648 | 297 | 513 |
| chunks (3) | 117,692 | 68,666 | 113,641 |

The last column compares normalized packed bytes against the previous float32
attribute values; it is distinct from a float32 interpolation word change.
The largest retained normalized-channel difference is 0.0039215535. At authored
capacity, these 152 particles use 3,648 color bytes instead of 14,592, saving
10,944 bytes per corpse's three batches. These are storage counts, not a frame
rate or total-memory improvement measurement. Packed layers also borrow the
sampled tuple directly rather than cloning it before writing owned bytes.

GPU acceptance spans seven phases, three camera directions, two sizes and two
blend settings for each target profile: **252 nonempty comparisons**. Actual
batch bytes match C. The stronger reference converts C BGRA bytes to explicit
RGBA float attributes, bypassing byte normalization and the BGRA shader decoder;
every rendered channel matches exactly. The previous float-tint counterfactual
differs by 238,280 channel bytes across those views. The initial same-byte-path
reference is retained separately and is not added to the accepted comparison
count. GL/page errors are zero.

The two unchanged Ray cases pass their existing 180 pixel comparisons. The
actual game-flow check still covers all eight contributing layers, eight effect
draws, posed-bone attachment, fog, exact active buffers across Save/reload and
disposal. Its fresh practice capture was visually inspected. The material blend
check retains ADD, BLEND and ADD_BLEND behavior.

```sh
node tools/qa/verify-gromp-billboard-color.mjs --output-dir .cache/gromp-billboard-new
npx vitest run tests/gromp-billboard-color.test.ts tests/gromp-death-particles.test.ts tests/legacy-particle-color.test.ts --maxWorkers=1
node --test tools/qa/legacy-billboard-color-reference.test.mjs
npx playwright test e2e/gromp-billboard-color.spec.ts e2e/gromp-ray-packets.spec.ts e2e/gromp-death.spec.ts
```

The [verification record](reference/gromp-billboard-color-verification.json)
records source freezes, compiler/reference evidence, distinct browser batches,
full application acceptance and limits. Schema 163 and simulation rules are
unchanged; the active cohort's 539 source pins stay exact.

## Application acceptance

The final source freeze passes TypeScript, all 10 Node QA checks and 121 focused
unit cases. The full suite has 3,251 passes across 397 files, with only the two
unchanged baseline failures: the missing original Leona Eclipse evidence closure
and the Lux missile snapshot's host-sensitive arithmetic digest. Their assertions
and expected results remain intact.

A fresh production build passes all 32 nested-path scenarios, with eight fresh
screenshots and no exposed development hook. The exact 1,202-file, 538,092,047-byte
pack (`174aa16a30410ad6a3a346861478f57a332ea4efe36de1a0e26e9e531cb0f2f5`)
also passes corruption rejection, cancellation/retry, offline repair and saved-tick
restore, a new offline Lux lane match, and atomic two-version activation. The run
records 978 service-worker responses and zero production page errors. All 1,125
public asset/data files retain their sizes and modification times. These checks
use system Chromium with software rendering; they make no physical-GPU claim.
The long-running match cohort is paused only during competing acceptance work
and resumed afterward, with each owned-process pause retained in the record.

## Historical Ray checkpoint

The original Ray component verifier now freezes its accepted sampler at
`46e69f7` while retaining its original pre-packing source graph and every prior
equality/C assertion. Its 255,500 non-Ray equalities describe that historical
checkpoint. The current whole-sampler verifier above checks the new billboards
and requires every other profile—including Rays—to stay exactly unchanged.
Historical curve-view performance comparisons remain frozen at both original
endpoints and make no performance claim for this arithmetic change.

## Subsequent plane checkpoint

The separate [plane correction](GROMP-PLANE-COLOR.md) now changes only shadow
profile4. This page and its verification record retain the original billboard
checkpoint. Its historical whole-sampler tool freezes the accepted sampler at
`395a4fe`; the current plane verifier checks the complete five-second lifetime
and requires every billboard/Ray/Simple-flash/mesh state to remain exact.
