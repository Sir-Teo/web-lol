# Native fresh Mesh/SCB cache selection

The matching native file supplies a conditional answer to the earlier cache-selection gap: a freshly allocated old component starts with index `+1c = -1`, and sword2's omitted/default-empty first mesh name makes the first resource helper return without changing it. The identified selector therefore skips its first 40-byte resource cache under those premises and proceeds to the separate SCB-cache path.

This is static original-file evidence, **not REA Evidence**, native execution, or an observation of Leona's live dispatch. The [reference pin](reference/leona-native-scb-cache-selection.json) retains 24 bounded instruction streams, exact native words/windows, direct and conditional branch targets, source wire bytes, and dependencies. The executable and arm64 slice are the unchanged matching artifacts identified in [native matching provenance](LEONA-NATIVE-MATCHING.md).

All native offsets and instruction addresses below are hexadecimal.

## Fresh component indices

Within function `101898bc8`, the allocation block requests `0xe0` bytes at `1018990d8/0dc` and retains the new pointer in X20. At `101899064`, X27 becomes all ones. Stores `1018990f8` and `1018990fc` write 64 bits at component `+24` and `+1c`, respectively. Thus all four index words `+1c`, `+20`, `+24`, and `+28` start as `FFFFFFFF` (`-1`). The caller passes this new component to initializer `1018916dc` at `1018991ec`.

This does not establish a reset policy for reused components. Other retained callers invoke the initializer in another context, including `1018e8e18/ed0`; their complete lifecycle is outside this reading.

## Registered source-field ownership

The field ownership is established by registration and descriptor publication, rather than matching a type name to an assumed layout:

| Registered type or field | Hash | Native relationship |
| --- | --- | --- |
| VfxPrimitiveMesh | `8594e839` | Factory `10193a73c`, kind byte 3; parent descriptor `1025f1320` |
| VfxPrimitiveMeshBase | `fc395264` | Descriptor `1025f1320` |
| mMesh | `0d89732d` | Parent field at `+10`, EMBEDDED83, descriptor `1025f0c38` |
| VfxMeshDefinitionData | `6a88780b` | Descriptor `1025f0c38`, allocation callback `10193a0c0`, in-place callback `10193a12c` |
| mMeshName | `8c41a32e` | STRING10 at child `+0` |
| mMeshSkeletonName | `90595a15` | STRING10 at child `+10` |
| mSimpleMeshName | `d467e8c0` | STRING10 at child `+20` |

Initializer `1019459bc/c0` sets X21 to `1025f07f8`; `101945c5c/60` supplies X21 plus `440` to registration `1018d61bc`. This produces `1025f0c38`, exactly the descriptor supplied by the embedded-field wrapper. The primitive's virtual getter `101914a44` returns `this+10`.

The definition's allocation and in-place callbacks zero its first string length at `+8`. The primitive factory initializes the same embedded length at primitive `+18`. The pointer is the registered empty-string value; its exact pointer and NUL byte are pinned too.

Original sword2 source is emitter index18 in `Leona_E_mis_weapon`. Its `primitive` is STRUCT82 of concrete type `8594e839`; its `mMesh` is EMBEDDED83 of type `6a88780b`. That child contains **one** serialized field, STRING10 `mSimpleMeshName`, naming `Leona_Base_Z_sword.scb`. It omits `mMeshName` and `mMeshSkeletonName`.

The verifier rechecks the relevant generic BIN-loader spans and dispatch table from the existing [BIN loader pin](reference/leona-native-bin-loader.json). The STRUCT reader invokes the registered primitive allocation callback, and the EMBEDDED reader loads only encoded fields. Under that identified chain, the two omitted string lengths retain their constructor defaults through reader return. Later overrides or mutations are not excluded.

## First attempt and SCB fallback

Initializer `1018916dc` supplies the embedded definition as X2, its next string at X3, and component `+1c` as output X1 to helper `101891f08`.

At `101891f20/24`, the helper reads the first string length at child `+8` and returns through `101891f68` if zero. This is before it aliases output X1 to X19 at `101891f30` or writes the output index. Therefore the omitted/default-empty `mMeshName` makes this helper preserve the supplied index.

For the identified fresh state, that preserved index is `-1`. Selector `10189030c/310/314` tests it and branches to `101890350`, skipping the first cache at manager `+f0` and its 40-byte records. The `resource+40` format read belongs to that skipped resource-wrapper branch. It is not a read from the SCB object's `+40` bounds storage.

The subsequent branch reads component `+24` and the separate manager `+110` cache, whose records are 16 bytes. Initializer `1018919b4/9c4` supplies component `+24` as the output to SCB loader/cache helper `1018980a0`; `1018982bc` stores its cache index through that pointer. The identified SCB selector then uses loaded SCB `+7d` to gate vertex colors, as recorded in [SCB material evidence](LEONA-NATIVE-SCB-MATERIAL.md).

## Verification and limits

Both commands verify without writing or downloading:

```sh
.tools/cdtb-venv/bin/python tools/assets/verify-leona-native-scb-cache-selection.py --check
.tools/cdtb-venv/bin/python -O tools/assets/verify-leona-native-scb-cache-selection.py --check
```

Normal invocation is also read-only. Checks use explicit exceptions and stay active under `-O`. They require the retained native/source caches and perform no native target, provider, compiler, library, GPU, network, browser, or game execution.

The empty-name helper does **not** clear an existing index. A reused component could enter with another value unless a different lifecycle path resets it; this reading neither proves such reuse nor exhausts resets. Intervening callbacks, post-load processing, alternate callers, and later index writes are not globally exhausted. The separate first-resource format enum remains unresolved for cases where that branch is reached.

The result closes the earlier-cache ambiguity for the stated fresh/default/source state. It does not establish that a live sword2 instance follows the chain or prove final native shader selection, reflection bindings, render state, or frame parity.
