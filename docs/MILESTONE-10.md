# Milestone 10 · Player controls, accessibility, original-lineup balance calibration, and continuous QA hardening

**Status: Completed on schema 189 (ruleset `c1e93950…`, offline pack `c5da4523…`); external hardware, native Riot client, 100-seed, and human-playtest gates remain explicitly tracked as `blocked-external`.**

Milestone 10 delivers full player-configurable controls and accessibility customization (`PlayerSettings`), calibrates the 5-champion **Original lineup** (`Brannic`, `Taviq`, `Irielle`, `Vess`, `Oona Vale`) to competitive full-match parity against the calibrated public roster while preserving bit-exact public-roster determinism, adds automated GitHub Actions milestone verification gates (`.github/workflows/milestone-gates.yml`), and re-certifies the production build (`dist/`) under nested subpath delivery, offline pack lifecycle audits, Playwright E2E acceptance, runtime profiling, and pinned `morluto/rea` (`rea-agents@6.10.1`) static + runtime reconciliation.

## Highlights

### 1. Configurable player controls, interactive key rebinding & accessibility (`src/storage/player-settings.ts`, `src/input/input.ts`, `src/ui/hud.ts`, `src/style.css`, `src/main.ts`)

- **Persisted browser settings (`rift.player-settings.v1`):** Pure client-side preferences validated and sanitized on load without altering simulation determinism or ruleset hashes.
- **Cast & combat input ergonomics:**
  - **Cast mode:** `Quick cast with indicator` (default), `Quick cast` (instant on press), and `Normal cast` (press to aim, left-click to fire, right-click/Escape to cancel).
  - **Attack-move mode:** `Click` (A + left-click) or `Quick` (instant attack-move toward cursor on A press).
  - **Target Champions Only mode:** `Hold` (default) or `Toggle` with live HUD indicator.
  - **Self-cast modifier (`Alt + spell`):** Configurable on/off for self-targeted shields/heals/buffs.
- **Interactive 20-action key rebinding:** Rebind all 20 gameplay actions (`Q/W/E/R`, `D/F`, trinket `4`, item slots `1–3/5–8`, attack-move, stop, recall, shop, camera lock, recenter, target-champions-only) directly from **Pause → Controls & accessibility** with automatic conflict swapping, reserved-key protection (`Escape`, `Tab`, `F1–F5`, `Shift`, `Control`, `Alt`, `Enter`), live HUD keycap updates, and one-click **Reset defaults**.
- **Accessibility & visual clarity:**
  - **Color-vision palettes:** `Default`, `Deuteranopia`, `Protanopia`, `Tritanopia`, and `High contrast`, applied consistently across HUD CSS variables and 3D health bars / minimap / range indicators (`src/render/view.ts`).
  - **HUD scale** (`85%`, `100%`, `115%`, `125%`) and **Text scale** (`90%`, `100%`, `115%`, `130%`).
  - **Reduced motion** toggle (auto-seeded from `prefers-reduced-motion: reduce`, overridable in settings).
- **Verified by:** `tests/milestone10-controls-accessibility.test.ts` (`6/6` unit tests) and `e2e/milestone10-controls-and-accessibility.spec.ts` (full browser persistence, rebinding, cast modes, palettes, scaling, and reset check).

### 2. Original-lineup 5v5 balance calibration (`src/content/original-lineup.ts`, `src/simulation/original-champions.ts`)

Milestone 9's post-Milestone-7 original-lineup baseline finished `4/4` Red victories (`25:57–26:31`) because the five original champions lacked rank scaling parity and hybrid AD scaling on Brannic/Taviq ultimates against Milestone 7's calibrated Darius/Vi/Lux/Ezreal/Morgana roster.

- **Calibration changes:**
  - Added per-rank spell scaling (`originalSpellAmount`) across all five original kits (`Brannic`, `Taviq`, `Irielle`, `Vess`, `Oona Vale`) and tuned per-level stat progression, cooldowns, and damage/shield curves.
  - Added scoped hybrid AD scaling (`source.damage * 0.55`) exclusively for `brannic` and `taviq` magic ultimates without buffing AP mage `irielle`'s early laning.
  - Bumped `SNAPSHOT_VERSION` to **189** (`src/simulation/snapshot.ts`) with backwards-compatible schema `187` & `188` save migration.
- **Calibrated 8-seed 60-minute cohort (`c1e93950…`, seeds `1–8`):**

| Seed | Winner | Final tick | Match clock | Round-trips | Future checks |
| ---- | ------ | ---------: | ----------: | ----------: | ------------: |
| 1    | Blue   |    144,276 |       40:04 |          41 |            40 |
| 2    | Red    |    145,534 |       40:25 |          41 |            40 |
| 3    | Red    |    139,619 |       38:46 |          39 |            38 |
| 4    | Red    |    149,744 |       41:35 |          42 |            41 |
| 5    | Blue   |    112,358 |       31:12 |          32 |            31 |
| 6    | Red    |    149,434 |       41:30 |          42 |            41 |
| 7    | Red    |    141,332 |       39:15 |          40 |            39 |
| 8    | Blue   |    136,636 |       37:57 |          38 |            37 |
| **Total** | **8/8 victories (Blue 3 – Red 5, 37.5% Blue)** | **1,118,933** | **p50 39:15** | **315** | **307 (18,420 ticks)** |

### 3. Bit-exact public 10-champion roster parity (6 baseline seeds)

