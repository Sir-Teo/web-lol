# Leona ordinary attack source playback

Ordinary Leona attacks now play prepared source cast and contact masters through
a lazy controller. The saved attack slot selects BasicAttack, BasicAttack2,
BasicAttack4 or CritAttack. BasicAttack and BasicAttack4 preserve their authored
40 ms Play-action delay with a future Web Audio start, without rounding to the
60 Hz simulation grid. Contact remains independently eligible only after the
saved accepted hit.

Normal and critical casts keep distinct gains and instance caps even though they
share media. Normal contacts select the saved Flesh, Metal, Stone or Wood branch
and use indexed cosmetic pitch within the authored −300/+300 cent range.
Critical contacts use their separate unpitched role. Stable indexed media and
pitch choices consume no gameplay RNG or IDs. The controller uses the distinct
three-point attack attenuation table and existing local master/listener policy.

Moving saved caster and target positions drive placement. Fixed cast/contact
audiences and current point visibility prevent later reveal from exposing a
hidden cast; a later visible contact can still play. Canceled casts finish their
finite source tail without inventing a hit. Mute/pause release owned nodes and
resume seeks the saved phase. Completed voices cannot replay at a frozen tick;
match-end tails drain using the audio clock without advancing the saved world.

A controller load fetches and decodes each unique URL once, sharing decoded
buffers across normal/critical roles while preserving separate admission caps.
It loads 24 unique masters across seven roles. Four Attack3-only masters remain
prepared data because that slot has zero source weight and is absent from the
current local animation selector. No LPF transfer or invocation is invented.
Q and ordinary-attack controllers can independently request shared Q URLs; the
cache is per controller load.

A pending or failed source controller retains one generic release cue and
suppresses the entire attempt's late source roles. A canceled attempt has no
legacy release event and therefore no generic fallback. Failed loads settle
readiness without per-frame retries. Ordinary Ashe loading remains lazy.

Saved-slot dispatch, W→Attack4 selection, critical precedence, indexed variation,
pitch distribution, gain/cap arbitration and listener placement are explicit
local policies. Source declarations do not establish native callsites, anonymous
switch setters, global shuffle history, effective priority inheritance, bus mix,
filter transfer or listening equivalence. Full ordinary Rift Leona integration
and native behavior/frame/listening acceptance remain open.

The save compatibility fingerprint now includes both Q and ordinary-attack state
rules, matching the existing W/E/R policy. Schema remains 128; incompatible
rulesets are rejected through the fingerprint.

## Verification

Eleven new controller tests cover all four selected slots, exact delayed starts,
material pitch, canceled casts, stable saved choices, moving placement, fixed
visibility, node cleanup, finished-voice suppression, separate caps and 24-URL
per-load deduplication. One fingerprint regression reproduces the omitted Q/attack
state roots before the fix and validates both dependencies afterward. TypeScript,
all 1,996 tests in 322 files and three Node QA checks pass.

The full 53-case Chrome run passes all nine new attack cases and 43 existing
regressions. The one failing assertion was the old Q failure test's expectation
of thirteen requests. With the new attack controller, seven shared Q masters are
independently requested, yielding twenty requests across thirteen URLs. The
corrected focused rerun passes and asserts the exact seven duplicated URLs,
single requests for the other six URLs, and no per-frame retries. The full-run
failure and trace are retained alongside that repair.

The attack cases verify all four selected slots through actual Save/reload,
identical snapshots and 90-tick futures, authored 40 ms delays, critical/material
contacts, canceled finite completion, hidden-start/later-contact audiences,
release fallback suppression, seventeen failed new-master requests without
retries, and audio-clock terminal draining without save mutation. Existing Q/E/R,
player controls, source graphics, Garen and bot save regressions also pass apart
from the repaired request-count assertion described above.

The first focused run passed eight cases before the terminal case and fingerprint
fix were added. An initial reporter run was restarted to persist JSON directly;
the subsequent turn interruption ended its runner before a final report. Partial
artifacts and restart records remain. The completed full run and focused repair
are the acceptance evidence. The first focused unit/typecheck logs retain a structural pose-helper
type mismatch and an incorrect zero-gain endpoint assertion; interpolation now
uses saved positions directly, and the test preserves the pinned −96.3 dB floor.

All 1,005 previously shipped public assets remain byte-identical. The 32 nested-path production recordings pass, with no development hook, no
production Leona fixture and no unrequested Leona preloads. Schema 128 ruleset is
`2f208b3eea9575ec65f59f6dd553b62609e2187de64539c65082db6aef83e9df`.
Pack `25cbb0db755fdcf5ace908b1f1a7df5ca39cc518253a6be631f9a62ea0f14c0b`
contains 1,053 files / 518,268,945 bytes. Offline integrity, repair,
saved boot and atomic version-switch checks pass with 963 service-worker responses
and no production errors.

The [acceptance ledger](reference/leona/aa-audio-runtime-verification.json) binds
exact working sources, generated output and retained evidence. Verify it with:

```sh
node tools/qa/verify-leona-aa-audio-runtime.mjs
# After later project changes:
node tools/qa/verify-leona-aa-audio-runtime.mjs --historical
```
