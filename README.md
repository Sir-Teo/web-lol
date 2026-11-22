# Browser MOBA: research and design

Design a browser game that reproduces as much of League of Legends' match experience as practical without an application backend. Quality and fidelity take priority over roster size or speed of delivery.

The repository now contains interactive practice and interim 5v5 modes plus the full production design. The production objective remains a complete, high-fidelity local 5v5 MOBA. This first playable is an intermediate milestone, not that completed product.

The current work is [Milestone 7: reference-calibrated ten-champion full-match release](docs/MILESTONE-7.md). It prioritizes gameplay fidelity, audiovisual calibration, and full-match/browser/offline certification before further roster expansion. Milestone 7 is not yet certified.

## Run locally

```sh
npm ci
npm run dev
```

Open the localhost address printed by Vite. The game opens directly into Ashe practice unless a saved match exists. Use **Escape → New match** to choose any of the **ten playable champions** (**Ashe, Lux, Garen, Master Yi, Leona, Ahri, Darius, Vi, Ezreal, or Morgana**) for either **Practice** or a **5v5 match**, customize **Runes & Stat Shards** (`6` Keystones, `5` Secondary Runes, `3` Shard rows), and pick **Intro** or **Standard** bot skill (configurable reaction cadence and skillshot aim limits). Starting replaces the current browser save. Default 5v5 matches run a **zero-mirror 10-champion roster** across top (Darius/Garen), jungle (Vi/Master Yi), mid (Ahri/Lux), bottom (Ezreal/Ashe), and support (Leona/Morgana), loading only the models, effects, and audio needed by the active match.

Season 2026 **Role Quests** track top-lane level `20` cap, `40`-treat Primal Smite, mid Tier 3 boots + `4 s` Empowered Recall, carry **7th item slot** (`8` key), and evolved support World Atlas + `2` Control Wards. In the current implementation the upper pit schedules **Voidgrubs** (`6:00`), **Rift Herald** (`15:00`), and **Baron Nashor** (`20:00`). Herald awards a next-turret-hit siege charge, not a controllable summon. The lower pit starts an **Elemental Drake** at `5:00` and supports **Elemental Rift**, **Dragon Soul**, and **Elder Dragon** progression. Four **Faelight** rings (six after Elemental Rift) grant `+25%` ward sight and a `45 s` vision area, alongside **Stealth Ward**, **Oracle Lens**, **Farsight Alteration** (Lv `9+`), and **Control Wards** (`75g`). These are local rules; the [Milestone 7 reference audit](docs/MILESTONE-7.md) tracks unresolved native differences. Open **Pause → Reference & patch 26.18** for the `158`-entry coverage and deviations ledger. See [bot roles](docs/BOT-ROLES.md) and [Baron encounters](docs/BARON-ENCOUNTER.md).

Right-click to move or attack, or hold right-click to follow cursor changes; hold W/E/R/D to aim and release to cast; press `1, 2, 3, 5, 6, 7` (and `8` on 7-slot Carry) to use active items such as **Zhonya's Hourglass**, **Youmuu's Ghostblade**, **Locket of the Iron Solari**, **Health Potion**, and **Control Ward**. Ashe Q activates at four Focus stacks; Lux Q is aimed, and pressing E again detonates her active zone; F heals you and a nearby ally, preferring the ally under the cursor. Hold Backquote to restrict ordinary right-click and unit-targeted spell picks to champions. Use A then click an enemy to attack it, or the ground for attack-move; S to stop, B to recall, hold 4 to aim and release a Stealth/Farsight Ward or press 4 to activate an equipped Oracle Lens, P for the `58`-item shop (including **Undo** while at the fountain), drag the minimap to move the camera, Space to recenter, Y to lock the camera, H for controls, and Escape to pause.

The sound and camera-lock buttons expose their current toggle state to assistive technology; their tooltips describe the next action. Camera state stays synchronized with Y and minimap/teammate camera changes. Your sound choice is saved in this browser and survives reloads.

To practice jungle clears, select Smite in either D/F slot in **New match**, start practice, and buy a companion at the fountain. The same camp and river calendars run in practice and 5v5 matches. See [Rift practice](docs/RIFT-PRACTICE.md) for saved continuation and current limits.

