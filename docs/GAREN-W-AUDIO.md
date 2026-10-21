# Courage source audio

Courage now uses its frozen source cast, sustained and ending recordings in the
development player/NPC fixtures. Eight unchanged float WAVs retain source
headroom, the two active recordings' authored loops, container gains, one child's
extra gain, source voice caps and the active container's stop fade. Native script
dispatch, listening, spatialization and mix comparison remain open. Garen remains
excluded from production selection.

## Frozen graphs and decoded masters

`reference/garen-w-audio.json` selects all four declared Courage SFX events from
the existing version-145 Garen banks at Riot 16.18.8175716. The pinned wwiser
parser resolves event names with its lowercase UTF-8 FNV-1 hash and retains all
22 selected/inherited node parameter trees, actions and eight media entries
(188,941 encoded bytes). Output bus `1259461568` remains unresolved. Names and
bank declarations establish dependencies, not the modern spell script's timing.

| Event suffix | Local role | Variants | Container gain | Global cap |
| --- | --- | ---: | ---: | ---: |
| `OnCast` | Accepted activation | 3 | −15 dB | 2 |
| `OnBuffActivate` | Sustained defense | 2 | −16 dB | 4 |
| `OnBuffDeactivate` | Natural defense expiry | 3 | −17 dB | 4 |
| `Stop…OnBuffActivate` | End sustained defense | Same active container | 250 ms linear fade | Same active cap |

The containers declare equal playlist weights, random/shuffle selection, reset
on play, one container play, no avoidance and no continuous sequence. The active
child sounds explicitly declare `Loop = 0` (unlimited), independently of that
single container play. The cast child carrying media `174925804` has an additional
−0.20000000298 dB makeup gain. The runtime combines that child gain with the
container gain; it is not baked into the WAV or applied to the other variants.

Pinned vgmstream revision `e6afeaacf433bfafd38d873f80c94517e09d5b96` decodes with
`-i -W 4`, preserving the full 44.1 kHz mono masters without normalization,
resampling, loop expansion or fades. Eight WAVs total **4,184,580 bytes**. The
decoded ledger retains encoder/WAV/PCM hashes, frame counts, duration, peak/RMS,
7,351 samples outside the unit range, complete decoder metadata and static codec/
compiler provenance from the existing [audio toolchain](GAREN-E-AUDIO.md).

| Active media | Intro/loop start sample | Exclusive loop end | Full recording |
| --- | ---: | ---: | ---: |
| `88666955` | 26,742 | 219,583 | 220,500 samples |
| `220792549` | 28,276 | 220,402 | 220,500 samples |

The exporter rechecks each encoded WEM's `smpl` chunk. RIFF stores the last loop
sample inclusively; pinned vgmstream `src/meta/wwise.c` already adds one before
`cli/vgmstream_cli_utils.c` exposes the metadata. Web Audio receives that exclusive
end divided by 44,100 with no second increment. Playback retains the intro and
repeats only the declared loop span. Native crossfades and audible loop-boundary
comparison have not been measured.

## Runtime and history

The local adapter starts cast and sustained playback at accepted W activation.
The sustained phase follows the four-second defense buff, independently of the
0.75-second shield/tenacity window or earlier shield depletion. Natural defense
expiry stops the loop with the declared 250 ms fade and starts the ending
one-shot. Death or match end stops the loop with that same fade and does not
create a natural-expiry ending cue. Cast and already-started ending recordings
finish naturally. These dispatch/death policies are local choices; event names
alone do not establish which native buff callbacks own these events.

Schema **80** adds required nullable `garenWVisual`, with original start tick,
nullable stop tick and nullable end reason (`expired`, `death`, `match-end`).
The active interval must match the living Garen's learned W and its gameplay
buff. Stopped history requires a valid exact expiry or an earlier death/match
end, cannot coexist with active Courage, and remains for **189 ticks** after
stop. This covers even the longest cast tail when death occurs immediately
after activation. Earlier saves remain incompatible under the same-build policy.
Practice cooldown resets can replace the single retained W interval.

Restoring/unmuting seeks the original phase, including the loop intro/span and
remaining fade. Source nodes, envelope gains and camera-distance gains are owned
and disconnected on completion, hiding or mute. Scheduled fade end also stops
the looping source. Natural-completion/stolen-voice identities remain remembered
until their history retires, including across fog changes, preventing replay
while the simulation clock is frozen. The result menu suspends the shared audio
context like other menus: paused tails finish only if that context resumes or
are released by mute/page teardown. This increment does not change global menu
audio semantics.

Sounds follow the caster's current ground point. Friendly histories remain
eligible after caster death; enemy histories require current visibility and
resume at their current age if revealed. Variant/suppression histories remain
retained while hidden. Listener position is the camera ground focus, using the
shared source attenuation curve, a local 0.2 master and 20 ms distance smoothing.
Position/orientation panning, bus processing, virtualization, exact native fog
rules and global shuffle/priority remain unverified. Equal-priority kill-oldest
handling interprets the source's separate global voice caps.

Controller/profile code and recordings load through a dynamic import on Garen
presence. Ashe/Lux startup retains its 17-recording baseline. Initial Garen
fixtures await readiness or establish fallback before becoming ready; a late
Garen triggers one cached eight-file load. Failed files preserve synthesized
cast feedback without repeated per-frame requests. A cast synthesized during
late loading suppresses only its later source cast, retaining the sustained and
ending phases. Source-ready casts bypass synthesis.

## Reproduction and validation

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-garen-audio.py
.tools/cdtb-venv/bin/python tools/assets/map-garen-w-audio.py
.tools/cdtb-venv/bin/python tools/assets/decode-garen-w-audio.py
.tools/cdtb-venv/bin/python tools/assets/export-garen-w-audio.py

npm run check -- --maxWorkers=4 --testTimeout=30000
npm run test:browser -- e2e/garen-w-audio-assets.spec.ts e2e/garen-w-audio.spec.ts
```

Eight source/state/controller checks cover all source roles and masters, child
gain, exclusive loops, phase/fade clocks, shield independence, expiry/death/match
end, saved continuation, malformed histories, node ownership, voice caps,
completion deduplication, hidden-history retention and late-load cast suppression.
Chrome compares every decoded float sample against the committed PCM bytes and
exercises real Web Audio loop bounds, source offsets, pause/mute, saved stop fade,
natural completion at a frozen simulation clock, fog, on-presence loading,
failed files and delayed readiness. [PROGRESS.md](PROGRESS.md) records the final
verification scope. Courage particles and full native audiovisual calibration
remain open.

All 966 source/simulation checks and TypeScript pass, along with 44 focused
Chrome cases and the production/nested-host smoke. The twelve mapping, decoded
provenance, profile and WAV outputs reproduce byte-for-byte. W code/data stays
in a separate 8.10 KB chunk (3.38 KB gzip), and ordinary startup remains 17
recordings. Save/transfer verification uses a 60-second browser deadline; the
full check uses four workers and a 30-second per-test deadline. Default test
settings remain unchanged. Native dispatch/loop-boundary listening and complete
production/full-match acceptance remain open.
