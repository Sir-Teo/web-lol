# Milestone 7 - Reference-calibrated ten-champion full-match release

**Status: in progress, not certified.** Defined November 22, 2026,
following [Milestone 6](MILESTONE-6.md). This is a full product milestone, delivered
through independently reviewable increments, not another roster expansion.

**Outcome:** one human and nine role-aware bots can play a complete, credible
Patch 26.18 Summoner's Rift match with the existing ten champions, independently
measured gameplay and presentation, deterministic recovery, and a certified
static-host/offline release. Quality takes priority over additional content.

## Baseline and research

The retained Milestone 6 ledger reports schema `185`, ruleset `e5e3cc7f...`,
ten distinct champions, and 158 coverage entries: 49 `verified-behavior`,
34 `verified-data`, 75 `approximation`, zero `unimplemented`. These are historical
receipts, not results rerun for this plan and not a percentage of native fidelity.

REA `rea-agents@6.10.1` was actually run locally for this definition, with networking
disabled and eight exact, read-only staged repository files. It parsed all eight
sources without parse failures. The retained parent Evidence is
`ev_f5e345cecfa1fd84eae9923afe815f3330d5503a8a91eb423f218c604da3c1e6`;
the input and bundle identities, source hashes, findings, and limitations are in
[the planning research receipt](reference/milestone7-planning-research.json).

REA recovered static source relationships, not a running game or native Riot
behavior. Its semantic graph retains 3,967 unknowns. The following conclusions
combine those source anchors with direct inspection of the named code and
historical ledgers; none is a new runtime certification.

| Finding                                                                                  | Evidence and consequence                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The newest reported ten-champion simulation covers 960 seconds, not a natural full match | `milestone6-verification.json` records 57,600 ticks. `simulate-rift.mjs` performs a final snapshot round trip, not periodic saved-future comparisons. Require a current-roster full-match cohort.                                                                                   |
| The old cohort metadata is not a reliable ten-champion composition contract              | `tools/qa/lib/cohort-profile.ts` still describes a mirrored older roster; `verify-match-cohort.mjs` only checks explicit composition for its development-roster profile. Validate actual champions and roles at every checkpoint.                                                   |
| Browser acceptance largely proves setup and UI wiring                                    | The Milestone 6 spec opens the ledger/shop, starts Ezreal, and directly mutates resources/quest state. Add normal-input combat, objective, recovery, and complete-match scenarios.                                                                                                  |
| The report and executable objective rules disagree                                       | The Milestone 6 report says grubs at 5:00 and Herald at 14:00 with a summoned siege unit. Current content/tests use 6:00 and 15:00, and a next-turret-hit charge substitute. Reconcile chronology and frozen sources before changing rules; do not assume the old prose is correct. |
| Content presence does not establish independent reference agreement                      | Coverage labels are generated partly by champion cohort/item metadata. Some approximations have no deviation note; older champions are broadly called behavior-verified despite open native calibration. Split implementation evidence from reference and presentation evidence.    |
| Historical verifiers intentionally permit absent local artifacts                         | `verify-milestone6.mjs` can return `packVerified: false` and skip missing captures/bundles. Preserve that historical mode, but make the new release verifier require its complete evidence set.                                                                                     |

### First implementation checkpoint: restore integrity

The public seed-1 audit reproduced three save rejections: empowered Recall at
tick 14,400, then an item-tenacity Charm history and an Apprehend slow at tick
61,200. Schema 186 records the accepted Recall deadline, validates sampled
Charm clocks without assuming Garen's Courage, and persists distinct identities
for Darius W/E, Morgana R, and Hextech Soul slows. Targeted regressions exercise
restore and saved futures without changing the match clock or forcing victory.
Compatibility follows the existing fail-closed schema/ruleset policy.

The schema-186 persistence candidate at ruleset `a658b0f1…` passed the build,
85 targeted tests, and byte verification of all 1,519 files in pack
`c500603f…`. Network-disabled REA `rea-agents@6.10.1` inspected `index.html`,
the boot and rules chunks, and `offline-worker.js`, with zero parse failures.
This was a selected-source static pass, not a complete runtime trace.
The distribution root is `6bab02a268be3b9a65fea5dc40ae559c737dc7d0703b0944e1bc63f7bd833abc`;
the parent Evidence is `ev_9fcba82f19f5d9f8f8d1608dc0f53ef0e3bb27ee6e028ea0f9b7c1bba440ae97`;
the locally retained bundle SHA-256 is
`22f5693a61b7cbbe36ca6815097ea8ca483d6f714e6b4453692bb30b0aaca860`.

