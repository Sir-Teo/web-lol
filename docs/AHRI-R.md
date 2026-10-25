# Spirit Rush base development controller

Target: standard PC Summoner's Rift 26.18, frozen Riot build 16.18.8175716.
This checkpoint adds the base Spirit Rush dash, three casts and essence bolts to
Ahri's non-player development fixture. **Passive Essence consumption, healing and
its additional R recasts/window extensions remain unimplemented.** Ahri remains
outside player selection and the production Rift roster. This is an incremental
controller foundation, not a complete Ahri kit or native behavior verification.

## Guarded source declarations

`tools/assets/export-ahri-r.py` uses the existing SHA-guarded declaration loader,
checks all eleven named values and root calculation links, and retains root/child
conflicts. Normal and optimized checks pass; differing existing generated output
is rejected.

| Declaration                | Retained value                                                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Root named damage          | 75/125/175 + 0.3499999940395355 AP.                                                                                                     |
| Root cooldown / mana       | 140/120/100 seconds / 100 at every rank.                                                                                                |
| Named counts and window    | Three targets; three casts; 15 seconds; one-second dash cooldown.                                                                       |
| Dash fields                | Named distance 500 and base speed 1200. No native trajectory is supplied.                                                               |
| Distinct root ranges/speed | Display 450; raw cast range 25000; generic missile speed 2200.                                                                          |
| Child bolt                 | Fixed-speed movement 1400; raw range 800; movement-complete cast/destroy behaviors.                                                     |
| Passive-related fields     | Reset casts 1; extension 10 seconds. Client explicitly links these to champion Essence consumption and a maximum of three stored casts. |
| Root restrictions          | Cannot cast while rooted; winding guard and stealth break; animation Spell4.                                                            |

Root cast-time fields are omitted. The child's 0.25-second cast field and root
legacy castFrame 15 do not establish a root windup. Child legacy damage, coefficient
0.7, cooldowns, icon and animation differ from root named values and remain separate.
The root also omits disabled/dead permissions and animator-framerate fields.

The ability has a manually managed lifetime. Three float-comparison VFX drivers
read the same R buff counter against 1/2/3; their comparison operator and counter
updates are not supplied. Character secondary-resource pip metadata also includes
three pips. Neither establishes native charge consumption. Spell4/Run_Spell4
ConformToPath events and a ToIdle sequencer remain source observations rather
than recovered path/control callbacks. The standard table does not fold in the
separate cherry-mode reset value 2.

The independent cache-only audit checks six pinned input identities and reparses
all 64 committed BIN records normally and under Python optimization. Findings
SHA-256: `6a0ac2a97ae419e3037ca38859342b14ebb69b08010b1aaef8fd5f61592967fd`;
checker SHA-256: `17dde8eb0ffd125e52ff5f05cff4e86bde096ab204934801be5523bff4943658`.
No native client, provider session or new extraction was used.

## Explicit local execution policies

- Accept an instant dash with the imported `spell4` body clip. No pending cast time
  is borrowed from the child. Initial activation costs 100 mana and starts the
  hasted root cooldown. Two further casts cost no mana, share the initial fixed
  15-second window and keep a one-second recast lockout unaffected by haste.
  Mana/cooldown invocation and native cancellation/combos remain unverified.
- Each accepted cast captures its current rank and AP. A nearby aim chooses a
  shorter dash; distant aim clamps to 500. Reachable endpoint correction backs
  inward deterministically if correction would exceed that bound. The dash
  traverses intervening terrain and ends on reachable ground, using fixed speed
  1200 without adding movement speed. These are local geometry/scaling choices.
- Position is computed from accepted origin and elapsed fixed ticks. A shared
  small arrival tolerance prevents floating-point drift at angled endpoints.
  Ordinary orders buffer until arrival; recall and new ordinary casts wait.
  Heal remains permitted. Flash, root, stun, Charm and death stop the dash;
  control interruption saves its actual root/stun/Charm deadlines. Native
  ability-during-dash permissions and control ordering are open.
