# Gromp mesh raw color

The skin-shard mesh now uses the checked float32 raw-key color preparation and
interpolation sequence. It retains its float RGBA attribute and shader path.
The [native mesh route](NATIVE-MESH-COLOR-ROUTE.md) distinguishes that conditional
16-byte float transfer from quad byte packing. This change adds only profile6
to the existing sampler policy; no renderer, geometry, UV, texture, blend, clock
or RNG behavior changes.

All seven Complex profiles now use the shared conditional float32 raw-key policy.
The explicit Simple flash stays separate and has constant white color. Native
live backing mode/cache mutation, phase, clocks/RNG, external modifiers, FPCR and
material/layout/shader binding remain unobserved. This is arithmetic component
fidelity within the local raw-key policy, not full native appearance parity.

## Independent arithmetic and retained state

The separate host-C reference scans original source strings from SHA-pinned
records and prepares float32 base/key products. It evaluates subtraction,
division, multiplication and addition separately, with contraction and fast math
disabled. Only mesh profile6 and its unpremultiplied mode1 are accepted. Its
four-key curve includes the nonbinary source times `.1` and `.7`. No native game
code runs; compiler identity, flags, C source and input hashes are retained.

Across **16,497 sampler calls**, all **196,431 mesh states** match C, including
float attribute words. Every non-color field and all **195,391 states from the
other seven profiles** match the accepted application at `891abcc`. The sweep
covers three death ticks, nine corpse IDs and half-tick steps through 305 ticks,
beyond the mesh's four-second maximum life. Another 1,010 key-neighbor/random
phases match C. The 34 durable fixtures cover source knots, neighboring float32
values and visible fade phases.

There are 47,109 changed float32 color states, with a maximum channel delta of
0.000000178814. The prior float attribute and the corrected one produce identical
pixels in the retained render matrix. **No visible improvement, storage saving or
frame-rate improvement is claimed.** The change removes the measured arithmetic
discrepancy while preserving the existing rendering path.

## Browser acceptance

The mesh's seven sampled phases, three camera directions, two resolutions and
two blend settings give **84 nonempty comparisons**, with zero pixel differences
from independent C RGBA and zero GL/page errors. Every active float attribute
matches C before rendering, including all retained particles. The test camera
frames the first retained shard while keeping the complete actual batch intact;
the initial full-cloud bounds left eight 64-pixel views empty and are retained
as a diagnostic. No game camera or mesh geometry was changed for the test repair.

All **nine browser cases pass in one clean batch**: mesh, plane (84 comparisons),
three billboards (252), two Rays (180), actual eight-layer death flow and material
blending. The latter checks retain posed-bone attachment, fog, exact active buffers
across Save/reload, disposal and source-alpha blend behavior.

```sh
node tools/qa/verify-gromp-mesh-color.mjs --output-dir .cache/gromp-mesh-new
npx vitest run tests/gromp-mesh-color.test.ts tests/gromp-plane-color.test.ts tests/gromp-billboard-color.test.ts --maxWorkers=1
node --test tools/qa/legacy-mesh-color-reference.test.mjs
npx playwright test e2e/gromp-mesh-color.spec.ts e2e/gromp-plane-color.spec.ts e2e/gromp-billboard-color.spec.ts e2e/gromp-ray-packets.spec.ts e2e/gromp-death.spec.ts
```

The prior plane verifier now explicitly freezes its accepted sampler at
`891abcc`, preserving its original equality/C assertion body byte-for-byte. The
current mesh verifier checks every other profile exactly. Historical billboard,
Ray and performance endpoints retain their existing scope and assertions.
The [verification record](reference/gromp-mesh-color-verification.json) retains
source freezes, compiler/C evidence, earlier diagnostics and application checks.

## Application acceptance

TypeScript, all 14 Node QA checks and 194 focused cases across six files pass.
The full suite passes 3,324 of 3,326 cases across 399 files; only the unchanged
missing Leona Eclipse evidence and host-sensitive Lux missile snapshot failures
remain. Their assertions and expected results are preserved.

The production build passes all 32 nested-path scenarios, with eight fresh
captures and no development hook. Its exact pack is
`273e1d8ec876bb239ef52ae674f4ed95f23cb665b4094a1408b0ec37b9fe3390`
(1,202 files / 538,092,143 bytes). That exact pack passes corruption rejection, cancellation/retry, offline repair,
saved-tick restore, a new offline Lux lane match and atomic two-version
activation. The run records 978 service-worker responses and zero page errors.
Schema 163, rules fingerprint
`1a1c286c5148bc1fef511cbf6ac28915e3638c0cd8834faed99ee2bc10fbb7d6`,
and all 539 cohort source pins remain unchanged. All 1,125 public asset/data files
retain their sizes and modification times. Software-Chromium checks do not
certify physical GPU performance.
