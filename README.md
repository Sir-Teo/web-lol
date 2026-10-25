# Browser MOBA: research and design

Design a browser game that reproduces as much of League of Legends' match experience as practical without an application backend. Quality and fidelity take priority over roster size or speed of delivery.

The repository now contains interactive practice and interim 5v5 modes plus the full production design. The production objective remains a complete, high-fidelity local 5v5 MOBA. This first playable is an intermediate milestone, not that completed product.

## Run locally

```sh
npm ci
npm run dev
```

Open the localhost address printed by Vite. The game opens directly into Ashe practice unless a saved match exists. Use **Escape → New match** to choose Ashe or Lux for practice or a 5v5 match. Matches pair you with four allied bots against five opponents; Ashe takes bottom and Lux takes mid. This interim Ashe/Lux roster assigns top, jungle, mid, bottom and support on each team. Jungle bots scout and clear home camps using Smite and paid companions; supports leave nearby carry farm and place brush wards. Shared strategy adds threatened-building defense, supported sieges and visible ganks/Scuttlers. Both modes schedule twelve ordinary camps and Scuttlers. Major objectives, the complete roster and complete team strategy remain unfinished. See [bot roles](docs/BOT-ROLES.md). Starting replaces the current browser save. Right-click to move or attack; hold W/E/R/D to aim and release to cast. Ashe Q activates at four Focus stacks; Lux Q is aimed, and pressing E again detonates her active zone; F heals you and a nearby ally, preferring the ally under the cursor. Use A then click an enemy to attack it, or the ground for attack-move; S to stop, B to recall, hold 4 to aim and release a Stealth Ward or press 4 to activate an equipped Oracle Lens, P for the shop, Space to recenter, Y to lock the camera, H for controls, and Escape to pause.

To practice jungle clears, select Smite in either D/F slot in **New match**, start practice, and buy a companion at the fountain. The same camp and river calendars run in practice and 5v5 matches. See [Rift practice](docs/RIFT-PRACTICE.md) for saved continuation and current limits.

The separate trinket slot shows charges, recharge and placed count. Wards supply shared team vision and retain their lifetime through saves. Swap to Oracle Lens for free in the shop at your fountain or while dead. Its eight-second moving scan reveals and disables enemy wards, while hidden champions produce sampled silhouettes. See [Stealth Ward](docs/WARDING-TOTEM.md) and [Oracle Lens](docs/ORACLE-LENS.md) for controls and current native-calibration limits.

Oracle now draws all twelve source Buff declarations and four child Death declarations, with saved ending histories through recasts, Ward swaps and reloads. The development review at `/tools/qa/oracle-particles.html` shares that renderer and also previews Alert, whose gameplay trigger remains unresolved. Scrub or isolate each layer, test moving anchors and uneven ground, and inspect the eight-second stop sequence. Native appearance, audio and performance calibration remain unfinished.

Open `/map.html` on the same server to inspect the full reference terrain, original compressed textures, and matching navigation overlay. The default game uses this same terrain and navigation grid. The original small scene remains available at `/?scene=fixture` in development for regression tests. See [map assets and fidelity audit](docs/MAP-ASSETS.md) for source selection, reproducible conversion, and remaining work.

The development-only `/?scene=leona-rift` trial starts Leona as support on the full Rift with four allied bots and five opponents. Learn Q/W for instant activation; hold E/R to aim and release. Save/reload and restart retain the support assignment. The trial has a separate browser save slot, preserving the ordinary match. The public champion chooser stays Ashe/Lux. See [Leona Rift trial](docs/LEONA-RIFT-TRIAL.md) for scope and verification.

The development-only `/?scene=fixture&champion=garen` fixture adds human Garen controls and HUD for kit testing. Q/W/E activate directly; hold R over a visible enemy champion in range and release. Courage draws twelve [source cast/ground/shoulder/reaction layers](docs/GAREN-W-PARTICLES.md) and uses [source cast/loop/ending audio](docs/GAREN-W-AUDIO.md), including authored loop bounds and saved stop fades. Judgment now draws six [source particle layers](docs/GAREN-SPIN.md) and uses [source cast/spin/ending/hit audio](docs/GAREN-E-AUDIO.md), with checkpoint-stable presentation tails. R adds nineteen [source visual layers](docs/GAREN-R-PARTICLES.md), including lethal-hit shockwave/rays/flash, and [cast/hit/stereo kill audio](docs/GAREN-R-AUDIO.md), retaining sound after particles end. Garen is still excluded from production selection while full presentation and native calibration remain open. See [Garen player fixture](docs/GAREN-PLAYER.md) for learning, setup and checkpoint behavior.

```sh
npm run check
npm run assets:validate
npm run test:browser
npm run build
npm run test:production
```

