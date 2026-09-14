# Summoner’s Rift reference terrain

The map inspection page at `/map.html` renders the pinned full terrain, vegetation, and background geometry. It provides fixed viewpoints, orbit/pan/zoom, and an overlay of the matching navigation grid. The default playable game now uses this same terrain, navigation, elevation, and source-authored fountain, lane, barracks, and turret positions. The inspector remains an asset and alignment study; a complete match, camps and complete-match behavior are still unfinished. Nexus and inhibitor models now occupy their authored placements and participate in the local building dependency chain.

## Source selection

The frozen Riot release is `16.18.8175716`, manifest `29CE6E781C3B6368`, also used by the six minions. The [16.18 map definition](https://raw.communitydragon.org/16.18/game/data/maps/shipping/map11/map11.bin.json) links its default skin to `Maps/MapGeometry/Map11/Base_SRX`. The older `Base` geometry is a different historical layout.

The [Base_SRX map container](https://raw.communitydragon.org/16.18/game/data/maps/mapgeometry/map11/base_srx.materials.bin.json) links `assets/maps/navgrid/map11/aipath_srx_3.aimesh_ngrid`. This explicit container reference supersedes the legacy `AIPath_SRX_2` field in the general map definition. Both files remain in extraction provenance to make this distinction inspectable; only version 3 enters the navigation artifact.

`docs/reference/map-extraction.json` pins 184 source files and 989 compressed patch chunks, including their SHA-256 hashes and CDN byte ranges. Extraction reads 184.35 MB of compressed patch chunks and produces 509.68 MB of geometry, materials, navigation, and texture sources. It never downloads the complete 2.49 GB WAD. The 185 required path-hash resolutions are committed separately; future rebuilds do not require CommunityDragon’s moving full hash list.

The map source contains all eight terrain visibility bits. The artifact retains bit 0 and shared geometry, removes duplicate instances from the other seven layers, and prunes their unreachable resources. The result contains 196 meshes, 137 materials, 137 terrain textures, and 645,491 triangles in the retained artifact before controller-based visibility filtering. The loader additionally honors the 20 explicit default-hidden instances described below. Original vertex precision is preserved.

## Texture preservation and browser memory

The canonical geometry buffer remains 36,311,444 bytes at its original vertex precision. Runtime loading uses a byte-identical gzip transport of 13,966,022 bytes, saving 22,345,422 bytes (61.54%) before any additional host compression. `pack-map-geometry.mjs` verifies the canonical source hash, writes the compressed artifact and transport manifest, and checks exact roundtrip equality. Compressed byte output may vary across zlib versions; the checked-in compressed hash and invariant decoded hash are both validated. The glTF remains standard and continues to reference the original buffer for external tooling.

`map-geometry-transport.ts` supplies glTF buffer views through the loader plugin interface. Concurrent views share one fetch/decode, bounds are checked, and decoded length/SHA-256 must match the pinned geometry. Raw gzip and already-decoded static-host responses are both supported. Neither texture resolution, vertex precision, topology nor GPU texture memory changes. The existing 327.42 MiB compressed-texture allocation and remaining transfer budget still need separate work.

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
- Active event/map mutators have not been fully reconciled. The artifact is the pinned default container and initial visibility mask, with explicit default-hidden controller states applied at load time; child/mutator evaluation and live transitions remain incomplete.
- The full-map simulation now shares geometry coordinates, elevation, grid collision, brush, and vision. Dynamic grid overlays, local unit avoidance, exact Riot steering, and expanded route/region reference checks remain required.
- Region-based download/CPU texture streaming, broader GPU support, reference camera matching, and complete-match performance remain production work. GPU residency is managed separately as described below.

## Lossless geometry transport validation

The transport browser tests verify raw gzip, decoded bytes, corrupt-payload rejection, invalid view bounds and a single shared request. Full-map tests exercise both hosting conventions across original-DXT and WebP-fallback loads, and confirm the canonical uncompressed geometry is not requested. The map validator checks the compressed hash and exact decoded equality as well as the canonical glTF. All 743 unit tests and TypeScript, five browser checks, zero-error/zero-warning map validation, and production subpath smoke pass. The mid-lane map capture was visually reviewed.

## GPU texture residency

The map render adapter tracks textures actually drawn, including the grass-tint shader texture and the smoke depth prepass. After each frame, an LRU releases offscreen GPU textures when estimated map texture residency exceeds 256 MiB. Current-frame textures are protected, even when their working set exceeds that target. This is a map-texture target, not a cap on total GPU memory; geometry, render targets and champion textures are outside it.

Original compressed mip arrays or decoded WebP images remain in CPU memory for exact re-upload. There is no texture resizing, mip removal, extra network fetch, or reduction in initial download/CPU memory. Compressed sizes come from the pinned asset manifest; the fallback estimates RGBA bytes including generated mip levels. Driver overhead is not included. Camera re-entry can incur upload work; full-match frame-time benchmarking remains outstanding.

At 1440×900, the inspector sequence overview → blue → mid → river → red → overview measured 327.42 MiB for the complete overview and approximately 254–255 MiB retained in the close views. Seventy-one evictions occurred; returning to the overview restored all visible textures. SHA-256 of the actual overview framebuffer was identical before and after that sequence. A separate GPU test alternates two textures through an eviction budget, verifies identical restored pixels, and checks that only one GPU texture allocation remains after each frame. Unit checks cover LRU order, shared textures, re-entry and visible working sets larger than the target.

Validation: TypeScript and 745 unit tests; eight browser checks covering residency, both map texture encodings, pointer/elevation agreement and fog. The production subpath smoke also passes. The restored overview capture was visually reviewed.

### Camera re-entry measurement

`tools/qa/benchmark-map-residency.mjs` compares a 256 MiB target with unlimited residency in four fresh browser contexts, ordered bounded → unlimited → unlimited → bounded. Each context warms the full overview for 30 frames, then visits blue → red → mid → river twice, rendering 30 frames at each view. The inspector's normal animation loop is stopped; the benchmark renders once per requested animation frame. CPU timing covers residency bookkeeping and the renderer call. Actual compressed upload calls/bytes are instrumented for both `compressedTexImage2D` and the WebGL2 immutable-storage `compressedTexSubImage2D` path. The script rejects bounded runs without measured re-uploads and warmed unlimited runs with unexpected uploads.

Reproduce with a development server running, without other browser or performance jobs:

```sh
node tools/qa/benchmark-map-residency.mjs http://127.0.0.1:5198 artifacts/map-residency-benchmark.json
```

The [recorded raw samples](reference/map-residency-benchmark.json) pin runtime revision, script hash, map input hashes, browser and hardware. On Apple M5 Pro / Chrome 152 / ANGLE Metal at 1920×1080, device scale 1:

| Run | Target | Camera-jump CPU median / maximum | Steady CPU median / p95 | Re-uploaded bytes |
|---|---|---|---|---|
| 1 | 256 MiB | 11.9 / 17.5 ms | 0.7 / 1.3 ms | 262,844,376 |
| 2 | Unlimited | 1.1 / 1.2 ms | 0.8 / 1.3 ms | 0 |
| 3 | Unlimited | 0.7 / 1.1 ms | 0.4 / 1.1 ms | 0 |
| 4 | 256 MiB | 8.5 / 13.7 ms | 0.3 / 0.9 ms | 262,844,376 |

Each bounded run made 128 texture evictions and 1,164 mip-level upload calls across eight camera jumps. The 240 GPU queries per run all resolved without disjoint, skipped or unresolved samples. GPU elapsed p95 ranged from 1.65 to 2.45 ms across the four runs. Animation-frame timestamp intervals remained at or below 16.8 ms in this sample; these timestamps do not measure physical display presentation. Eight transition samples per run are too few for a robust tail estimate, so maxima are reported explicitly.

This establishes a material synchronous re-upload cost despite unchanged pixels and lower residency. It does **not** establish that complete matches meet a frame budget: champions, combat, fog updates, minimap jumps in play, slow devices and WebP fallback are outside this static-map experiment. The run-to-run CPU/GPU variation also prevents attributing small steady-frame differences to the eviction policy. Budget-aware pre-upload scheduling and full-game camera traversal measurements remain needed; texture detail has not been reduced to hide the cost.

### Near-view texture preparation

After the map frame is rendered, `MapTexturePrefetch` tests visible mesh bounds against a view expanded by 15% in each screen dimension. It asks the residency controller to initialize nearby missing textures with Three's `initTexture`. Hidden meshes and camera-layer exclusions are respected. Original source mips and pixels remain unchanged; speculative uploads never block a visible texture from uploading normally when it is needed.

The scheduler admits at most two textures per frame and stops starting uploads after 2 ms. This is a soft scheduling window: one synchronous driver upload can overrun it. It only evicts older offscreen textures outside the entire candidate neighborhood, and skips a candidate without evicting anything when there is insufficient eligible space. Thus it does not cycle through an oversized neighborhood or exceed the map residency target to speculate. Visible texture accounting remains separate from prepared textures. It currently uses a symmetric border, not motion prediction or an idle-time estimate for combat-heavy frames.

The browser pan comparison first records a mid-lane reference image, warms blue base for 30 frames, then moves to mid over 200 frames with preparation disabled/enabled. The measured route uploaded 18,175,416 bytes during visible draws without preparation, versus zero with preparation. Preparation uploaded 29,535,056 bytes during the pan, including extra border textures. The enabled run peaked at 268,349,568 bytes, below the 268,435,456-byte target. Within each loaded scene, the final framebuffer hash exactly matched its pre-pan reference. These values measure upload placement, not an FPS improvement; the preparation and its extra upload work still consume frame time.

An initial cross-page framebuffer comparison differed. Its cause has not been isolated; the accepted regression compares before/after within each loaded scene so resource creation and draw ordering are held fixed. This pan test did not establish cross-load pixel determinism. The subsequent draw-order investigation below isolates and repairs that discrepancy.

TypeScript and 748 unit tests pass, including visible/nearby protection, oversubscribed neighborhoods, no partial eviction, upload count and clock limits. Nine browser checks and the production subpath smoke pass across the pan, restored overview, both texture encodings and full-game picking/fog behavior. The [verification record](reference/map-texture-prefetch-verification.json) retains the pan observations and source hashes. The earlier camera-jump benchmark renders manually without this preparation step and remains evidence for the pre-preparation policy, not a current performance certification.

### Stable map draw ordering

Texture completion order previously influenced GLTFLoader material creation IDs. Three's opaque queue sorts by those IDs, so different network timing changed the order of overlapping map surfaces. Six diagnostic loads alternating normal and deliberately delayed DDS responses produced two repeatable framebuffer hashes despite identical camera/projection matrices and the same 75 visible meshes. The [before/after record](reference/map-draw-order-verification.json) preserves those hashes, matrices and draw records.

The loader now tags each map material with its pinned glTF material index and each mesh with its scene traversal index. The inspector and the game's existing ground display list use these stable keys in place of runtime creation IDs. Group, explicit pass, material-variant and depth priorities remain intact; untagged objects retain ordinary Three ordering. This retains material grouping without allowing download timing to decide the draw order. The keys are runtime WeakMap metadata, not changes to source geometry, materials, texture data or visibility. Missing material associations fail explicitly rather than silently returning to a timing-dependent key.

All six post-fix DXT diagnostic loads produced the same framebuffer hash. The committed browser regression verifies identical camera matrices, draw names/order and framebuffer hashes across normal/delayed responses for **both** DXT and WebP; it also checks that the schedules actually produce different material IDs. The pan, ground/effect queue and blended terrain regressions pass. TypeScript and 750 unit tests pass, including source-key ordering and unchanged ordering for untagged objects. The production subpath smoke passes, and the stable DXT mid-lane capture was visually reviewed.

This establishes repeatability for the tested source map and view. The chosen order comes from the frozen glTF, not a recovered native Riot render queue; native material/pass matching and the map-state fidelity gaps above remain open.

### Explicit controller defaults

A mesh's all-layer flag does not make its visibility controller irrelevant. The previous loader rendered every retained instance, including 20 meshes whose linked source controller explicitly says `DefaultVisible: false`. Those included Tunnel/Cup/Upgraded Baron terrain variants and Mountain/Ocean features. This could show mutually exclusive geometry together even after draw ordering became deterministic.

`export-map-initial-visibility.py` verifies the pinned material JSON, converter mesh/controller table and extracted mapgeo hashes, joins retained glTF node names to their source controller hashes, and exports the explicit false defaults. The [source audit](reference/map-initial-visibility.json) retains controller records, node mappings, input/output hashes and unresolved cases. Both source controller classes inherit the `DefaultVisible` field; the Toolkit metadata defines its omitted default as true. No false value is inferred from an absent field.

`loadRift` applies the table through GLTFLoader's source-node associations before rendering. It fails if any expected hidden node cannot be resolved. The meshes and full-resolution assets remain intact for subsequent state work, but hidden meshes neither draw nor request speculative texture initialization. This changes the rendered map state, not source geometry or texture quality. The map validator checks the table's artifact/input hashes, complete node coverage and explicit source evidence for each false default. The converter pipeline regenerates the table.

Five retained child/mutator controllers remain unresolved and keep their previous visibility. In particular, `ParentMode: 3` has not been assigned guessed boolean semantics, and the active Hall of Legends mutator state has not been assumed. Dynamic elemental/Baron transitions, controller evaluation and matching navigation overlays remain unfinished. Applying explicit defaults improves the initial scene without certifying a complete live map state.

Validation: 750 unit tests and TypeScript; six browser checks covering all 20 hidden instances, exclusion from draws/preparation, DXT/WebP load-order determinism, panning and exact overview restoration. The map asset validator reports zero errors/warnings. The production subpath smoke passes, and the default-visibility overview was visually inspected. The original-DXT overview now uses an estimated 293.75 MiB of resident map texture data versus 327.42 MiB when the extra variants were all drawn; initial downloads and CPU asset storage remain unchanged.
