# Source particle orbital basis and velocity stretch

The selected external `particleRead.ts` functions `orbitInto` and `stretchOf`
produce 56 orbital basis fixtures and 90 stretch fixtures. The exporter compiles
those functions with the pinned external basis and enums, without importing
application arithmetic. All float32 orbital matrix bytes match exactly; stretch
results match the external double values. The 149 tests include independent
fixture reproduction, buffer ownership and malformed input rejection.

Birth orbital velocity uses radians per second. Age-scaled degree angles round
to float32 before the existing standing-basis kernel. Zero orbital velocity
returns no basis. Negative near-zero ages remain supported for fractional births.

Velocity stretch uses world travel speed. Only camera and arbitrary quads read
the control, including when direction orientation is disabled. Scale zero returns
one regardless of the minimum; a nonzero control uses the authored minimum,
including zero or values below one. Simple emitters, rays, meshes and trails do
not stretch. The caller chooses the correct draw axis and frame placement.

W's Y orbital speed and `.004` / `1.3` stretch controls are covered. These kernels
do not certify native update clocks, actor attachments, random streams or pixels.
Portable CI runs the committed fixtures; the separate reproduction test requires
the retained external reader archive.

## Root binding timeline

`SourceBindingTimeline` accumulates each step's root movement with that step's
float32 bind weight. This preserves changing weights instead of applying the
current weight to the total displacement since birth. Its replay tests compare
bound positions and travel velocity with `SourceParticleFrame`, whose placement
arithmetic is covered by the existing external frame fixtures. They cover normal
and stopped lifetimes, reverse/fractional seeks, changed stop clocks, zero weights,
constant-vs-keyed values and independent returned buffers. Root positions remain
caller-supplied saved inputs; scene-axis conversion is outside this helper.
