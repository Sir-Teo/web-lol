# Solar Flare Activate resource boundary

The enabled `Leona_R_buf` complex emitter3, `Activate`, has no authored base
texture path. Its color-lookup name is explicitly empty. There is no named asset
waiting to be extracted or decoded, and no authored custom material, mesh,
children or disabled flag. Its size and movement curves are meaningful; omission
of a primitive is different from an explicit NonRenderable primitive.

The retained 65a7 external reader defaults an omitted primitive to camera quad.
The retained 2adda preview gives an unnamed base a one-pixel zero-RGBA texture.
With that resource policy and its SrcAlpha/One blend, the emitter contributes no
visible pixels. This establishes the external preview behavior, not the native
client's default resource.

The retained native quad fragment samples the texture supplied to it and keeps
product alpha through global remap. It has no missing-resource branch, so it
cannot identify the CPU's unnamed resource binding. Native 16.18 primitive,
resource, state and runtime override behavior remain unresolved by this reading.

Profile3 stays excluded locally, with no invented white or procedural texture.
The two weapon quads still require an attachment frame; the integrated R total
remains 41 of 44 enabled families across both area alternatives. No runtime
behavior, build, schema or ruleset changes in this audit.

The [reading record](reference/leona-r-activate-reading.json) pins the raw and
compiled source, complete independent audit, exact reader snapshots and native
fragment text. `python3 tools/assets/verify-leona-r-activate.py` checks the retained
bytes and source/profile correspondence offline. No game client or shader runs.