Public-roster behavior is completely untouched by the original-lineup calibration and player-settings layer. All six Milestone 7/9 baseline seeds finish on the exact same tick on schema 189 (`c1e93950…`):

| Seed  | Winner | Final tick | Match clock | Round-trips | Future checks | Parity vs M7/M9 |
| ----- | ------ | ---------: | ----------: | ----------: | ------------: | --------------- |
| 26018 | Red    |    129,896 |       36:04 |          37 |            36 | Bit-exact       |
| 719   | Blue   |    151,378 |       42:02 |          43 |            42 | Bit-exact       |
| 1     | Red    |    106,852 |       29:40 |          30 |            29 | Bit-exact       |
| 927   | Blue   |    135,885 |       37:44 |          38 |            37 | Bit-exact       |
| 2     | Red    |    121,660 |       33:47 |          34 |            33 | Bit-exact       |
| 3     | Red    |    112,171 |       31:09 |          32 |            31 | Bit-exact       |
| **Total** | **6/6 victories** | **757,842** | **p50 33:47** | **214** | **208 (12,480 ticks)** | **0 drift, 0 failures** |

### 4. Performance budgets, production delivery, CI gates & REA 6.10.1 certification

- **Runtime Performance & Heap Budgets (`artifacts/milestone10-performance-profile.json`):**
  - Minute-20 10-champion simulation p95: **`1.3754 ms/tick`** (`mean 0.8839 ms/tick`, budget `≤ 4.0 ms`).
  - Production 5v5 post-GC used JS heap (`Chrome/157.0.8103.78`, `1920×1080`): **`197.11 MiB`** (budget `≤ 280 MiB`).
  - Draw calls p95: **`72`** (budget `≤ 250`), `77` textures, `100` buffers, `0` page errors, `developmentHookPresent: false`.
  - Cold boot: `7,959 ms`; full 5v5 start: `29,917 ms`.
- **Asset & Offline Pack Integrity (`npm run assets:validate`, `npm run offline:verify`):** `0` errors, `0` warnings across all GLBs and map assets (`645,491` triangles, `278` hashed resources); offline pack `c5da452322221ebfcbec36efa42da77b9271cc271a721bd4414ac32fb8667fff` (`1,554` files, `582,853,215` bytes, worker policy `41e26572…`).
- **Nested Subpath Audit (`tools/qa/production-subpath.mjs milestone10-subpath`):** `result: "passed"` under `/nested/rift/`, `recordings: 313`, `publicChampionChoices: 10`, `developmentHook: false`, `0` unrequested preloads.
- **Full Offline Pack Lifecycle (`tools/qa/offline-pack.mjs milestone10-offline`):** `result: "passed"` on Chrome `157.0.8103.78`, `1,440` service-worker responses, `0` production errors, all 16 lifecycle checks `true`.
- **Browser Acceptance (`e2e/milestone10-controls-and-accessibility.spec.ts` + `e2e/milestone7-presentation-and-acceptance.spec.ts`):** `3/3` Chrome E2E specs passed (controls/cast modes/rebinding/accessibility persistence, multi-resolution HUD + Reference modal + Rift Herald summon, 10 sequential restarts without leaks, and WebGL context-loss recovery). *(Playwright Firefox and WebKit executables are not installed on this container image; schema 187 Firefox 155 and WebKit 26.6 receipts remain retained in `milestone7-verification.json` and `milestone8-verification.json`.)*
- **Continuous QA Workflow (`.github/workflows/milestone-gates.yml`):** Automated GitHub Actions workflow running TypeScript check, asset validation, production build, offline pack verification, `verify-milestone{5,6,7,9,10}.mjs`, Node QA unit tests (`npm run test:qa`), and the 13-file (`141`-test) clean Vitest gate.
- **Pinned REA Certification (`tools/qa/run-milestone10-rea.mjs`, `rea-agents@6.10.1`):**
  - `audit-release-exposure`: `0` exposed findings (`by_status.exposed: 0`).
  - `analyze-javascript-application` + feature traces + `capture-browser-scenario` + passive CDP `inspect-web-page` + `reconcile-javascript-runtime`: **`12/12` runtime scripts matched, `0` unmatched, `0` ambiguous**.
  - Canonical authenticated Evidence bundle `artifacts/milestone10-rea-evidence-bundle.json` (`62,485,773` bytes, SHA-256 `5d6fd1d09cb5d08057bcb65d158424666ea3fd5143b753d42b0030a190ef98f3`, `2` records, `0` unknowns, validated by `evidence-import`).

## Explicitly retained external gates (`blocked-external`)

- Native Patch 26.18 Riot client side-by-side captures.
- Physical integrated-GPU laptop/desktop 20-minute post-warmup frame pacing and macOS desktop Safari acceptance.
- Full 100-seed 60-minute scale cohort and 20 human-input full matches.

## Reproduction commands

```sh
node tools/qa/verify-milestone10.mjs
node --test tools/qa/verify-milestone10.test.mjs
npx vitest run tests/milestone10-controls-accessibility.test.ts tests/original-lineup.test.ts
npm run build && npm run assets:validate && npm run offline:verify
xvfb-run -a node tools/qa/profile-milestone7.mjs --output artifacts/milestone10-performance-profile.json
xvfb-run -a node tools/qa/run-milestone10-rea.mjs
```

See the machine-verifiable [Milestone 10 verification ledger](reference/milestone10-verification.json).
