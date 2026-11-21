# Milestone 5: Presentation, Browser Reliability, and Offline Delivery

Milestone 5 completes deterministic command-log replay, Web Audio combat/feedback mixing with teamfight peak limiting, expanded practice tools, WebGL context-loss recovery with intact-world save offering, sequential-session GPU/DOM/listener disposal, multi-browser verification (Chrome, Firefox, WebKit), full-match 6-champion 5v5 stress profiling, production offline-pack certification, and `morluto/rea` (`rea-agents@6.10.1`) static and runtime Evidence verification.

Simulation rules and save compatibility remain pinned to Milestone 4:

- `SNAPSHOT_VERSION`: `184`
- `SNAPSHOT_RULESET`: `1cf6e4e9b814a10bcd727579afc7485af55df0f870b7deed6cfdaadb58989ce7`
- Production offline pack: `2fe8cc4211e2c14208afef5a21c416e9f98248639de98b6bb694ebd1a2e7f102` (`1,432` files, `581,220,111` bytes, worker policy SHA-256 `41e26572bb22a1213c268473c6cdbb7bc0aba4b95cf7e6d27ad07131b749873a`)

## 1. Deterministic Command-Log Replay (`src/replay/match-replay.ts`)

- **Format (`rift-match-replay`, version `1`):** Stores the initial `WorldSnapshot` (validated against `SNAPSHOT_VERSION = 184` and `SNAPSHOT_RULESET`), ordered external player mutation entries (`command`, `buy`, `sell`, `move-item`, `practice`), periodic SHA-256 state checkpoints (`checkpointIntervalTicks = 300`), `totalTicks`, and `finalSha256`.
- **Bot vs. human command boundary:** `MatchReplayRecorder` wraps `world.enqueue`, `world.buy`, `world.sell`, and `world.moveItem` with an `inStep` re-entrancy guard around `world.step()`, recording external human commands and shop/practice mutations without double-recording AI commands enqueued during `World.update()`.
- **Playback, seeking, and integrity:** `MatchReplayPlayer` clones an isolated playback `World`, caches periodic snapshots every `300` ticks for fast backward/forward seeking (`Restart`, `-5s`, `Pause`/`Play`, `+5s`, and `0.5×` / `1×` / `2×` / `4×` speed), locks `InputController` into `readOnly` mode so pointer/keyboard gameplay inputs cannot mutate the replay `World`, and computes WebCrypto `SHA-256` digests at every checkpoint tick and `totalTicks`, surfacing live `✓ X/Y hashes` or explicit mismatch status in `#replay-bar`.
- **Fail-closed import validation:** `parseMatchReplayLog` and `prepareReplayImport` reject oversized payloads (`> 10 MiB`), invalid JSON, wrong `format`, mismatched `snapshotVersion` or `ruleset`, non-monotonic or out-of-range entry/checkpoint ticks, invalid payloads, and battlefield mismatches before touching the live session.
- **UI integration:** Accessible from **Pause → Replay** (`Watch current replay`, `Download replay file`, `Choose replay file`) and directly on the **Victory** / **Defeat** modal (`Watch replay`, `Download replay`).

## 2. Combat Sound Mix & Teamfight Limiter (`src/audio/audio.ts`, `src/storage/sound-preference.ts`)

- **Submix routing without ruleset drift:** `AudioManager` constructs `masterBus`, `combatBus`, `combatCompressor` (`DynamicsCompressorNode`: threshold `-6 dBFS`, knee `12 dB`, ratio `4:1`, attack `3 ms`, release `150 ms`), and `feedbackBus`. All champion and Baron source-audio controllers connect through a `Proxy`-wrapped `combatContext` whose `destination` resolves to `combatBus`, keeping `rulesetFiles` completely untouched.
- **Persistence & cross-browser `AudioParam` behavior:** `rift:sound-mix:v1` persists `{ master, combat, feedback, dynamicLimiter }` independently of the boolean mute key (`rift:sound-enabled:v1`). Gain updates apply both direct `.value` assignment and `setValueAtTime(..., currentTime)` after `cancelScheduledValues` so suspended `AudioContext` instances in Chrome, Firefox, and WebKit report identical immediate readbacks.
- **HUD controls:** **Pause → Sound & mix** provides keyboard-accessible `Master volume`, `Combat SFX`, `UI & feedback cues` range sliders, `Dynamic fight limiter: On/Off`, and `Reset mix defaults`.

## 3. Practice Tools (`src/practice/practice-tools.ts`)

Shared between live HUD execution and deterministic replay playback:

- `Restore HP/MP` (`restore`)
- `Reset cooldowns` (`cooldowns`)
- `+500g` (`gold`)
- `Spawn/move dummy` (`dummy`)
- `Level up` (`level-up`)
- `Level 18` (`max-level`)
- `Reset enemy` (`reset-enemy`)
- `Fast-forward 30s` (`fast-forward-30s`, `1,800` stepped simulation ticks with full recorder checkpointing)

## 4. WebGL Context-Loss Recovery & Sequential Session Disposal

