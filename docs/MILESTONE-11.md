# Milestone 11 · Simulation engine optimization, 100-seed scale certification (`M7-D012`), and 3-browser release readiness

**Status: Completed on schema 190 (ruleset `578c93f0…`, offline pack `426e7668…`). Closes `M7-D012` (100-seed 60-minute public-roster scale cohort) and expands production acceptance across Chrome 157, Firefox 155, and WebKit 26.6; native Patch 26.18 Riot client captures, physical integrated-GPU/macOS Safari hardware benchmarks, and 20 human-input matches remain explicitly tracked as `blocked-external`.**

Milestone 11 delivers a bit-exact **2.13×** 60 Hz simulation engine speedup, uses that headroom to certify the full **100-seed 60-minute public-roster scale cohort** (`100/100` natural Nexus victories, `12,822,682` checked ticks, `3,616` exact minute round-trips, `0` failures — closing `M7-D012`), verifies **bit-exact parity** on all 6 Milestone 7/9/10 public baseline seeds and all 8 Milestone 10 calibrated Original-lineup seeds, completes full **3-browser acceptance** across **Chrome 157, Firefox 155, and WebKit 26.6** (including real completed-match offline import/replay/reload/export on all three engines), adds a fail-closed macOS desktop Safari release-gate harness (`tools/qa/milestone11-macos-safari.mjs`), re-certifies the shipped production build (`dist/`) with pinned `morluto/rea` (`rea-agents@6.10.1`), and wires Milestone 11 into `.github/workflows/milestone-gates.yml`.

## Highlights

### 1. Bit-exact 60 Hz simulation engine optimization (`src/simulation/world.ts`, `src/simulation/milestone6-champions.ts`, `src/content/mobile-clip-durations.ts`, `src/simulation/snapshot.ts`)

V8 CPU profiling of full 60-minute 5v5 matches (`match-seed.js`) showed that ~42% of simulation CPU time was spent in per-tick unit scans (`nearest()`, `visible()`, `pointVisible()`), per-tick structure/stat snapshot rebuilding, and repeated linear lookups in `mobileClipDurations()`.

- **Engine optimizations (strictly bit-exact):**
  - Team-partitioned alive-unit lookup cache (`unitLookup`) scoped strictly to `World.step()` (invalidated in `finally` so external test mutations such as `world.units.reverse()` never observe stale ordering).
  - 16×16 world spatial grid for alive non-champion units (retaining `dummy` units for `pointVisible()` vision while skipping them in `nearest()`, with explicit invalidation hooks on displacement effects including Darius E and Vi R).
  - O(1) self-sight fast path, squared-distance fast rejects, zero-allocation `pointVisible(..., false)`, fused buff/debuff expiry loops, and change-guarded `observedStats` / `structureKnowledge` updates.
  - `Map`-backed `mobileRig()` and `mobileClipDurations()` with a fast path for non-mobile unit kinds.
  - Bumped `SNAPSHOT_VERSION` to **190** (`src/simulation/snapshot.ts`) with backwards-compatible schema `185`–`189` migration (including Milestone 10 `c1e93950…`).
- **Measured speedup & budgets (`artifacts/milestone11-performance-profile.json`):**
  - Seed 1 full 5v5 match wall time: **`148.96 s` → `69.9 s`** (**2.13× faster**, bit-exact final tick `106,852`).
  - Minute-20 10-champion stress profile (`3,600` ticks, seed `26018`): **`0.8025 ms/tick` p95** (`0.502 ms` mean, `0.436 ms` p50 — down from `1.3754 ms/tick` p95 in Milestone 10, **5× under** the `4.0 ms` budget).
  - Production 5v5 browser profile (`Chrome/157.0.8103.78`, `1920×1080`): **`72` p95 draw calls** (`≤ 250`), **`244.29 MiB` post-GC used JS heap** (`≤ 280 MiB`), `76` textures, `100` buffers, `developmentHookPresent: false`, `0` page errors.
- **Verified by:** `tests/milestone11-release-readiness.test.ts` (`4/4` unit tests covering schema 187/188/189 → 190 migration and tamper rejection, `step(N)` vs `step(1)` bit-exactness, spatial-grid dummy vision / `nearest()` / external mutation safety, and `mobileRig` parity).

