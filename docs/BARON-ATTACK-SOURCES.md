# Original Baron attack effects

The frozen 16.18.8175716 Map11 archive now supplies the default Baron's actual
missile and hit particle definitions plus their direct texture/mesh dependencies.
Root's probability-one `BaronBasicAttack` selects effect keys `{4d9a618a}` and
`{0508c5af}`. Skin0's resource resolver maps those keys to the following records:

| Role | Authored particle path suffix | Record hash | Emitters |
| --- | --- | --- | ---: |
| Missile | `SRU_Baron_Base_Attack_Missile` | `3c5885a2` | 9 |
| Hit | `SRU_Baron_Base_BA1_tar` | `6d98a267` | 12 |

The [source pin](reference/baron-attack-source.json) retains every selected
emitter, authored order, curve, omission and unresolved field/type hash. The
finite dependency set contains 25 TEX files and two SCB meshes, including the
original shared Akshan/item/map textures selected by these definitions. Two
original linked multi-skin BINs retain binding context; the selected systems
both live in the Skin0/Skin9 file. Total: 29 files / 1,921,359 original bytes.
Their CDN manifest, chunks, file identities and exact resource bindings are
retained. Particle paths independently hash to their resolver references.

No mutable name dictionary is needed. Labels come only from five existing
hash-pinned source readings, and file paths come directly from the definitions.
Unresolved 32-bit field/type names remain unresolved; there are no unresolved
64-bit asset paths in this selected closure. This does not establish native
particle defaults, material dispatch, attachment or full boss behavior.

## Reproduction and safeguards

Use the pinned CDTB checkout and Python requirements from [ASSETS](ASSETS.md).
The script checks the actual reader path, clean checkout/revision and frozen
input identities. Discovery requires an explicit flag and missing pin/cache;
ordinary reproduction requires the existing pin. Use fresh report paths.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python \
  tools/assets/extract-baron-attacks.py \
  --output-dir .cache/fresh-baron-attack-sources \
  --report artifacts/fresh-baron-attack-source.json
```

A separate cache reproduces the entire pin byte for byte, including SHA-256
`4b300f952b2a768e1eaa5c5f9eda3dd397e457ba1ead19c10fbd9aaa02c3543a`.
Normal and optimized Python checks pass. Deleting one copied TEX recovers its
exact original bytes. Corrupt-cache, existing-report, repeated-discovery and
edited-input-pin probes reject for their intended reasons; neither corrupt
bytes nor existing evidence is silently replaced. All 29 final source identities
verify. The first repeat checks caught tuple/list container comparison in the
extractor; normalizing JSON containers fixes that comparison while the original
pin and its exact encoded-byte gate remain unchanged. Two offline unit cases
also verify source bindings, all seed hashes and the asset closure; TypeScript
passes. The [verification record](reference/baron-attack-source-verification.json)
retains these outcomes and raw-artifact identities.

## Next presentation work

The textures contain 214 authored mip levels (22 BC3 and three BC1 textures).
The two SCBs use flag 2 with per-vertex colors, unlike the Yi face-color layout;
that distinction survives the [private decode](BARON-ATTACK-DECODE.md), including
exact SCB reconstruction. Native geometry/color interpretation, saved missile/contact roots, emission playback,
source material dispatch and native visual comparison remain next steps.

The live encounter still uses its explicitly provisional missile marker.
No runtime/public media, simulation field or saved format changes in this source
increment. Fingerprint `e20bdc…`, schema 163 and the two selected full-match
results remain unchanged. Source availability is not finished rendering.
