# Six human choices in the combined roster trial

Open `/?scene=roster-rift`, then **New match**. The private chooser offers Ashe,
Lux, Garen, Master Yi, Leona and Ahri. Garen takes top, Yi jungle, Ahri/Lux mid,
Ashe carry and Leona support. Your champion replaces that allied position;
the other nine champions keep their existing bot policies.

Each 5v5 choice starts with ordinary gold, an empty inventory, one unspent skill
point and no learned spells. Human movement, learning, casting and purchasing
remain manual. NPC junglers still pay for their companions. For human Yi,
select Smite in D or F and buy your own companion at the fountain; the menu
preserves selected summoners instead of silently replacing them.

The chooser and match creation share one exhaustive human-role mapping.
Existing trusted champion admissions still apply. The public selection helper,
ordinary menus and separate champion trials retain Ashe/Lux. Production ignores
the private URL and checks the two public choices directly.

Practice in this Rift host offers Ashe/Lux. The other four choices show an
unavailable practice button and explanation while keeping 5v5 available. The
start callback also rejects an unsupported practice request before replacing
or writing a match. Existing dedicated development practice scenes remain
available. The disabled practice state uses an unavailable cursor.

The selected champion remains selected when reopening the private menu. Real
Save/reload preserves their manual state and own HUD, and restart reproduces
their initial selected match instead of falling back to Ashe. The private slot
remains `development-roster-rift`; no schema or saved field is added.

All 41 focused role/admission cases pass. The four-case browser batch passes
without retries: six actual private starts, six Save/reloads and six exact
restarts; public/separate-trial boundaries and actual Lux practice; the existing
public keyboard/cast/restore flow; and the existing combined-roster natural
Alpha, private saves and exact future. All six humans retain ten champions,
nine bots, their expected roles, manual unspent ranks and no free companion.
Garen shows his own resource panel, while the other five show mana.

The private menu was inspected at 1440×900 and 1024×720. Its existing scrolling
dialog keeps all six choices without horizontal overflow. The minor final
cursor and Yi preparation note are covered by the final boundary capture.

The broad run passes **3,528/3,534 cases across 413 files**, retaining the same
six independently reproduced baseline failures. TypeScript, all 29 Node QA
cases and the build pass. Schema stays 163; rules fingerprint
`033bd826b7f5899449adbec1cbb02ff826f636cf3b75c758f4effe4f7c5a02be` matches
pack `6ae6d2082737111fc8f19c468b88affa58cf9fa5eab6c4b31a135b64826f1b50`,
1,202 files / 538,106,646 bytes. Public assets, spell controllers and saved
fields are unchanged. The preceding full-length simulation and offline evidence
retain their own fingerprints; neither is newly certified for this chooser.

Nested production passes all 32 recordings, the exact private URL rejection,
zero unsolicited development champion preloads, and a real menu assertion of
exactly Ashe/Lux. The [verification record](reference/roster-player-selection-verification.json)
pins sources, all six manual player records, final layouts and delivery checks.

```sh
npm run dev
# Open /?scene=roster-rift
npx vitest run tests/roster-rift.test.ts tests/lane-match.test.ts tests/masteryi-bot-rift.test.ts tests/ahri-bot-rift.test.ts tests/leona-rift-trial.test.ts tests/garen-rift-trial.test.ts --maxWorkers=1
npx playwright test e2e/roster-player-selection.spec.ts e2e/roster-rift.spec.ts e2e/match-champion-choice.spec.ts
```

## Internal roster playtest build

```sh
npm run build -- --mode roster-playtest
python3 -m http.server --bind 127.0.0.1 --directory dist-roster-playtest 4174
```

Open `http://127.0.0.1:4174/`. The build starts a normal 5v5 with Ashe in the
carry slot. **Escape → New match** offers all six champions in the same roles
as the development trial. Ashe and Lux are also available for practice.
The HUD identifies this build as **Roster playtest**. It uses its own manual
save and recovery slot, including for practice, and does not expose
development fixtures or test hooks.

