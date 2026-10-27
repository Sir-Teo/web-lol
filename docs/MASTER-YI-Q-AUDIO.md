# Alpha Strike sound playback

The private human/NPC Yi fixtures play the two declared Q cast layers and
ordinary contact cues, alongside the [contact renderer](MASTER-YI-Q-CONTACTS.md).
Source declarations and local creation timing remain separate. The earlier
[source preparation](reference/masteryi/q-audio-source-verification.json) retains
the immutable reading and all missing bindings without runtime assumptions.

The complete frozen Q particle package declares `soundOnCreateDefault` on exactly
two of its eight resources. `MasterYi_Q_Cas` names
`Play_sfx_MasterYi_AlphaStrike_missilecast`; `MasterYi_Q_Tar` names
`Play_sfx_MasterYi_AlphaStrike_hit`. The critical target, empty hit resource and
audio-named missile-begin dummy omit this field. Those omissions remain explicit
in the [reading](reference/masteryi/q-audio-reading.json); no critical, dummy or
other callback is inferred from names. Native script timing/creation remains
unverified, separately from these serialized on-create declarations.

| Resource/event layer | Container | Source gain | Pitch modifier | Global voice limit | `bKillNewest` |
| --- | ---: | ---: | --- | ---: | ---: |
| Cast, first action | 8847 | −12 dB | ±100 cents | 3 | 1 |
| Cast, second action | 8848 | −10 dB | ±100 cents | 3 | 0 |
| Ordinary target | 8846 | −11 dB | none | 2 | 0 |

Both cast actions contain one finite recording. The ordinary target retains its
five source playlist entries in their original order, each with stored weight
50,000. Source play actions have no delay/gain modifiers; each container uses one
play, no loop modulation, global limits, random mode 1, reset-at-each-play and
zero avoid-repeat count. The reading retains those raw policies, rather than
substituting a single shared eviction rule. Native RNG and voice arbitration
still require explicit runtime interpretation/calibration.

All three containers inherit through mixer 8845 into 1056413114: priority 60,
six-point attenuation 339248780 and unresolved output bus 1259461568. This is the
same root as Highlander, distinct from the attack-audio root/attenuation. Leaves
add no gain, pitch, bus override or voice limit. The graph event hashes, action
closures, ancestry, properties, playlist order/weights, leaves, media and curve
are independently checked against the frozen graph.

Seven already-decoded private mono 44.1 kHz float masters are copied byte-for-byte
to public source assets, totaling 1,300,172 WAV bytes. Three retain values above
one; the largest absolute peak is 1.039229393005371. These WAVs use the pinned
canonical software decode of the native WEMs; official-client decoder output is
not certified. Samples remain unchanged, with no clipping, normalization,
resampling or embedded-loop interpretation. The slowest authored pitch endpoints
require at most 144 cast-history ticks and 42 hit-history ticks on the local
60 Hz grid. These are finite recording-retention bounds, not native dispatch
durations or recovered spell callbacks.

```sh
python tools/assets/prepare-masteryi-q-audio.py
python tools/assets/prepare-masteryi-q-audio.py --check
python -O tools/assets/prepare-masteryi-q-audio.py --check
python tools/assets/test-masteryi-q-audio.py
python -O tools/assets/test-masteryi-q-audio.py
python tools/assets/export-masteryi-q-audio.py --check
python -O tools/assets/export-masteryi-q-audio.py --check
```

The reading is immutable: a conflict fails before writing; another reviewed
profile needs a separate `--output` path. Twenty-five guards pass in each Python
mode. Helper controls cover missing/ambiguous fields, scalar/ranged properties,
nonfinite values and parent chains. Semantic mutations intentionally bypass the
outer graph checksum to exercise rejection of altered events, media, caps,
eviction flags, weights, routing, action modifiers and invented critical bindings.
Normal/optimized actual source checks also pass. That source preparation left
runtime unchanged; the following schema-149 implementation uses those exact
reviewed declarations.

Immutable identities and source/check evidence:
[verification ledger](reference/masteryi/q-audio-source-verification.json).

