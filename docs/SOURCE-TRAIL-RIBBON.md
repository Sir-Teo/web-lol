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