### 2. `M7-D012` Closed — Full 100-seed 60-minute public-roster scale cohort (`docs/reference/578c93-public-milestone11-hundred-ledger.json`)

The complete default 100-seed 60-minute public-roster cohort (`tools/qa/match-cohort.mjs --jobs 2 --keep-going --snapshot-compression gzip`, verified by both `tools/qa/verify-match-cohort.mjs --public-roster` and `tools/qa/verify-milestone7-cohort.mjs`) passed with **100% natural Nexus completion**:

| Metric | Value | Gate requirement |
| ------ | ----: | ---------------- |
| Requested / completed seeds | **100 / 100** | 100 seeds |
| Natural Nexus victories | **100 (100.0%)** | `≥ 98%` (`verify-milestone7-cohort.mjs`) |
| Unfinished (60-min horizon) | **0** | `≤ 2` |
| Simulation / round-trip / invariant failures | **0** | `0` |
| Checked 60 Hz ticks | **12,822,682** | 100% checked |
| Exact minute snapshot round-trips | **3,616** | 100% bit-exact |
| Saved-future continuation checks | **3,516 (210,908 ticks)** | 100% bit-exact |
| Victory duration (p10 / p50 / p90) | **29:46 / 34:20 / 43:41** | Natural 60-min pacing |
| Side split (Blue / Red) | **20 Blue / 80 Red** | Recorded candidly for future public-roster balance work |
| Milestone 7/9/10 public baseline seeds (6/6) | **Bit-exact (`26018: 129896`, `719: 151378`, `1: 106852`, `927: 135885`, `2: 121660`, `3: 112171`)** | `0` tick drift |

> Note: `docs/reference/milestone7-discrepancy-register.json` is an immutable pinned Milestone 7 artifact (`verify-milestone7.mjs`) and intentionally remains untouched; `M7-D012` closure is recorded here, in `docs/reference/milestone11-verification.json`, and in `docs/ROADMAP.md`.

### 3. Bit-exact 8-seed Original-lineup calibration parity (seeds `1–8`)

All 8 Milestone 10 calibrated Original-lineup seeds (`Brannic`, `Taviq`, `Irielle`, `Vess`, `Oona Vale` vs public team) finished with **bit-exact winner and final-tick parity** on schema 190 (`578c93f0…`):

| Seed | Winner | Final tick | Match clock | Round-trips | Future checks | Parity vs M10 |
| ---- | ------ | ---------: | ----------: | ----------: | ------------: | ------------- |
| 1    | Blue   |    144,276 |       40:04 |          41 |            40 | Bit-exact     |
| 2    | Red    |    145,534 |       40:25 |          41 |            40 | Bit-exact     |
| 3    | Red    |    139,619 |       38:46 |          39 |            38 | Bit-exact     |
| 4    | Red    |    149,744 |       41:35 |          42 |            41 | Bit-exact     |
| 5    | Blue   |    112,358 |       31:12 |          32 |            31 | Bit-exact     |
| 6    | Red    |    149,434 |       41:30 |          42 |            41 | Bit-exact     |
| 7    | Red    |    141,332 |       39:15 |          40 |            39 | Bit-exact     |
| 8    | Blue   |    136,636 |       37:57 |          38 |            37 | Bit-exact     |
| **Total** | **8/8 victories (Blue 3 – Red 5, 37.5% Blue)** | **1,118,933** | **p50 39:15** | **315** | **307 (18,420 ticks)** | **0 drift, 0 failures** |

### 4. Full 3-browser acceptance (Chrome 157, Firefox 155, WebKit 26.6), offline delivery, macOS Safari tooling & REA 6.10.1 certification

- **3-Browser Playwright Acceptance (`tools/qa/milestone11-multibrowser.playwright.config.ts` — `9/9` passed):**
  - Both `e2e/milestone10-controls-and-accessibility.spec.ts` (cast modes, 20-action key rebinding, color-vision palettes, HUD/text scaling, persistence) and `e2e/milestone7-presentation-and-acceptance.spec.ts` (1280×720 / 1920×1080 / 2560×1440 HUD readability, split-evidence Reference modal, Eye of the Herald summon, 10 sequential restarts, pause clock freeze, and WebGL context-loss recovery) passed across **Chrome `157.0.8103.78`**, **Firefox `155.0`**, and **WebKit `26.6`**.
