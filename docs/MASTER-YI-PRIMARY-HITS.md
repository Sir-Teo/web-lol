# Master Yi primary contact effects

The private Master Yi fixture now renders all three declared primary hit systems
on accepted ordinary/critical contacts: eleven emitters and 93 authored mip
levels. Independent saved target poses place effects on the declared chest
bone, with separate finite histories through target removal, source death,
fog and victory. Ordinary trails and audio retain their existing admission.

The runtime keeps fluid unblended with its alpha threshold, alpha-blended blood
and soft particles, additive flashes, source atlas controls, spawn rotations,
world acceleration, birth drag and spatial drag. It borrows four verified Yi
textures and adds seven source transports. No new attack sound is inferred.

The following sections retain the source preparation evidence. Runtime uses
explicit reconstruction policies: source-X reflection, 0.01 units, captured
attacker facing, 60 Hz Float32 force replay and a spatial drag field fixed at
the birth root. Missing procedural/ward/structure chest bones retain the shared
root-plus-0.9 fallback. Native force cadence, shader selection, sampler state,
inherited scale/rotation and missing-bone fallback remain uncalibrated. Mobile
rigs must contain their declared bone; a missing mobile attachment fails loudly.

The frozen 16.18.8175716 base character binds three primary spells to three
complete particle systems. This source checkpoint retains eleven emitters,
two particle/skin BINs and eleven TEX files, totaling 974,269 native bytes.
The original 27,930-byte character BIN is checked separately against all
60 records and its linked-file declaration. No standalone mesh is referenced.

| Spell | Resource | Emitters |
| --- | --- | ---: |
| `MasterYiBasicAttack` | `MasterYi_BA_Tar_01` | 4 |
| `MasterYiBasicAttack2` | `MasterYi_BA_Tar_02` | 4 |
| `MasterYiCritAttack` | `MasterYi_Crit_tar` | 3 |

All three explicitly set `bHaveHitEffect` and `bHaveHitBone` to true and name
`C_BUFFBONE_GLB_CHEST_LOC`. This is the target attachment declaration. The
caster's center joint used by attack trails does not establish its transform.
Target rig availability, missing-bone fallback, inherited transforms and
contact-time pose capture remain integration work.

Each ordinary system contains `fluid`, `flash`, `blood_drops` and `soft`.
Fluid declares blend 3; blood and soft declare blend 1. Flash declares bind
weight 1 and omits blend mode. The critical system contains `ground_glow`,
`flash` and `bubble`; the first two declare blend 4 and bubble omits it.
Only the critical ground glow explicitly declares full binding. Omitted bind
and local-orientation controls remain omissions. The name `ground_glow` alone
does not prove terrain projection. No system declares flags, creation sound
or persistent sound defaults.

The complete definitions, probability curves, source types, paths and native
hashes are in [the frozen pin](reference/masteryi/primary-hit-particles.json).
The [binding reading](reference/masteryi/primary-hit-binding-reading.json)
provides a selected-field index anchored to the complete-resource digest;
it is not a reduced runtime profile. Sampler/material parity and all eleven emitters must be handled before
runtime integration. This
checkpoint changes no runtime dispatch, save schema or public assets.

From the repository root, with the pinned CDTB environment:

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-masteryi-primary-hits.py
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-masteryi-primary-hits.py --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/prepare-masteryi-primary-hits.py --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/test-masteryi-primary-hits.py
```

Extraction refuses existing conflicts, verifies frozen archive provenance and
reparses the native records before creating missing outputs. The reader
refuses changed source/model pins. Thirty guards pass in normal and optimized
Python; native checks and replay preserve all thirteen originals and the
reading byte-for-byte with unchanged modification times. The
[verification ledger](reference/masteryi/primary-hit-source-verification.json)
records archived inputs, logs and unchanged application identity. The previous
application certificate remains 3,037 passing tests with three documented
baseline failures; no new full application run is claimed for this source-only
checkpoint.

## Private authored texture decode

The [decoded record](reference/masteryi/primary-hit-particles-decoded.json)
retains all 93 mips from eleven textures: six format-10 BC1 textures and five
format-12 BC3 textures. The private PNGs total 546,090 bytes and independently
replay to 4,767,732 RGBA bytes using the standard-library PNG checker. The
producer uses the pinned CDTB TEX-to-DDS conversion and recorded Pillow build.
This is a software decode certificate; native GPU filtering remains uncalibrated.

Four textures match Q, two match W, three match R, one matches E and one matches
attack trails. These are overlapping family counts. For each shared texture,
the native identity and every mip field except its output path match exactly,
including compressed blocks, PNG bytes, RGBA pixels and alpha statistics.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/decode-masteryi-primary-hits.py --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/test-masteryi-primary-hit-decode.py
```

Thirteen decode guards pass in both normal and optimized Python. The independent
checker runs with producer dependencies blocked, and rejects missing textures,
meshes, mip ranges, pixel digests and alpha statistics. Replay preserves all
94 output bytes and modification times. The explicit zero-mesh profile leaves
the common decoder's two-mesh default unchanged. See the
[decode ledger](reference/masteryi/primary-hit-decode-verification.json).

## Lossless private texture transport

