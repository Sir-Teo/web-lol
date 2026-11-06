# Shared source trail extrusion

Baron's two declared trail primitives need a renderer path distinct from quads
and meshes. The existing Leona Zenith mode-1 ribbon extrusion is now a reusable
`sourceTrailRibbon` function. Zenith delegates to that exact implementation;
attachment, saved root histories, visibility and source-particle sampling remain
with its consumer. Arbitrary/camera trail frame construction and Baron ownership
are not inferred by this extraction.

The shared writer retains newest-first ordering, quality-selected box filtering,
source side-vector bisectors, cumulative cutoff, WAKE texture coordinates,
source corner order, lookup/erosion/color values and visibility separators.
It never joins across a hidden sample. The policy remains an explicit external
reconstruction on the local 60 Hz scheduler, with the existing independent
pinned Leona sample arrays; this adds no native timing or camera-trail certificate.

All 42 Zenith particle/ribbon cases pass, including independent pinned arrays,
visibility splitting, cutoff boundaries, exact saved-flight/tail replay and
buffer disposal. TypeScript passes. The valid output algorithm is moved intact;
only the invalid mixed-profile error changes from champion-specific to general
wording. Simulation/content sources and saved format do not change. Previously
verified production pack identities retain their original builds; this renderer
refactor is verified through the source-array and renderer tests.

## Camera-trail framing

The shared writer also accepts an explicit view direction as its fifth argument.
Leaving it null retains the arbitrary trail's particle-side path. Camera trails
expand across the view/tangent cross product. The first tangent uses the next
raw sample; later tangents join the filtered centres. A duplicate or end-on
first point uses the least-aligned world axis; later degenerate points reuse
the previous raw side. Joint smoothing bisects raw sides, without accumulating
the previous bisector. Visibility boundaries reset that state before framing.
A zero, nonfinite, overflowing or malformed direction rejects explicitly.

These laws follow the already pinned LeagueToolkit external `ribbon.ts` writer
at revision `2adda384347dd43e76d6295d77fe1f13623b2808` / SHA-256
`ada3d66b955dee7916f10e5b76417a9d7985bbbca337afcd551a7f30fa5cbe68`.
The [independent samples](reference/source-camera-trail-samples.json) are emitted
by executing that pinned writer, with no import of the application adapter.
`node tools/assets/export-camera-trail-samples.mjs --check` reproduces them.
Ten fixtures cover curves, end-on views, repeated/all-coincident samples,
oblique view, WAKE parity and cutoff. Application positions/UV/colors/lookups
agree within 1e-5 (erosion within 1e-6), preserving the existing JavaScript
number reconstruction rather than claiming float32 instruction parity.

Sixteen new cases plus all 42 existing Zenith cases pass; TypeScript passes.
The new cases include hidden-birth separation and invalid view inputs. An initial
TypeScript check caught direct JSON-array-to-tuple assertions in the test;
explicit tuple construction fixes their static types without changing fixtures.
No active renderer requests the camera mode yet: Baron attachment, saved roots,
emission and materials remain next integration work. This is not a native CPU,
shader, scheduling, browser-frame or visual-parity certificate.