The internal 5v5 also runs the live Baron prototype described in
[Baron encounters](BARON-ENCOUNTER.md#rift-playtest). This increments the
shared save schema to 183. Earlier checkpoints are tied to the old ruleset
and cannot be resumed on the new build, including in public modes where live
Baron remains disabled.

The private build writes to `dist-roster-playtest/` with its own offline pack.
It is not a Pages artifact. Serve the original `.bin.gz` bodies as files, not
with `Content-Encoding: gzip`; Vite preview uses that header, so the browser
decodes the files before the offline pack can verify their original bytes.
For internal browser testing beyond localhost, use a private HTTPS origin
separate from the public game. Selecting a Vite mode does not provide access
control. Do not redistribute reference assets without the required permission.

To check offline continuation, save a match through the pause menu, download
the complete pack under **Offline files**, and reload with the network disabled.
The restored match should show the same clock and champion and remain paused.
With the build in place and the preview server stopped, audit the pack and
exercise the same flow in installed Chrome:

```sh
node tools/qa/verify-current-pack.mjs dist-roster-playtest
npx playwright test --config tools/qa/roster-playtest.playwright.config.ts
```

For human playtest acceptance, complete one spawn-to-Nexus match from each of
the five roles, exercising both mid choices across runs if possible. Capture
the build/pack identity, champion, role, side, result and match duration. Note
any input, bot, combat-readability or progression issue with the match clock
and an exported checkpoint when available. Across the games, join an allied
Baron attempt, decline one, and disrupt an enemy attempt. Check that the bots
resume lane play or defend after losing vision or the fight, and follow an
empowered wave after a successful clear.

The headless check uses the normal bot policy in the player's slot, not human
input, and records natural victories, Baron clears, empowered siege hits, and
an exact terminal save for each role. Run it from the repository root:

```sh
node --experimental-strip-types --input-type=module -e '
import { build } from "vite";
import { rulesetFingerprint } from "./tools/ruleset-fingerprint.ts";
await build({
  configFile: false, publicDir: false,
  define: { __SIMULATION_HASH__: JSON.stringify(rulesetFingerprint()) },
  ssr: { noExternal: true },
  build: { ssr: "tools/qa/baron-playtest.ts", outDir: ".cache/baron-playtest-runner" }
});'
mkdir -p artifacts
results=$(mktemp -d artifacts/baron-playtest-XXXXXX)
for champion in garen masteryi lux ahri ashe leona; do
  node .cache/baron-playtest-runner/baron-playtest.js "$champion" 1 --output "$results/$champion"
done
```

A natural Nexus finish without an objective attempt is evidence for match
completion, not evidence that the bots can convert Baron into a siege.
`tests/rift-baron.test.ts` separately stages a Smite clear and verifies that a
minion's ordinary attack after restore deals 50% more damage to a tower.

On schema 183, ruleset `cc055c26318cf167c1b9a2e4a96cfb3cfd7f3d87b9b1be7e331a91e051a290d3`
(offline pack `73c01993a72a8e29eec258eaf9e0cdae9af2103eba37d43edb0027b14d638d35`,
1,432 files / 581,181,080 bytes), all six seed-1 matches across the five roles
produced valid Nexus finishes, active Baron rallies, and exact clear/terminal
restores:

| Player slot | Champion | Winning side | Match clock | Rally / attack (s) | Baron clears | Empowered structure hits |
|---|---|---|---|---|---|---|
| Top | Garen | Red | 41:47 | 37 / 33 | Blue @ 34:20 | 0 |
| Jungle | Master Yi | Red | 28:55 | 11 / 33 | Red @ 21:54 | 84 |
| Mid | Lux | Blue | 40:09 | 45 / 12 | — | 0 |
| Mid | Ahri | Red | 31:45 | 37 / 32 | — | 0 |
| Carry | Ashe | Blue | 33:01 | 34 / 43 | Blue @ 25:28 | 270 |
| Support | Leona | Blue | 44:50 | 49 / 0 | — | 0 |

For the [combat performance gate](DESIGN.md#15-provisional-performance-budgets),
record the physical GPU, driver, browser and quality settings, and keep the raw
frame/callback percentiles. Start the development server and use a
`contest.match.json` captured by the runner, or export a checkpoint during a
human pit fight on the same ruleset:

```sh
npm run dev # run in another terminal
node tools/qa/benchmark-rift.mjs http://127.0.0.1:5173 \
  path/to/contest.match.json artifacts/baron-pit-cadence \
  --roster-baron --headed --gpu --samples=600 --warmup=15
```

The report separates busy-pit frame intervals from the whole window. Check
that Chrome reports the intended physical GPU, and collect at least 100
busy-pit samples before interpreting a p99 (repeat or use a longer contest if
necessary). Empty-pit frames and software rendering do not qualify. This pit
profile supplements the full stress fixture in the design budget; it does not
replace it.

Measured on Mac mini (`Mac18,5`, Apple M6, 16 GiB RAM, macOS, Chrome
`157.0.8103.79`, `ANGLE (Apple, ANGLE Metal Renderer: Apple M6, Unspecified Version)`,
`1920×1080` DPR 1) on ruleset `cc055c26…` with triple-buffered
`ParticleSurfaceBatcher`, off-screen/shared soft-particle depth passes,
pruned sword-instance scene traversal, and cached pointer hit-testing:

- **Ashe seed-3 contest (`tick 125820`, up to 5 visible champions, 132 busy-pit samples):**
  busy-pit frame median `16.7 ms`, p95 `33.3 ms`, p99 `33.4 ms` (down from
  baseline `50.0 / 200.1 ms`); 600-frame window median `16.7 ms`, p95
  `17.7 ms`, p99 `33.4 ms`; GPU render median `1.33 ms`, p95 `3.10 ms`, p99
  `4.80 ms` (down from `2.35 / 4.82 / 5.54 ms`); CPU `renderCalls` median
  `4.7 ms`, p95 `17.2 ms`, p99 `25.3 ms` (down from `72.2 ms`); simulation step
  median `0.90 ms`, p95 `1.70 ms`; draw calls median `179`, p95 `220`, p99
  `227` (down from `267 / 509 / 550`, keeping even p99 below the `< 250` guide).
- **Ashe seed-5 contest (`tick 114480`, up to 4 visible champions, 158 busy-pit samples):**
  busy-pit frame median `16.7 ms`, p95 `17.7 ms`, p99 `33.3 ms` (down from
  baseline `31.4 / 67.6 ms`); 600-frame window median `16.7 ms`, p95 `17.7 ms`,
  p99 `17.8 ms` (down from `33.3 ms`); GPU render median `1.97 ms`, p95
  `6.60 ms`, p99 `8.25 ms`; CPU `renderCalls` median `5.6 ms`, p95 `15.2 ms`,
  p99 `20.0 ms`; simulation step median `0.80 ms`, p95 `1.80 ms`; draw calls
  median `156`, p95 `270`, p99 `284` (down 66% from `254 / 784 / 834`).

Simulation (`p95 <= 1.80 ms`), GPU execution (`p99 <= 8.25 ms`), and Seed-5
600-frame p99 (`17.8 ms`) stay at 60 Hz, with `elementFromPoint` reflows cut to
`0.0 ms` and `SwordParticleInstances.prepare` cut by 85% (`358 ms -> 54 ms`).
