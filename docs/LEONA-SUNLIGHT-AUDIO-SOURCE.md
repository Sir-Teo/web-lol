# Sunlight source audio preparation

The declared Sunlight contact event now has an offline-reproducible source graph,
three untouched float32 masters and a generated authoring table. This checkpoint
prepares assets; runtime playback remains the next increment.

`Play_sfx_Leona_LeonaSunlight_hit` (2146748535) uses Play action 917723274 and
random container 2445. Its authored gain is −12 dB, instance cap is two, and
`bKillNewest=0`. The ordered sounds 282110511 / 943926914 / 99903188 resolve to
media 134510222 / 495930967 / 836514570. The playlist has equal 50000 weights,
Shuffle mode, global/reset flags, no continuous sequence, loop count one and no
avoid-repeat history. The retained 1000 ms transition field is disabled by
`eTransitionMode=0`; it is not a playback delay.

The action has no authored delay or transition property. The container and
sounds have no authored Pitch or sound Loop property. The generated table marks
absent pitch/delay/transition values as explicit local-zero policies. All three
sounds retain Priority 60 and raw override/admission flags. Parent 2444 points to
695650395, with Priority 60 and the shared six-point spell attenuation 339248780.
Output bus 1259461568 remains unresolved. No effective-inheritance flattening,
native shuffle history or listener/bus mix is claimed.

All five Stop actions in the retained bank target none of the nine selected or
inherited graph nodes. This is a bounded direct-target audit; native caller and
global/script stopping behavior remain unknown. The independently audited graph
matches every primary graph field apart from the primary's added stop-audit
summary. No encoded media IDs or SHA values overlap the prepared Q/W/E/R/attack
sets.

The masters are mono, 44.1 kHz IEEE float32 WAV, with 85,429 frames and 341,848
bytes total. Their durations are 0.6891836735 / 0.6094557823 / 0.6385260771 seconds.
One source sample exceeds unity; peak 1.0305808783 is preserved. No normalization,
gain, resampling, fade, loop expansion or clipping is applied. The decoder reports
no loop regions. The longest clip needs 42 ticks; the existing 65-tick Sunlight
visual history already covers that horizon.

The mapper verifies pinned banks, parser XML, declarations, hierarchy and media
bounds. Decoder overwrite guards preserve retained WAVs and provenance. Export
checks validate encoded and decoded hashes, format, PCM, headroom, duration,
playlist, gain, priorities, attenuation and output bytes. All destination checks
complete before any new public asset is written. Check mode runs offline without
a decoder. Normal and optimized Python use active guards.

## Verification

Canonical mapping, decoding and export reproduce twelve isolated output files
byte for byte. Three new units verify graph/provenance, authored policy and every
PCM hash. TypeScript, all 1,999 tests in 323 files and three Node QA checks pass.
Sixteen mutation controls reject changed gain, priority, action delay,
attenuation, encoded WEM, decoded WAV, generated table and public WAV under both
normal and optimized Python. Two pristine baselines pass. Both decoder overwrite
attempts reject with all four retained files unchanged. Independent and primary
normal/optimized checks pass.

Five focused Chrome cases pass: all three masters decode sample for sample,
ordinary Ashe requests no Sunlight source assets, and existing Sunlight layers
retain save/reload placement, graphics recovery, hidden-birth behavior and lethal
terminal tails. All 32 nested-path production recordings pass, without development
hooks or unrequested Leona preloads. All 1,005 previous public files are unchanged;
only the three new masters were added.

Schema remains 128; ruleset is `66c7ac1748296621bb8bf3c64ca17eeaefb52b567444d1e54c664b82ad0d3148`.
Pack `f619515039ffeeebfa55afcca92e0f8f1aa6fec70a37ced7ecbc92d6a19c5aa1` contains 1,056 files / 518,610,793 bytes.
Offline integrity, repair,
saved boot and atomic version-switch controls pass with 963 service-worker
responses and no production errors.

The [acceptance ledger](reference/leona/sunlight-audio-source-verification.json)
binds exact working sources, generated distribution and retained evidence:

```sh
node tools/qa/verify-leona-sunlight-audio-source.mjs
# After later project changes:
node tools/qa/verify-leona-sunlight-audio-source.mjs --historical
```
No native game execution, caller timing, source listening comparison or full
Leona/project acceptance is claimed.
