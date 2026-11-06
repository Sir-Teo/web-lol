# Static mesh particle spawning

Baron's Embers_Blend hit emitter names the native sphere as its emission mesh,
with source scale 0.3. The new `staticEmissionSurface` prepares immutable source
positions/indices for deterministic point/normal sampling. It does not draw the
sphere. Inputs and outputs retain original source units; scale, transforms,
attachment and cosmetic RNG ownership stay with the future caller.

The rule follows LeagueToolkit's pinned external static sampler: pick triangles
proportionally to area, then blend corners with weights
`[(1-u)*(1-v), (1-u)*v, u]`. This is intentionally distinct from square-root
barycentric sampling and from the external skinned-surface sampler. Cumulative
area boundaries select the next triangle; zero-area meshes and total area below
1e-5 produce no birth and consume no draws. A valid birth consumes three draws
in `[0,1)`, returns the source face normal and uses independent returned storage.
Malformed extents/indices, nonfinite vertices, area overflow and invalid draws
reject explicitly. Construction snapshots caller arrays.

The [reader ledger](reference/baron-emission-readers.json) pins six external
source blobs at revision `2adda384347dd43e76d6295d77fe1f13623b2808`, with URLs,
SHA-256 and Git blob identities. The actual static sampler source is SHA-256
`880e6df1f4d06ae6a74198059d45ef2de15b87d4a1c44e898fbf9b7bc602effe`.
Only that external function executes in the independent fixture generator;
its other mesh/skeleton readers are retained context, not claimed verification.

The [sample set](reference/static-emission-samples.json) contains 71 births:
64 scripted draws over Baron's original 121-vertex/220-triangle sphere plus
unequal-area, cumulative-boundary, corner-blend, degenerate and small-area cases.
It checks exact source/decode identities before reading mesh points. No scene
scale, reflection, unit conversion or generated normal is applied to the input.
`node tools/assets/export-static-emission-samples.mjs --check` reproduces the
fixtures without importing this application's sampler.

All 83 cases pass. Positions agree with the external float32 outputs within
2e-5 source units, and normals within 1e-6. Additional cases check boundary
selection, nonuniform blending, mutable input/output isolation and invalid input.
The [verification record](reference/static-emission-verification.json) pins test,
fixture and implementation bytes. TypeScript passes. This is external
reconstruction evidence, not native CPU/RNG/default or instruction parity.
No active emitter uses the helper yet; application source effects, public media,
simulation state and save format remain unchanged.
