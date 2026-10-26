# Master Yi primary contact particle sources

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
fallback is preserved as a reader policy, not recovered native behavior.
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