The separate trinket slot shows charges, recharge and placed count. Wards supply shared team vision and retain their lifetime through saves. Swap to Oracle Lens for free in the shop at your fountain or while dead. Its eight-second moving scan reveals and disables enemy wards, while hidden champions produce sampled silhouettes. See [Stealth Ward](docs/WARDING-TOTEM.md) and [Oracle Lens](docs/ORACLE-LENS.md) for controls and current native-calibration limits.

Oracle now draws all twelve source Buff declarations and four child Death declarations, with saved ending histories through recasts, Ward swaps and reloads. The development review at `/tools/qa/oracle-particles.html` shares that renderer and also previews Alert, whose gameplay trigger remains unresolved. Scrub or isolate each layer, test moving anchors and uneven ground, and inspect the eight-second stop sequence. Native appearance, audio and performance calibration remain unfinished.

Open `/map.html` on the same server to inspect the full reference terrain, original compressed textures, and matching navigation overlay. The default game uses this same terrain and navigation grid. The original small scene remains available at `/?scene=fixture` in development for regression tests. See [map assets and fidelity audit](docs/MAP-ASSETS.md) for source selection, reproducible conversion, and remaining work.

The development-only `/?scene=leona-rift` trial starts Leona as support on the full Rift with four allied bots and five opponents. Learn Q/W for instant activation; hold E/R to aim and release. Save/reload and restart retain the support assignment. The trial has a separate browser save slot, preserving the ordinary match. The public champion chooser stays Ashe/Lux. See [Leona Rift trial](docs/LEONA-RIFT-TRIAL.md) for scope and verification.

The development-only `/?scene=fixture&champion=ahri` scene adds human Ahri practice with aimed Q/E/R, instant W, Essence and stored R casts in her own HUD. Its private save supports reload, restart and checked match-file imports. See [Ahri player practice](docs/AHRI-PLAYER.md).

The development-only `/?scene=ahri-rift&bots=ahri` trial puts Ahri mid bots on the source Rift with normal movement, vision, learning, purchases, combat and wave farming. It starts a human Ahri against an Ahri mid; choose Ashe through **New match** to play bottom with Ahri bots in both mids. Its private save preserves the ordinary and original Ahri trial slots. See [Ahri bot Rift trial](docs/AHRI-BOT-RIFT.md).

The development-only `/?scene=fixture&encounter=baron` scene adds a stationary
Baron sparring target with published minimum-level stats, the original source
rig, Flash/Smite and an isolated browser save. It supports real damage,
retaliation, local reset and checked file round-trips. Retaliation draws nine
source missile emitters and twelve hit emitters, with candidate cast/hit audio
from eight source clips. Saved paths, poses and finite audio tails reconstruct
through reload. Root, stun, silence and Charm resistance have focused checks.
Full boss abilities, epic rewards/buffs, other control interactions and live
objective calendars remain unfinished; native visual/audio calibration is open.
See the [current Baron checkpoint](docs/CURRENT-BARON-SOURCE-KERNELS.md) and
[combat fixture](docs/BARON-ENCOUNTER.md).

The development-only `/?scene=roster-rift` trial combines Garen top, Master Yi jungle, Ahri mid and Leona support with an Ashe carry. **New match** offers all six human champions in their assigned positions, with manual learning and purchases. It uses ordinary bot policies and its own save slot. See [combined roster trial](docs/ROSTER-RIFT.md) and [six-player selection](docs/ROSTER-PLAYER-SELECTION.md).

