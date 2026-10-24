# Saved Solar Flare presentation facts

Accepted R casts now retain their phase and participant facts after live gameplay
R retires. Snapshot schema 126 stores a bounded `leonaRVisuals` array per champion.
This prepares source playback; it introduces no R particle/audio dispatch or
native timing claim. Existing damage, targeting, control and resource policies
remain in their gameplay adapter.

## Records and capture boundaries

Each record keeps accepted rank/radius, the clamped fixed ground point, an
independent cast anchor and creation audiences. Release has its own captured
source position/facing and tick. Flash may move the caster between these anchors
without changing the area point. Completion records either impact, pre-release
death or match end. Released R can impact after owner death. Later crowd control
keeps the existing committed-cast behavior.

Impact captures the entire sorted participant set before any damage/control
callback. Each participant keeps identity, kind/team/rig, radius, the original
hit point, center/outer result and creation audience. Saved pose frames then
follow the target independently. Same-tick Flash can change the final target pose
without moving the original hit anchor. Lethal or removed targets detach and
freeze. Contact frames stop on their own deadline while the impact record stays
available for longer source tails.

Rolling source pose frames retain caster visibility and a separate audience for
the area point. No area vision is granted. The first owner death freezes a saved
pose/audience with its death/respawn clocks; the area audience continues to sample
the fixed point. That frozen pose survives later respawn and subsequent death.
Accepted/release/death anchors remain separately retained when old rolling frames
are removed. Terminal matches keep a frozen winning snapshot.

## Bounds and validation

The [generated table](../src/content/leona-r-history-bounds.json) hashes the full
frozen R source pin and covers all 44 enabled records. For each emitter it sums
positive lifetime, particle linger, emitter linger and first-emission delay with
the largest particle lifetime/probability product, rounds up to 60 Hz and adds two
local settlement ticks. Missing particle lifetime uses an explicit local one
second. This deliberately conservative accounting does not establish native
overlap, omitted defaults, script dispatch or effect stop timing.

| Role | Bound in ticks |
| --- | ---: |
| Buff | 722 |
| Cast | 698 |
| Contact | 132 |
| Green/red area | 704 |
| Impact | 884 |
| Ended record retention | 884 |
| Rolling source frames | 885 |

History expires exactly at `endTick+884`. A record remains active until an actual
gameplay end; it does not infer release/impact from renderer time. Snapshot
validation binds live R to its accepted record and rejects foreign owners,
missing live history, inconsistent rank/geometry/clocks, malformed pose sequences,
impossible participant order/identity/rig/boundaries and expired data. Current
target poses are checked only while contact recording is active, allowing later
despawn or respawn. Older schemas/rulesets are rejected by the existing strict
compatibility policy. E, bot and Garen save browser assertions now expect 126.
Internal consistency cannot authenticate every self-consistent historical edit
or infer completed casts deleted from an otherwise valid save.

## Verification scope

Nine focused unit cases cover source/probability bounds, phase restore futures,
pre-callback hit anchors, death and posthumous impact, Flash, independent area
visibility, exact retention boundaries, terminal freeze and forged saves. Existing
Solar Flare gameplay tests exercise the new records without changing their combat
expectations. Browser tests use ordinary Save match and page reload for windup,
released and impact states and compare exact following snapshots.

The full 1,827 unit cases/301 files and three Node QA cases pass. Fourteen Chrome
cases include these three R saves, four Zenith saves, source trails, Garen
particles and the staged bot save. Fresh nested production passes 32 recordings
without a development hook or unrequested Leona preload. The fresh 996-file offline
pack contains 510,463,898 bytes and passes integrity, cancellation/retry, repair,
saved/new-match boot, removal and atomic activation with 963 service-worker responses.

Seeds 8/38 each run ten simulated minutes with one worker: 72,000 checked ticks,
20 round trips and 18 future checks. All 20 checkpoints match the prior frozen
schema 125 Zenith-history smoke after removing only version/ruleset and new empty
R-history arrays. This is an earlier frozen baseline, not an immediate-parent
rerun. Both matches end unfinished at the horizon; the full 100-seed gate remains
open. Ruleset 755819ef identifies this increment. No CPU benchmark is claimed.

```sh
python3 tools/assets/export-leona-r-history-bounds.py --check
npm run check
npx playwright test e2e/leona-solar-history.spec.ts
node tools/qa/verify-leona-r-history.mjs
```

The [verification record](reference/leona/r-history-verification.json) pins exact
source and delivery evidence. Later canonical changes require `--historical`.
Source R drawing, source SFX, native CPU dispatch/terrain/matrix/state bindings,
Leona player/support and full six-champion delivery remain open. Nothing is
pushed; the full project goal stays active.

The subsequent [R source SFX increment](LEONA-R-AUDIO.md) uses these saved facts
for three finite local roles. The verification and ruleset above remain scoped
to history acceptance; R source drawing/native acceptance are still separate.
