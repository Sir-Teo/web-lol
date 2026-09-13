# Reference asset pipeline

The game now uses animated base melee, caster, and siege minions for both teams, extracted from the matching patch 16.18 game archive. Procedural minion and champion fallback geometry has been removed. The default game also uses the full reference Rift terrain. Both teams’ towers now use matching source rigs, textures, submesh states, and authored placements. The training dummy still uses temporary geometry.

## Sources and provenance

The [Riot release service](https://sieve.services.riotcdn.net/api/v1/products/lol/version-sets/EUW1?q%5Bplatform%5D=windows&q%5Bpublished%5D=true) returned release `29CE6E781C3B6368`, content version `16.18.8175716`, created September 11, 2026. Rebuilds use that fixed [manifest](https://lol.dyn.riotcdn.net/channels/public/releases/29CE6E781C3B6368.manifest), not the moving release endpoint.

The minion sources reside in `DATA/FINAL/Maps/Shipping/Map11.wad.client`. The archive is 2.49 GB, but the extractor reads only the header, subchunk table, and selected file ranges. The current selection uses 83 CDN chunks totaling 3.10 MB compressed and extracts 88 files totaling 5.74 MB. Only the required meshes, rigs, textures, and four selected animation states enter the runtime assets.

- `docs/reference/minion-extraction.json` pins the release manifest hash, CDN bundle byte ranges and hashes, resolved WAD paths, and extracted file hashes.
- `docs/reference/minion-wad-paths.json` contains the 89 required path-hash resolutions, including the subchunk table. The development investigation used CommunityDragon's full hash list; future rebuilds do not need that 224 MB file.
- `docs/reference/minion-skins.json` snapshots the six skin and animation graph definitions from CommunityDragon 16.18, with their exact URLs.
- Each runtime GLB has a sibling JSON manifest identifying its input files, output hash, triangles, bones, scale, and animation mapping.

The source art remains Riot-owned reference material. Provenance does not establish production distribution permission. Current source versions are stronger evidence than the archived Ashe model, but gameplay capture calibration and verification of the active in-match skin selection are still required before asserting pixel parity.

## Conversion details

| Model | Triangles | Joints | Authored skin scale |
|---|---:|---:|---:|
| Blue melee | 1,063 | 43 | 0.70 |
| Red melee | 1,223 | 43 | 0.74 |
| Blue caster | 1,071 | 43 | 0.76 |
| Red caster | 1,076 | 46 | 0.87 |
| Blue siege | 1,690 | 40 | 0.925 |
| Red siege | 1,605 | 40 | 0.925 |

The converter resolves `Idle1`, `Run`, `Attack1`, and `Death` through each source animation graph. Red melee deliberately shares several blue melee animations according to its graph. Blue caster's default death is `minion_caster_death3`, rather than the similarly named alternatives. Siege attack selection currently keeps the first authored option; randomized attack variants remain unimplemented.

Centimeters and authored skin scale are baked consistently into positions, joint translations, inverse bind matrices, and animation translation tracks. Skeletons remain at the glTF scene root. Materials use their source painted textures with unlit shading. The six GLBs total about 2.9 MiB and contain four clips each. Their source clip durations, including deaths around three seconds, are preserved. The renderer uses separate animation mixers and cloned skeletons per unit while sharing mesh geometry and textures. Unit removal disposes its skeleton GPU texture and mixer bindings without disposing shared geometry or painted textures.

Health-bar placement is measured from the initial animated model bounds. Dead unit records remain for four seconds so these death clips can finish. Attack animation playback still needs precise release-frame calibration against reference captures; passing state-transition tests does not prove that timing parity.

## Rebuild on the current macOS ARM development environment

The running game requires none of these extraction dependencies. They are build-time tools under ignored `.tools/` and `.cache/` directories.

Pinned tools:

- [CDTB](https://github.com/CommunityDragon/CDTB), commit `ba981db2a2c814a0d78e55f6483e0636b527850f`.
- [lol2gltf](https://github.com/Crauzer/lol2gltf), commit `7fe8d5c9b82fd0a86ea682fced28f8021bb3e063`.
- Local .NET SDK 8.0.425, installed at `.tools/dotnet` with Microsoft's `dotnet-install.sh`.
- The lol2gltf ImageSharp dependency is updated from 3.1.6 to 3.1.12 before publishing the converter. The rebuild no longer emits the earlier ImageSharp vulnerability warnings.
- Python dependencies are pinned in `tools/assets/requirements.txt`; glTF Transform 4.5.0 is locked in `package-lock.json`.

For an existing checked-out toolchain:

```sh
python3 -m venv .tools/cdtb-venv
.tools/cdtb-venv/bin/pip install -r tools/assets/requirements.txt

# In the pinned lol2gltf checkout, update the directly referenced ImageSharp package.
.tools/dotnet/dotnet add .tools/lol2gltf/src/lol2gltf/lol2gltf.csproj package SixLabors.ImageSharp --version 3.1.12
.tools/dotnet/dotnet publish .tools/lol2gltf/src/lol2gltf/lol2gltf.csproj -c Release -r osx-arm64 -o .tools/converter --self-contained false -p:PublishReadyToRun=false -p:PublishSingleFile=false

PYTHONPATH=.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/extract-reference-minions.py
node tools/assets/convert-minions.mjs
npm run assets:validate
npm run test:browser
```

The extractor rejects changes to the pinned manifest, compressed chunks, or extracted source bytes. Conversion checks source bytes against their recorded provenance before reading them. The asset validator checks every GLB's output hash and runs the Khronos validator. All seven current GLBs have zero errors and warnings. Blue caster retains four source degenerate triangles, reported at informational severity; no geometry repair was guessed.

The browser suite includes a six-model gallery, distinct mixer behavior, complete death playback and removal, and attack-windup cancellation. Screenshot evidence is stored locally in `artifacts/browser-minion-gallery.png`.

## Full map extraction

The separate [map pipeline](MAP-ASSETS.md) now extracts pinned terrain, materials, textures, and navigation from this archive. `/map.html` provides a full-map inspection scene with original GPU-compressed textures and a navigation overlay. The playable simulation uses this terrain, source-grid collision and sight, bilinear elevation, authored fountain and turret positions, and three lane routes. The original small terrain is retained only as an explicit development regression fixture.

## Matching tower assets

The map's authored `Characters/Turret/Skins/Skin0` and `Skin3` references select the blue and red models. Skin3 explicitly shares the Skin02 mesh/rig and animation graph while supplying red textures. The source skin scale is approximately 0.9 for blue and the default 1.0 for red. The runtime applies each full source placement matrix, including rotation and height, after conversion to browser coordinates; targeting direction does not rotate the building.

`docs/reference/turret-definitions.json` freezes both skin and animation definitions with their exact CommunityDragon 16.18 URLs and source hashes. `turret-extraction.json` pins the manifest, selected patch chunks, 15 source files, and the definition snapshot hash. `turret-wad-paths.json` is the minimal path table. Extraction reads 2,867,273 compressed bytes from 28 chunks and yields 6,010,112 source bytes. It reuses the existing pinned Map11 archive reader and the minion converter toolchain.

```sh
PYTHONPATH=.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/extract-reference-turrets.py
node tools/assets/convert-turrets.mjs
npm run assets:validate
```

The two GLBs total 4,766,672 bytes. Blue has 58 joints and 16,499 triangles across all retained parts; its intact visible part has 3,358 triangles. Red has 82 joints and 27,410 triangles across all retained parts; its intact base and cloth have 5,626 triangles. Original painted texture dimensions and all seven referenced animation files are retained across the two assets. GLB reconstruction after a fresh generated animation-directory cleanup is byte-identical.

Every submesh is an independent node with `submesh`, `initiallyHidden`, and `destroyedVisible` extras. The game applies these source-derived visibility states; a generic glTF viewer that ignores the extras will display overlapping intact, damaged, and broken parts. Geometry and textures are shared, while each unit owns one rig and mixer. Submeshes within a tower share that rig, and removal disposes its bone texture without disposing the shared assets.

Destroyed towers remain as records and render the source rubble parts in the initial `Destroyed` pose. This is a persistent rubble representation, not the complete destruction sequence. Damage-stage triggers, staged break animation events, ambient sparkle/glow, attack VFX and muzzle attachment, respawn rules, native texture-mip preservation, and pixel calibration remain outstanding. Source graph definitions are retained so these can be reconstructed without inventing animation timing. Enemy-building memory remains separate vision work.

Browser checks cover all 22 exact placement matrices, fixed building orientation during attack states, initial visible parts, independent per-tower rigs, persistent rubble for both teams, hidden dead health bars, and GPU cleanup on explicit removal. Intact/rubble screenshots are stored under `artifacts/browser-{blue,red}-tower-{intact,rubble}.png`.

## Nexus and inhibitor assets

The default map now includes both teams’ source Nexus and inhibitor models, with intact/dead submeshes and retained clips. See [structure assets and gameplay](STRUCTURES.md) for provenance, rebuild commands, state handling, tests, and explicit remaining accuracy work. All fifteen current GLBs pass validation with zero errors/warnings.

## Super-minion assets

Both team models now use the same matching 16.18 source pipeline. Their six clips, source scales, provenance, reconstruction commands, and animation-derived corpse lifetime are documented in [lane minions](MINIONS.md). All fifteen model GLBs validate with zero errors/warnings. Original six-minion rebuilds remain byte-identical after sharing the converter.
