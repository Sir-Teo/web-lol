# Judgment source particles

Garen's E now renders all six inline source layers in the player and NPC development
fixtures: `Outer_mesh`, `inner_mesh`, `edge`, `Top_Down_base`, and the two
`ground_glow` emitters. These attach to
the moving caster, stop emitting when E ends, and retain bounded particles after
recast, R interruption, death or natural completion. This is an initial rendering
adapter; Garen remains outside production selection.

## Source and reproduction

`reference/garen-model.json` already contains the skin BIN verified against the
frozen Riot 16.18.8175716 archive. Its inline
`Characters/Garen/Skins/Skin0/Particles/Garen_Base_E_Spin` record declares six
emitters. The new extraction ledger pins that archive's mesh and five TEX files,
including bundle ranges, chunk hashes and decoded file hashes. The format-aware
CDTB reader is used for Riot WAD/TEX, which the available REA binary opener does
not advertise supporting.

After installing the pinned CDTB environment from [ASSETS.md](ASSETS.md), run:

```sh
node tools/assets/verify-garen-spin-defaults.mjs
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-garen-spin.py
PYTHONPATH=.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/export-garen-spin.py
node tools/assets/convert-garen-spin.mjs
```

Repeated extraction/export checks the committed provenance. The derived audit can
be regenerated explicitly with `export-garen-spin.py --update-audit` after an
intentional exporter revision; frozen source verification remains unchanged.
Python 3.14 uses
standard-library Zstandard through pyzstd; the requirements now install its
backport only below Python 3.14.

The SCB is version 3.2, flags 5, with 612 vertices and 1,224 triangles. Its layout
matches the repository's existing flag-5 crescent decoder: positions, per-corner
UVs, face RGB, central point and a 24-byte trailing block. The 89,540-byte GLB
retains positions at 0.01 source scale, UVs and custom `_SOURCE_FACE_RGB` through
exact glTF round trips with zero validation errors/warnings. The nonzero central
point, flags and trailing bytes remain metadata. Face RGB and those metadata are
not assigned guessed runtime meanings.

All five textures export as lossless RGBA PNGs with pixel and output hashes in
`reference/garen-spin.json`. Runtime now loads all five textures, including the
ground-glow source and its particle-color lookup. All resources use the application base path and work under
nested static hosting.

## Adapter behavior and limits

Profiles retain authored delays, rates, probability tables, birth velocities,
rotations, angular velocities, color/scale curves, dimensions, offsets, UV scroll,
blend modes and passes. Mesh layers use the source SCB. Quad layers use authored
half-extents and the existing arbitrary-quad UV/`Ry Rx Rz` convention. The source
passes remain 100, 3, -10, 50, -100 and -100. Raw textures use no sRGB conversion, linear
filtering, repeat addressing for source images and clamped lookup addressing, depth testing, no depth writes and source-alpha
additive/alpha framebuffer blending. These sampler/composition choices need native
comparison.

The adapter uses the existing 60 Hz first-birth/rate-budget convention, rounds
emitter delays upward to a step, and samples deterministic indexed streams from
caster ID, original start tick, emitter and particle identity. It consumes no
simulation RNG and does not depend on prior rendered frames. Degenerate
`[0,0]` rotational probability tables keep endpoint evaluation; they are not
converted into uniform random ranges. Probability multipliers apply once to the
sampled birth value. Color and scale use normalized natural particle age.

Binding follows the current interpolated caster position with the captured cast
facing. Vertical motion integrates the authored constant birth velocity.
Orientation at each actual native birth, source pivot use, directional animation
blending, native random sequences and update cadence remain unverified. Enemy
draws require current unit sight; this suppresses hidden-owner effects. Native
per-pixel fog clipping at a visible effect's boundary remains open.

On stop, no new particles spawn. The selected source linger values cap total
particle age rather than extending life from the stop. Natural color/scale phase
is retained. The original one-second simulation retention bound covered the longest selected
particle stop-life cap (approximately 0.85 seconds). Snapshot version 76 added required
nullable `garenEVisual` with original start, captured facing and nullable stop
tick. Validation requires matching active E ownership or a valid, unexpired
stopped interval. Restore reconstructs active particles and tails exactly;
expired materials are disposed while shared geometry/textures stay cached.
The subsequent [source audio integration](GAREN-E-AUDIO.md) extends that shared
presentation history to 154 ticks in version 77. Particle caps stay unchanged;
the retained record can outlast every draw while its sound finishes.

The two `ground_glow` emitters (indices 4/5, which share a name) have distinct keys
and draw names. Index 4's omitted birth scale resolves to `[1,1,1]`; index 5 keeps
the authored `[150,150,150]`. Omitted scale/color are unit scale and white. These
defaults come from executing `readValue` helpers and checking the exact field
mappings in the already pinned [ltk-manager reader](https://raw.githubusercontent.com/LeagueToolkit/ltk-manager/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/readVfxSystem.ts)
and its [value defaults](https://raw.githubusercontent.com/LeagueToolkit/ltk-manager/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/readValue.ts).
`reference/garen-spin-defaults.json` retains four source hashes, executed results
and the distinction between reconstruction evidence and native CPU verification.

Both glows use the lookup defaults: lifetime X, constant Y, unit scales and zero
offsets. The resulting coordinate is `(age/life,1)`. The 64×64 ramp has identical
rows, so that constant row does not alter its pixels. It changes RGB brightness;
its alpha stays 255. Glows retain the explicit four-second emitter lifetime, with
the system stopping them when the three-second spell ends. Their 0.25-second
linger caps total live particle age on stop. Shared source geometry, transforms,
visibility and tail restoration also cover both glow identities.

Garen now uses the shared initial RGBA-product shader for all six layers, with a
white lookup for the four emitters that have none. Its new base UV offset retains
scrolling without moving the independent lookup coordinate. The inspection page
at `/tools/qa/particle-color-preview.html` includes Garen's glow and lifetime ramp.
Native composition remains open. Q/W/R effects and source audio also
remain unfinished. A source-backed appearance and passing checks do not establish
native visual parity or production/full-match certification.

## Validation

Nine tests verify source/profile/output hashes, source delay boundaries,
bounded deterministic sampling, stop caps, natural/recast/death continuation and
malformed checkpoint rejection, both glow defaults/lookups and their stop caps.
The browser scenario loads the actual mesh and
textures, checks all six named layers and finite transforms, exercises enemy
visibility, saves/reloads a stopped tail and verifies material disposal. The
1.25-second capture `artifacts/browser-garen-judgment-source.png` was visually
reviewed. Broader check results are recorded in [PROGRESS.md](PROGRESS.md).

The initial four-layer revision passed all 918 source/simulation tests and 29
focused browser scenarios. The six-layer revision passes all 920 tests and
TypeScript, plus 11 focused browser cases across the Garen kit, Lux Illumination,
particle products, atlas, lifetime playback and palettes. Sixteen new GPU probes
compare every RGBA channel within one byte against independent PNG texel
products, at four lookup positions with uniform/vertex coordinates and with/without
a base UV offset. Gameplay and lookup-page captures were visually reviewed.
Production build and nested-host
smoke pass with 17 existing recordings and the production Garen gate intact.
All 26 GLBs and the map validate without errors or warnings. The validator now
reads the existing shared Lux target-mesh ledger instead of requiring missing
per-mesh sidecars. The existing large-bundle warning remains.
