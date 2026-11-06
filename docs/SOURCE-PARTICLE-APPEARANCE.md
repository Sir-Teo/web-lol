# Source particle scale and color

`SourceParticleAppearance` samples life-keyed scale/color into float32, then
multiplies birth values and explicit instance/modulation factors in source order.
Uniform scale reaches billboards, arbitrary quads and meshes, but not trails.
Raw native-unit scale and HDR color/alpha remain unclamped. Prepared curves,
modulation and outputs own their storage.

All 388 cases pass. The 384 independent samples execute selected external
appearance/age functions with supplied instance factors and no live probability
or linger replacement curves. They cover all 21 Baron profiles plus uniform/HDR
cases, ages, finite/unbounded lifetime and fractional instance factors. Every
float32 scale/color byte matches. TypeScript passes. See
`artifacts/source-appearance-verified-tests.log`; reproduce with
`node tools/assets/export-source-appearance-samples.mjs --check`.

The current strict Baron closure has no live scale/color probability tables.
The adapter rejects them explicitly until a flicker adapter is supplied. Linger
replacement curves and legacy-simple appearance remain outside this closure.
Actor-size/instance factor selection and shader color-space/blend handling remain
separate. No native CPU/PRNG/cadence or visual fidelity certificate is implied,
and no gameplay or active renderer changes here.