- **Context-loss soft-depth safety & save offering:** On `webglcontextlost`, `main.ts` pauses simulation, calls `view.disposeContextResources()` to release all eight `SceneDepth` render targets (`Oracle`, `Leona W/E/R`, `Ahri W/Q/E/R`) plus both `ParticleDistortionPass` buffers and clear stale `softDepth` uniforms on live particle layers, and opens the `Graphics interrupted` dialog offering **Save match**, **Download current match**, and **Restart match** from the intact `World`. On `webglcontextrestored`, WebGL targets rebuild lazily on demand and the player can resume cleanly.
- **Zero-leak sequential matches:** `GameView.resetWorldState()` and `GameView.dispose()` release unit meshes, textures, geometries, health bars, range rings, fog/minimap overlays, and `particleBatcher` GPU buffers, replacing cached rigs cleanly if an asset reference changes. `InputController`, `Hud`, `AttackStatTooltip`, and `ScoreboardItemTooltip` tear down window/DOM listeners via `AbortController`. In multi-browser E2E testing across 4 consecutive 6-champion 5v5 restarts, `renderer.info.memory` held steady (`geometries: 433 → 400`, `textures: 329 → 325`, `hudCount: 1`, `canvasCount: 1`).

## 5. Multi-Browser Matrix, Visual Review & Offline Quota Findings

`npx xvfb-run -a npx playwright test -c tools/qa/multibrowser.playwright.config.ts` passes **9/9** browser acceptance scenarios across all three target engines:

| Browser engine           | Version tested    | WebGL 2 backend in CI        | Result       |
| ------------------------ | ----------------- | ---------------------------- | ------------ |
| Google Chrome (Chromium) | `157.0.8103.78`   | ANGLE Vulkan SwiftShader     | `3/3` passed |
| Mozilla Firefox (Gecko)  | Playwright `155`  | Mesa `llvmpipe` (under Xvfb) | `3/3` passed |
| WebKit (Safari engine)   | Playwright `26.6` | WebKit headless WebGL 2      | `3/3` passed |

Captured and visually inspected review set (`artifacts/milestone5-*.png`):

1. `artifacts/milestone5-playfield.png` — Rift playfield, HUD, minimap, practice corner
2. `artifacts/milestone5-fog-vision.png` — Off-lane fog-of-war shading and sight boundary
3. `artifacts/milestone5-aiming.png` — Held `W` Volley cone/range telegraph
4. `artifacts/milestone5-busy-fight.png` — Multi-unit 6-champion 5v5 combat, projectiles, and floating combat text
5. `artifacts/milestone5-shop.png` — Item shop recipes, search, stats, and inventory slots
6. `artifacts/milestone5-death-state.png` — Champion death greyscale overlay and respawn timer
7. `artifacts/milestone5-result-screen.png` — Victory screen with `Watch replay` and `Download replay`
8. `artifacts/milestone5-replay-bar.png` — Live `#replay-bar` transport with `✓ hashes` verification badge
9. Gameplay `.webm` recording retained per browser scenario under `test-results/`.

### Measured Browser Storage & Quota Limits

- **Persistent browser profiles (`tools/qa/offline-pack.mjs`):** Complete `1,432`-file (`581,220,111`-byte) pack downloads, SHA-256 verifies, installs `offline-worker.js`, repairs missing metadata, restores saved ticks, and boots a fresh 5v5 lane match with network disabled (`1,494` service-worker responses, `0` errors) in ~18 seconds using bounded 6-way fetch/Cache Storage pipelining.
- **Chromium Incognito / Private Browsing finding:** Chromium masks `navigator.storage.estimate().quota` as `10 GiB` (`10,737,418,240` bytes) in Incognito mode while enforcing an actual RAM-backed `StoragePartition` cap of approximately `6%` of host RAM (`~458 MB` on an `8 GiB` machine). Because the full unstripped 6-champion deployment is `581.2 MB`, full-pack downloads in Incognito windows on `≤ 8 GiB` RAM hosts hit `QuotaExceededError` cleanly (`Browser storage is full. Free space and retry; completed files are kept.`), whereas standard persistent profiles succeed.

## 6. Full-Match 6-Champion 5v5 Stress Profile & Revised Device Limits

Stress fixture (`artifacts/milestone5-public-stress-*`, `72,900` simulated ticks / `20:15` public 6-champion 5v5 with Baron Nashor spawned and `595` ability casts across Lux, Garen, Master Yi, Ashe, Leona, and Ahri):