- **3-Browser Real Completed-Match Offline Restore (`tools/qa/offline-completed-match.mjs`, seed `26018` tick `129,896`):**
  - **Chrome `157.0.8103.78`:** `passed`, `2,244` SW responses, `0` offline origin requests, `0` errors.
  - **Firefox `155.0`:** `passed`, `2,229` SW responses, `0` offline origin requests, `0` errors.
  - **WebKit `26.6`:** `passed`, `2,162` SW responses, `0` offline origin requests, `0` errors.
- **Production Subpath, Asset & Full Offline Pack Audits:**
  - `npm run assets:validate` (`0` errors, `0` warnings) and `npm run offline:verify` (pack `426e76689f2a4a3458a83e67000744bb4a0b7d9d60a83403bfd1338d944ac389`, `1,554` files, `582,860,137` bytes, worker policy `41e26572…`).
  - `production-subpath.mjs milestone11-subpath`: `passed` under `/nested/rift/`, `recordings: 313`, `publicChampionChoices: 10`, `developmentHook: false`, `0` unrequested preloads.
  - `offline-pack.mjs milestone11-offline`: `passed` on Chrome `157.0.8103.78`, `1,439` SW responses, `0` production errors, all 16 lifecycle checks `true`.
- **Fail-closed macOS Desktop Safari Runner (`tools/qa/milestone11-macos-safari.mjs`):**
  - Automates native macOS `safaridriver` acceptance and 20-minute post-warmup frame-pacing capture on physical Apple hardware; fails closed with exit code `2` on non-macOS hosts.
- **Continuous QA Workflow (`.github/workflows/milestone-gates.yml`):**
  - Runs TypeScript check, asset validation, 14-file (`145`-test) Vitest suite (including `tests/milestone11-release-readiness.test.ts`), production build, offline pack verification, `verify-milestone{5,6,7,9,10,11}.mjs`, and `node --test tools/qa/verify-milestone*.test.mjs`.
- **Pinned REA Certification (`tools/qa/run-milestone11-rea.mjs`, `rea-agents@6.10.1`):**
  - `audit-release-exposure`: `0` exposed findings (`by_status.exposed: 0`).
  - `analyze-javascript-application` + feature traces + `capture-browser-scenario` + passive CDP `inspect-web-page` + `reconcile-javascript-runtime`: **`12/12` runtime scripts matched, `0` unmatched, `0` ambiguous**.
  - Canonical authenticated Evidence bundle `artifacts/milestone11-rea-evidence-bundle.json` (`62,459,260` bytes, SHA-256 `d8dcefd9dbd910731d81b6b46847f4c35578e6a6aa354457b3bb9338295d9893`, `2` records, `0` unknowns, validated by `evidence-import`).

## Explicitly retained external gates (`blocked-external`)

- Native Patch 26.18 Riot client side-by-side captures.
- Physical integrated-GPU laptop/desktop 20-minute post-warmup frame pacing and physical macOS desktop Safari acceptance (`tools/qa/milestone11-macos-safari.mjs`).
- 20 human-input full matches.

## Reproduction commands

```sh
node tools/qa/verify-milestone11.mjs
node --test tools/qa/verify-milestone11.test.mjs
npx vitest run tests/milestone11-release-readiness.test.ts
npm run build && npm run assets:validate && npm run offline:verify
xvfb-run -a node tools/qa/profile-milestone7.mjs --output artifacts/milestone11-performance-profile.json
xvfb-run -a npx playwright test -c tools/qa/milestone11-multibrowser.playwright.config.ts
xvfb-run -a node tools/qa/run-milestone11-rea.mjs
```

See the machine-verifiable [Milestone 11 verification ledger](reference/milestone11-verification.json) and the [100-seed cohort ledger](reference/578c93-public-milestone11-hundred-ledger.json).
