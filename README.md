# Browser MOBA: research and design

Design a browser game that reproduces as much of League of Legends' match experience as practical without an application backend. Quality and fidelity take priority over roster size or speed of delivery.

This repository currently contains research and a build specification, not a playable implementation.

- [Game and technical design](docs/DESIGN.md)
- [Research, evidence, and uncertainties](docs/RESEARCH.md)
- [Implementation milestones and acceptance criteria](docs/ROADMAP.md)
- [Verified champion data sample](docs/reference/champion-sample.json)

Recommended architecture: TypeScript + Vite + Three.js, a renderer-independent simulation on a 2D plane, a 3D battlefield, DOM HUD, nine local bots, and browser persistence. Static hosting serves the files; matches need no game server or runtime API.

Reference target: standard PC Summoner's Rift, patch 26.18, with Data Dragon 16.18.1 as a verified data starting point. This is a frozen reference, not a promise that every rule has already been reconstructed. The specification identifies what still requires measurement.

Riot's published policy does not authorize games using its IP. The design therefore separates match-system research from the assets and content permissions needed for a literal League reproduction. An independently authored MOBA can use the proposed architecture; exact Riot content requires an appropriate license.
