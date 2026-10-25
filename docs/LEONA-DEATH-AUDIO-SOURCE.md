# Leona Death3D source layers

The declared death event is now mapped to two prepared source layers. One event
starts both layers through two ordered Play actions:

| Layer | Action | Direct sound | Media | Authored action delay |
| --- | --- | --- | --- | --- |
| First | 22612475 | 461770655 | 455387691 | absent; explicit local zero |
| Second | 148653763 | 267995038 | 558948421 | 1750 ms |

The event is `Play_sfx_Leona_Death3D_cast` (1647906331). Each sound authors
MakeUpGain −10 dB, cap four, `bKillNewest=0` and
`bIgnoreParentMaxNumInst=1`. Neither authors Pitch, sound Loop or ranges. There
is no random container or authored action TransitionTime. Raw override/admission
flags remain in the graph and selected policy table; no effective inheritance is
flattened. Absent pitch/transition and first-layer delay have explicit local-zero
policies for later playback.

Both sounds point to parent 212757264, which authors Priority 55 and attenuation
687014649. This has the same three raw curve points as ordinary-attack
attenuation—0 / 1350 / 2412—but a distinct ID and unresolved output bus
2232828494. All five retained-bank Stop actions match none of the seven selected
or inherited nodes. That bounded audit does not establish global or script
stopping behavior. No encoded ID or SHA overlaps Q/W/E/R/ordinary attack/Sunlight.

The mono 44.1 kHz float32 masters retain 331,314 frames / 1,325,344 bytes. Their
full durations are 3.6366893424 and 3.8760997732 seconds. Peak is 0.9752417803,
with no above-unit samples and no decoded loop regions. No normalization, gain,
resampling, fade, loop expansion, trimming or clipping is applied.

The delayed layer ends 5.6260997732 seconds after the event. Generated retention
is therefore 338 ticks at 60 Hz. Existing transient death events expire after
150 ticks and are cleared on restore. Saved `deadAt` clears on respawn, and live
coordinates/current visibility do not preserve the original birth audience.
A later playback increment needs a separate saved death fact with its accepted
clock, position and audience. This source checkpoint adds no such fact and no
runtime audio.

The independently audited graph matches all primary graph fields except the
primary's added bounded stop-audit summary. Mapper, decoder and exporter keep
pinned banks, declarations, XML, media, raw properties and float provenance.
Exporter destination checks all complete before any new public file is written.
Check mode runs offline without decoding, with active guards under `-O`.

## Verification

Three new units cover both ordered layers, direct policies, graph/PCM provenance,
separate attenuation and the delayed 338-tick bound. TypeScript, all 2,009 tests
in 325 files and three Node QA checks pass. Canonical generation reproduces ten
isolated files byte for byte. Eighteen mutation controls reject altered gain,
parent priority, delay, attenuation, WAV/WEM, table, public output and retention
under normal and optimized Python; both pristine baselines pass. Both decoder
overwrite attempts reject with all three retained files unchanged.

Both Chrome cases pass exact sample decoding and ordinary Ashe lazy loading.
All 32 nested-path production recordings pass without development hooks or
unrequested Leona preloads. All 1,008 previous public assets remain unchanged;
exactly two new WAVs are added.

Schema remains 128; ruleset is `9e3706224c3c417e9dbe5c4b89185a9d8874759d43c803cd4b9d8af302a18a6a`.
Pack `7103df4e9ea02090f34128a3ee7a3f5c4a258df6c538dedf538f8eb1d82b26b7` contains 1,059 files / 519,941,952 bytes.
Offline integrity, repair,
saved boot and atomic version switching pass with 963 service-worker responses
and no production errors.

The [acceptance ledger](reference/leona/death-audio-source-verification.json)
binds exact working sources, generated output and retained evidence:

```sh
node tools/qa/verify-leona-death-audio-source.mjs
# After later project changes:
node tools/qa/verify-leona-death-audio-source.mjs --historical
``` No
native caller/timing, animation association, cancellation, listener/bus mix,
source listening comparison or full Leona/project acceptance is claimed.
