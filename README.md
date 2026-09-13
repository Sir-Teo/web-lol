# Browser MOBA: research and design

Design a browser game that reproduces as much of League of Legends' match experience as practical without an application backend. Quality and fidelity take priority over roster size or speed of delivery.

The repository now contains an interactive practice build and the full production design. The production objective remains a complete, high-fidelity local 5v5 MOBA. This first playable is an intermediate milestone, not that completed product.

## Run locally

```sh
npm ci
npm run dev
```

Open the localhost address printed by Vite. The game opens directly into Ashe practice. Right-click to move or attack; hold W/E/R/D to aim and release to cast. Q activates at four Focus stacks; F heals. Use A then click for attack-move, S to stop, B to recall, P for the shop, Space to recenter, Y to lock the camera, H for controls, and Escape to pause.

Open `/map.html` on the same server to inspect the full reference terrain, original compressed textures, and matching navigation overlay. This terrain study is separate from the practice simulation while full-map gameplay integration is underway. See [map assets and fidelity audit](docs/MAP-ASSETS.md) for source selection, reproducible conversion, and remaining work.

```sh
npm run check
npm run assets:validate
npm run test:browser
npm run build
```

The browser suite currently uses installed Google Chrome. All runtime assets are served locally. Offline reload/persistence, other-browser certification, and production hosting are not implemented yet.

## Current build

The playable includes a three-dimensional practice lane, an animated archived Ashe reference model, six animated minion models from patch 16.18, movement and attack states, collision-tested projectiles, basic ability approximations, minion waves, two turrets, a sparring bot, a target dummy, recall, a small working shop, minimap controls, pause, and practice tools. Shared terrain/brush visibility now controls targeting, bots, fog, hidden projectiles, and combat feedback.

See [development status](docs/PROGRESS.md) for verified behavior, known limitations, and the next fidelity work. Procedural terrain, towers, and the target dummy remain temporary. See the [asset pipeline](docs/ASSETS.md) for the matching minion sources and reproducible conversion. The archived champion animation is not certified against the target patch.

- [Game and technical design](docs/DESIGN.md)
- [Research, evidence, and uncertainties](docs/RESEARCH.md)
- [Implementation milestones and acceptance criteria](docs/ROADMAP.md)
- [Verified champion data sample](docs/reference/champion-sample.json)

Architecture: TypeScript + Vite + Three.js, a renderer-independent simulation on a 2D plane, a 3D battlefield, and DOM HUD. Nine local bots and browser persistence remain planned. Static hosting serves the files; gameplay needs no game server or runtime API.

Reference target: standard PC Summoner's Rift, patch 26.18, with Data Dragon 16.18.1 as a verified data starting point. This is a frozen reference, not a promise that every rule has already been reconstructed. The specification identifies what still requires measurement.

The local reference build includes Riot-owned icons and an archived character model, with source URLs and hashes in `public/assets/`. Riot's published policy does not authorize games using its IP; redistribution authorization has not been established. The reference asset pack is not a cleared production distribution. The independent asset pipeline and content permissions remain tracked in the production design.
