# Wuju Style sound playback

The private human/NPC Yi fixtures play both declared finite E onset cues and the
natural-ending cue. Accepted E admits cast and activation together. Q/W pauses
extend the buff's end clock while each recording keeps its own source clock.
Natural expiry admits an ending at the captured point; death, victory and a
replacement E preserve existing finite onsets without inventing an ending.
This is a local lifecycle interpretation of the retained spell bindings; native
callbacks remain unverified. Public selection remains Ashe/Lux.

Schema 153 records the cast rank, point/audience and actual removal with its
paused end clock and separate point/audience. Validation checks active-buff
ownership, chronological casts, exact pause accounting and replacement links.
A captured hidden onset cannot appear through later vision; the ending has its
own audience. Six source WAVs are delivered unchanged, retaining all samples
and headroom. Cosmetic hash choices select from the original two-entry playlists
without gameplay RNG or event/entity IDs and reconstruct exactly after restore.
The native global-shuffle declarations remain separate from that local choice.

Each source container keeps an independent cap of four. Equal-priority local
admission follows event chronology and discards oldest voices. Pause/mute
releases voices; resume seeks each selected source. Generic cast fallback
suppresses only the later duplicate cast, leaving the independently declared
activation and natural ending available after recovery. Failed loads preserve
verified successes; explicit retry fetches only missing masters. Ordinary
Ashe/Lux startup does not load this private source package.

The earlier source audit remains below and in its immutable
[source ledger](reference/masteryi/e-audio-source-verification.json).

The frozen Wuju Style spell explicitly binds three finite cues: cast at suffix
slot 12, `WujuStyleSuperCharged` activation at slot 18 and deactivation at slot 19.
The [source reading](reference/masteryi/e-audio-reading.json) preserves the exact
suffix strings, native playlists, actions, parent properties and six existing
private float masters. This preparation is separate from the accepted
[Wuju Style mechanics](MASTER-YI-E.md); that source checkpoint added no runtime playback.

| Phase | Container | Source gain | Original playlist order |
| --- | ---: | ---: | --- |
| Cast | 9318 | −11 dB | 289182248, 975357315 |
| Activation | 344121187 | −9 dB | 418795702, 209385861 |
| Deactivation | 195063349 | −14 dB | 418782952, 63363042 |

The cast playlist order differs from the sorted hierarchy-node list. The initial
private projection rejected that mistaken assumption; the reading now checks
the stored `CAkPlayList` entries directly, retaining each weight of 50,000.
All three containers declare one play, random mode 1, global voice limits of
four, reset-at-each-play, zero avoid-repeat count and `bKillNewest=0`. The source
policies remain declarations; native shuffle state, choice and admission are
not reconstructed by this source checkpoint.

Container 9318 explicitly authors priority 60 as well as its gain; that field
remains present even though root 1056413114 also declares priority 60. Parent
mixer 210632701 adds no properties. The shared root retains six-point attenuation
339248780 and unresolved output bus 1259461568. Actions add no property/range
modifiers and retain fade-curve value 4. Leaves add no property/range modifiers,
bus overrides or voice limits. The source graph's exact event hashes,
action/node/media closures, ancestry and all playlist entries are checked.

Six mono 44.1 kHz float WAVs total 1,468,612 bytes. One contains samples above
one; the largest absolute peak is 1.0037055015563965. WAV and PCM identities,
headers, format/statistics and the absence of encoded loop points are checked
against the retained canonical software decode. Samples are not clipped,
normalized, resampled, mixed or expanded into loops. At 1× playback speed, the
longest cast, activation and deactivation recordings require 69, 127 and 67
local 60 Hz retention ticks. These are recording bounds, separate from E's
five-second buff and its Q/W pauses or native callback timing.

```sh
python3 tools/assets/prepare-masteryi-e-audio.py
python3 tools/assets/prepare-masteryi-e-audio.py --check
python3 -O tools/assets/prepare-masteryi-e-audio.py --check
python3 tools/assets/test-masteryi-e-audio.py
python3 -O tools/assets/test-masteryi-e-audio.py
```

Thirty-one guards pass per Python mode, covering suffix/event closure, original
playlist order, source priority, gain, fade curve, finite/global/continuous
policies, limits, leaves, source IDs and master integrity. Existing differing
readings reject; a changed projection needs a separate reviewed output path.
This audit infers no particle/contact cue or other native callback. Public media,
playback, simulation state and save format remained unchanged in that source checkpoint.

Actual normal/optimized checks and replays preserve the reading and six selected
masters in bytes and timestamps. At that source checkpoint, application identity remained schema 152 with
the same ruleset and production pack. Exact source archives and staged results
are recorded in the [source verification ledger](reference/masteryi/e-audio-source-verification.json).
The preceding runtime acceptance remains historical evidence for the unchanged
application; this source preparation adds bounded source/master verification.

Runtime reproduction adds:

```sh
python3 tools/assets/export-masteryi-e-audio.py --check
python3 -O tools/assets/export-masteryi-e-audio.py --check
npx vitest run tests/masteryi-e-audio.test.ts tests/masteryi-e-audio-history.test.ts --maxWorkers=1
```

The runtime focused run passes 360 checks across 18 files, covering the new
history/voice tests and existing E/Q/W/R mechanics, audio, particle and loader
checks. The full suite passes 2,752 of 2,755 cases across 368 files; the three
recorded source-artifact baseline failures remain. The original 111,600-tick
wave-clock check passes its unchanged five-second limit. TypeScript/production
build and three Node QA checks pass. Normal/optimized checks and replays preserve
all eight delivery files in bytes and timestamps.

The final Chromium/SwiftShader batch passes all 18 cases with retries disabled:
six E audio, five W audio, six Highlander audio and the existing E/pending Double
Strike private Save/reload case. All six E PCM arrays and source headroom remain
exact in AudioBuffers. Real E input restores the exact future and selected
ending. W pauses E by 240 ticks without restarting/stretching either onset.
One missing master causes a single fallback; retry retains five successful
buffers, fetches one file and preserves the independent activation/ending.
Finite onsets drain once after victory without a new ending or world mutation.
Ordinary startup requests no E masters; late Yi presence fetches each once.

The strict production `/nested/rift/` audit passes all 32 recordings and verifies
zero development E/W WAV preloads, alongside real Lux, ward, Oracle, companion,
restart/restore and opacity checks. Development hooks and private Yi selection
remain absent.

The schema-153 ruleset is
`eafbf4e4a145281648e13196bdf09ce4b7475f558f7e8400cdfc2e65025e9bd9`.
The verified pack is
`cd6d72500d232032a40ed9c52127509b796d60a0fb97ae36d81a249096574885`,
with 1,147 files and 535,472,924 bytes. Exact source archives, staged results and
identities are retained in the
[runtime verification ledger](reference/masteryi/e-audio-verification.json).
These checks establish source-memory/API behavior and bounded regression
coverage, rather than physical listening, native bus/output calibration, device
FPS, the entire browser suite or offline installation.
