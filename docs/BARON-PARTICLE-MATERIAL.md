# Baron particle surfaces

The shared batched surface accepts per-vertex tint, base/mult UV transforms,
erosion mixer/drive and preserved mesh BGRA. It wraps within each book cell,
then applies palette, multiplier, erosion and tint in external shader order.
Omitted source fields use the pinned external reader defaults: base/mult wrap;
erosion mirror, .1 feathers and 1.5 slice; palette luma and first-row centre.
Alpha/alpha-add use their separate blend states and alpha-ref defaults to 5/255.
Textures are borrowed; disposing the material does not dispose their images.

The local Chromium/SwiftShader check compares exact RGBA bytes against the pinned
external fragment shader in 84 cases (21 emitters × four variations). Cases use
patterned synthetic textures, rotation/scroll and actual book divisions, erosion,
palette, multiplier and mesh vertex alpha. Each emitter produces visible pixels.
The reference has a separate minimal vertex harness; runtime shader errors fail
the check. TypeScript passes. See reference/baron-material-verification.json.

This material is not connected to gameplay. Primitive placement, ribbons, owner
height/size policies, depth-bias dispatch, final draw ordering, authored texture
scene appearance and native-client fidelity remain separate integration work.
The pixel comparison does not certify those paths or device performance.
