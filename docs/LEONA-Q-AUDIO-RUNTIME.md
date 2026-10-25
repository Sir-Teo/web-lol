# Daybreak source playback and saved attack history

Q now plays its thirteen prepared source masters through a lazy controller when
Leona is present. Activation and every committed empowered-attack attempt use
moving caster poses; actual contact uses the saved target poses. The buff loops
the entire untouched master from accepted activation until consumption, natural
expiry, recast, death or match end, then fades for 500 ms. The authored initial
fade is 100 ms. A stop during that fade starts from its current level.

## Saved facts and local policies

Each Q history now records ordered `attackStarts`, including attempts canceled by
target loss. The contact must reference the last recorded attempt; an active
captured attack must correlate with that same history. Strict decoding rejects
missing, duplicated, future, out-of-window and contradictory starts. Snapshot
schema is 127; old saves are rejected instead of inventing missing attempts.

The old caster retention could end after an early hit before the longest 1.891 s
cast master finished. Generated bounds now cover 114 ticks for cast, 28 for attack
and 52 for hit. Caster history retains the maximum required source/visual tail;
the existing 77-tick target tail already covers hit audio. Histories still expire
at a finite bound and consume no gameplay IDs or random draws.

Variants are indexed cosmetic choices independent of simulation RNG. Cast and
buff use the activation's saved audience, attacks use each attempt's start
frame, and hit uses the contact audience. Current point visibility also applies.
Later reveal cannot expose a hidden activation or attack. Mute and pause release
all owned nodes, and resume seeks using the saved phase clock. Finished finite
voices cannot replay at a frozen tick. Terminal fades drain on the audio clock
without changing the saved world.

The shared source controller supports optional whole-buffer loops and avoids
scheduling an infinite stop. E and R keep their finite defaults. Q preserves the
source role gains and caps with the existing local master/attenuation policy;
cap zero is locally unlimited. Failed or pending source activation/attack keeps
synthesized feedback and suppresses the matching late source duplicate. The
persistent buff and actual contact remain independently eligible. Failed fetches
settle readiness and are not retried each frame.

These are explicit reconstruction policies. Bank event names and the pinned
reader's interpretation of `Loop=0` do not establish native invocation times,
whole-master loop boundaries, loop phase, random history, effective voice
inheritance or listener/bus mix. No native game execution, listening comparison,
voice-over, native frame, ordinary Rift Leona or full-project acceptance is claimed.

## Verification

Fourteen new units cover the two reproduced history gaps, canceled/retried and
late attacks, strict saves, source clocks, loop seeking, fixed audiences,
interrupted fades, mute/visibility cleanup, fallback suppression, voice caps and
expiry/recast/terminal stops. Existing Q presentation expectations now include
cast-audio retention. TypeScript, all 1,966 tests in 319 files and three Node QA
tests pass. Twelve isolated negative controls reject changed WAV, WEM, loop,
stop-fade and retention data under normal and optimized Python; both pristine
export checks pass.

Eight focused Chrome cases pass real Q playback, sample-for-sample master decode,
Save/reload with exact 90-tick futures, stop fade seeking, looping beyond the
master duration, mute/resume, terminal draining, visibility, finite completion,
per-event fallbacks, failed fetches and ordinary Ashe lazy loading. The broader
browser, production and offline results are pinned in the acceptance ledger.

The first browser run retained an overly broad request matcher, a hidden-attack
fixture whose blue target supplied allied vision, and 26 requests in a failed-load
case while test files were being edited. The isolated rerun with the matcher and
neutral target corrected passes and observes exactly thirteen requests with no
per-frame retry. The original specs, traces and logs remain available. The first
history regression preserves both failures before implementation; the existing
presentation test's earlier retention expectation is also retained in its log.

All 984 previously shipped public files remain byte-identical. The source table
and thirteen WAVs retain the hashes from the source-preparation checkpoint.
`docs/reference/leona/q-audio-runtime-verification.json` binds exact working
sources, generated distribution and evidence. Verify the frozen checkpoint with:

```sh
node tools/qa/verify-leona-q-audio-runtime.mjs
# After later project changes:
node tools/qa/verify-leona-q-audio-runtime.mjs --historical
```

The 38-case browser regression and 32 production recordings pass. Runtime ruleset
is `45c72d674fc34cac2d1386a9eb60881fcb00b32f821c9101c1b12af33a1aba30`. Pack `519c98024be9fa01d338659162d864e339269f435402cc27b408bdd351318486` contains 1,031 files / 515,863,893 bytes.

Offline integrity, repair, saved boot and atomic version-switch checks pass with
963 service-worker responses and zero production errors.
