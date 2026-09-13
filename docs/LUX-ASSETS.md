# Lux base model and atomic animations

The second champion's base asset is now prepared from the same pinned client build as the existing Rift and Ashe assets: 16.18.8175716, manifest `29CE6E781C3B6368`, archive `DATA/FINAL/Champions/Lux.wad.client`. `reference/lux-model.json` retains the skin/animation definitions, original source URLs, archive chunks, individual file hashes and atomic clip mappings.

The extractor verifies 25 unique source files, including the mesh, skeleton, texture and binary definitions. It decodes the binary skin and animation graph and compares them with the pinned JSON records. All 22 atomic clips are preserved; the graph's separate `Recall` sequencer remains recorded rather than flattened into an invented atomic clip. [Skin record](https://raw.communitydragon.org/16.18/game/data/characters/lux/skins/skin0.bin.json), [animation record](https://raw.communitydragon.org/16.18/game/data/characters/lux/animations/skin0.bin.json)

The converted GLB contains 4,926 triangles, 79 bones and 22 animations in 3,864,360 bytes. Source skin scale 1.5 becomes a 0.015 unit conversion, applied consistently to vertices, node translations, inverse bind matrices and animation translations. The original texture is retained. Zero-weight joint indices are canonicalized for glTF validity; meaningful weights are preserved. Materials use unlit source color, as in the existing Ashe adapter. The output and conversion manifest are `public/assets/models/lux-base.glb` and `lux-base.json`.

Rebuild from the repository root:

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-lux-model.py
node tools/assets/convert-lux-base.mjs
npm run assets:validate
```

The existing configured CDTB and lol2gltf tool runtimes are required. To inspect clips interactively, run `npm run dev` and open `/tools/qa/champion-preview.html` on the local development server. The preview supports clip selection, play/pause, scrubbing, orbiting and zoom. It is a development tool and is not a production build entry or selectable champion screen.

## Verification and remaining integration

GLB validation reports zero errors and warnings. The full model/map asset validator passes after correcting its lookup for the previously added static Ashe arrow manifest. The Lux browser case loads all 22 clips and samples every skinned vertex at three times per clip, rejecting non-finite results. Idle and ultimate poses were captured and inspected. All 512 source/simulation checks and nested-path production smoke pass.

This prepares the source rig, not a playable Lux. Champion identity and gameplay selection, passive/Q/W/E/R rules, cast timing, returning shields, persistent zones/recasts, particles, sound, indicators, AI, save ownership and interaction tests remain to be integrated. Animation graph transitions, sequencer timing, event dispatch, native material lighting and pose/camera comparison are also unfinished. The playable default remains Ashe; loading Lux into that simulation as an Ashe-shaped substitute would not implement her kit.

## Distinct simulation actor and runtime rig

The runtime now loads `lux-base.glb`, selects it from the saved champion identity, plays `spell1` for queued Q, and uses the pinned recall sequence `idle3` → `entry_b4dcde19`. Selection uses Lux's radius 100 and height 85 with the existing provisional cylinder adapter. Loading the additional rig adds 3,864,360 bytes to the initial model catalog; conditional roster loading and the full performance budget remain outstanding.

`reference/lux-character.json` retains the root character and basic-attack records with the full downloaded response hash. `python3 tools/assets/export-lux-progression.py` regenerates the selected stats; run Prettier afterward. Lux owns base HP 580, mana 440, AD 54, armor 21, MR 30, range 550 and movement 330. Growth uses the shared pinned nonlinear level factors; attack-speed growth uses her separate 0.625 ratio against base 0.669. Regeneration is champion-specific. The 14-tick base attack windup is calculated from a conventional 30% base fraction plus the authored −0.14375 offset, rather than a measured native release. Its calibration is unfinished. [Pinned character source](https://raw.communitydragon.org/16.18/game/data/characters/lux/lux.bin.json)

Four simulation cases verify growth/regeneration, resource ownership and saved Q release, absence of Ashe attack passives, and unavailable spells/invalid saves. A match browser scenario verifies the real Lux rig, spell animation, two roots and both recall clips. This is a Q-capable scenario actor; passive/W/E/R, champion selection, native effects/audio and Lux combat AI remain unfinished.
