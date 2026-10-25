# Leona support: observed ordinary attack contact and staging

The development support bot no longer starts an ordinary champion pursuit solely
because the opponent is visible and outside tower protection. The saved baseline
showed a melee approach into ranged fire before the allied carry could attack.
The existing E/R follow-up guards did not govern these ordinary attack orders.

The local attack decision now accepts a target already within melee reach, a
visible hold long enough for a direct walk and estimated attack, or a short
approach with an allied champion actually engaged and currently in attack reach.
The approach uses current movement speed, root/stun state and walkable terrain.
It rejects distant, stunned, retreating or out-of-reach allied follow-up. The
short approach budget is 45 ticks of local tuning, not recovered native AI.

When no opponent offers a safe attack, Leona can stage 250 units behind the
living carry toward the allied fountain. The destination uses real navigation
and retains the visible tower check. It does not follow a corpse. Existing
outnumbered retreat, committed windups, E/R policy, farming delegation and normal
Ashe/Lux decisions retain their behavior. Human attack commands remain unrestricted
by this bot-only decision. The compatibility fingerprint includes the changed rules. The contact-history
correction below requires snapshot schema 130.

## Verification and bounded comparison

The two original team regressions fail with an attack order before the change,
then pass with staging movement. Seventeen new simulation cases cover both team
orientations, melee peel, isolated held contact, current allied attack reach,
unavailable allies, short/slowed/rooted forecasts, a blocked path, human commands,
committed windups and exact saved continuation. The full standard check passes
2,054 units in 329 files, TypeScript and three Node QA checks.

The initial expanded fixture copied whole unit fields into navigation points;
strict snapshots rejected those extra fields. Its query adapters now return
coordinates only. A held-target positive also placed a second enemy close enough
to trigger the existing outnumbered retreat. An observer trace identified that
rule; the positive now isolates the intended catch. The retreat rule was retained.
All initial failures and the trace remain in the evidence.

Both fixed ten-minute development reruns pass 72,000 checked ticks, 20 strict
round trips and 18 restored-future comparisons. Leona deaths change from four to
zero for seed 26018 and five to one for seed 719, with level four becoming five
and six respectively. These are two selected deterministic comparisons. They do
not establish a general win rate, balance, complete support behavior or native
bot equivalence. The [prior corpus](LEONA-RIFT-COHORT.md) remains frozen separately.

## Moving-contact save correction

The first longer candidate run found a strict save failure at tick 75,600 in
seed 719. A minion moved later than Leona within the same simulation tick. Its
end-of-tick following sample correctly moved, while the accepted contact point
remained at the earlier hit position. The old decoder incorrectly required them
to coincide. The failed corpus remains separate and is not relabeled as passing.

Each ordinary contact now retains an independent required `contactFrame`, with
its birth point, audience and posed clock, alongside the later following samples.
The contact clock may be the current or immediately preceding animation tick,
depending on unit processing order. Strict decoding checks that bound, exact
contact point/audience agreement, rig-valid pose and the complete later sample
sequence. Current following samples still match the live target. It does not
infer missing contact data or accept schema-129 saves.

Three added contact-history cases cover moving targets before/after their
attacker, exact restored futures and missing/displaced/stale/future/audience
forgeries. Birth data stays separate from post-contact movement without adding
IDs, RNG or combat events. Existing material, lifecycle and source audio checks
remain intact. The full standard check passes after this correction.

Both fresh longer runs pass 273,583 checked ticks, 77 strict round trips and
75 restored-future comparisons across 4,500 ticks. They reach valid Red victories
at ticks 130,839 and 142,744. Leona finishes with eight and six deaths, versus
12 and 16 in the preserved baseline. Both selected matches still end in Red
victory; complete support play and balance remain open.

All 90 broader Chrome cases pass, followed by one added controlled real-map
moving-minion contact case. The two seeded browser scenarios match passive
replays and actual Save/reload with exact 400-tick futures. The added contact
case uses an authored wave minion and real terrain, keeps distinct contact and
following poses, and preserves its actual Save/reload and 180-tick future. Both
Rift captures were visually reviewed. The pre-addition browser source is
retained alongside the 90-case report.

Removing only compatibility identifiers and the new contact field from an
offline comparison produces identical complete gameplay states at the original
failing tick. The source fix therefore preserves the original contact, IDs, RNG
and combat. Normal imports retain strict version checks. All 391 failed-run
source pins are archived exactly; two older files were recovered from Git only
when their SHA-256 matched the original run plan.

All 32 nested-path production recordings pass, preserving the production trial
gate and zero ordinary Leona preloads. All 1,010 public assets remain unchanged.
Schema 130 ruleset is
`ca5d6fe53f056aea0943668b0596546e68869e922d4bab91a254888db59931cd`;
pack `ad6604e58b19fa9b8b26cd1519898f3733184607e9094a42543df8037e8b7b6a`
contains 1,060 files / 519,950,009 bytes.
The [frozen acceptance ledger](reference/leona/support-ai-verification.json)
binds source, artifacts, the failed candidate and corrected comparisons.
Offline integrity, repair, saved boot and atomic version switching pass with
963 worker responses and no production errors. Native comparison, three R
families, complete roster/support, hundred-seed and performance acceptance
remain open.
