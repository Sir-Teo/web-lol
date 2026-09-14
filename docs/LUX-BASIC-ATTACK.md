# Lux basic-attack particle source package

The basic-attack spell's `mMissileEffectKey` selects `Lux_BA_mis`; the pinned skin resource map resolves it to `Characters/Lux/Skins/Skin0/Particles/Lux_Base_BA_mis`. The new exporter checks both mappings and decodes the actual particle binary from client 16.18.8175716, manifest `29CE6E781C3B6368`, Lux's client archive. Its decoded record must equal the full pinned record in `reference/lux-basic-attack.json`.

The effect has three emitters: `crescentwhite` uses `VoidCrescent.scb`, Ring04 and a ramp-down lookup; `Trail` uses Lux's Q trail texture with the rainbow multiplier; `hoop` uses the mote texture and a spectral lookup. The complete emitter curves, probabilities, unknown fields, source paths and archive/file/chunk hashes are retained. This is stronger evidence than identifying a similarly named image, but it does not establish native shader semantics.

Six TEX files export to lossless PNGs totaling 31,087 bytes. The exporter checks the decoded RGBA bytes again after PNG encoding and checks repeat exports against the pinned dimensions and pixel hashes. The textures include lookup data, not six interchangeable color sprites. The inspection view intentionally shows the raw images; the visible black areas and rainbow bands are not a finished native projectile appearance.

The crescent SCB has 62 source vertices and 120 triangles, version 3.2, flags 5, no per-vertex BGRA block, and an RGB block for the 360 face corners. Its central point is nonzero and 24 trailing bytes remain uninterpreted. The decoder accepts only this verified profile and preserves source coordinates, UVs, face RGB values, flags, bounds, central point and trailing data. Layout evidence comes from the repository's pinned LeagueToolkit StaticMesh and StaticMeshFace readers; neither the unknown flag nor the trailing fields are silently assigned invented meanings.

The 20,216-byte GLB uses the existing 0.01 source-unit scale. Position, UV, custom `_SOURCE_FACE_RGB` and topology survive exact glTF round trips, and the embedded Ring04 PNG hash is unchanged. Face RGB is retained as a custom attribute rather than multiplied into the visible material while its native use is unresolved. The central point, trailing data and emitter transforms are retained as metadata, not applied as guessed transforms. The ordinary unlit preview material is for source inspection. All model/map validators pass with zero errors and warnings.

Reproduce from the repository root:

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/export-lux-basic-attack.py
node tools/assets/convert-lux-crescent.mjs
npm run assets:validate
```

With the development server running, open `/tools/qa/lux-basic-attack-preview.html`. The browser test loads the GLB and all six textures, checks the converted attribute counts, and captures the inspection board. The source crescent and texture board were visually inspected.

Gameplay still uses the generic attack projectile. Next work must reconstruct lookup/shader behavior, particle primitive semantics, binding/orbital motion, emission lifetime, attachment orientation and saved animation phase, then compare the composed effect against native references. The package is deliberately not advertised as pixel-authentic or runtime-complete. Riot-owned source content remains subject to the production design's unresolved distribution authorization.
