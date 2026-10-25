# Attached-skin rim inputs

Eclipse's four attached-skin layers now supply the checked native CPU mapping
of the authored rim control to their shader exponent. The source tables retain
raw `fresnel`; a separate generated table provides the shader power. This fixes
an input mismatch in the local W renderer without changing its shader formula,
source geometry, masks, tint packing or erosion policy.

| W profile | Authored float32 rim control | Shader float32 exponent | Little-endian bytes |
| --- | --- | --- | --- |
| 4, 9 continuous | 0.05000000074505806 | 0.3449999988079071 | `d7a3b03e` |
| 5, 6 burst | 0.15000000596046448 | 0.8350000381469727 | `90c2553f` |

## Static evidence and boundary

The [input reading](reference/leona-attached-skin-reflection-inputs.json) retains
six raw W/E/R BIN definitions, bounded native instruction streams, the original
source-to-uniform code chain and attached-skin AIR. Its source-code observations
refer to frozen bytes before this correction. The executable is the previously
pinned matching 16.18 macOS client; it is read as data and is never launched.

`VfxPrimitiveAttachedMesh` registration leads to a constructor that writes kind11.
The old uniform consumer admits kind11 into the attached-resource path. With its
resource/pass guards satisfied and intermediate calls returning, that branch can
reach the common rim upload. The upload maps child `fresnel` at +0x2c with
`FMA32(source, 4.9f, 0.1f)` and supplies `fresnelColor.rgb` to `vFresnel`. This
is distinct from child `reflectionFresnel` at +0x18, which maps separately to
`vReflection.x`. The retained skin VS5 consumes `vFresnel.w` directly in its power
operation; no second mapping occurs in that shader.

All six supported W/E/R attached-skin definitions author blend4. The native
special RGB premultiplication/forced-alpha rule for blend0/2 therefore does not
apply to these source definitions. E/R omit the reflection child; their local
zero-rim RGB/exponent1 matches the conditional native null-child constant
`[0,0,0,1]`. Their factories and shader inputs are unchanged.

This supports a bounded W input correction. Actual Leona invocation, final
shader/pass, complete tint factors, cube resource, root/bone frame, samplers and
whole-frame equivalence remain unobserved. The local W material still draws the
rim without cube reflection. No claim that VS5 and PS34 form a linked native
pipeline follows from using them as separate arithmetic evidence.

## Implementation and checks

`export-leona-w-skin-fresnel.py` verifies the static reading, matches each current
source profile and emits exact mapped values into `leona-w-skin-fresnel.json`.
The W factory requires the profile and raw source to match that table before
constructing the material. The material continues to accept an explicit shader
exponent, including the E/R no-child fallback. The diagnostic descriptions now
name raw `fresnel` and mapped `fresnelPower` separately.

Both normal and optimized-Python static checks pass. Both reject altered mapped
power, source wire type and native-window controls. Twenty-three focused unit
cases pass across W/E/R skin and shared multiplier material tests. The additional
unit case rechecks the exporter and rejects unsupported profile/source pairs;
existing renderer tests inspect initial and extended W uniform values.

Sixteen Chrome cases pass the shared material probes and W/E/R source playback,
save/reload, exact graphics recovery and repeated resource retirement. There are
239 one-channel-level-bounded W material comparisons, including108 actual mask
texel cases. The mapped animated-rig CPU/GPU maxima are1/1/2 channel levels for
idle/walk/attack, with0/0/1 pixels differing by more than one level, within the
existing sparse-reference budget. Repeated GPU output and graphics recovery are
exact. The four-column source screenshot is inspected.

In the actual GameView, isolated profiles4/5/6/9 contribute1685/279/1712/955 pixels
at their sampled phases. Replacing only their mapped exponent with the old raw
control changes1628/261/1656/915 pixels; restoring the exponent changes zero.
These local image controls establish that the correction reaches each source
layer. They are neither native-frame nor full-family acceptance.

```sh
.tools/cdtb-venv/bin/python tools/assets/verify-leona-attached-skin-reflection-inputs.py --check
.tools/cdtb-venv/bin/python -O tools/assets/verify-leona-attached-skin-reflection-inputs.py --check
.tools/cdtb-venv/bin/python tools/assets/export-leona-w-skin-fresnel.py --check
python3 tools/assets/export-leona-w-skin-materials.py --check
```

The standard check passes 1,904 units in312 files, TypeScript and three Node QA
tests. Production passes32 nested-path recordings, with no development hook or
unrequested Leona preload. All966 public files remain byte-identical. Schema126
uses ruleset`2f2d7dac16d7b3c1d0e7a35d81ed8c9323ab623dc49e2201eec4094390ff15b0`.
Offline pack`394400909b59dfcc5f397a5aaba9f4a981d4b1c28b3822d0f5b983eb7f89d46d`
contains1,012 files/513,310,583 bytes and passes integrity, repair, saved offline
boot and atomic-version controls with963 worker responses and no production
errors. Production and offline evidence is retained in the
[accepted runtime ledger](reference/leona/w-skin-fresnel-verification.json). Player/support, complete Leona and native/full-roster acceptance
remain open.