Seed 1 then reached the 18-minute diagnostic horizon (64,800 checked ticks)
without an invariant failure. The public-roster verifier checked ten distinct
champions and five roles per team at all 18 round trips, with 17 saved-future
comparisons covering 1,020 ticks. There was no natural victory at the diagnostic
horizon; this result does not count toward the 60-minute release cohort.
The original Chrome production-subpath run timed out at the Navigation control.
The map inspector now submits terrain on camera or overlay changes instead of
redrawing the same settled frame; near-view texture uploads can continue
without a redraw. A Chrome regression checked idle rendering and both
Navigation and Mid lane input. The first nested production run passed those
controls and entered practice, but Chrome's renderer crashed during a
subsequent fixture-query boot. The traced retry on the same build passed
the complete existing subpath script: real Ashe and Lux casts, a 5v5 restart,
ward and Oracle Lens placement/restore, and no out-of-prefix requests or
production errors. Its report is
`artifacts/production-subpath-m7-map-idle-retry.json` (SHA-256
`6bcb3f51411d6c4d0a6f519535bc5321d8ecb0171aa22a569ccb19efedccd494`).
This is the existing Chrome audit, not the Milestone 7 all-roster browser matrix.

The redraw candidate's pack is
`b0cee7cc152255a2521762458518ac0bb9ebcf31a170286fb1352c33a55ca365`
(1,519 files, 581,692,784 bytes), verified byte for byte. Network-isolated
REA inspected six selected production files, including `map.html` and its
entrypoint, with zero parse failures. It left 181 inventoried sources
unselected; this is not runtime certification. Artifact root:
`62bd25ed9df35c9b52840c7b786be9a59f733fa54376a9a068cac86c2329ca50`;
parent Evidence: `ev_e9ac4731c1a635f91b10f4da9d02c37ae4adc924cb670ed8eb0d69095743af64`;
bundle SHA-256: `7e10aef14fd535c18cb82aced4d808039742436b2ff076a8fde7f4407531c721`.

### Full-match sentinel and offline runtime

The public-roster seed 1 rerun with a 60-minute horizon ended in a natural
Nexus victory at tick 94,587 (26:16.45). The independent verifier admitted all
27 round trips with the ten distinct champions and five roles per side,
including the terminal state, and checked 26 saved continuations covering
1,560 ticks. This is one seed, not the 100-seed release gate. The separate
default 100-seed plan was launched at `.cache/match-cohort/m7-public-hundred`
on the same ruleset. Its initial supervisor stopped after accepting 22 natural
victories and no failures. The [frozen recovery tool](MATCH-COHORT-RECOVERY.md)
retained those reports, archived the partial outputs for seeds 20 and 21,
and restarted only pending seeds. This is one frozen plan with an interruption,
not a combination of independently configured runs. The sentinel ledger is
`.cache/match-cohort/m7-sixty-seed-1.ledger.json` (SHA-256
`d344e9f6431cc4698ea6057c6ef30593ae8f5b891230a9f3354350eece1bef1b`).

The resumed cohort then reported its first failure: seed 36 reached a red
victory at tick 96,186 but its terminal save was rejected (`Invalid neutral
order`). Victory idled every unit, including a Gromp that was still leashing
home, and the save contract requires a returning monster to hold its home
move order. Replaying the pinned tick-93,600 checkpoint reproduced the
failure. Victory now preserves that order; the regression in
`tests/terminal-restoration-clocks.test.ts` fails without the fix. The
replay now saves, restores, and continues identically. The change alters the
ruleset (now `2daecf45cc420c7b062fc63c343c530a60450c1501f79fd57fd40256ee333c77`),
so the 38 victories under `a658b0f1…` are retained as evidence but do not
count toward the gate. A fresh 100-seed run was started at
`.cache/match-cohort/m7-public-hundred-r2` (2 jobs, gzip snapshots). It must
finish, and pass `verify-milestone7-cohort.mjs`, before the gate closes.

The Chrome offline audit passed on pack `b0cee7cc…`: verified download,
cancellation/retry, saved-clock offline reload, pack repair, a network-off Lux
5v5 start with real E input, pack removal preserving the save, and the
isolated two-version activation checks. It recorded 1,517 service-worker
responses and no production errors. The receipt is
`artifacts/offline-pack-m7-map-idle-production.json` (SHA-256
`156266efe95f4a21ae42e8022a60771d0aa2dd5d665a737ff200cbf546d45b61`).
This does not exercise all roster abilities offline or count as a complete
human-input match.

