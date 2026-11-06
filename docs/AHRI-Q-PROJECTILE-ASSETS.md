# Ahri Q projectile asset preparation

This isolated source checkpoint stages the two Q projectile resource closures, `Ahri_Q_mis` and `Ahri_Q_mis_02`: 16 and 20 native emitters. The native spell/resource aliases are checked in the later reading below; runtime phase dispatch remains unbound. It leaves simulation, rendering, public assets, startup requests and the accepted pack unchanged.

Seventeen TEX dependencies include base images, erosion maps, multiplier masks and ray textures. All 151 authored mip levels pack losslessly into 17 private PNG transports totaling 713,081 bytes. The decoder record and native sources remain pinned. Every packed level unpacks to its recorded software-decoded RGBA hash; direct sampling of the transport atlas is invalid. Native GPU decoding and pixel equivalence remain unverified.

Three flag-2 SCB meshes become private GLBs after glTF Transform dedup/prune with attributes retained. The indicator, sphere and swirls contain 995 source vertices and 1,464 triangles. Their transports contain 1,040 vertices: the sphere needs 45 additional UV seam vertices. Every source triangle, position, UV and optional color byte replays exactly. The sphere's absent color stream remains absent. No normals, pivots, winding changes or coordinate conversions are invented. The three GLBs total 41,136 bytes, pass the glTF validator with zero errors/warnings and load through the application's Three.js revision 186.

The pinned ledgers are [texture transports](reference/ahri/q-projectile-texture-transport.json) and [mesh transports](reference/ahri/q-projectile-mesh-transports.json). Both preserve native coordinates; future rendering must explicitly bind scene units, attachment frames, lifetimes, trails, materials and visibility. The white unlit transport material does not establish source shading. Native projectile event mapping and outgoing/return dispatch remain unbound.

Run the texture packer and its `--check` mode after restoring the retained Q source/decode caches. Seven Python guard cases pass normally and under `-O`, including recursive dependencies, source/producer pins, mip corruption, symlinks and a final conflict that prevents earlier writes. Five Node mesh guard cases reproduce all outputs and reject conflicts, symlinks, changed input records and corrupt selected geometry before partial publication. The engine loader verifies all three transports. These fixture-dependent preparation checks are separate from portable runtime CI.

## Native spell/resource alias reading

The later [portable binding reading](reference/ahri/q-projectile-bindings.json) verifies the native Q ability's root/three-child declaration and joins `AhriQMissile.mMissileEffectKey` to `Ahri_Q_mis` and `AhriQReturnMissile.mMissileEffectKey` to `Ahri_Q_mis_02`. These aliases are now established from retained native declarations rather than inferred from asset names. The native script bodies and callback chronology remain outside these records.

The reading pins the named character source, native 30,475-byte character BIN, named-record label source, model and complete Q particle source. A fresh Riot archive restoration matches the retained BIN exactly, and the unchanged pinned parser verifies all 64 character records plus links. Both missile declarations remain verbatim, including movement, client, targeting and damage fields; no gameplay rules are generated.

The ordinary missile omits `visibilityComponent` and declares an empty `mStartBoneName`; the return declares `EnterFOWVisibility` and `root`. The return's `mVisualsTrackHiddenTargets` flag is retained without inventing a renderer visibility policy. The two native aliases do not establish local particle stop dispatch, height/attachment transforms, trails, material arithmetic or pixels. The effect/resource joins cover all 36 emitters and 20 texture/mesh dependencies.

The standard-library reader reproduces exactly without private caches or decoder tools. Normal and optimized guard modes each reject nine malformed/missing/conflicting/symlink cases, including five source-pin mutations. Both Node wrappers pass. A separate source-only workflow runs the portable check and both modes; fixture-dependent PNG/GLB staging remains separate.

The [binding verification receipt](reference/ahri/q-projectile-bindings-verification.json) records three successful workflow commands from a ten-file git archive export with no caches, tools or dependencies. All 196 Node QA cases pass in this isolated source branch. Its schema 175 context is historical and separate from the accepted primary cast renderer under schema 176.

## Complete private profile projection

The later implementation branch projects all 36 emitters and all 45 authored emitter fields. Its [portable profile reading](reference/ahri/q-projectile-profile-reading.json) pins the source aliases, texture/mesh transports, compiler and unchanged value helpers. The 499,830-byte private table contains 16 billboards, ten trails, six mesh emitters, two ground quads and two rays. No runtime module or public asset is generated by this step.

Nested value types, authored key counts, explicit source fields and probability metadata remain separate from fallback values. Integrated particle-age UV curves retain their base and keys, while emitter UV scrolling remains a separate clock. Six camera-facing and four arbitrary trails preserve tiling, smoothing and cutoff; three smoothing fields and every cutoff are omitted in the native declarations. Both cylindrical shapes and legacy rotations remain explicit. Single-particle flags do not erase authored burst rates, including the 75-particle sparkle burst.

Normal and optimized guards reproduce the complete table from committed source metadata alone. They reject five input-pin mutations, dropped emitters, unknown fields, unsupported trail modes, corrupt outputs, conflicts and symlinks before partial publication. Missing constructors, cylinder sampling, root frames, stop/linger policy, visibility, material arithmetic and native pixels remain unbound. The listed defaults are local adapters rather than native-default certification.

The [profile verification receipt](reference/ahri/q-projectile-profile-verification.json) records all six workflow commands passing from a twenty-file git export with no private caches, tools or dependencies, and all 218 Node QA cases passing on the implementation branch. All runtime/public source bytes still match the accepted primary cast application; its pack and gameplay scope remain unchanged.

## Public asset staging on the implementation branch

The complete 36-emitter public table is an exact path substitution of the private projection. All 17 textures / 151 authored mips and three source meshes are accounted for. Two PNGs reuse byte-identical cast assets; swirls reuse the already checked cast GLB because both transports replay the same native triangles, UVs and colors. The shared geometry remains owned by the cast resource loader. Fifteen additional PNGs and two GLBs add 639,983 public bytes.

The [publication ledger](reference/ahri/q-projectile-publication.json) pins the private/public tables and shared cast inputs. Both portable guard modes reproduce publication from committed assets without private inputs, reject eight source mutations and changed shared assets, and refuse conflicts or symlinks before partial writes. Four asset tests verify every profile field, all texture identities and engine loading of all three meshes. TypeScript and the complete GLB validator pass.

This stages assets and data without binding a projectile renderer or adding simulation history. The unused content table conservatively changes the implementation branch's ruleset fingerprint; the accepted primary pack and schema remain unchanged. Source frames, stop/linger policy and actual projectile presentation are the next implementation work.
