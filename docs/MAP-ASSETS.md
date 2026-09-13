# Summoner’s Rift reference terrain

The map inspection page at `/map.html` renders the pinned full terrain, vegetation, and background geometry. It provides fixed viewpoints, orbit/pan/zoom, and an overlay of the matching navigation grid. The default playable game now uses this same terrain, navigation, elevation, and source-authored fountain, lane, barracks, and turret positions. The inspector remains an asset and alignment study; a complete match, camps and complete-match behavior are still unfinished. Nexus and inhibitor models now occupy their authored placements and participate in the local building dependency chain.

## Source selection

The frozen Riot release is `16.18.8175716`, manifest `29CE6E781C3B6368`, also used by the six minions. The [16.18 map definition](https://raw.communitydragon.org/16.18/game/data/maps/shipping/map11/map11.bin.json) links its default skin to `Maps/MapGeometry/Map11/Base_SRX`. The older `Base` geometry is a different historical layout.

The [Base_SRX map container](https://raw.communitydragon.org/16.18/game/data/maps/mapgeometry/map11/base_srx.materials.bin.json) links `assets/maps/navgrid/map11/aipath_srx_3.aimesh_ngrid`. This explicit container reference supersedes the legacy `AIPath_SRX_2` field in the general map definition. Both files remain in extraction provenance to make this distinction inspectable; only version 3 enters the navigation artifact.

`docs/reference/map-extraction.json` pins 184 source files and 989 compressed patch chunks, including their SHA-256 hashes and CDN byte ranges. Extraction reads 184.35 MB of compressed patch chunks and produces 509.68 MB of geometry, materials, navigation, and texture sources. It never downloads the complete 2.49 GB WAD. The 185 required path-hash resolutions are committed separately; future rebuilds do not require CommunityDragon’s moving full hash list.

The map source contains all eight terrain visibility bits. The artifact retains bit 0 and shared geometry, removes duplicate instances from the other seven layers, and prunes their unreachable resources. The result contains 196 meshes, 137 materials, 137 terrain textures, and 645,491 submitted triangles when the entire map is visible. Original vertex precision is preserved.

## Texture preservation and browser memory

All source textures remain at their original dimensions. The standard glTF references lossless WebP files; packing verifies exact decoded RGBA equality against the converter’s PNGs, including RGB behind zero alpha. Images are external files so the geometry and textures can be cached independently and no individual artifact exceeds 100 MB.

On GPUs supporting both S3TC and its sRGB extension, `src/render/rift-assets.ts` instead loads the original BC1/BC3 blocks and authored mip levels. `pack-map-dxt.py` changes only the container and mip order, verifies that reversing the result exactly reproduces the source TEX payload, and wraps DDS in deterministic gzip for transfer. The 138 textures, including the grass tint map, require 145.77 MB transferred and 343.32 MB (327.42 MiB) of GPU block storage. This avoids the much larger decoded RGBA allocation without resampling or recompressing the art.

The loader explicitly preserves BC1 one-bit alpha. Three’s DDS loader labels DXT1 as RGB by default; using that label would produce opaque foliage quads. It also handles both static-host conventions: gzip decoded automatically through `Content-Encoding`, or raw gzip bytes decoded with `DecompressionStream`. A browser test exercises both in the same load. The fallback is testable at `/map.html?textures=webp`; it has a substantially larger GPU memory footprint and remains unsuitable as a blanket low-memory-device strategy.

All glTF, geometry, texture, and navigation hashes are validated by `npm run assets:validate`. The map document passes the Khronos validator with zero errors and zero warnings. The validator does not certify shader equivalence or memory budgets.

## Coordinates and navigation

The glTF retains source map coordinates. Both renderer entry points apply `scale = (0.01, 0.01, -0.01)` and `translation = (-74.25, 0, 74.25)`, placing the Order/blue base southwest while preserving positive elevation. Camera bookmarks are inspection positions, not a calibrated League gameplay camera.

The navigation source is format 7.1. The parser checks all 87,320 cells’ X/Z ordering, validates dimensions and finite height samples, and checks the full trailing hint-table length. It exports the original 16-bit flags, four packed region bytes per cell, and 350,463 float32 height samples in a 1,925,772-byte payload. The overlay uses the 50-unit cell grid and bilinear height samples with the source’s separate X/Z sample spacing.

The format reference is [FrankTheBoxMonster/LoL-NGRID-converter](https://github.com/FrankTheBoxMonster/LoL-NGRID-converter/tree/92943ed2b2d5e82c86d680e69f53f247c89aefee), specifically `NGridFileReader.cs`. Unknown flags, including bit 128, are retained rather than assigned invented behavior. The export is the base grid. Runtime A* navigation uses radius-aware clearance, exact swept capsule checks against blocked cell rectangles, and path smoothing. Walls and structures block movement; team gates allow their own team. Transparent walls preserve sight, brush uses connected regions, and neutral gate regions permit sight into and out of their interior while blocking sight through. See [vision policy](VISION.md). Dynamic overlays and unit avoidance remain unfinished; unknown bit 128 is preserved without an assigned behavior.

## Authored gameplay layout

`tools/assets/export-rift-layout.py` freezes the two CommunityDragon JSON sources linked above, verifies their exact SHA-256 hashes before parsing, and writes `docs/reference/rift-layout-source.json`. The snapshot retains the selected source objects, barracks configuration, source URLs/hashes, and derived output hashes.

`public/assets/maps/rift-layout.json` contains two fountain spawns, three routes, six barracks, 22 turret placements, and the source wave configuration. Coordinates come from each object's authored transform. The blue spawn is source `(394, 171, 461)` and the red spawn is `(14340, 179, 14391)`; these use the explicit spawn objects rather than nearby shop or gate locators. The runtime projects moving-unit starts to valid clearance and follows the routes in opposite directions for the two teams.

The frozen barracks configuration starts waves at 30 seconds, repeats every 30 seconds, and separates individual units by approximately 0.8 seconds. Melee, siege, and caster counts follow its timed entries. Active-event overrides and inhibitor/super-minion behavior remain unimplemented; this is not a certified reconstruction of every live match configuration.

The exporter also converts the extracted source minimap to lossless WebP. `assets:validate` checks both layout and minimap output hashes. To rebuild only these small artifacts after source extraction:

```sh
.tools/cdtb-venv/bin/python tools/assets/export-rift-layout.py
node tools/assets/validate-map.mjs
```

Gameplay uses bilinear source elevation for unit feet and indicator placement, and height-field ray intersection for cursor picking. The fog texture shades elevated terrain materials as well as the minimap. Browser checks cover fountain and river picking, model elevation, real pointer movement/attacks, and brush visibility. They establish internal alignment; reference camera/material calibration still needs matched gameplay captures.

## Converter toolchain

The map uses a separate authoring toolchain because the minion converter cannot parse map geometry version 18. It does not modify the minion or archived Ashe pipelines.

| Tool | Frozen version |
|---|---|
| CDTB | `ba981db2a2c814a0d78e55f6483e0636b527850f` |
| lol2gltf | `7fe8d5c9b82fd0a86ea682fced28f8021bb3e063` |
| LeagueToolkit | `76bf57bf4fd195343dec610bf0f912a06b910914` |
| .NET SDK | `10.0.401`, isolated under `.tools/dotnet10` |
| Python libraries | `tools/assets/requirements.txt` |
| glTF Transform | `4.5.0`, npm lockfile |

The checked-in patches adapt the CLI to .NET 10 and the pinned Toolkit source, resolve newer hashed WAD links into source paths, export visibility metadata, and change silent material-adapter failures into explicit errors. Two unsupported shaders receive clearly labeled static diffuse adapters. The source tools and these patches are GPL-3.0; their license is included in `tools/assets/patches/COPYING-GPL-3.0`. These tools execute only during authoring. Riot artwork retains its separate ownership and existing distribution limitations.

On a fresh macOS ARM authoring machine, install the isolated CDTB/Python environment described in [ASSETS.md](ASSETS.md), then:

```sh
git clone https://github.com/Crauzer/lol2gltf.git .tools/map-converter
git -C .tools/map-converter checkout 7fe8d5c9b82fd0a86ea682fced28f8021bb3e063
git clone https://github.com/LeagueToolkit/LeagueToolkit.git .tools/league-toolkit
git -C .tools/league-toolkit checkout 76bf57bf4fd195343dec610bf0f912a06b910914

# Use Microsoft's dotnet-install.sh to install exactly SDK 10.0.401.
bash .tools/dotnet-install.sh --version 10.0.401 --install-dir .tools/dotnet10 --no-path

PYTHONPATH=.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/extract-reference-map.py
bash tools/assets/convert-reference-map.sh
```

The build script checks source commits and SDK version, applies the committed patches idempotently, and publishes with locked dependency resolution. The current script targets `osx-arm64`; other authoring platforms need a corresponding runtime target and verification. Runtime pages require only the static files and WebGL 2.

The reconstructed textured intermediate GLB was rebuilt byte-for-byte after replacing discovery-time path resolution with the committed minimal path table: SHA-256 `b573f287d9066a0e19c44085bc6e02b8a6ee1d00523b47b9bab020c2b5dc6cbc`.

## Fidelity gaps

- Both teams’ source tower models now use the full authored placement matrices, with persistent rubble. Both teams’ inhibitors and Nexus are now imported separately as well. Camps and particle effects remain unfinished. See [tower assets](ASSETS.md#matching-tower-assets).
- The converter’s shader adapters approximate Riot’s shaders. Animated water, terrain transitions, glow compositing, lighting/fog, and controller-driven displacement are incomplete.
- Brush uses the source grass tint image in a static shader approximation. Its UV fit, brightness, motion, and see-through response still require reference calibration.
- The twelve procedural Faelights indicator meshes are explicitly omitted and listed in the artifact manifest; their shader is not implemented.
- Dynamic terrain materials use their diffuse texture without their authored state transitions. This is visible in the audit manifest and prevents a pixel-parity claim.
- Active event/map mutators have not been fully reconciled. The artifact is the pinned default container and initial visibility mask, not a claim about every live match configuration.
- The full-map simulation now shares geometry coordinates, elevation, grid collision, brush, and vision. Dynamic grid overlays, local unit avoidance, exact Riot steering, and expanded route/region reference checks remain required.
- Region-based texture streaming, broader GPU support, reference camera matching, and complete-match performance remain production work.
