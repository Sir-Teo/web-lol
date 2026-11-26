# Milestone 9 · Runtime performance, memory budget, and scale hardening

**Status: Completed on schema 188 (ruleset `878d8aaf…`, offline pack `efec8baf…`); external hardware, native Riot client, 100-seed, and human-playtest gates remain explicitly tracked as `blocked-external`.**

Milestone 9 closes Milestone 7's open runtime performance and memory-budget discrepancy (**`M7-D013`**), hardens full-match snapshot persistence under a 16-seed scale expansion across both the 10-champion public roster and the 5-champion original lineup, and re-certifies the production build (`dist/`) under nested subpath delivery, offline pack verification, browser lifecycle stress, and pinned `morluto/rea` (`rea-agents@6.10.1`) static + runtime reconciliation.

## Summary of verified gains (`M7-D013` resolved)

| Metric                                     | Milestone 7 (Schema 187) | Milestone 9 (Schema 188) | Budget       | Delta        |
| ------------------------------------------ | -----------------------: | -----------------------: | -----------: | -----------: |
| Simulation tick p95 (minute-20 10-champ)   |          `4.18 ms/tick`  |        `1.3656 ms/tick`  | `≤ 4.0 ms`   | **`-67.3%`** |
| Simulation tick mean (3,600 ticks, 2 vCPU) |          `2.70 ms/tick`  |        `0.8722 ms/tick`  | —            | **`-67.7%`** |
| Production 5v5 post-GC used JS heap        |          `524.17 MiB`    |        `194.08 MiB`      | `≤ 280 MiB`  | **`-63.0%`** |
| Production 5v5 draw calls p95 (`1920×1080`)|          `72`            |        `72`              | `≤ 250`      | Unchanged    |
| Production page errors / dev hook          |          `0` / `false`   |        `0` / `false`     | `0` / `false`| Pass         |

## Engineering changes

### 1. Bit-exact simulation hot-path optimization (`-67.3%` p95 tick time)

All three simulation optimizations preserve exact floating-point math, tie-breaking, RNG draw order, and unit iteration order:

- **`src/simulation/navgrid.ts` (`NavGrid.reachable`):** Replaced full-square grid scans with an expanding Chebyshev-ring search (`r = 1 .. maxR`) that stops once the ring's lower bound exceeds the current best squared distance while preserving exact `(dx, dy)` tie-breaking.
- **`src/simulation/vision.ts` (`seenFrom`):** Eliminated per-call closure allocation and array filtering, added squared-distance pre-rejection before `hypot`, and short-circuited line-of-sight checks immediately on first clear observer.
- **`src/simulation/world.ts` (`step` unitLookup):** Built a per-step `unitLookup` index (`byId`, `champions`, `structures`) cleared in `finally` to accelerate `unitById`, `allies`, `enemies`, `champions`, `pointVisible`, `inSight`, and `visibleTo` without changing combat semantics (preserving `!this.alive(u)` in `pointVisible`).

Bit-exact parity is verified across all six Milestone 7 public-roster baseline seeds (`26018`, `719`, `1`, `927`, `2`, `3`), every one finishing at the exact same tick as schema 187.

### 2. Browser production JS heap reduction (`-63.0%` post-GC heap)

- **`src/render/map-geometry-transport.ts`:** Added a `release()` callback to release the decoded `ArrayBuffer` (`~34.6 MiB`) immediately after map geometry upload.
- **`src/render/map-texture-residency.ts` & `src/render/map-texture-prefetch.ts`:** Added `isResident(texture)` and an optional `prepare` gate on `prefetch()`.
- **`src/render/rift-assets.ts` & `src/render/view.ts`:**
  - Skipped downloading 17 hidden-only DDS terrain textures that are never referenced by visible gameplay meshes.
  - Stored compressed `.dds.gz` bytes as `Blob`s with a bounded LRU decoded-source cache (`24 MiB` in gameplay, unbounded in `/map.html`) and decompressed on demand with `gunzipSync`.
  - Cleared `texture.mipmaps = []` immediately after GPU texture upload so Three.js does not retain duplicate CPU mip chains once uploaded.
  - Added `prepareVisibleTextures(camera)` so visible terrain textures hydrate cleanly before first gameplay frames while staying within budget.