## Local playback and saved history

An accepted Q records the logical creation of `Q_Cas` and dispatches its two
finite layers at the same local audio-clock instant. Accepted ordinary contacts
record `Q_Tar` creation before damage/lethal cleanup. Pending/lost marks and
critical contacts create no hit cue. This adapts the existing local Q controller;
native script/particle creation callbacks and frame timing remain unverified.

Each cast history keeps its original target, rank, origin and creation audience,
plus up to four ordinary contacts with their saved mark identities and captured
positions/audiences. The 144-tick source cast bound also covers the latest local
Q contact plus its 42-tick hit tail. History outlives Q recovery and the shorter
visual retention, allowing a save made after visual cleanup to restore the
remaining cast recordings. Death and victory retain already-created finite cues.
The existing terminal presentation clock drains them without changing the
frozen simulation. No extra gameplay IDs or RNG are consumed.

Indexed cosmetic choices select the source playlist entry and pitch. Source
recordings remain at their original rate/PCM; `AudioBufferSourceNode` applies the
chosen playback rate and seeks in source seconds on restore/resume. Seek uses
the actual float32 WebAudio playback rate, preventing drift from a double-precision
rate that the AudioParam cannot retain. Captured
creation points stay fixed. An unseen cast cannot appear later when vision
returns; a known contact can finish at its known point after the final vision
source dies. Native game-object movement, panning, randomness and bus mix remain
unobserved. The local master gain is 0.2 with the retained source gains and
attenuation curve.

The two cast containers independently apply their declared three-voice limits:
one rejects a newest admission, the other evicts an oldest voice. The hit
container retains two voices. Local chronological/tie admission and finished
keys prevent an evicted/rejected cue from appearing on a later frame; they are
not a native DSP arbitration certificate. Pause/mute stops nodes; resume seeks
eligible finite cues. A generic cast fallback consumes both native cast layers
once, while later ordinary contacts remain independently eligible.

All seven masters load only for present/late Yi units. Decoded successful buffers
survive a partial failure; an explicit retry fetches only failed files. Failed
loads do not cause per-frame network retries. The ordinary Ashe/Lux selector
remains unchanged.

The integration also removes redundant fixed-step work: ordinary units skip Yi
contact-state lookups, empty presentation arrays skip no-op filtering, and pose
selection reuses the endpoint movement sample already computed by the updater.
Every animation tick and the full-precision movement threshold remain intact;
boundary tests compare the complete stored pose against a fresh pose selection.
The original wave-clock deadline is retained. Diagnostic CPU profiles and all
intermediate performance failures are kept with the verification evidence.

## Verification

The final full run passes 2,593 tests across 357 files, retaining the same three
pre-existing source-audit failures: the missing Leona reflection reader, original
distortion compiler artifacts and unchanged Lux first-sampler hash mismatch.
The original five-second wave-clock test passes. No deadline, quality setting,
pose golden or assertion tolerance was loosened.

The final TypeScript/production build and 11-case browser batch pass. Browser checks cover exact
PCM hashes/headroom for all seven AudioBuffers, real ordinary/critical keyboard
Q, source-second seek at the applied float32 rate, a save after visual cleanup,
identical later simulation, independent newest/oldest limits, whole-cast fallback,
selective retry, fog/death/terminal tails and the three contact-visual regressions.
The original paused-context and double-versus-float32 seek diagnostics are
retained. Export replays normally and with optimization keep all 17 checked
source/public/generated files unchanged in bytes and timestamps.

The production build under `/nested/rift/` passes all 32 ordinary input recordings,
including purchases and save/restore, with zero unrequested Yi model, attack,
Highlander, Alpha audio or Q contact downloads. Three Node QA checks also pass.
The immutable runtime source and evidence index is
[`q-audio-verification.json`](reference/masteryi/q-audio-verification.json).

This is local Chromium/SwiftShader/API acceptance, not native Riot callback,
official decoder, bus/panning/listening, physical-device, FPS or native frame
parity certification. Source declaration checks remain independently inspectable.
