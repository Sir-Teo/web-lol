# Milestone 8 · Original roster and audiovisual validation

The local roster now has 15 playable champions. Selecting an original in **Escape → New match → Original lineup** makes that champion playable in Practice or 5v5. In 5v5 the five originals fill the allied roles and face Darius, Vi, Lux, Ezreal, and Morgana.

| Role    | Champion                        | Kit                                                                |
| ------- | ------------------------------- | ------------------------------------------------------------------ |
| Top     | Brannic, the Kilnwarden         | Temper, Ridgehammer, Bank the Fire, Kilnstep, Firing Ring          |
| Jungle  | Taviq, the Thornrunner          | Forager, Briar Sweep, Hidewrap, Vaultvine, Bramble Gate            |
| Mid     | Irielle, the Prism Cantor       | Refrain, Lattice, Violet Interval, Glass Mantle, Resonant Crown    |
| Carry   | Vess, the Coilwright            | Overcharge, Copper Shot, Static Stake, Slip Coupling, Arc Rail     |
| Support | Oona Vale, the Tideglass Mender | Salt Thread, Glass Current, Harbor Light, Salt Circuit, Springtide |

Each champion has an independently authored rig, ten animation clips, a champion icon, four ability icons, cast and impact cues, and bot tactics for their role. Ability windups, hit geometry and impact events use the simulation clock. The glTF check verifies the rig sizes in world units as well as binary validity and provenance. The browser review includes champion scale and cast readability in an overlapping teamfight.

## Natural match results

The independent cohort verifier checked both original-lineup 5v5 matches with normal win conditions. Both finished with a destroyed Blue Nexus and a Red victory.

| Seed  | Result               | Tick    | Match clock | Exact restores | Matching continuations |
| ----- | -------------------- | ------- | ----------- | -------------- | ---------------------- |
| 719   | Red victory          | 86,908  | 24:08       | 25             | 24                     |
| 26018 | Red victory          | 98,360  | 27:19       | 28             | 27                     |
| Total | Two natural finishes | 185,268 |             | 53             | 51                     |

The automated human slot controlled Vess. The other four originals used their role bots. Every retained checkpoint passed strict decoding and an exact round trip, and the separate simulations advanced another 3,060 matching ticks. These two seeds are a match reliability check. Balance across seeds and human play remains unmeasured.

## Browser and media evidence

Chrome 157, Firefox 155, and WebKit 26.6 each selected all five originals in the production chooser, started Vess's 5v5, showed ten champions on the scoreboard, cast Copper Shot through keyboard input, replayed the cast with matching hashes, and reloaded the checkpoint. Five rigs passed glTF validation with zero warnings and zero errors. The staged teamfight capture shows the original silhouettes and overlapping spell geometry at the match camera scale. Chromium rendered ten isolated Q audio samples through the game's Web Audio mix, one cast and one impact from each champion. All ten samples contained a signal below clipping.

REA 6.10.1 completed 14 actions through the production chooser and captured the loaded 5v5 frame. Visual review revealed a rig-unit mismatch in the first build, so the rigs were re-exported and the production capture was run again. REA also ran its release exposure audit and analyzed the selected game bundle, rules bundle, and offline worker. Its JavaScript graph has bounded static coverage. The browser scenario and static bundle passed REA's evidence import validation.

Chrome, Firefox, and WebKit verified all 1,554 pack files, then imported, replayed, reloaded, and exported the seed 719 result with the origin server stopped. Both exports from each engine exactly matched the cohort checkpoint, and none of the browsers contacted the origin during this phase. Chrome and Firefox also used Playwright's network emulation. A two-file check reproduced that the WebKit override blocks even cached navigation, so WebKit used the stopped server to exercise the offline path.

The [verification ledger](reference/milestone8-verification.json) records the ruleset, pack identity, browser results, and REA evidence IDs.

The build and pack integrity checks passed, along with 87 focused gameplay
tests and 48 cohort and historical-verifier checks. The broad Vitest run
encountered unavailable legacy reference fixtures, timeouts, and a Lux E
sampler hash mismatch. The
long-running Ahri audio-history test passed in isolation after timing out
during the broad run and on the baseline checkout.

## Main integration

The merge retained the upstream map redraw and source-specific slow policies
for Darius, Morgana, and Hextech Soul. The schema 187 reader upgrades
checkpoints from both schema 186 builds and the initial Milestone 8 release.
On the integrated build, 129 focused gameplay tests passed. REA completed the
14-action production browser scenario and refreshed the release exposure
audit. The pack integrity check verified 1,554 files and 582,802,756 bytes.
Both 5v5 seeds reproduced the recorded results and passed 53 exact checkpoint
restores and 51 matching continuations. Chrome imported, replayed, reloaded,
and exported an exact copy of the completed checkpoint with the server stopped.

## Reproduction

Run the [original-lineup cohort](MATCH-COHORT.md) from the repository root, build the production pack, and verify its manifest.

```sh
npm run build
npm run assets:validate
npm run offline:verify
npx playwright install chromium
npm run preview
```

With the production build running, exercise champion selection, Vess's cast input, checkpoint reload, and real replay validation in each target engine. Pass `--headed` on hosts where software WebGL needs a display.

```sh
node tools/qa/original-lineup-browser.mjs --browser chromium --url http://127.0.0.1:4173/ --output artifacts/original-lineup-chromium
node tools/qa/offline-completed-match.mjs --report .cache/milestone8-new/seeds/719/report.json --output-dir artifacts/original-lineup-offline
```

Current checkpoints use [schema 187](SAVES.md), which also opens supported Milestone 6 and Milestone 7 checkpoints. Replay hashes remain specific to the ruleset that generated them.