### 3. Snapshot integrity fix uncovered by 12-seed scale expansion

Running the expanded 12-seed public cohort uncovered a pre-existing persistence bug on **seed `8` at tick `108,000`**: snapshot deserialization failed with `"Saved match contains invalid Leona ordinary attack history."`.

- **Root cause (`src/simulation/world.ts`, `World.beginLeonaDash`):** When Leona started an ordinary attack against the same enemy champion struck by her in-flight Zenith Blade (`E`), `setOrder(source, { type: 'attack', target: target.id })` was a no-op for presentation cleanup because `order.target === u.attackTarget`. `beginLeonaDash` then cleared `source.attackCycle = null` without closing the active attack presentation record.
- **Fix:** Called `this.finishAttackPresentation(source, 'action')` immediately before `source.attackCycle = null` in `beginLeonaDash`. This is pure visual-history bookkeeping with zero effect on combat math, cooldowns, or RNG.
- **Verification:** Added a deterministic regression test in `tests/milestone9-performance-and-memory.test.ts` (5/5 passing), bumped `SNAPSHOT_VERSION` to **188** (`src/simulation/snapshot.ts`) with backwards-compatible schema 187 migration (`bf0a46cf…`, `3e7c02a0…`), and confirmed seed `8` passes all 34 round-trips and reaches natural victory at tick `121,166`.

## Scale cohort results (16 full 60-minute matches, 0 failures)

### Public 10-champion roster (12 seeds)

Verified via `tools/qa/match-cohort.mjs` and independent `tools/qa/verify-match-cohort.mjs` on ruleset `878d8aaf2b241c5b515b21c68ee3efb33e35ceeae4b5e442240e2deb1c6e76a2`:

| Seed  | Winner | Final tick | Match clock | Round-trips | Future checks | Notes                          |
| ----- | ------ | ---------: | ----------: | ----------: | ------------: | ------------------------------ |
| 26018 | Red    |    129,896 |       36:04 |          37 |            36 | Exact Milestone 7 tick parity  |
| 719   | Blue   |    151,378 |       42:02 |          43 |            42 | Exact Milestone 7 tick parity  |
| 1     | Red    |    106,852 |       29:40 |          30 |            29 | Exact Milestone 7 tick parity  |
| 927   | Blue   |    135,885 |       37:44 |          38 |            37 | Exact Milestone 7 tick parity  |
| 2     | Red    |    121,660 |       33:47 |          34 |            33 | Exact Milestone 7 tick parity  |
| 3     | Red    |    112,171 |       31:09 |          32 |            31 | Exact Milestone 7 tick parity  |
| 4     | Red    |    105,011 |       29:10 |          30 |            29 | Natural Nexus victory          |
| 5     | Red    |    118,808 |       33:00 |          34 |            33 | Natural Nexus victory          |
| 6     | Red    |    131,174 |       36:26 |          37 |            36 | Natural Nexus victory          |
| 7     | Blue   |    173,724 |       48:15 |          49 |            48 | Natural Nexus victory          |
| 8     | Red    |    121,166 |       33:39 |          34 |            33 | Verified Leona dash fix        |
| 9     | Blue   |    124,687 |       34:38 |          35 |            34 | Natural Nexus victory          |
| **Total** | **12/12 victories** | **1,532,412** | **p50 33:47** | **433** | **421 (25,208 ticks)** | **0 failures, 0 unfinished** |

### Original allied lineup (4 seeds, post-Milestone-7 calibrated ruleset)

Allied Brannic, Taviq, Irielle, Vess, and Oona Vale vs calibrated Darius, Vi, Lux, Ezreal, and Morgana:

