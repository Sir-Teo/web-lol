# Batched Baron source preview

The isolated renderer draws all 21 profiles with the published authored mips, one
shared drawing capsule and the source emission surface arrays. Quads and meshes
use one instanced draw per emitter; each trail uses one dynamic geometry draw.
The emission sphere is never fetched or drawn. Appearance stays HDR until the
framebuffer. Mesh BGRA stays normalized and alpha-bearing. Alpha surfaces sort
particles back to front by float32 squared eye distance.

Source centimetres become metres once for particle centres and quad/ribbon sizes.
Mesh transport vertices are already metres and their birth scales stay dimensionless.
The preview uses explicit neutral birth factors and supplied root/orientation; it
does not certify native actor size, height, handedness or attachment routing.

The current WAKE/OFF ribbon adapter matches exact position/UV bytes in 48 pinned
external full-writer cases, plus an invalid-input guard. Four batch tests check
centre conversion, normalized mesh alpha, capacity rejection, fog-run splitting
and owned-resource disposal. Hidden births split runs; they never form a bridge.
The batch borrows textures and mesh templates. An asset load failure cleans up
all successful resources; retiring a batch disposes only its buffers/materials.

The real browser preview observes all 21 emitters across eight screenshots, with
25 texture fetches and one drawing-mesh fetch. No shader errors occur. Reviewed
missile/hit screenshots are retained. The shared fragment shader still matches
84 external pixel cases after adding instancing support. TypeScript passes.
See reference/baron-batched-preview-verification.json.

The preview is isolated from gameplay. Historical effect reconstruction, native
attachment/height/size decisions, owner retirement, depth-bias handling and
full-scene browser save/reload verification remain integration work. Local
Chromium/SwiftShader results are not device-performance or native-fidelity proof.
