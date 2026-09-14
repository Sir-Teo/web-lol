# Browser MOBA: research and design

Design a browser game that reproduces as much of League of Legends' match experience as practical without an application backend. Quality and fidelity take priority over roster size or speed of delivery.

The repository now contains interactive practice and lane-match modes plus the full production design. The production objective remains a complete, high-fidelity local 5v5 MOBA. This first playable is an intermediate milestone, not that completed product.

## Run locally

```sh
npm ci
npm run dev
```

Open the localhost address printed by Vite. The game opens directly into Ashe practice unless a saved match exists. Use **Escape → New match** to choose Ashe or Lux for practice or a lane match. Lane matches pair you with four allied bots against five opponents; Ashe takes bottom lane and Lux takes mid. This interim mode uses Ashe/Lux with two top, one mid and two bottom per team; jungle and neutral objectives remain unfinished. Starting replaces the current browser save. Right-click to move or attack; hold W/E/R/D to aim and release to cast. Ashe Q activates at four Focus stacks; Lux Q is aimed, and pressing E again detonates her active zone; F heals you and a nearby ally, preferring the ally under the cursor. Use A then click an enemy to attack it, or the ground for attack-move; S to stop, B to recall, P for the shop, Space to recenter, Y to lock the camera, H for controls, and Escape to pause.

Open `/map.html` on the same server to inspect the full reference terrain, original compressed textures, and matching navigation overlay. The default game uses this same terrain and navigation grid. The original small scene remains available at `/?scene=fixture` in development for regression tests. See [map assets and fidelity audit](docs/MAP-ASSETS.md) for source selection, reproducible conversion, and remaining work.

```sh
npm run check
npm run assets:validate
npm run test:browser
npm run build
npm run test:production
```

The browser suite currently uses installed Google Chrome. All runtime assets are served locally. Manual checkpoints are available from the pause menu: Save match, then reload to restore in a paused state. Match files can be downloaded and imported through **Pause → Match files**. Offline reload, autosaves and other-browser certification are not implemented yet.

## Deployment

The practice build is hosted at https://sir-teo.github.io/web-lol/. Pushes to `main` install dependencies with npm caching, build, and deploy to GitHub Pages. Documentation-only and test-only pushes skip deployment; the workflow can also be run manually. CI does not run test suites.

`npm run test:production` builds locally and checks both entrypoints beneath a strict nested static-host path using installed Google Chrome. It verifies the map-to-practice link, map controls, all nine source audio requests, real-input Hawkshot and Lux Binding casts, Lux selection and lane restart, and absence of failed/out-of-prefix requests or development hooks. Its screenshot is saved to `artifacts/production-subpath.png`.

## Current build

The playable includes the full reference Rift terrain, the pinned patch 16.18 base Ashe model with 25 atomic animation clips, eight animated minion models from patch 16.18, movement and attack states, collision-tested projectiles, basic ability approximations, three lanes with timed minion waves and inhibitor-driven super waves, 22 animated reference turrets at authored positions, a sparring bot, a target dummy, recall, a small working shop, minimap controls, pause, and practice tools. Source-grid navigation and elevation govern movement and pointer targeting. Shared terrain/brush visibility controls targeting, bots, terrain-wide fog, hidden projectiles, and combat feedback. Known enemy buildings remain shaded under fog while live health and targeting stay sight-gated.

See [development status](docs/PROGRESS.md) for verified behavior, known limitations, and the next fidelity work. The target-dummy model remains temporary; camps and full-match bot behavior are still missing. Both bases now include their Nexus and inhibitors, with protected structures, regrowth, and a local Victory/Defeat result. See the [asset pipeline](docs/ASSETS.md) for the matching minion sources and reproducible conversion. Champion animation transitions, event timing, lighting and reference-pixel calibration remain unfinished.

- [Local match checkpoints and compatibility](docs/SAVES.md)
- [Browser interruption and graphics recovery](docs/RECOVERY.md)
- [Minion sources and wave coverage](docs/MINIONS.md)
- [Structure progression and remaining rules](docs/STRUCTURES.md)
- [Latest quality-first design review](docs/DESIGN-REVIEW.md)
- [Recommended build strategy and research priorities](docs/BUILD-STRATEGY.md)
- [Game and technical design](docs/DESIGN.md)
- [Fidelity priorities, reference captures, and production gates](docs/FIDELITY-PLAN.md)
- [Research, evidence, and uncertainties](docs/RESEARCH.md)
- [Reference capture experiments and accuracy validation](docs/REFERENCE-VALIDATION.md)
- [Implementation milestones and acceptance criteria](docs/ROADMAP.md)
- [Verified champion data sample](docs/reference/champion-sample.json)

Architecture: TypeScript + Vite + Three.js, a renderer-independent simulation on a 2D plane, a 3D battlefield, and DOM HUD. Manual browser checkpoints and a selectable nine-bot lane match are implemented; complete role AI, automatic checkpoints and offline packs remain planned. Static hosting serves the files; gameplay needs no game server or runtime API.

Reference target: standard PC Summoner's Rift, patch 26.18, with Data Dragon 16.18.1 as a verified data starting point. This is a frozen reference, not a promise that every rule has already been reconstructed. The specification identifies what still requires measurement.

The local reference build includes Riot-owned icons, character models and terrain, with source URLs and hashes in `public/assets/`. Riot's published policy does not authorize games using its IP; redistribution authorization has not been established. The reference asset pack is not a cleared production distribution. The independent asset pipeline and content permissions remain tracked in the production design.
