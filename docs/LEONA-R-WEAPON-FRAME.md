# Leona R weapon-quad attachment boundary

The two enabled arbitrary quads in `Leona_R_buf` still have no recovered invocation or attachment frame. The frozen source does not justify choosing actor world origin, capsule center, or a weapon bone, or changing their authored position to make them visible.

This is a bounded static reading of version **16.18.8175716**. It uses the original Leona BIN bytes, their existing extraction pins, and the frozen Leona client-WAD directory. It adds no runtime behavior and does not establish native dispatch or a rendered frame.

## Authored definitions

The source resource is `Characters/Leona/Skins/Skin0/Particles/Leona_Base_R_buf` in `data/characters/leona/skins/skin0.bin`. The two enabled definitions are:

| Source emitter index | Source emitter name | Primitive | EmitterPosition | Birth rotation |
| --- | --- | --- | --- | --- |
| 1 | BeamswordGlow | VfxPrimitiveArbitraryQuad | `[0,-90,0]` | `[180,0,90]` |
| 2 | BeamswordGlow2 | VfxPrimitiveArbitraryQuad | `[0,-90,0]` | `[180,90,90]` |

Both author bind weight 1 and local particle orientation. Their complete declarations are retained in the [reference pin](reference/leona-r-weapon-frame.json), including source values and texture/material fields. These fields describe an emitter relative to a supplied frame; they do not name that frame. Emitter labels and texture filenames are not bone bindings.

The system and its alias mapping supply no explicit bone or socket for these quads. The separately authored `idleParticlesEffects[0]` binds `Leona_Idle_Sword` to `BUFFBONE_GLB_WEAPON_1`. That binding cannot be transferred to `Leona_R_buf`.

## Search coverage and positive references

The verifier re-decodes **17 distinct original BIN byte identities**, covering the skin0 root and **all 16 of its linked BINs**, including the character and animation records. The pin preserves their exact paths, SHA-256 hashes, raw string/FNV match offsets, structural reference locations, and linked-path hash coverage.

Within that bounded set, the recovered R-buff references are the skin resource-map value and the system's definition key, `particlePath`, and `objectPath`. They identify a resource, not a spawn operation. The Leona character record identifies the R spell's `mScriptName` as `LeonaSolarFlare`; its inspected fields contain no R-buff invocation. The base `Spell4` atomic animation clip names `leona_spell4.anm` and has no `mEventDataMap`.

The R spell's targeter `centerLocator/basePosition` fields belong to targeter definitions. They are not evidence for the buff particle's caller frame. No inspected source establishes a capsule-center default or a weapon anchor for these quads.

## Frozen client-WAD boundary

The cached naming dictionary supplies **218** known Leona BIN/Lua path spellings. Comparing their exact path hashes with the frozen Leona client-WAD directory finds **118 BIN paths present** and **100 known script paths absent**. The absent exact paths include character-script and `LeonaSolarFlare`, slow, vision, and R attack-buff `.lua`, `.luabin`, and `.luabin64` candidates where those spellings occur in the dictionary.

The directory bytes are reconstructed offline from the already retained RMAN chunk, checked against the prior character extraction's SHA-256 pin, decompressed, and compared byte-for-byte with the retained header. The verifier also checks official manifest bundle ID, range, compressed size, and decompressed size. The manifest is `29CE6E781C3B6368`; the reference pin records exact manifest/header/chunk hashes and CDN provenance.

The dictionary can contain historical spellings. Absence of those exact hashes from this client WAD does not establish that server scripts never existed, that the effect is unused, or that another artifact contains no caller. No historical patch notes or prior-version source were used. A “legacy R buff” explanation remains unknown; names and linger values do not establish it.

## Verification and remaining work

Run from the repository root using the existing dependency environment:

```sh
.tools/cdtb-venv/bin/python tools/assets/verify-leona-r-weapon-frame.py --check
.tools/cdtb-venv/bin/python -O tools/assets/verify-leona-r-weapon-frame.py --check
```

Normal invocation also verifies without writing. The checker requires the retained caches; it performs no download, native target/provider invocation, compiler, browser, or render work. Its checks use explicit exceptions and remain active under `-O`.

Recovery still requires a positive spawn call, attachment override, or generic native frame contract tied to this invocation. The existing local root-frame probe's below-terrain result is a local placement observation, not evidence for a replacement frame. Both quads remain outside accepted runtime rendering until that boundary is resolved.
