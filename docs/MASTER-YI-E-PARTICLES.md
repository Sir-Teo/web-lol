# Wuju Style particle sources

The frozen base skin declares six E particle resources with 14 emitters. The
source checkpoint retains all six complete definitions, four native BINs and
nine TEX textures: 13 files totaling 1,086,727 bytes. Frozen compressed source
reads total 370,895 bytes. No standalone SCB mesh is referenced.

| Native resource name | Complex emitters |
| --- | ---: |
| `MasterYi_E_Sword1_buf` | 2 |
| `MasterYi_E_Sword4_buf` | 1 |
| `MasterYi_E_buff` | 4 |
| `MasterYi_E_SuperChraged_Sword1_buf` | 2 |
| `MasterYi_E_SuperChraged_Sword4_buf` | 1 |
| `MasterYi_E_SuperChraged_buf` | 4 |

`SuperChraged` is the original spelling. Resource names remain literal; they do
not establish native branch selection, attachment bones or script callbacks.
Sword systems have glow quads; the two body systems also declare finite activation
flare and beam emitters. Missing emitter lifetimes remain missing. Probability,
lookup, color/scale, orientation, UV and secondary-texture controls stay complete.

All six systems omit system flags and sound fields. Those omissions remain
distinct from zero, null, empty strings or inferred on-create sounds. Existing
[Wuju Style audio](MASTER-YI-E-AUDIO.md) uses its separately declared spell
bindings. This source checkpoint adds no runtime particle dispatch or public
assets, and changes no gameplay, save schema, ruleset or production pack.

The [source pin](reference/masteryi/e-particles.json) records complete definitions,
native source identities, dependency hashes and extraction provenance for frozen
build 16.18.8175716. Checking reparses the actual BINs using the pinned CDTB parser
and retained name inputs, checks the complete skin/resource binding, and compares
every field while distinguishing numeric and Boolean values. A current dictionary
or parsed JSON substitute is not accepted as native verification.

Reproduce with the pinned source environment:

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-masteryi-e-particles.py --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python -O tools/assets/extract-masteryi-e-particles.py --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/test-masteryi-e-particles.py
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python -O tools/assets/test-masteryi-e-particles.py
```

Omitting `--check` restores missing frozen files after full preflight; existing
conflicts are rejected before archive access. Correct files retain their bytes
and timestamps. See [verification](reference/masteryi/e-particle-source-verification.json).
Native branch/weapon binding, source-to-shader mapping, lifecycle and physical
frame parity require separate work.

The subsequent [private decode](MASTER-YI-E-DECODE.md) retains all nine textures
and 78 authored mip levels, with independent software pixel replay and no
runtime/public-asset dispatch.

The [authored sword conditions](MASTER-YI-SWORD-BINDINGS.md) separately retain
the skin's actual buff predicates and named joints: four supercharged instances
for the active Wuju Style child, and `MasterYi_E_buff` on sword one for Highlander.
This does not infer native scale inheritance or creation/removal callbacks.