The Node QA suite passed all 338 cases. The unfiltered Vitest run recorded
10,110 passes and 34 failed tests, with 37 failed files including suites that
could not load. Missing audit inputs, timeouts, and the historical Lux sampler
digest mismatch were not waived. The pinned open-source particle readers were
restored to the local audit cache; a narrow rerun passed 77 cases covering the
Baron ribbon reader, replay, and ruleset fingerprint. The full unfiltered
suite has not been re-certified.

Native reference captures, human-input full matches, the 100-seed gate, and the
physical-device and full browser matrices remain open. A scoped REA inspection
and byte-exact pack check do not replace these gates.

## Scope and boundaries

Keep Ashe, Lux, Garen, Master Yi, Leona, Ahri, Darius, Vi, Ezreal, and Morgana.
Retain all five roles, Intro/Standard bot bands, practice, editable loadouts,
replays, saves, the static host, and offline operation. No application backend,
network multiplayer, new champions, new skins, patch upgrade, or engine rewrite.

Freeze standard PC Summoner's Rift 26.18, its exact client build, source revision,
and hotfix cutoff. Missing build/cutoff information remains unknown; today's
patch data must not silently replace the frozen target.

Use only lawfully obtained artifacts and authorized captures. Public availability
of Riot assets is not distribution permission. Native inspection stays bounded
and read-only; no game injection, anti-cheat bypass, or unauthorized server access.
Locally authored assets may remain an explicitly labeled fallback, but cannot
satisfy a source/native presentation claim. Missing authorization or usable
reference evidence blocks the corresponding fidelity gate, rather than becoming
a fabricated pass.

The existing 60 Hz local clock and browser-only bot match remain intentional
architecture differences, not defects to hide or reasons to rewrite the engine.

## Delivery increments and dependencies

### 7.0 - Freeze truth and create the discrepancy contract

Start here before gameplay or presentation corrections.

- Reproduce the current build and applicable baseline checks. Inventory missing
  historical inputs, unavailable artifacts, and existing failures separately.
  A scoped pass must not be presented as a full-suite pass.
- Reconcile README, progress, reference UI, actual source, tests, and historical
  reports. Preserve historical receipts and annotate supersession instead of
  rewriting their hashes or claiming old results for new code.
- Audit all 158 existing coverage IDs and every one of the 75 approximations.
  Retain the denominator and IDs; add explicit subcases rather than deleting or
  merging difficult entries to improve counts.
- For each discrepancy record: ID, patch/build, source/capture hash, implementation
  location, measured result/uncertainty, severity, owner, dependencies, acceptance
  scenario, and disposition. Classify implementation verification, independent
  reference verification, and visual/audio calibration separately.
- An approximation needs a concrete player-facing deviation. Source numbers,
  local deterministic tests, and native observations are different evidence
  classes. Correct unjustified statuses even if headline counts decrease.

**Exit:** a frozen release candidate baseline, a complete discrepancy register,
and no unlabeled approximation or unsupported verification claim. Define severity
before fixes: P0 covers corrupt state, crashes, hidden-information leaks, and
invalid victory; P1 covers wrong match-changing rules or misleading combat cues.

Primary interfaces: `src/content/reference-coverage.ts`, its UI consumer,
`docs/REFERENCE-VALIDATION.md`, and versioned reference receipts.

### 7.1 - Establish independent reference and calibration fixtures

Depends on 7.0. Gameplay and presentation implementation may then proceed in
parallel against these same frozen fixtures.

