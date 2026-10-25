# Ahri development player practice

Use `/?scene=fixture&champion=ahri` with the development server. This adds a
human-controlled Ahri to the separate practice fixture, using her existing
[Q](AHRI-Q.md), [W](AHRI-W.md), [E](AHRI-E.md), [R](AHRI-R.md) and
[Essence Theft](AHRI-PASSIVE.md) controllers. Ordinary production selection remains
Ashe/Lux; Ahri's Rift roster, role AI, native presentation and full kit delivery
remain unfinished.

## Player controls and feedback

- Spend skill points with the upgrade buttons or Ctrl plus the spell key. All four spells
  begin unlearned; R retains the ordinary level-six/eleven/sixteen learning gates.
- Hold Q or E, aim on the battlefield, then release. Their guides show the local
  simulated full range (1000) and collision radius (Q 100, E 60). A nearby point
  still chooses direction for these projected missiles. Right-click/Escape keeps
  the existing cancellation behavior. They do not inherit Focus or Hawkshot input.
- W activates immediately. Its own icon, name, mana/cooldown and movement/fire
  description replace the ordinary Volley controls.
- Hold R and release toward a point. The guide shows the corrected landing
  footprint, using the same bounded endpoint policy as the controller. Its guide
  uses the simulated 500-unit maximum, separately from the retained root display
  value 450. It does not inherit Crystal Arrow's long corridor.
- R displays stored casts, free recast cost, the active recast window and its
  one-second lockout. Champion Essence updates that feedback after consumption.
  The Essence counter is shown in the title row and describes current-level/AP
  healing. Friendly world-space counter feedback remains available.
- Portrait/title, spell cards, rank previews, descriptions and controls help use
  Ahri data. Mana is visible; Ashe Focus pips are absent. Charm descriptions retain
  1.35/1.65-second precision rather than rounding those ranks to one decimal.

The scene reuses the existing imported rig/portrait/spell icons. The model remains
an unlit development preview with the previously documented material, hair/tail,
animation-graph and native effect/audio gaps. No new public asset is imported.
Guides are local gameplay previews, not recovered native targeter geometry.

## Trusted scene and saved-file boundary

The development URL supplies `Battlefield.developmentAhri` only for the practice
fixture. The constructor rejects an Ahri player without that trusted context or
on Rift. The snapshot decoder applies the same context and practice-mode checks.
The context flag is never serialized; adding a permission field to a file cannot
manufacture it. Ahri NPC fixtures retain their existing boundary.

The scene uses the private `development-ahri-player-fixture` save key. Saving,
reloading and restarting do not overwrite the ordinary `practice-fixture` save.
Restart preserves Ahri and the chosen summoners while resetting practice state.
The pause menu keeps the existing fixture controls rather than adding a public
champion option.

Match files still preview before loading. This player scene additionally requires
an Ahri file before any write. Its own exact checkpoint can be imported; another
champion is rejected without changing current/saved state. An Ahri player file
also rejects in the ordinary fixture where the trusted context is absent.
Schema 137 records this compatibility change under the existing same-build policy.
No migration from earlier schemas is implied.

## Verification and retained failures

The first six-case player run failed five cases and passed the file-boundary case.
The fixture had paused before trying to learn/cast, so the intended pause guards
rejected those inputs. It also attempted a top-bar click behind an already open
pause menu. The corrected fixture resumes for real input, freezes accepted state
for exact checks and explicitly waits for reload navigation. All six cases then
passed with their assertions retained. Original failures/traces and prior fixture
bytes remain in the evidence.

A separate regression first demonstrated the over-rounded Charm duration label.
Its failing test and prior tooltip helper are retained; the corrected helper passes
rank-two/rank-four literal duration checks, and the browser checks those actual
upgrade tooltips.

The final full check passes 2,182 tests across 338 files, TypeScript and three Node
QA checks. The 114-case focused Ahri run includes nine player cases for trusted
construction/restore, public selection denial, input policies, guide geometry,
ranked descriptions/resources, imports, edited permissions and 300-tick future
simulation. Existing NPC spell/passive behavior remains covered.

The final Chrome run passes all 48 cases without skips, failures or retries. Its
six player cases cover real controls and upgraded Charm tooltips, Essence/R HUD
feedback, two actual player Save/reloads with exact 300-tick futures, separate
ordinary/private saves, restart and rejected/accepted file imports. Three player
screenshots were reviewed at 1440×900. The final proof is the v2 browser run; the
earlier green v1 run predates the tooltip correction and remains historical.

Production passes 32 recordings, including rejection of the exact player fixture
URL, no development hook and no unrequested Ahri preload. Offline reload passes
with 963 service-worker responses and no production errors. The pack has
1,065 files / 520,057,332 bytes. Pack:
`28d0e90bcadcb411642e2fbcf0226b3c5403630589f10ca8a57ada94bdc76eba`.
Ruleset: `5eb9fc897a3193c5a5d575afca7dc397dc987bbe8d8a47df35fadea1f4d0e29c`.

All 1,015 prior public files remain byte-identical. Frozen source/build/evidence
closure is [player-verification.json](reference/ahri/player-verification.json),
checked with `node tools/qa/verify-ahri-player.mjs` or `--historical` after later
changes. Development player integration, private save/restart and import boundaries
are verified. Production roster expansion, full Ahri kit, native behavior/presentation,
performance and full-project completion flags remain false.