| Seed  | Winner | Final tick | Match clock | Round-trips | Future checks |
| ----- | ------ | ---------: | ----------: | ----------: | ------------: |
| 26018 | Red    |     95,466 |       26:31 |          27 |            26 |
| 719   | Red    |     94,160 |       26:09 |          27 |            26 |
| 1     | Red    |     94,150 |       26:09 |          27 |            26 |
| 927   | Red    |     93,470 |       25:57 |          26 |            25 |
| **Total** | **4/4 victories** | **377,246** | **p50 26:09** | **107** | **103 (6,180 ticks)** |

*(Note: Milestone 8's earlier original-lineup cohort ran on pre-Milestone-7 ruleset `3e7c02a0…`; these 4 seeds establish the calibrated schema 188 baseline incorporating Milestone 7's Darius/Vi/Lux/Ezreal/Morgana, drake, Herald, Voidgrub, and First Strike updates.)*

## Production delivery, browser lifecycle & REA 6.10.1 certification

- **Asset & Offline Pack Integrity (`npm run assets:validate`, `npm run offline:verify`):** `0` errors, `0` warnings; offline pack `efec8baf7ea13b73be2961874ce3b9eec976c00430f44d4564894a6ca633ca2c` (`1,554` files, `582,828,680` bytes, worker policy `41e26572…`).
- **Nested Subpath Audit (`tools/qa/production-subpath.mjs milestone9-subpath`):** `result: "passed"` under `/nested/rift/`, `recordings: 313`, `publicChampionChoices: 10`, `developmentHook: false`, `0` unrequested asset preloads.
- **Full Offline Pack Lifecycle (`tools/qa/offline-pack.mjs`):** `result: "passed"` on Chrome `157.0.8103.78`, `1,472` service worker responses, `0` production errors, all 16 checks `true` (integrity failure, cancel/retry, network-off boot & repair, atomic version handoff, scope-only removal).
- **Chrome Acceptance & 10-Restart Stability (`e2e/milestone7-presentation-and-acceptance.spec.ts`):** `2/2` Chrome tests passed, verifying multi-resolution HUD, Rift Herald summon, Reference modal, **10 sequential restarts without resource leaks**, and WebGL context-loss recovery. *(Playwright Firefox and WebKit binaries are not installed in this container image; their schema 187 acceptance receipts remain retained in `milestone7-verification.json` and `milestone8-verification.json`.)*
- **Pinned REA Certification (`tools/qa/run-milestone9-rea.mjs`, `rea-agents@6.10.1`):**
  - `audit-release-exposure`: `0` exposed findings (`by_status.exposed: 0`).
  - `analyze-javascript-application` + feature traces for offline pack (`ev_abd130e7…`) and texture backing (`ev_64f82ec3…`).
  - `capture-browser-scenario` (`ev_5e3d035f…`), passive CDP `inspect-web-page` (`ev_6e8a90ac…`), and `reconcile-javascript-runtime` (`ev_7398cbea…`): **`12/12` runtime scripts matched, `0` unmatched, `0` ambiguous**.
  - Canonical Evidence bundle `artifacts/milestone9-rea-evidence-bundle.json` (`62,319,301` bytes, SHA-256 `6056c50b0bac0a4d7680b260b8d604089ae4e255a5c1eec29b436479a476402e`, `2` records, `0` unknowns, validated by `evidence-import`).

## Explicitly retained external gates (`blocked-external`)

- Native Patch 26.18 Riot client side-by-side captures.
- Physical integrated-GPU laptop/desktop 20-minute post-warmup frame pacing and macOS desktop Safari acceptance.
- Full 100-seed 60-minute scale cohort and 20 human-input full matches.

## Reproduction commands

```sh
node tools/qa/verify-milestone9.mjs
node --test tools/qa/verify-milestone9.test.mjs
npx vitest run tests/milestone9-performance-and-memory.test.ts
npm run build && npm run assets:validate && npm run offline:verify
xvfb-run -a node tools/qa/profile-milestone7.mjs --output artifacts/milestone9-performance-profile.json
xvfb-run -a node tools/qa/run-milestone9-rea.mjs
```

See the machine-verifiable [Milestone 9 verification ledger](reference/milestone9-verification.json).