- On acceptance, select up to three distinct currently visible eligible enemies
  within 600 center-to-center units of the cast origin. Champions come first,
  then distance and stable unit ID. Allies, structures, wards, protected emerging
  monsters and resetting monsters are excluded. Acquisition origin, dispatch
  timing, native visibility rules and range-edge interpretation remain open.
- Bolts use captured per-target magic damage and linear homing at the child speed.
  Terrain and other bodies do not intercept. Committed bolts track through later
  vision loss and caster death. Target death/untargetability spends the bolt
  without retargeting. Pursuit expires after a local four-second bound. Native
  spline/default tracking and post-death ownership remain unverified.
- Dash, recast window and bolts are independent saved lifetimes. An accepted dash
  can finish after the recast window expires. Exhausting three casts retains the
  window until its deadline, but no passive reset is fabricated. Death closes
  that window and dash while committed bolts can finish. Terminal settlement
  clears all R state.
- Cyan spheres are named development bolt markers. Native R VFX, impact/target
  effects, audio, full animation-graph behavior and material/dynamic-bone fidelity
  remain open.

## Save and verification boundary

Schema 135 requires `ahriRushes`. Each window has one global entity ID, source/team,
window/lockout/charge facts, indexed bursts and indexed bolts. Saves validate
source/rank ownership, unique target IDs, charge and clock relations, bounded dash
endpoints, active fixed-step position, arrival/interruption facts, control causes,
bolt movement and spent/live outcomes. Incompatible borrowed pending windups reject.
Older schemas intentionally reject under the same-build policy.

An angled-frame regression first failed with the accumulated-vector implementation.
Its failing run and both prior movement/validator files are retained. The fix
passes every saved movement frame for twelve angles. One full-run fixture used an
invented monster emergence duration; replacing it with the pinned Gromp duration
preserves all eligibility assertions. Both full-run logs are retained.

The full check passes 2,154 tests across 336 files, TypeScript and three Node QA
checks. Twenty-one R tests cover ranks/AP, initial/recast resources, lockout and
expiry, target ordering and eligibility, short/long/angled/terrain dashes, endpoint
correction, root/stun/Charm/Flash/death, buffered actions and Heal, pursuit/target
loss, edited-save rejection, terminal settlement and 300-tick saved continuation.

Thirty-eight targeted Chrome cases pass in one run without failures, skips or
retries. Four R cases verify the source body clip, three development bolt markers,
arrival, free recast behavior and actual Save match/reload in dash, recovery and
recast. Every reload preserves exact saved bytes and 300 future ticks. Dash and
arrival screenshots were reviewed at 1440×900. The remaining cases retain all
prior Ahri NPC/Q/W/E, Leona rig recovery, Garen/Lux controls, champion selection,
animation and match-file coverage.

Nested-path production smoke passes 32 recordings with no development hook, no
Ahri fixture and no unrequested Ahri model preload. Offline checks pass with 963
service-worker responses and no production errors. Pack `b791b3c576c01898d063a76f6cc8f668bfab392a1b544c7e7145a694beb92672` has
1,065 files / 520,044,533 bytes. Ruleset:
`86ba88f0caeb4e222145f8c4b4bfc54ad17f15ffcaa25827582b444af77db5c8`.

The pinned Data Dragon 16.18.1 `AhriR.png` is 6,639 bytes, SHA-256
`5c1095c39353b5f7af61b8c66d818b82bcdfcfbbddd3cadedc526e47fa8b42fe`.
All 1,013 prior public files other than the reference manifest remain identical;
the icon is the only new public file. Production champion options are unchanged.

Frozen evidence: [r-verification.json](reference/ahri/r-verification.json).
Run `node tools/qa/verify-ahri-r.mjs`, or add `--historical` after later changes.
Passive Essence resets, full Ahri kit, native behavior/presentation, production
roster expansion, performance and full-project completion flags remain false.
