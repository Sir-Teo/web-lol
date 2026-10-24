# Saved Solar Flare source SFX

Three finite R roles now use nine untouched float32 masters from the frozen
16.18 Leona SFX banks. Playback derives from saved `leonaRVisuals` facts and uses
the same finite-voice controller as Zenith. Source graph policy is distinct from
the local dispatch, listener mix and admission policies below.

## Frozen source graph and masters

The [graph pin](reference/leona-r-audio.json) preserves three declared play events,
their actions, selected/inherited 20-node graph, nine WEM identities/offsets/hashes,
bank/XML provenance and parser revision. The parent chain 2440→695650395 retains
attenuation 339248780 and unresolved output bus 1259461568.

| Role | Event suffix after `Play_sfx_Leona_` | Gain | Instance cap | Variants |
| --- | --- | ---: | ---: | ---: |
| Cast | `LeonaSolarFlare_OnCast` |−7dB |2 |4 |
| Area | `LeonaSolarFlare_buffactivate` |−5dB |0 |1 |
| Impact | `LeonaSolarFlare_hit` |−1dB |2 |4 |

Cast/impact containers author random mode 1, avoid-repeat 0, one-shot loop count 1,
global/reset flags and `bKillNewest=0`, with explicit parent-limit overrides.
The direct area sound retains its available policy. Cap 0 is bound locally to
unlimited; equal-priority capped voices steal the oldest local voice. Native
global random/shuffle, virtual behavior and cap-zero semantics are unresolved.

No Pitch, play delay or play transition property is authored. Runtime pitch and
onset use explicit local zero defaults. The pin audits all stop actions against
the three R targets and parent 2440: none match, and no R stop event is declared.
This bounded absence does not exclude global/external stopping.

Pinned vgmstream exports mono 44.1kHz finite IEEE float32 WAV with no gain,
normalization, resampling, loop expansion, baked pitch or fade. All nine have no
looping metadata. They total 648,634 frames and 2,594,932 WAV bytes. One sample
exceeds ±1, with peak 1.012442708015442; it remains unchanged. Independent cache
and canonical-graph decodes match all media metadata and WAV/PCM hashes exactly.
The [decode pin](reference/leona-r-audio-decoded.json) retains tool/compiler/static
codec identities and source graph hash. Chrome must preserve every float sample.

## Saved local dispatch and voice lifecycle

An accepted cast emits a caster cue plus one area cue at the fixed ground point.
The area cue represents the shared green/red buffactivate hook once, not one
sound per color alternative. Actual saved impact emits one ground cue, including
an empty impact. These are explicit local choices; names/hooks do not establish
native CPU callsites or timing. There is no per-target R sound or invented stop.

Cast placement follows bounded saved caster poses, including the frozen first
death pose. Area/impact placement stays at the accepted point across caster
Flash, movement and posthumous impact. Each role requires its own creation
audience and current point vision. Hidden creation does not replay after reveal.
Accepted finite cues finish naturally even if death/match end cancels impact.

Deterministic cosmetic variants use source identity/start/role without gameplay
RNG. Sample offset is wall age times playback rate; natural remaining duration
uses the selected clip. The longest source tail is 142 rounded-up ticks, below
the existing 884-tick R retention. No snapshot field/schema is added: schema 126
remains, with a new ruleset for source audio/profile state.

The shared controller borrows decoded finite buffers, owns/disconnects its source
and gain nodes, and remembers finished, stolen, rejected and fallback cast keys
until saved history retires. Mute/current fog releases voices; eligible unfinished
ones resume at current offsets. Terminal playback uses the audio clock while the
winning World snapshot stays fixed. Listener attenuation and 0.2 master multiplier
are local bindings; native bus/listener mix and listening acceptance remain open.

Ordinary Ashe/Lux startup imports no R profile/controller/masters. Load failure
settles once and retains one procedural cast fallback; a late-ready source cast
cannot duplicate it. Area/impact roles remain independent of cast fallback.
Controller updates assume forward-running World/audio clocks. Save/import/restart
construct fresh audio; arbitrary same-controller rewind is outside this contract.

## Verification scope

Seven unit cases cover exact source policy/master hashes, phase placement,
audiences, death/terminal behavior, seek offsets/natural endings, variants,
retention, caps and finite completion. Chrome covers unchanged samples, ordinary
Save/reload/mute, hidden creation/reveal, terminal drain, fallback/lazy loading,
natural completion and real network failure. Zenith cases exercise the shared
controller's existing pitched contact and delayed/faded stop behavior.

The first R network-failure test retained a copied 21-file uniqueness assertion;
it correctly made nine requests and passed after that assertion was corrected.
Strict E2E typechecking also required spreading the heterogeneous readonly
variant tuples into one array; this preserves their source order and values.
Initial failures remain retained separately from final passing evidence.

The full 1,834 unit cases/302 files and three Node QA cases pass. Fourteen unique
Chrome cases pass across the initial 13 successes, corrected failure case and
final typed asset probe; Zenith's seven cases cover the shared controller.
Fresh nested production passes 32 recordings with no development hook or
unrequested Leona preload. The fresh offline manifest contains 1,007 files and
513,067,346 bytes. All offline controls pass with 962 service-worker responses
and no production errors. No new normal-match cohort or CPU benchmark is claimed here;
the prior schema 126 R-history smoke remains historical evidence.

```sh
python3 tools/assets/export-leona-r-audio.py --check
npm run check
npx playwright test e2e/leona-r-audio.spec.ts e2e/leona-r-audio-assets.spec.ts
node tools/qa/verify-leona-r-audio.mjs
```

The [verification record](reference/leona/r-audio-verification.json) freezes source,
decoder inputs, media and acceptance evidence. Use `--historical` after canonical
changes. Source R visual compilation/drawing, native CPU/terrain/matrix/state and
frame/listening comparison, player/support integration and full six-character
delivery remain open. No native game client or Metal shader executes. Nothing
is pushed; the full project goal stays active.
