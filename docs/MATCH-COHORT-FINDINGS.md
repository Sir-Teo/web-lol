# First cohort findings: save-state boundaries

The first 100-seed plan ran against commit `503754f`, schema 113 and ruleset
`6a6196f596e935bd1989d28352042f32774cf2496de0ef6be1b281d94f7945f1`.
It stopped dispatching after a failed seed and drained all owned workers.
**Eight seeds ran: six passed, two failed, and 92 remained queued.** No winner
was forced. This run does not meet the 100-seed gate.

The failed plan, bundled runner, copied map inputs, logs, checkpoints and reports
remain under `.cache/match-cohort/normal-100-6a6196f-20261023`. The eight attempted
matches checked 1,555,118 ticks, 434 successful snapshot round trips and 428 saved
future comparisons. These counters include work before the failures and are not
a passing result for the cohort.

| Seed | Outcome | Last tick | Finding |
| --- | --- | ---: | --- |
| 1 | Blue victory | 191226 | Passed |
| 2 | Blue victory | 213253 | Passed |
| 3 | Failed at Blue victory | 204912 | Cinders pulse clock not settled |
| 4 | Blue victory | 204991 | Passed |
| 5 | Failed while active | 151200 | Arrow splash mutated a ward |
| 719 | Blue victory | 205272 | Passed |
| 927 | Red victory | 204061 | Passed |
| 26018 | Red victory | 180203 | Passed |

The four historical anchors retain their previous winners/ticks and exact
canonical states after accounting only for schema/ruleset identities and the two
new, empty Garen history arrays on each champion. The frozen anchor comparison
records those explicit differences; it does not establish a 100-seed result.

## Winning regeneration boundary

Seed 3 destroyed the Nexus at tick 204912, exactly when champion 33's red buff
was due for its next regeneration pulse. Combat stops the winning tick before
post-combat restoration. Its retained `nextRegenTick` was therefore 204912, while
strict checkpoint validation requires the next phase deadline, 204942. The game
had reached a valid victory, but the exported result could not be restored.

`advanceRedBuffClock` now settles expiration/phase independently of HP restoration.
The ordinary regeneration path uses that same clock helper. Nexus completion
settles all champion records without adding an HP pulse after victory. The same
terminal boundary also expires a due Lost Chapter Enlighten record without
applying its final mana restoration. Its post-combat expiry had the same ordering
problem, reproduced by a focused test.

The normal healing amount, lockout, cadence, buff duration, combat, victory tick
and winner remain unchanged. Live red-buff validation is not relaxed. Tests
retain the strict rejection of a forged due pulse in the repaired terminal save.
The three boundary scenarios cover red regeneration, Enlighten and both together;
HP/mana remain exactly at their pre-victory values and restored victories remain
frozen through subsequent step attempts.

## Crystal Arrow splash and wards

Seed 5 retained ward 149020 with `slowUntil = 148701`. It still had three HP and no
tracked slows. Arrow's primary collision and generic slow application already
excluded wards, but its splash loop wrote the old slow fields before the generic
slow helper rejected the target. Those fields remained on the stationary ward
after the deadline passed. Strict ward validation correctly rejected the save at
**42:00** (tick 151200).

The splash eligibility filter now excludes wards before applying damage or
control. Enemy champions/minions still receive their existing splash damage and
slow. Ordinary ward attack/clearing rules remain unchanged. Both team orientations
are covered; a real Arrow launch is restored before contact, then the entire ward
record is checked unchanged after splash. The real Save match/reload browser
path now retains the exact checkpoint.

## Replay and verification scope

`tools/qa/replay-cohort-failures.ts` resumes each pinned last-valid checkpoint
under the repaired source. It overrides only the ruleset identity **for this
controlled diagnostic**; original source files are untouched. Production saves
still reject other rulesets. The old invalid final snapshots, given the same
explicit identity bridge, remain rejected by the unchanged decoder.

- Seed 3 resumes from tick 201600 and reaches the same Blue victory at 204912.
  The only canonical state difference is the red-buff deadline 204912 → 204942.
- Seed 5 resumes from tick 147600 and reaches the same active state at 151200.
  The only canonical difference is the ward's invalid legacy deadline → 0.
  Its repaired checkpoint then continues identically for another 120 ticks.

Both cases round-trip exactly. Five focused regressions failed on the old source
and pass on the fix. The initial reproduction setup was corrected to enable Rift
structures and use Lost Chapter's actual field name before recording those
baseline failures. The full unit suite, browser checks, production smoke and
pinned evidence are recorded in [the correction ledger](reference/cohort-save-corrections.json).
All 1,457 unit checks across 265 files, 16 unique Chrome cases and the nested-host
production smoke pass. `node tools/qa/verify-cohort-save-corrections.mjs` checks
that frozen evidence against the repaired source.

Schema **113** is unchanged; the strict ruleset fingerprint changes. No migration,
validator exception, timing acceleration, forced outcome or seed exclusion is
introduced. A fresh complete 100-seed plan must run under the new fingerprint,
prioritizing the two failed seeds while retaining the same seed population. The
full project remains incomplete: roster, role systems, objectives, native visual
comparison and full-match browser/performance gates are still required.
