# Preserve primary ray width, length and near displacement

Yi's private critical-hit ray now retains its authored three-component size.
At birth it uses width 80, length 180 and near displacement zero. The earlier
uniform-scale shortcut replaced all three with 80, shortening the ray and
moving its near edge. Its scale curve also grows X and Y independently; at
phase 0.5 the corrected size is approximately `[125, 315, 0]`.

The raw emitter explicitly sets `isUniformScale` and `birthScale0=[80,180,0]`.
The [birth-scale witness](reference/native-ray-birth-scale.json) traces the
native vector through one additional complete function and 89 selected
instruction words, inheriting the verified
[prepared-record writes and ray consumption](NATIVE-RAY-DRAW-DATA.md).

| Stage | X | Y | Z |
| --- | --- | --- | --- |
| Birth preparation registers | S11 | S12 | S10 |
| Shared-factor multiplication result | S4 | S6 | S17 |
| Stack output byte offset | `0x298` | `0x29c` | `0x2a0` |
| Initializer input byte offset | 104 | 108 | 112 |
| Birth record byte offset | 16 | 20 | 24 |
| Prepared draw record byte offset | 20 | 24 | 28 |
| Ray role | Width | Length | Near displacement |

The native preparation routine at `0x1018f6cac..0x1018f8d84` reads candidate
`birthScale0` from definition `+0x3e8`. It preserves three components through
constant/evaluator selection and optional probability sampling. One shared
factor multiplies each component separately. The initializer receives
`X1=SP+0x230`, so the three stack output fields become its input offsets
104/108/112. The subsequent writers preserve that order.

An optional external vector modifier can transform the birth vector. Its
producer and defaults remain unresolved, as do the shared factors. This
correction keeps the existing local adapter's unit-factor/no-external-modifier
policy and removes its final X-to-Y/Z copy for this ray. It does not define
`isUniformScale` for other primitives. Billboard, quad and other effect-family
size policies remain unchanged; the raw flag stays in the source profile.

Source `scale0` has times `[0, 0.20000000298023224, 1]` and values
`[[1,1,1], [1,1,0], [2.5,3,0]]`. The native prepared-record writer multiplies
matching birth and scale lanes. The independent Python reference evaluates
these source values under the retained local linear phase policy. It does not
claim native curve arithmetic, RNG, clocks, transform inheritance or FPCR.

The original regression records the old birth result `[80,80,80]`. The corrected
unit case also checks the independent midlife growth and zero displacement.
An independent comparison checks 90 ray samples against raw source dimensions,
while retaining all 13,280 quad states and every other ray field. Existing
half-frame, lookup and normalized-byte color checks remain in that comparison.

The GPU shape oracle supplies independently evaluated source dimensions to a
renderer frozen at `552e156`, and compares it with the actual current sampler
and renderer. Seven times, three cameras, two target sizes and raw/runtime
blending produce 84 nonempty cases with zero changed channel bytes. Every case
detects the old uniform-fill shape, totaling 312,021 changed channel bytes.
The reference uses authored textures and the normalized BGRA stream. It updates
all surfaces after fitting the camera. No game is booted for this calibration.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/native_ray_birth_scale.py --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/test-native-ray-birth-scale.py
node tools/qa/verify-primary-hit-packets.mjs --output-dir .cache/ray-size-check-new
npx playwright test e2e/primary-hit-ray-shape.spec.ts
```

Twelve native guard cases cover complete function bytes, every selected word,
function boundaries, inherited record/source pins, primitive and flag identity,
source birth/curve collapse, initializer dispatch and inherited XYZ writes.
No native executable or Metal shader was run. This establishes component
routing under the stated local policies, not complete native visual parity.

All 12 new native guards pass normally and with Python optimization. The
focused application suite passes 59 checks. The full suite records 3,096
passing tests out of 3,098 across 391 files, with the same two baseline failures
and the original wave deadline. No golden or assertion was weakened. The
[verification ledger](reference/native-ray-birth-scale-verification.json)
retains the original failure, source/native checks, GPU evidence and final
browser/production results.

TypeScript, all six Node QA cases and all ten browser cases pass. The
production build and nested-path smoke check pass 32 recordings with eight
fresh screenshots and zero unintended private preloads. Schema remains 163;
the pack contains 1,200 files / 538,085,046 bytes, 16 bytes larger than the
preceding accepted pack. All 14 accepted primary-hit exports retain their
bytes and timestamps. No public assets change.