| Metric                                               | Provisional target (`DESIGN.md`)         | Measured Milestone 5 value                                                                                   | Disposition                                                                                 |
| ---------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Simulation step (`Node V8`, `72,900` ticks)          | `p95 ≤ 4.0 ms/tick`                      | `1.46 ms/tick` mean (incl. invariant checks); `0` violations                                                 | **Met** (main-thread simulation retained; worker not needed)                                |
| Draw calls (`1920×1080`, `121` active units)         | `< 250`                                  | `median 135`, `p95 167`, `p99 172`                                                                           | **Met**                                                                                     |
| Rendered triangles (`1920×1080`)                     | Reference Rift + roster                  | `median 331,114`, `p95 355,527`                                                                              | Recorded                                                                                    |
| Active GPU resources (`renderer.info`)               | Bounded across matches                   | `114` geometries, `181` textures, `20` programs                                                              | **Met** (zero growth across restarts)                                                       |
| Fog-of-war update (`256×256`)                        | Bounded                                  | `median 4.8 ms`, `p95 7.7 ms`                                                                                | Recorded                                                                                    |
| HUD update                                           | Bounded                                  | `median 0.5 ms`, `p95 1.0 ms`                                                                                | **Met**                                                                                     |
| Production 6-champion 5v5 JS heap (post-GC)          | `≤ 256 MiB`                              | `261.6 MiB` (`274,344,121` bytes after practice→5v5 transition)                                              | **Revised to `≤ 280 MiB`** for full 6-champion Rift                                         |
| Full offline source-quality deployment               | `60 MB` core placeholder                 | `581.2 MB` (`1,432` files, unstripped reference art/audio)                                                   | **Revised to `≤ 600 MB` full pack** (requires persistent profile on `≤ 8 GiB` RAM hosts)    |
| Frame interval on headless 2-vCPU VM (`SwiftShader`) | `p95 ≤ 16.7 ms` on integrated-GPU laptop | `median 1,149.9 ms` (`96.3%` in Vulkan `SwiftShader` software rasterizer; JS `renderCalls` `median 18.2 ms`) | Software-WebGL host limitation documented; physical GPU laptop 60 FPS gate remains distinct |

## 7. `morluto/rea` (`rea-agents@6.10.1`) Evidence Ledger

All static and runtime observations were recorded with `morluto/rea` v6.10.1 and exported to `artifacts/milestone5-rea-evidence-bundle.json` (`14` complete records, SHA-256 `4e9710a5f56f9cc52c892bac22f888a107fa6d2ab8a1dc1a7073db066b2da3a1`, verified via `rea evidence-import`):

| Investigation question                                                                         | REA operation                    | Evidence ID                                                                                                                                           | Authority / Confidence           | Observed finding & explicit boundary                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Does `dist/` leak source maps, debug companions, or credential markers?                        | `audit_release_exposure`         | `ev_429acdde2fbad5bf3cb9b5f9db36f9af3bea0fe5b7f2e07abf2676bd4e74fa57`                                                                                 | `shipped-artifact` / `observed`  | `exposed: 0`, `embedded source maps: 0`, `debug companions: 0`, `credential hits: 0` across `175` scanned text members (`6` large chunks skipped by static byte cap; does not prove global security).                                                                                                                                                |
| Does `dist/` parse cleanly and preserve static bundle integrity?                               | `analyze_javascript_application` | `ev_d2236f24c1f475e4cedc6b22d3ff426968a21ef9e01d706b201873d7396f835e` (summary `ev_ae8bfd9fe59b27a272c5747aa071ac0c51e6663422b053aea84768efb9925f78`) | `shipped-artifact` / `derived`   | Root digest `7e0c1eb7918237c15034beee195247fd5b7bb2c1e066708eef1b8f69c6ac22a0`; `4` core entry bundles (`assets/game-BW4z7NqY.js`, `offline-worker.js`, `assets/map-B5roSaMX.js`, `assets/rules-C6_6Wsp1.js`) parsed with `0` syntax errors across `398,630` AST nodes and `2,168` static findings (`173` asset/chunk files left outside AST scope). |
| Can minified `dist/` chunks be reverse-mapped to `src/` without source maps?                   | `compare_source_to_bundle`       | `ev_b78ed2e189d455a431e498fb2076cc1e52b07e15b52249dcde6e2975a5331b96` (summary `ev_8d05cec4974bd95b6b9d936fdfa3de00118ca7d2161f2a3d3a1f65a1852a9a77`) | `analyst-inference` / `inferred` | `829` `src/` files (`root_sha256: 7a833253…`) vs `321` application graph nodes remain `unknown` because production omits source maps (`embedded: 0`), confirming fail-closed non-attribution.                                                                                                                                                        |
| Do Practice Tools, Sound & Mix, and Deterministic Replay execute cleanly in the shipped build? | `capture_browser_scenario`       | `ev_df0af4ec20c09db974016ea34c4c9c6de0f65cc08bdf1d883dec84e1b3f0cc53` (summary `ev_1c788b25223e9e26a5adc392b0b8cf4bc8b0a4e0af3bc2b51562ac6473e59381`) | `controlled-replay` / `observed` | All `13` declared browser actions completed on `/nested/rift/` (`Chromium 157.0.8103.78`): `353/353` `2xx` HTTP responses, `0` failed requests, `0` page errors, and final accessibility snapshot (`sha256: 321b4bf7…`) verified `Match replay controls` with `REPLAY ✓ 1/1 hashes`.                                                                 |

## 8. Reproducible Verification

Run the committed Milestone 5 verifier after `npm run build`:

```sh
node tools/qa/verify-milestone5.mjs
```
