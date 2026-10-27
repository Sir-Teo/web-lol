# Authored sword effect conditions

The base skin contains two `PersistentEffectConditionData` declarations. These
provide concrete buff predicates and attachment names, independently of names in
the particle resource map.

| Buff tested by `HasBuffDynamicMaterialBoolDriver` | Effect | Source bone |
| --- | --- | --- |
| `WujuStyleSuperCharged` | `MasterYi_E_SuperChraged_buf` | `BUFFBONE_Cstm_Sword1_loc` |
| Same | `MasterYi_E_SuperChraged_Sword1_buf` | `BUFFBONE_Cstm_Sword2_loc` |
| Same | Same effect, separate instance | `BUFFBONE_Cstm_Sword3_loc` |
| Same | `MasterYi_E_SuperChraged_Sword4_buf` | `BUFFBONE_Cstm_Sword4_loc` |
| `Highlander` | `MasterYi_E_buff` | `BUFFBONE_Cstm_Sword1_loc` |

The character record declares `WujuStyleSuperCharged` as an E child with the active
Wuju Style buff description. The ordinary `MasterYi_E_buff` resource is explicitly
conditioned on Highlander here. Four unique effect systems produce five attachment
instances and 13 emitter instances. The repeated sword-one glow is preserved as
two instances on different bones.

All four names resolve uniquely to actual skin joints in the current rig: GLB
nodes 87–90. The reading retains original and GLB spelling, using an explicit
case-insensitive name bridge. Every referenced emitter authors full bind weight
and local orientation, which makes the current animated joint frame available
for a future attachment renderer. No root fallback or missing-joint substitution
is inferred.

The source skin scale is 1.5; the GLB bakes this into 0.015 positions/translations.
That fact does not independently establish native VFX offset/size inheritance,
axis reflection or attachment shader behavior. Native buff creation/removal,
component restarting, tail destruction and reveal behavior also need separate
runtime calibration. The two normal sword subresources absent from this table
remain retained resources; they are not labeled globally unused.

The [binding reading](reference/masteryi/sword-persistent-bindings.json) retains
the exact two conditions, five bindings and active child declaration. The
[private E transports](reference/masteryi/e-texture-transport.json) retain all
nine textures and 78 authored mip levels. No public PNG or runtime code changes
in this checkpoint. See [verification](reference/masteryi/sword-binding-verification.json).

Reproduce with `python tools/assets/prepare-masteryi-sword-bindings.py --check`,
`python tools/assets/pack-masteryi-e-textures.py --check` and
`python tools/assets/test-masteryi-sword-bindings.py`, including optimized Python.