The browser suite currently uses installed Google Chrome. All runtime assets are served locally. Manual checkpoints are available from the pause menu: Save match, then reload to restore in a paused state. Match files can be downloaded and imported through **Pause → Match files**. Offline reload, autosaves and other-browser certification are not implemented yet.

[Decisive Strike source audio](docs/GAREN-Q-AUDIO.md) now follows accepted Q activation, buff stops and committed swings, including both QAttack layers and their authored delay. Saved clocks retain stop fades and source tails; the development audition page remains at `/tools/qa/garen-q-audio-preview.html`.

[Decisive Strike particle sources](docs/GAREN-Q-PARTICLES.md) now include all eleven systems, 29 textures and four meshes. Inspect them at `/tools/qa/garen-q-source-preview.html`. Twenty-two emitters now render, including the target's silence icon. Schema 85 retains the landing anchor and each Q hit's accepted silence deadline, preserving original clocks through reload and overlapping sources. Native silence sizing/attachment, blur/axis dispatch, distortion and visual calibration remain open.

## Deployment

The practice build is hosted at https://sir-teo.github.io/web-lol/. Pushes to `main` install dependencies with npm caching, build, and deploy to GitHub Pages. Documentation-only and test-only pushes skip deployment; the workflow can also be run manually. CI does not run test suites.

`npm run test:production` builds locally and checks both entrypoints beneath a strict nested static-host path using installed Google Chrome. It verifies the map-to-practice link, map controls, 17 startup recordings and three selected Oracle recordings, real-input Hawkshot and Lux Binding casts, Lux selection and 5v5 restart, five-position scoreboard assignments and selected jungle companion rigs, all eleven practice monster rigs, Smite selection, a practice companion purchase, real Stealth Ward placement and saved restoration, Oracle Lens preparation/activation/restoration, rejection of development player-fixture flags, and absence of failed/out-of-prefix requests or development hooks. Its screenshot is saved to `artifacts/production-subpath.png`.

## Current build

The playable includes the full reference Rift terrain, the pinned patch 16.18 base Ashe model with 25 atomic animation clips, eight animated minion models from patch 16.18, movement and attack states, collision-tested projectiles, basic ability approximations, three lanes with timed minion waves and inhibitor-driven super waves, 22 animated reference turrets at authored positions, a sparring bot, a target dummy, recall, a small working shop, minimap controls, pause, and practice tools. Source-grid navigation and elevation govern movement and pointer targeting. Shared terrain/brush visibility controls targeting, bots, terrain-wide fog, hidden projectiles, and combat feedback. Known enemy buildings remain shaded under fog while live health and targeting stay sight-gated.

See [development status](docs/PROGRESS.md) for verified behavior, known limitations, and the next fidelity work. The target-dummy model remains temporary; epic objectives and full-match bot behavior remain unfinished. Both bases now include their Nexus and inhibitors, with protected structures, regrowth, and a local Victory/Defeat result. See the [asset pipeline](docs/ASSETS.md) for the matching minion sources and reproducible conversion. Champion animation transitions, event timing, lighting and reference-pixel calibration remain unfinished.

- [Stealth Ward controls and source boundaries](docs/WARDING-TOTEM.md)
- [Oracle Lens controls, counterplay and source boundaries](docs/ORACLE-LENS.md)
- [Rift practice camps and companion growth](docs/RIFT-PRACTICE.md)
- [Local match checkpoints and compatibility](docs/SAVES.md)
- [Five-position assignments and jungle/support decisions](docs/BOT-ROLES.md)
- [Shared siege, defense, gank and river strategy](docs/BOT-TEAM-STRATEGY.md)
- [Bot group-combat decisions](docs/BOT-GROUP-COMBAT.md)
- [Garen and Ahri roster expansion](docs/ROSTER-EXPANSION.md)
- [Ahri development NPC and source declarations](docs/AHRI.md) — `/?scene=fixture&npc=ahri` adds her own stats, ordinary attacks and rig; spells and player selection remain unfinished.
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

Architecture: TypeScript + Vite + Three.js, a renderer-independent simulation on a 2D plane, a 3D battlefield, and DOM HUD. Manual browser checkpoints and a selectable nine-bot 5v5 foundation are implemented; complete team/role AI, automatic checkpoints and offline packs remain planned. Static hosting serves the files; gameplay needs no game server or runtime API.

Reference target: standard PC Summoner's Rift, patch 26.18, with Data Dragon 16.18.1 as a verified data starting point. This is a frozen reference, not a promise that every rule has already been reconstructed. The specification identifies what still requires measurement.

The local reference build includes Riot-owned icons, character models and terrain, with source URLs and hashes in `public/assets/`. Riot's published policy does not authorize games using its IP; redistribution authorization has not been established. The reference asset pack is not a cleared production distribution. The independent asset pipeline and content permissions remain tracked in the production design.