Use the existing [capture packet](REFERENCE-VALIDATION.md#capture-packet) and
CAM-01, MOVE-01, INPUT-01, ATK-01, FOG-01, LANE-01, BASE-01, and MATCH-01 cases.
Capture both team orientations, both bases, lane, river, wall corners, and brush.
Record input timestamps and at least five repeats for each initial timing case.
Retain raw observations separately from normalized rules and implementation choices.

Fit one camera/coordinate transform on training locations and test held-out
locations. Do not tune per screenshot. Initial planning budgets at 1920x1080 are
landmark error p95 <= 3 px, maximum <= 8 px, and visible event timing error <= one
reference frame plus one local tick. Freeze final budgets after repeat captures
establish uncertainty, before tuning; preserve any budget change and its reason.
If reference uncertainty cannot resolve a gate, mark it blocked, not passed.

Build independent behavior matrices for all ten passives and forty active
abilities, including relevant rank/level/resource, attack-speed/haste, cancellation,
target-loss, collision, CC, shield, and item/rune boundaries. Give Darius, Vi,
Ezreal, and Morgana full matrices, not only roster/activation checks. Expected
values must come from pinned independent evidence, not the implementation under test.

**Exit:** reproducible fixtures, registered captures, approved uncertainty/budgets,
and explicit provenance for every claimed reference expectation.

### 7.2 - Close match-changing gameplay and bot discrepancies

Depends on 7.0 and 7.1.

Correct the existing ten kits and cross-system primitives where independent
evidence disagrees. Prioritize charged casts, empowered attacks/resets, on-hit
ordering, shields/CC, execute/reset windows, displacement, and death/target-loss
edges. Reuse shared combat and command-validation mechanisms.

Reconcile all five role quests; purchases, recipes, uniqueness, consumables,
undo and slot expansion; selected rune triggers; ward detection/reveal/expiry;
turret rewards/protection, economy, respawns, and inhibitor progression.
An advertised effect must work, not merely expose the right icon or statistic.

Finish the frozen patch's objective semantics: grub lifecycle/rewards and
Voidmites, Herald pickup/channel/summon/charge and player interaction where
required by the reference, drake selection/respawns, elemental terrain's navigation
and vision consequences, all six Souls, Elder burn/execute, and Baron siege.
Replace current match-changing substitutes rather than rename them as complete.
Determine exact rules from the frozen evidence, not this plan's shorthand.

Bots must contest/scout objectives through team-visible observations, use their
own kits and purchases competently, support the carry, and convert fights into
structures. Difficulty may adjust reaction/aim/decision quality but never hidden
knowledge or gameplay rewards. Retain offscreen simulation and ordinary victory.

**Exit:** all advertised match-changing behavior has independent acceptance
evidence; no open P0/P1 gameplay discrepancy. Intentional non-reference policies
remain explicit, narrowly scoped deviations, not substitutes for required systems.

### 7.3 - Calibrate complete presentation, not isolated emitter counts

Depends on 7.1; final integration also depends on 7.2.

Calibrate terrain/camera first, then silhouettes, feet/facing, animation transitions,
release poses and sockets, materials/lighting, complete VFX, HUD, and audio.
Finish the four locally authored Milestone 6 champions' authorized reference
rig/animation/effect/audio route and audit the six older champions' remaining
native defaults and audiovisual gaps. Include objective and vision assets.

Compare full ability timelines: anticipation, collision geometry, impact, decay,
sound onset, visibility filtering, and cleanup. Damage deadlines stay simulation
owned. Match sound event selection/overlap, not merely decoded sample bytes.
Review a busy 5v5 fight for threat hierarchy, health-bar clarity, and mix priority.

Cover lane, both bases, fog/brush, aiming, shop/loadout, death, objective contest,
busy fight, and result screen at 1280x720, 1920x1080, and 2560x1440. Include pointer,
keyboard, focus, and readable HUD behavior, not just DOM visibility assertions.

**Exit:** registered stills, side-by-side clips, timing/error tables, and reviewed
composites meet the frozen budgets. No P1 presentation discrepancy or unlabeled
placeholder remains. Restored browser pixels alone do not establish native parity.

### 7.4 - Certify complete matches, persistence, and the shipped artifact

Depends on 7.2 and 7.3.

| Gate                         | Required outcome                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current public-roster cohort | At least 100 fixed, recorded seeds at a 60-minute horizon; ten distinct champions and one of each role per team checked in actual snapshots; zero invariant failures; >= 99% natural Nexus victories. At most one horizon must have retained diagnostics proving a genuine strategic stalemate, not deadlock or broken progression. Never force victory or change clock/rewards to pass.           |
| Saved futures and replay     | Minute checkpoint byte equality plus the following 60-tick future throughout the cohort. Add event-boundary saves around pending projectiles, charged casts, CC/shield expiration, objective transitions, terrain changes, and victory. Replays match hashes; incompatible/tampered files fail explicitly.                                                                                         |
| Human-input full matches     | Twenty recorded complete matches: two per selectable champion, spanning all roles and both bot bands. Record farming/trading, shopping, quest progression, objective contests, death/respawn, and base conversion. Retain failures and fix P0/P1 findings; automated human-slot bots are not substitutes for these input traces.                                                                   |
| Browser acceptance           | Chrome, Firefox, and WebKit pass real-input combat/objective/recovery cases for the entire roster. Certify desktop Safari separately on the named macOS device; Linux WebKit is not Safari certification. Test both camera orientations and the resolution matrix.                                                                                                                                 |
| Production and offline       | Build and run beneath a nested static-host path with no development hooks, failed/out-of-prefix requests, or unrequested champion preloads. Verify every pack byte; network-off reload and first use of all forty abilities/ten passives and objective/vision assets must work. Exercise repair, quota failure, eviction/recovery, cancellation, version handoff, and incompatible-save rejection. |
| Lifecycle                    | Context loss offers intact-world recovery/export and restores cleanly. Ten sequential match restarts show no accumulating listeners, WebGL contexts, scene-depth targets, or retained sessions; hidden-tab return does not advance paused match time or retain held keys.                                                                                                                          |
| Mandatory release evidence   | A new Milestone 7 verifier requires every declared source digest, pack, cohort, browser/capture/performance receipt, and REA bundle. Missing artifacts, missing cases, stale identities, and incomplete cohorts fail certification; historical verifiers remain historical.                                                                                                                        |

The existing cohort runner/verifier and browser/offline helpers are starting
points, not unchanged commands that already prove these gates. Fix misleading
fixture labels and composition contracts before reusing their outputs.

After the cohort finishes, run
`node tools/qa/verify-milestone7-cohort.mjs .cache/match-cohort/m7-public-hundred`.
It first runs the independent verifier against the current ruleset with public
roster checks, then enforces the natural-victory threshold and one-horizon cap.
One unfinished match entails a nonzero exit pending review of retained
stalemate evidence; the invariant pass alone cannot close this gate. This
command evaluates the cohort only, not the full release.

### 7.5 - Certify performance and close the release

Prepare profiling fixtures after 7.0; final certification depends on 7.4.

Name a physical integrated-GPU laptop and desktop, including CPU/GPU/RAM,
OS, driver, browser version, power mode, and viewport before optimization.
Use the same frozen ten-champion late-match fixture, with active objectives,
minions, vision, and complete effects. Retain the source-quality baseline.

At 1920x1080, initial release budgets are simulation p95 <= 4 ms/tick,
animation-frame timestamp interval p95 <= 16.7 ms and p99 <= 33.4 ms,
p95 draw calls < 250, and post-GC production JS heap <= 280 MiB where measurable.
These are proposed ten-champion gates, not inherited six-champion results.
Measure at least 20 minutes after warmup on each named device/browser combination.
Report CPU/render/GPU costs separately; unsupported GPU timing remains unknown.
Collect physical presentation/missed-frame evidence rather than labeling callback
delivery or a Node mean as 60 FPS or a p95 result. Software-rendered CI verifies
functionality, not a hardware performance claim.

Record cold boot/decode/shader costs, every first ability use, texture allocation,
peak memory, and restart growth. Freeze any necessary budget revision before the
final comparison, with its measurements and tradeoff; do not quietly relax a
failed gate. Profile before introducing workers, batching, or asset compression,
and prove visual/behavioral equivalence for any optimization.

Run pinned REA on the final built static artifact, trace champion/objective,
save/replay and offline boundaries, and reconcile the static graph with controlled
browser scenarios. Export and authenticate its Evidence bundle. Track unresolved
static relationships separately from product defects; REA does not certify
native visuals, server behavior, performance, or licensing.

**Exit:** the release ledger pins the exact source revision, schema/ruleset, pack,
reference/capture set, cohort, browser/device results, and REA identities. Every
mandatory gate passes with no unresolved P0/P1 defect. Remaining intentional
deviations are visible in the game and documented with evidence and rationale.

## Execution and compatibility policy

Use small commits ordered by the dependencies above. Begin with truth/fixtures,
then shared mechanics, complete kits/objectives, integrated presentation, and
certification. No delivery date is promised before reference availability and
measured correction throughput are known.

Reuse existing npm scripts with appropriate selectors. Gameplay/content changes
must deliberately update the ruleset and, when required by saved state, schema;
presentation-only work should preserve gameplay compatibility where possible.
Never activate incompatible code/content over a saved match or silently migrate
it. Preserve old receipts and use fresh namespaced capture/cohort paths, especially
because Milestone 6 browser tests write fixed filenames pinned by its verifier.

Candidate checks include targeted Vitest cases, `npm run assets:validate`,
`npm run test:qa`, the cohort runner/verifier, browser configs,
`npm run test:production`, and `npm run offline:verify`. The final full-suite
receipt must expose pre-existing failures; they cannot be masked by scoped results.
New acceptance fixtures and the mandatory Milestone 7 release verifier are
deliverables of this milestone, not files claimed to exist already.

**Completion rule:** feature presence, an audited bundle, a green smoke test, or
one visually convincing fight cannot close this milestone. The independently
measured, complete ten-champion match and its reproducible release evidence can.
