# Wuju Style audio declarations

The frozen Wuju Style spell explicitly binds three finite cues: cast at suffix
slot 12, `WujuStyleSuperCharged` activation at slot 18 and deactivation at slot 19.
The [source reading](reference/masteryi/e-audio-reading.json) preserves the exact
suffix strings, native playlists, actions, parent properties and six existing
private float masters. This preparation is separate from the accepted
[Wuju Style mechanics](MASTER-YI-E.md); it adds no runtime playback yet.

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
playback, simulation state and save format remain unchanged in this checkpoint.

Actual normal/optimized checks and replays preserve the reading and six selected
masters in bytes and timestamps. Application identity remains schema 152 with
the same ruleset and production pack. Exact source archives and staged results
are recorded in the [source verification ledger](reference/masteryi/e-audio-source-verification.json).
The preceding runtime acceptance remains historical evidence for the unchanged
application; this source preparation adds bounded source/master verification.
