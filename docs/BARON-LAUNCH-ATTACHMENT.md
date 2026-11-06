# Historical Baron launch attachment

`BaronLaunchAttachment` samples the source attack's `JawBot` from its saved
release pose using a private `TargetPoseSampler`. It returns a complete matrix
including the reference model's existing scale, saved facing, map placement and
terrain height. Returned matrices own their storage. Cache identity follows
immutable saved pose objects; independently restored poses are sampled anew.
Missing authored joints, invalid pose clocks and invalid heights fail explicitly.
Disposal retires the private skeleton exactly once.

Eight focused cases pass, including loading the native model with SHA-256
`5d9cd6632d191270a94d976e284458145f9fa9e445165eaadb304e2892fff417`.
The native smoke check keeps its original binary buffer, accessors, skins and
animation tracks, omitting materials/images in a temporary pose-only GLB so no
DOM texture decoder is needed. An initial Node data-URI attempt hit the missing
`ProgressEvent` API; the successful test uses an embedded GLB buffer instead.
The original asset is not modified.

Evidence: `artifacts/baron-launch-native-verified-tests.log`. This checks native
asset binding, local placement and ownership, not native animation-graph or
particle-render fidelity. The helper is not yet used by the provisional marker.
The source target-height augment and initial target-height offset remain
separate from this launch transform; neither is guessed or added here.
