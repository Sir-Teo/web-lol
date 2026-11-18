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
and an exported checkpoint when available. Run the existing
[combat performance gate](DESIGN.md#15-provisional-performance-budgets) on a
named integrated-GPU laptop; a headless browser smoke is not that measurement.
