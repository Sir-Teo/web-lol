# Orb of Deception development controller

Ahri's Q can now be learned and cast by the development NPC at
`/?scene=fixture&npc=ahri`. Ashe remains the human champion. Q has its own spell
metadata, retained icon, paid cast, source `spell1` pose, two-leg flight and strict
continuation. This document retains the initial schema-132 checkpoint, when
W/E/R and passive were unfinished. The later [W controller](AHRI-W.md) advances
to schema 133. Ahri player controls, the remaining kit, role AI and the ordinary
roster remain unfinished. These are explicit local simulation policies; they
do not establish native execution or rendering.

## Source and intended behavior

The [complete source package](AHRI.md) retains the 30,475-byte BIN and all 64
records from build 16.18.8175716. The independent Q audit reparses that entire
closure and checks six input identities, normally and with Python optimization.
Its findings are retained at
`.cache/ahri-q-contract-static-review-v1-20261025/findings.json`, SHA-256
`86db02fe1935324810aef704fe0cec4961434741988b0da5d7701ccc5bc4b6c3`.

The versioned client description explicitly describes magic damage outward and
true damage on return. Its tooltip uses the same `totaldamage` placeholder for
both legs. This supports the intended two-leg payload; it is not executable
server-callback evidence. The root calculation authors damage 35/60/85/110/135
plus a coefficient of 0.5. The adapter interprets that stat coefficient as AP and
uses the root calculation on each leg. The different legacy child effect arrays
and coefficients 0.4/0.6 remain unchanged in the reference; they are not selected
as current damage.

The root authors `mCastTime` and `spellCastTime` of 0.25 seconds, a winding
cancellation guard, animator-framerate flag and casting-breaks-stealth flag.
Child disable/death privileges do not transfer to root cast gating. Root display
range 970, raw range 25000, client line width 110, child/missile width 100 and
child outward range 1000 remain distinct declarations.

`python3 tools/assets/export-ahri-q.py --check` verifies the generated Q table
against the frozen inputs. It also works with `python3 -O`. Both retain the
input hashes and differing-output guard. The generated table includes both
independent movement profiles and raw child range arrays.

## Local simulation policies

| Concern | Implemented policy |
| --- | --- |
| Cast | Five ranks; costs 55/65/75/85/95 mana; base cooldown 7 seconds with ordinary haste adjustment. Costs/cooldown begin at accepted cast. A 15-tick windup commits the copied aim, cancels an ordinary attack and recall, and delays movement until release. New casts fail under stun/silence; an accepted windup completes through later stun. Death cancels the windup without refund. |
| Outward movement | Aim supplies direction. The orb travels a fixed 1000 units, even for a nearby aim point. Speed starts at 2500, decelerates at 3200 per second and clamps at 400. The root's generic 1100 speed is not used as this movement speed. |
| Turn | Clamped speed is integrated analytically in seconds. The endpoint occurs at 0.77734375 seconds, inside the 47th tick. That tick emits a final outward segment and spends only its remaining time on return. |
| Return movement | Re-aim at the caster's current center after unit movement. Speed begins at 60, accelerates at 1900 per second and clamps at 2600. Arrival clamps to the caster center. Flash changes the tracked endpoint; a dead caster remains the return target. A local eight-second flight limit bounds pathological pursuit. |
| Collision | Swept circles use source width 100 as a radius, plus each target's radius. Width interpretation is provisional. Both legs ignore terrain. Living hostile champions, lane units, dummies and neutral monsters are eligible; allied units, structures and wards are excluded. Targets are ordered by contact fraction, then ID. |
| Damage | Each target can receive one hit per leg, including a return-only hit. Damage/rank are captured at cast; later items do not rewrite the payload. Outward damage uses magic mitigation; return damage uses true damage through the ordinary damage/shield pipeline. No Frost or Focus behavior is borrowed. |
| Match end | The active flight array clears at the ordinary terminal boundary. No additional attacks, events or simulation ticks are created to finish its visual. |

Exact native integration order, movement time base, collision eligibility and
width, endpoint/catch geometry, cancellation/CC priorities, caster death/recall
rules and callback dispatch remain unverified. The choices above are deliberate
local behavior. The eight-second limit is not an extracted spell value.

## Saved state and presentation

Schema 132 adds required `ahriOrbs` state. Each orb retains its global ID, source,
team, rank, captured damage, origin/direction, previous/current positions, launch
and latest tick, and independent outward/return hit IDs. The decoder checks
ownership, learned rank, clocks, lifetime, normalized direction, per-tick motion,
exact outward path, unique/eligible contacts and payload lower bounds. It rejects
foreign Q state and active orbs in a finished match. Ahri remains a non-player
development-map unit, and W/E/R state remains rejected. Earlier saves are
incompatible under the existing same-build policy.

The body selects the imported `spell1` clip. The orb is a small blue sphere with
ordinary interpolation, current point visibility for enemy flights and shared
graphics cleanup. It is an explicit development marker, not a source particle
reconstruction. Native Q particles, bone attachment, materials, motion trails,
impact presentation, source audio, listening and frame comparison remain open.
The local Q icon and text come from the retained 16.18.1 client cohort.

Ahri spell allocation stays manual while her own bot policy is unfinished. In
the development console, learn Q with `world.learnSpell('q', ahri.id)` and enqueue
the ordinary targeted-point cast command for that unit. Base movement/basic
attacks remain shared. This does not add a human Ahri HUD or keyboard mapping.

## Validation

Six motion tests compare the analytic curves with independent midpoint
integration, exercise clamp boundaries and stable distance inversion, verify the
split turn tick, moving return target, exact saved motion and invalid inputs.
Thirteen Q tests cover cast gates/costs, both damage categories, multiple and
return-only targets, all five captured payloads, terrain/structure/ally policies,
Flash, caster death, manual allocation, malformed saves and complete source
table correspondence. Normal and optimized exporters and static audits pass.

TypeScript, 2,090 unit tests in 333 files and all three Node QA checks pass on the
final controller. The initial motion guard accidentally inspected an unrelated
raw range array; validation now checks its four numeric parameters explicitly.
Early fixture assertions omitted per-tick mana/health regeneration; the repaired
cases account for mana regeneration exactly and use a non-regenerating victim
for the death-persistence check. All original logs remain retained.

Twenty-three Chrome scenarios pass in one run, including Q cast/flight rendering,
all three line targets taking exactly two hits, exact checkpoint futures and
existing Ahri NPC, Leona rig, Garen/Lux controls, selection, animation and match-file
checks. Three additional application Save → reload cases pass for windup,
outward flight and return after caster death, each preserving 300 future ticks.
Both flight captures were visually reviewed. These are controlled development
scenarios, not native or full-match acceptance.

Production build and nested-host smoke pass with 32 recordings, no development
hook and no ordinary Ahri model requests. Offline checks pass with 963 worker
responses, including exact saved offline startup and atomic version switching.
The pack contains **1,062 files / 519,998,317 bytes**, ID
`7c9c36e8ab068c4140918f1addb64b7ecb2f4f3152c751b898c88c23726a5980`.
Ruleset:
`0fba88792336cee69705cbd320025192ea4427b6d33f1291cb05d8707c121720`.
One Q icon and its manifest entry are added; all 1,010 other prior public files
remain byte-identical. The public file count is now 1,012.

The [verification ledger](reference/ahri/q-verification.json) binds full retained
sources, generated files, failed attempts, successful checks and reviewed
captures. Run `node tools/qa/verify-ahri-q.mjs`; use `--historical` after later
source changes. Full Ahri kit, role/player integration, native behavior and
presentation, complete performance and overall project acceptance remain open.
