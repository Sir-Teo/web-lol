# Native Final Spark beam layers

## Provenance and rebuild

The base skin resource resolver maps `Lux_R_mis_beam` to `Characters/Lux/Skins/Skin0/Particles/Lux_Base_R_mis_beam`. That particle lives in the shared Skin0–Skin4 binary linked by the skin. Public JSON requests for shared binary paths returned 404, so the data was extracted directly from the already pinned Riot client manifest and Lux archive. Public symbol tables supplied field names; the retained pin allows subsequent verification without downloading those tables.

`reference/lux-beam-layers.json` records the source binary, 45-emitter count, six selected complete emitter records, six texture paths and decoded pixel hashes. Its extraction manifest pins all seven original files (404,376 bytes), patch chunks and source hashes. `export-lux-beam-layers.py` verifies the resolver/link, re-extracts those files, compares all selected emitter fields and converts the textures losslessly. PNGs total 55,341 bytes. The output adds six small texture requests to startup.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/export-lux-beam-layers.py
npx prettier --write src/content/lux-beam-layers.ts
```

## Selected source layers

| Emitter | Delay | Particle life | Blend field | Purpose |
|---|---:|---:|---:|---|
| warning_beam_1 | 0 | 1 s | 1 | Colored warning core and mask |
| warning_beam_2 | 0 | 1 s | 4 | Additive warning overlay |
| Beam_Core1 | 1 s | 0.2 s | 4 | Orange core glow |
| Beam_Core2 | 1 s | 0.15 s | 1 | Scrolling rainbow multiplier |
| Beam_Core_FLASH | 1 s | 0.08 s | 1 | Bright release flash |
| Beam_Core_Glow | 1 s | 0.2 s | 4 | Warm fading release glow |

The exact one-second native emission delay strengthens the earlier approximate video timing observation. Particle timing is evidence for presentation; it does not by itself prove the damage callback's exact tick.

The runtime replaces the synthesized canvas gradient with source base/multiplier textures, tint curves, birth color, width curves, primary UV rates, integrated warning UV rates, multiplier scroll and offsets. It maps blend field 1 to normal alpha blending and 4 to additive, and uses source pass values to order layers. The local source/target Z offsets are projected along the beam direction; the warning begins 150 units behind the origin and the core begins 240 behind and extends 100 past its endpoint. These affect presentation only.

Each layer's age comes from the saved simulation clock and the fixed R release delay, without accumulated animation deltas. Width and color curves interpolate between authored keys; integrated UV rates use piecewise trapezoidal integration. Textures are shared, while removed beams dispose their geometry/materials. A narrow source-derived warning transitions into a white core with moving rainbow edges.

## Verification and remaining fidelity work

The reproducible export verifies every retained field and exact decoded RGBA pixels. All 538 source/simulation checks, two focused Lux Chrome scenarios and nested-path production smoke pass. The R browser case checks shader/console errors, the four visible release layers, cleanup, and identical geometry, tint and primary UV state after restoring the same simulation tick. The rendered composite was inspected; a first two-core-only render lacked the bright center, prompting inclusion of the source flash/glow layers.

Six of 45 beam emitters are implemented. Other glow, streak, distortion, bokeh, ground and width/end indicators remain absent, as do the separate cast, hit and middle effects and native audio. The ground-following ribbon tessellation, source-width interpretation, UV coordinate conventions/default addressing, height/attachments, color-space/pass mapping and fog segmentation still need controlled native comparison. This is a partial source effect integration, not pixel parity. The effect does not change R's provisional damage geometry. Full browser, full-match and performance suites were not rerun.
