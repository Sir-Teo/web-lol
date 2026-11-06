# Source point, sphere and cylinder births

The new `sourceSpawnShape` kernel returns the raw source-unit offset, transformed
offset and row-major shape turn in independent float32 arrays. A point consumes
no random draws. Sphere volume uses a linear radius draw, not a cube root;
a shell fixes its radius, and both turn through full Y/Z angles. Cylinder volume
uses a signed linear radius, height runs from zero toward its declared height,
and the shape turns about Y. Shell cases omit the radial draw. These naive
source distributions are retained rather than replaced by uniform-volume ones.

The kernel follows LeagueToolkit's pinned external shape and basis functions at
revision `2adda384347dd43e76d6295d77fe1f13623b2808`. The
[verification record](reference/source-spawn-shape-verification.json) retains both
source URLs/hashes. The [66 fixtures](reference/source-spawn-shape-samples.json)
execute those external functions without importing the application helper,
preserving raw float32 bytes (including signed zeros) as hexadecimal data.
`node tools/assets/export-source-shape-samples.mjs --check` reproduces them.

All 77 tests pass. Every offset, raw offset and matrix matches fixture bytes
exactly, with unchanged draw counts and turned flags. Additional cases cover
signed-zero point offsets, independent output storage, the deliberately naive
volume distributions and malformed/nonfinite declarations or random draws.
TypeScript passes. Values outside finite float32 range reject rather than
publishing infinite positions.

This proves the selected external kernel samples on the current runtime. It
does not prove native CPU/PRNG/update parity or interpret serialized shape flags.
The API accepts the volume/shell policy explicitly. Legacy animated offsets and
angles, emission-mesh scale/normals, actor attachment and final emitter placement
remain caller responsibilities. No active source renderer uses these new shapes
yet, and simulation/content sources, saved state and public media are unchanged.