The eleven delivery PNGs total 605,648 bytes and recover all 93 authored mip
rectangles exactly. A texture consumer must extract each rectangle into its
own texture level; sampling the packed image directly is invalid. No public
asset or effect dispatch is added.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/pack-masteryi-primary-hit-textures.py --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/test-masteryi-primary-hit-transport.py
```

Ten transport corruption guards pass in normal and optimized Python. Both
modes replay all twelve staged outputs with identical bytes and timestamps.
The browser probe uses the real authored-mip loader and Three WebGL upload:
all 93 framebuffer readbacks exactly match the recorded RGBA hashes. Concurrent
requests share each texture, producing eleven image requests. The test uses
Chromium/SwiftShader in this environment, not a native-client material or
physical-frame-rate certificate. The
[transport ledger](reference/masteryi/primary-hit-transport-verification.json)
retains the source snapshot and probe evidence.

## Complete private control profiles

The [profile reading](reference/masteryi/primary-hit-profile-reading.json)
retains all eleven emitters and every explicit field, with compiled fallbacks
separate from raw omissions. Ordinary systems have identical complete emitter
arrays. The profile includes birth drag, world and field acceleration, spatial
drag centre/radius/strength, both legacy spawn rotations, bound-size offset,
source alpha thresholds, lookup selectors, importance and censor modulation.

Fluid uses the pinned reader's unblended mode 3, not additive blending. The
blood atlas starts at frame 15 on a 4×4 grid with sixteen frames and raw frame
rate 1. Fluid's random-start 2×2 grid omits `numFrames`; the compiled one-frame
fallback now aligns with the [native constructor scalar witness](NATIVE-EMITTER-SCALAR-DEFAULTS.md).
The constructor also supports local=true and particle-local=false defaults;
actual native dispatch and orientation interpretation remain unobserved.
The [native atlas runtime trace](NATIVE-ATLAS-RUNTIME.md) additionally establishes
continuous-frame modulo, quad half packing and shader-side flooring. The
[quad packet correction](PRIMARY-HIT-HALF-PACKETS.md) now applies this ordering
and half lookup precision to the retained unit-corner quad profiles. The
[ray packet correction](PRIMARY-HIT-RAY-PACKETS.md) adds its separately traced
lookup/color precision while preserving geometry and frame policies. Live native
shader selection remains unverified.
The raw identifier `{08b52819}` matches candidate `censorModulateValue`;
no global censorship switch or quality filter is inferred. Raw hashes stay
unchanged in the original definitions.

The conservative local retention is 75 ticks: first-update birth plus the
largest source lifetime and its float32 probability multiplier, with endpoint
coverage. The multiplier `1.2000000476837158` exceeds 1.2, so prematurely rounding
it would shorten the history. Linger values remain separate.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/prepare-masteryi-primary-hit-profiles.py --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/test-masteryi-primary-hit-profiles.py
```

All 32 profile guards pass in normal and optimized Python, and both modes
preserve the reading's bytes and timestamp. This preparation changes no runtime
or public files. The [profile ledger](reference/masteryi/primary-hit-profile-verification.json)
records the exact source snapshot, reader references and evidence.

## Runtime checks

Schema 163 saves each accepted contact's target pose frames, audience, radius,
structure transform, captured facing and detach tick. The decoder checks exact
coverage, valid rig pose clocks, bounded expiry, own-team visibility and frozen
detached endpoints. Known births cannot become visible retroactively when the
target is revealed. Bound particles require current positive visibility;
unbound particles retain their known birth anchor. Accepted finite effects
survive source death, and terminal presentation advances only their finite clock.

The runtime profile exporter is reproducible:

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/export-masteryi-primary-hit-particles.py --check
npx vitest run tests/masteryi-primary-hits.test.ts --maxWorkers=1
```

The new unit coverage includes source family completeness, source atlas cells,
spatial drag radius/clamp/interpolation, bound-size offsets, finite lifetimes,
movement, cancellation, critical hits, removed targets, source/target death,
exact saved futures, forged pose histories and unchanged gameplay RNG/IDs during
sampling. Browser checks verify real contact admission, all eleven runtime
emitters, target chest positions, exact authored GPU mip pixels and real menu
Save/reload with a 130-tick future. Runtime acceptance results and archived
sources are retained in the [runtime ledger](reference/masteryi/primary-hit-runtime-verification.json).

Runtime acceptance retains 31 passing new unit cases, 92 passing initial attack
regressions and six passing Node QA cases. The full application run recorded
3,067 passes and four failures; one was the existing Lux E test's explicit
schema-162 assertion. Updating that assertion to 163 preserved all tamper checks,
and its six-test suite then passed. The three unresolved failures are the prior
missing Leona source archive, missing original distortion shader archive and
Lux sampler golden mismatch. The original five-second wave test passed.

Four primary-hit browser cases pass across the initial and corrected fixture
runs. Every emitter produces nonzero GPU pixels (minimum 35 pixels in the
isolated probe), and all 93 runtime mip hashes match. Seventy sword comparisons
plus three full passive/E/R scene comparisons retain exact pixels. With the new
contacts active, the latter scene uses 254 reference draws versus 59, 51 and 50
segmented draws across the three cameras. These are draw-count and pixel checks,
not physical FPS or native-client parity measurements.

The build and strict production subpath run pass with 32 recordings, eight fresh
screenshots and zero new/private effect preloads. Normal/optimized source replay
passes 85 guards per mode and preserves all fourteen runtime outputs in bytes
and timestamps. The current GLB availability audit finds the declared chest
joint in 27 of 32 target rigs; wards, inhibitors and nexuses use the explicit
local fallback described above. Numeric joint indices vary by rig.

The later [native constructor witness](NATIVE-CONSTRUCTOR-WITNESS.md) now backs
the compiler's omitted primitive and alpha-byte inputs. Nine primitive omissions
align with constructor CameraQuad; seven alpha-reference omissions align with
constructor byte 5. All eleven concrete emitter wire types and the full 3,851-chunk
Master Yi WAD match the frozen native/content cohort. All fourteen runtime exports
remain byte-for-byte unchanged; native dispatch, later overrides and upload
conversion retain their existing limits.
