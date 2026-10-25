# Original Metal skin lookup fixture

The retained unchanged VS0/PS11 pair now passes 100 byte-exact Metal/scalar RGBA8
cases on the recorded Apple M1. Of these, 76 explicit white RGBA lookup cases
also match the current local WebGL material exactly. The other 24 have no local
WebGL comparison: the material has no lookup-resource path. A fresh 88-case
VS0/PS34 erosion regression also remains byte-exact across all three.

This is 188 original-Metal/scalar observations, with 164 local WebGL comparisons.
It extends the [skin fixture](LEONA-METAL-SKIN-HARNESS.md) without changing a game
material, source asset or actual Leona shader selection. The League executable
remains unexecuted; native dispatch, resource bindings and gameplay frames remain
open.

## Explicit nonerosion ABI

The [static reading](reference/leona-skin-nonerosion-abi.json) verifies the retained
original TOC/bundle, library/AIR identity and matching VS0/PS11 varying locations.
PS11 has `DISABLE_FOW`, without erosion. Its fragment buffer 16 is 8 bytes:
`COLOR_LOOKUP_UV` float2 at 0, uniform for the whole draw. Texture slots are 0 remap,
1 base and 2 lookup; samplers are 0 base, 1 lookup and 15 shared. Reusing PS34's
texture ordering would swap the base and lookup. The original vertex bone,
frame, locals and attribute contracts are unchanged.

```text
Q = sample(base, transformedBaseUV) * sample(lookup, uniformLookupUV)
C = Q * tint
selectedRGB = remap.a > 0 ? remap.rgb : C.rgb
RGB = clamp(selectedRGB + Q.a * vertexRim, 0, 1)
alpha = C.a
```

The rim receives base alpha multiplied by lookup alpha before tint alpha.
Remap replaces only RGB. The fixture supplies explicit nearest/clamp samplers,
zero depth push, orthographic projection and identity bind transforms. White
RGBA lookup makes the local material's implicit neutral contribution equivalent
in these supplied cases; it proves no native default resource or W variant.

## Controls and recorded result

The 100 cases retain base/tint alpha, mapped/raw powers, normals, bones, remap and
base-UV controls from the earlier fixture. Additional lookup draws sweep alpha
0/64/128/255, tint alpha 0/.2/1 and both mapped powers. Two-texel controls change
uniform lookup UV independently of base UV and include colored lookup RGB.
These 24 non-neutral lookup cases compare Metal and scalar only; saved comparison
fields explicitly contain null for WebGL. Two of those controls keep lookup
alpha 0 and active remap alpha 1/255.

In the oblique four-bone fixture at power 0.345, lookup alpha 0 produces
`[20,72,132,0]`. Lookup alpha 64 produces RGB `[29,79,135]`, alpha 128 gives
`[38,85,139]`, and alpha 255 gives`[55,98,145]`. These RGB values remain the same
when tint alpha changes. Output alpha for lookup alpha 255 is 0/26/128 for tint
alpha 0/.2/1. With lookup alpha 0 and active remap, both remap alpha 1 and255 yield
`[240,20,170,0]`. The original shader executes unchanged for each observation.

All native command buffers complete and all compared WebGL errors are zero.
Maximum channel differences are zero in the 100 lookup cases, 76 local comparisons
and fresh 88 erosion comparisons. Initial 98/100 runs are retained as earlier
results; the accepted final runs use the final shared source and input capture.
The independent static harness review and its capture addendum retain exact
reviewed file hashes. Normal and optimized-Python ABI checks and the three Node
QA tests pass.

## Source capture and limits

The runner requires a fresh output directory. Before compilation, it copies all
14 whitelisted inputs into each run's input tree and compares their hashes with
the recorded input manifest. This includes both original libraries, owned Swift,
case/scalar and preview sources, material/data and package/lock/config files.
The [runtime ledger](reference/leona/metal-skin-lookup-verification.json) freezes
those copies, commands, executable hashes, stdout/stderr and every comparison.
Its offline verifier compiles or executes nothing and rejects missing cases,
changed pixels/library records, a fabricated unsupported WebGL result and an
altered input snapshot.

Execution still reads live paths after capture. No concurrent edits occurred
while the accepted runs executed; captured bytes also match the final inputs.
This is not an atomic filesystem lock or a snapshot of installed dependencies,
the browser or SDK. Package-lock records dependency intent; recorded versions
and the earlier Three-chunk review bound the fixture. Actual native palette
preparation, nonidentity binds, perspective, spatial remap ramps, nonzero depth
push, native sampler/render state and Leona gameplay frames remain unverified.

```sh
node tools/qa/run-leona-metal-skin.mjs --run --lookup --output .cache/my-fresh-lookup-run
node tools/qa/verify-leona-metal-skin-lookup.mjs
```

Earlier 88 and 267-case skin/depth ledgers continue to verify historically. There
is no new production/offline run, normal-match cohort or performance claim.
Schema 126, ruleset `de9c47cb` and accepted pack `5a22adeb` remain unchanged. Playable
Leona, full support behavior and full-roster/native-frame acceptance remain open.
