# Solar Flare decal address policy

Solar Flare's two planar area alternatives now request clamp-to-edge for their
diffuse texture. The color lookup already used clamp. Authored UV address metadata
stays intact in the source profile; the decal material path supplies this override.

The matching 16.18 arm64 CPU path selects `UNLIT_DECAL` for its kind7 branch and
writes one into the three sampler address bytes for `DIFFUSE_MAP`,
`FALLOFF_TEXTURE` and `PARTICLE_COLOR_TEXTURE`. The generic material lookup returns
a 32-byte record. Its address bytes at offsets0x10/0x11/0x12 copy into a 40-byte
render binding at offsets0x18/0x19/0x1a. The Metal binding constructor consumes
those three bytes independently as S/T/R sampler arguments. Its immutable map
`[2,0,3,5]` and the SDK definitions identify internal address1 as clamp-to-edge.

These layouts must stay distinct from the separate Metal sampler object that
stores one address byte and filter fields at offsets0x10/0x11/0x12. Reading that
other object as the generic material record would misidentify two address axes
as filter settings.

The [native binding record](reference/leona-native-particle-bindings.json) retains
the exact binary identity, raw Hopper observations, instruction bytes, tables and
SDK enum definitions. REA6.4.0 timed out before Hopper completed its analysis;
the retained results come from the existing owned local bridge and are explicitly
not REA Evidence. The game client and native shaders were not executed.

The local source projector still chooses terrain receivers, clipping, matrices,
height range, visibility, blend and depth policies. Its exported level-zero PNGs
retain linear filtering without generated mipmaps. Full native resource/mipmap
selection, Leona dispatch and frame parity remain open. This narrow address
correction adds no family: integrated R remains41/44, with two weapon frames and
Activate's complete native source-loader/runtime path still separate.

The projector runtime module is now a ruleset root, so changes to its bindings
and imported material/asset helpers affect saved-match compatibility. Schema126
is unchanged.

Validation passes1,881 unit cases across309 files, three Node QA checks and the
fourteen targeted Chrome cases. Both area colors retain clamp/linear/no-generated-
mip sampler settings and exact Save/reload pixels. Graphics recovery is exact;
six casts retire owned buffers/materials without disposing borrowed textures.
The actual Rift receiver probe, R skins/all38 surface descriptions, shared early
capture and 640 decal arithmetic samples pass. This is local browser validation.

Fresh production passes32 recordings with no development hooks or unrequested
Leona preload. All965 static files match the prior pack byte for byte. The fresh
1,011-file/513,276,626-byte pack passes offline controls, including saved-tick boot,
repair, activation and saved-data preservation, with963 service-worker responses
and no production errors. No new normal-match cohort or CPU benchmark is claimed.
