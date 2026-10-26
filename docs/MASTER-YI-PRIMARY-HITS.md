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
it is not a reduced runtime profile. Texture decode, sampler/material parity
and all eleven emitters must be handled before runtime integration. This
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