The [internal roster playtest build](docs/ROSTER-PLAYER-SELECTION.md#internal-roster-playtest-build) runs those six choices in an optimized browser build with its own saves and offline pack. It is separate from the public Pages build.

The development-only `/?scene=masteryi-rift&bots=masteryi` trial adds Yi jungle bots with paid companions, normal clears and own-kit decisions. It starts a human Yi against a Yi jungler; choose Ashe or Lux through **New match** to play alongside an allied Yi. Its private save preserves the ordinary and original Yi trial slots. See [Yi bot Rift trial](docs/MASTER-YI-BOT-RIFT.md).

The development-only `/?scene=fixture&npc=masteryi` scene adds a manual Master Yi NPC with his own melee attacks, rig, [Double Strike](docs/MASTER-YI-PASSIVE.md), [Wuju Style](docs/MASTER-YI-E.md), [Meditate](docs/MASTER-YI-W.md), [Highlander](docs/MASTER-YI-R.md) and [Alpha Strike](docs/MASTER-YI-Q.md). The fourth primary contact schedules a separate half-damage strike; E empowers both contacts, and W channels healing/mitigation while pausing E/R and building passive stacks. R adds stat bonuses, slow immunity and takedown effects; Q adds saved marks, untargetability, return/recovery and basic-hit cooldown reduction. Champion marks now retain [assist eligibility before delayed damage](docs/MASTER-YI-MARK-ASSISTS.md). Private saves retain their interactions. The [human fixture](docs/MASTER-YI-PLAYER.md) at `/?scene=fixture&champion=masteryi` adds own keyboard/mouse controls, icons, tooltips and passive feedback with a separate private save. The [base SFX source graph](docs/MASTER-YI-AUDIO.md) and decoded masters now supply [ordinary/critical attack audio](docs/MASTER-YI-AA-AUDIO.md), with source delays, pitch ranges and material impacts. [Highlander cast effects](docs/MASTER-YI-R-CAST.md) add all eight source emitters, two native meshes and 86 authored mip levels, with saved moving/hidden roots and an independent finite clock. [Highlander takedown effects](docs/MASTER-YI-R-KILL.md) add all three source emitters and 42 authored mip levels on actual live R extensions, sharing the verified Q trail geometry and retaining saved Q-hidden births. [Highlander activation/expiry audio](docs/MASTER-YI-R-AUDIO.md) uses its own source gains and attenuation. The [Sustained Highlander source reading](docs/MASTER-YI-R-BUFF.md) preserves all three variants, their ten emitters, unsorted source curves and attached overlay without inferring runtime callbacks. The [Highlander visual source closure](docs/MASTER-YI-R-PARTICLES.md) retains all five systems, 21 emitters and the separately authored persistent trail sound declaration for further integration. [Alpha Strike contact effects](docs/MASTER-YI-Q-CONTACTS.md) now use the complete ordinary/critical target emitters, a source trail mesh and all 59 authored texture mip levels, with saved contact/visibility histories. [Alpha Strike audio](docs/MASTER-YI-Q-AUDIO.md) adds both declared cast layers and ordinary contact cues, with source pitch/voice policies and saved finite tails. [Alpha Strike cast effects](docs/MASTER-YI-Q-CAST.md) add both source cast emitters, a seekable four-cell disappear atlas and all 35 authored texture mip levels, with saved roots independent of body hiding. [Alpha Strike reappearance](docs/MASTER-YI-Q-END.md) adds both return emitters, all 41 authored texture mip levels and an explicitly mapped early distortion pass, with saved complete/target-loss return roots. [Meditate cast effects](docs/MASTER-YI-W-CAST.md) add all seven source cast emitters, their torus mesh and 87 authored texture mip levels, with saved movement/visibility and finite cancellation/death tails. [Sustained Meditate effects](docs/MASTER-YI-W-BUFF.md) add all four buff emitters, the heal mesh and 54 authored mip levels, with exact saved interruption clocks and compressed root histories. [Meditate damage effects](docs/MASTER-YI-W-DAMAGE.md) add both finite reaction emitters on positive W-reduced damage, reusing all four Q contact textures and saving independent roots through linger, Q, death and victory. The [complete Meditate source closure](docs/MASTER-YI-W-PARTICLES.md) also retains damage and tenacity systems for later presentation work. [Meditate audio](docs/MASTER-YI-W-AUDIO.md) plays the finite cast and living ending cues with saved independent tails, preserving the activation stop declaration and unfinished loop/foley playback. The [W foley source connection](docs/MASTER-YI-W-FOLEY.md) now retains the explicit entry-animation, skin-resource and persistent-sound chain without inventing its frame-time conversion. [Wuju Style audio](docs/MASTER-YI-E-AUDIO.md) adds both finite onset cues and natural ending, with original playlists, saved pause/removal accounting and independent source clocks. The [complete Wuju Style visual source](docs/MASTER-YI-E-PARTICLES.md) retains all six E resources, 14 emitters and their native texture dependencies with original names and omissions. The [authored sword conditions](docs/MASTER-YI-SWORD-BINDINGS.md) bind the active E child to four sword instances and Highlander to the ordinary main-sword effect. [Saved sword glows](docs/MASTER-YI-SWORD-GLOWS.md) render those five declared joint instances with full posed rotations, 78 authored mip levels, rolling visibility histories and finite removal tails. [Ordered draw batching](docs/MASTER-YI-SWORD-INSTANCING.md) combines eligible sword particles while preserving transparent ordering with an individual-draw fallback. The [attack-trail source closure](docs/MASTER-YI-ATTACK-TRAILS.md) retains all five event-bound ordinary/critical/passive trails, their center-joint attachment and complete native dependencies. The [Double Strike composite reading](docs/MASTER-YI-PASSIVE-AUDIO.md) retains parent/secondary omissions and both hit actions with their shared material branches. Double Strike playback, other unfinished effects, native calibration and production selection remain separate work.

The development-only `/?scene=fixture&champion=garen` fixture adds human Garen controls and HUD for kit testing. Q/W/E activate directly; hold R over a visible enemy champion in range and release. Courage draws twelve [source cast/ground/shoulder/reaction layers](docs/GAREN-W-PARTICLES.md) and uses [source cast/loop/ending audio](docs/GAREN-W-AUDIO.md), including authored loop bounds and saved stop fades. Judgment now draws six [source particle layers](docs/GAREN-SPIN.md) and uses [source cast/spin/ending/hit audio](docs/GAREN-E-AUDIO.md), with checkpoint-stable presentation tails. R adds nineteen [source visual layers](docs/GAREN-R-PARTICLES.md), including lethal-hit shockwave/rays/flash, and [cast/hit/stereo kill audio](docs/GAREN-R-AUDIO.md), retaining sound after particles end. Garen is still excluded from production selection while full presentation and native calibration remain open. See [Garen player fixture](docs/GAREN-PLAYER.md) for learning, setup and checkpoint behavior.

```sh
npm run check
npm run assets:validate
npm run test:browser
npm run build
npm run offline:verify
npm run test:production
```

The latest full suite passes 9,215/9,217 tests. The missing historical Leona
checker/archive and the retained Lux E sampler digest remain unresolved; their
assertions are unchanged. See the [current validation receipt](docs/reference/ahri/e-rendering-acceptance.json)
and [Lux runtime portability audit](docs/LUX-E-SAMPLER-PORTABILITY.md).

The default browser suite uses installed Google Chrome, and the multi-browser Milestone 5 acceptance suite (`npx xvfb-run -a npx playwright test -c tools/qa/multibrowser.playwright.config.ts`) runs across Google Chrome, Firefox, and WebKit. All runtime assets are served locally. Manual checkpoints and automatic recovery checkpoints are available from the pause menu (`Save match` and `Match files`), deterministic command-log replays with SHA-256 checkpoint verification are available under **Pause → Replay** and on **Victory**/**Defeat**, combat/feedback submix sliders and the `-6 dBFS` teamfight limiter live under **Pause → Sound & mix**, expanded 8-action practice controls live under **Practice tools**, and WebGL context loss offers **Save match** from the intact simulation before restoring cleanly. Use **Pause → Offline files → Download game pack** in a persistent browser profile to cache the complete `581.2 MB` build for offline reloads. See [Milestone 5 report](docs/MILESTONE-5.md) and [offline delivery](docs/OFFLINE-PACKS.md) for verified scope and device/quota limits.

[Decisive Strike source audio](docs/GAREN-Q-AUDIO.md) now follows accepted Q activation, buff stops and committed swings, including both QAttack layers and their authored delay. Saved clocks retain stop fades and source tails; the development audition page remains at `/tools/qa/garen-q-audio-preview.html`.

[Decisive Strike particle sources](docs/GAREN-Q-PARTICLES.md) now include all eleven systems, 29 textures and four meshes. Inspect them at `/tools/qa/garen-q-source-preview.html`. Twenty-two emitters now render, including the target's silence icon. Schema 85 retains the landing anchor and each Q hit's accepted silence deadline, preserving original clocks through reload and overlapping sources. Native silence sizing/attachment, blur/axis dispatch, distortion and visual calibration remain open.

## Deployment

The practice build is hosted at https://sir-teo.github.io/web-lol/. Pushes to `main` install dependencies with npm caching, build, and deploy to GitHub Pages. Documentation-only and test-only pushes skip deployment; the workflow can also be run manually. A separate CI workflow runs TypeScript, scoped Baron/Ahri audio, particle, sound-preference and cohort checks on
Node 24.22.1, plus cache-independent float-format/publication guards; the full suite and browser/offline gates remain
separate. See [Q projectile acceptance](docs/reference/ahri/q-projectile-rendering-acceptance.json).

On Linux with system Chromium, build first and run `node tools/qa/production-subpath.mjs --system-chromium unique-run-name`. The default command continues to use installed Google Chrome.

The complete offline-pack audit also accepts system Chromium: after building, run `node tools/qa/offline-pack.mjs unique-run-name --system-chromium`. It checks actual Cache Storage, network-off restoration, repair, cancellation and version activation. Use a fresh run name to retain earlier evidence. Omit the flag to use installed Google Chrome; run browser audits serially.

The offline-panel retry probe has a separate configuration:

```sh
npx playwright test --config tools/qa/offline-ui.playwright.config.ts
```

It uses installed Playwright Chromium, or `CHROMIUM_PATH` for an existing browser.
The fixture enables the production panel gate and controls storage operations;
it checks pending-action behavior, not service-worker cache correctness.

`npm run test:production` builds locally and checks both entrypoints beneath a strict nested static-host path using installed Google Chrome. It verifies the map-to-practice link, map controls, source audio and selected Oracle recordings, real-input Hawkshot and Lux Binding casts, Lux selection and 5v5 restart, five-position scoreboard assignments and selected jungle companion rigs, all eleven practice monster rigs, Smite selection, a practice companion purchase, real Stealth Ward placement and saved restoration, Oracle Lens preparation/activation/restoration, rejection of development player-fixture flags, and absence of failed/out-of-prefix requests or development hooks. Each run reserves an exclusive claim and writes eight screenshots to
`artifacts/production-subpath-<run>-<view>.png` plus a namespaced JSON report.
Existing run names reject before browser work. It also requires zero unsolicited
Baron model/effect/audio requests, Ahri audio masters and Q cast/projectile particle assets when Ahri is absent. See [QA artifact retention](docs/QA-ARTIFACT-RUNS.md).

`npm run offline:verify` checks every current distribution file, its complete
manifest, pack identity and generated worker without rewriting historical receipts.
It verifies bytes, not browser behavior.

## Current build

The playable includes the full reference Rift terrain, the pinned patch 16.18 base Ashe model with 25 atomic animation clips, eight animated minion models from patch 16.18, movement and attack states, collision-tested projectiles, basic ability approximations, three lanes with timed minion waves and inhibitor-driven super waves, 22 animated reference turrets at authored positions, a sparring bot, a target dummy, recall, a small working shop, minimap controls, pause, and practice tools. Source-grid navigation and elevation govern movement and pointer targeting. Shared terrain/brush visibility controls targeting, bots, terrain-wide fog, hidden projectiles, and combat feedback. Known enemy buildings remain shaded under fog while live health and targeting stay sight-gated.

See [development status](docs/PROGRESS.md) for verified behavior, known limitations, and the next fidelity work. The target-dummy model remains temporary; epic objectives and full-match bot behavior remain unfinished. Both bases now include their Nexus and inhibitors, with protected structures, regrowth, and a local Victory/Defeat result. See the [asset pipeline](docs/ASSETS.md) for the matching minion sources and reproducible conversion. Champion animation transitions, event timing, lighting and reference-pixel calibration remain unfinished.

- [Stealth Ward controls and source boundaries](docs/WARDING-TOTEM.md)
- [Oracle Lens controls, counterplay and source boundaries](docs/ORACLE-LENS.md)
- [Rift practice camps and companion growth](docs/RIFT-PRACTICE.md)
- [Local match checkpoints and compatibility](docs/SAVES.md)
- [Automatic recovery checkpoints and preview](docs/RECOVERY-CHECKPOINTS.md)
- [Five-position assignments and jungle/support decisions](docs/BOT-ROLES.md)
- [Shared siege, defense, gank and river strategy](docs/BOT-TEAM-STRATEGY.md)
- [Allied bot intent in the scoreboard](docs/ALLIED-INTENT.md)
- [Held F1–F5 champion cameras](docs/TEAM-CAMERA.md)
- [Teammate portraits, health and camera controls](docs/ALLY-PORTRAITS.md)
- [Camera-aligned held spell and ward previews](docs/AIM-CAMERA.md)
- [Minimap camera dragging](docs/MINIMAP-CAMERA-DRAG.md)
- [Held champion targeting](docs/CHAMPION-TARGETING.md)
- [Held right-click movement](docs/HELD-MOVEMENT.md)
- [Wall-time frame-rate readout](docs/FRAME-RATE.md)
- [Wall-time result effects and frozen match state](docs/TERMINAL-WALL-CLOCK.md)
- [Pinned epic-objective character records](docs/EPIC-CHARACTERS.md)
- [Baron, Herald and Grub source rigs and binding audit](docs/EPIC-MODELS.md)
- [Current Baron source effects, candidate audio and delivery](docs/CURRENT-BARON-SOURCE-KERNELS.md)
- [Complete private Baron audio corpus](docs/BARON-AUDIO-CORPUS.md)
- [Completed development-roster 100-seed baseline (7ae8e0)](docs/CURRENT-DEVELOPMENT-ROSTER-HUNDRED.md)
- [Frozen unfinished-match horizon diagnostics and continuations](docs/E20BDC-UNFINISHED-HORIZON.md)
- [Private Baron combat, saves and admission](docs/BARON-ENCOUNTER.md)
- [Baron root, stun, silence and Charm resistance](docs/BARON-CONTROL.md)
- [Selected full matches on the initial Baron ruleset](docs/BARON-BASELINE-MATCHES.md)
- [Historical control build: full match and offline delivery](docs/BARON-CONTROL-DELIVERY.md)
- [Historical hundred-game combined-roster invariant gate](docs/COMBINED-HUNDRED-ABC8DC.md)
- [Historical hundred-game ordinary-roster invariant gate](docs/ORDINARY-HUNDRED-ABC8DC.md)
- [Frozen source-cache recovery](docs/REFERENCE-CACHE-RECOVERY.md)
- [Fresh offline delivery and completed-match checks](docs/OFFLINE-CONTROLS-REFRESH.md)
- [Late natural finishes and current-pack offline round-trips](docs/LATE-MATCH-ROUNDTRIP.md)
- [Bot group-combat decisions](docs/BOT-GROUP-COMBAT.md)
- [Master Yi character source foundation](docs/MASTER-YI.md) — complete retained records, ranked declarations and explicit source/client omissions; [development rig review](docs/MASTER-YI-MODEL.md) is available at `/tools/qa/masteryi-model.html`, and the [manual NPC fixture](docs/MASTER-YI-NPC.md) at `/?scene=fixture&npc=masteryi` adds own melee attacks and private saves; the playable kit remains unfinished.
- [Garen and Ahri roster expansion](docs/ROSTER-EXPANSION.md)
- [Charm source audio and saved phase clocks](docs/AHRI-CHARM-AUDIO.md) — nine unchanged masters, exact Linear play fade and retained Exp1 stop domain.
- [Orb source audio and saved dispatch clocks](docs/AHRI-Q-AUDIO.md) — 22 unchanged masters, per-leg hit sequences and distinct flight stop curves.
- [Charm saved observation](docs/AHRI-E-VISUAL-HISTORY-PLAN.md) — strict cast, flight, contact and target-lifetime history, owned animation poses and frozen gameplay comparisons.
- [Charm particle source preparation](docs/AHRI-E-PARTICLES.md) — 28 bound profiles with exact restored packets, finite tails and lazy loading; native buff skin selection and calibration remain open.
- [Spirit Rush joined spell rendering](docs/AHRI-R-PARTICLES.md) — 23 saved missile/contact profiles, four eye glow/trail profiles on both native eye bones and all six layout quad/glow/mesh profiles, with exact restored packets and lazy assets; other persistent and unresolved profiles remain deferred.
- [Fox-Fire joined source rendering](docs/AHRI-W-RENDERING.md) — 23 orbit, flight and hit profiles, saved visibility and finite drains; cast/weapon resources remain unjoined.
- [Fox-Fire source audio and saved clocks](docs/AHRI-W-AUDIO.md) — eleven unchanged masters, continuous activation and a separate stop-tail cue.
- [Essence Theft source audio](docs/AHRI-P-AUDIO.md) — five shared masters, independent saved consumption cues and exact restore.
- [Ahri Q particle source](docs/AHRI-Q-PARTICLES.md) — seven native systems, complete private mip/mesh decode and raw attachment declarations.
- [Ahri Q cast particles](docs/AHRI-Q-CAST.md) — saved delayed dispatch, source swirls/glow and animated Tails.
- [Ahri Q projectile particles](docs/AHRI-Q-PROJECTILES.md) — both missile systems, source surfaces/ribbons, saved visibility and restored finite clocks; hit, speed and Orb_Cast remain unbound.
- [Ahri Recall source audio](docs/AHRI-RECALL-AUDIO.md) — finite channel audio, saved return/interruption clocks and birth visibility.
- [Ahri lifecycle source audio](docs/AHRI-LIFECYCLE-AUDIO.md) — finite death and actual respawn cues with independent saved audiences.
- [Ahri attack source audio](docs/AHRI-AA-AUDIO.md) — ordinary/critical aliases, twelve masters and saved windup/contact clocks.
- [Ahri development NPC and source declarations](docs/AHRI.md) — `/?scene=fixture&npc=ahri` adds her own stats, ordinary attacks, rig and manually cast [Q](docs/AHRI-Q.md)/[W](docs/AHRI-W.md)/[E](docs/AHRI-E.md) and [R base](docs/AHRI-R.md) controllers plus [Essence Theft](docs/AHRI-PASSIVE.md) healing/R resets; [human practice controls and HUD](docs/AHRI-PLAYER.md) are available in a separate development scene; role AI and native presentation remain unfinished.
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

Architecture: TypeScript + Vite + Three.js, a renderer-independent simulation on a 2D plane, a 3D battlefield, and DOM HUD. Manual browser checkpoints, match-file export/import, offline asset packs and a selectable nine-bot 5v5 foundation are implemented; complete team/role AI remains unfinished. Static hosting serves the files; gameplay needs no game server or runtime API.

Reference target: standard PC Summoner's Rift, patch 26.18, with Data Dragon 16.18.1 as a verified data starting point. This is a frozen reference, not a promise that every rule has already been reconstructed. The specification identifies what still requires measurement.

The local reference build includes Riot-owned icons, character models and terrain, with source URLs and hashes in `public/assets/`. Riot's published policy does not authorize games using its IP; redistribution authorization has not been established. The reference asset pack is not a cleared production distribution. The independent asset pipeline and content permissions remain tracked in the production design.

Private Yi primary attacks also render [saved ordinary and critical weapon trails](docs/MASTER-YI-PRIMARY-TRAILS.md) with the retained native mesh and all 25 authored mip levels.

The private Double Strike presentation also retains [both saved authored trail events](docs/MASTER-YI-PASSIVE-TRAILS.md), with separate current-pose decisions and shared verified geometry.

Private Yi ordinary attacks now use [both source-declared body/trail/audio choices](docs/MASTER-YI-ATTACK-SELECTION.md), with indexed cosmetic selection and separate source cast delays.

[Primary contact effects](docs/MASTER-YI-PRIMARY-HITS.md) now render all eleven ordinary/critical hit emitters with 93 authored mips, saved target chest poses, finite tails and explicit unblended fluid.

[Owned pose capture](docs/POSE-HISTORY-CAPTURE.md) reduces timeline-copy overhead while preserving independent saved attachment histories.

[Native payload restoration](docs/NATIVE-CLIENT-RESTORATION.md) recovers the exact frozen client bytes for further static fidelity work.

[Native constructor evidence](docs/NATIVE-CONSTRUCTOR-WITNESS.md) now supplies the Yi hit compiler’s omitted primitive and alpha-byte defaults without changing its rendered outputs.

The [native emitter scalar witness](docs/NATIVE-EMITTER-SCALAR-DEFAULTS.md)
backs the existing Yi primary-hit atlas and flag defaults with exact frozen
constructor/registration bytes; generated game data remains unchanged.

[Spatial-drag replay](docs/PARTICLE-SPATIAL-DRAG-REPLAY.md) removes repeated
per-step work while retaining exact primary-hit particle outputs.

The [distortion evidence recovery](docs/PARTICLE-DISTORTION-RECOVERY.md)
restores all 53 original shader resources and artifacts against unchanged hashes.

The [Lux FMA reference](docs/LUX-E-FMA-REFERENCE.md) reproduces the original
sampler golden with controlled compiler arithmetic and preserves game math.

[Source particle placement](docs/PARTICLE-SURFACE-PLACEMENT.md) avoids unused
rotations and transient allocations with exact state and GPU pixel comparisons.
