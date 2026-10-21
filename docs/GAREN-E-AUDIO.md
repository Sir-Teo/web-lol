# Judgment source audio

Garen's E now uses source recordings for cast, active spin, ending and individual
hit cues in the development fixtures. Recordings load when a Garen unit is present.
The ordinary Ashe/Lux entry retains its existing 17-recording startup; Garen adds
13 files only when needed. Garen remains excluded from production selection.
An initial Garen roster finishes loading those recordings, or establishes fallback,
before the game becomes ready. Garen introduced later starts the same cached load.

## Source evidence

The frozen Riot 16.18.8175716 Garen archive contains the two banks declared by
`Garen_Base_SFX` in the verified skin record. `garen-audio-extraction.json` retains
archive/chunk/file hashes. Neither voice-over nor other skins are included.
Pinned wwiser revision `71654ed1a2c4642894bd7e7ed79eba66986fb770` parses bank version
145: 85 embedded media entries and 37 declared events. The names come from the
skin; lowercase UTF-8 FNV-1 IDs resolve them to bank events.

`garen-e-audio.json` retains all six Judgment play/stop events, their actions,
32 selected/inherited parameter trees and the 13 referenced media entries.
Playback traversal follows action targets and container children. Parent/bus
traversal retains policy without decoding unrelated siblings. DIDX/DATA boundaries
are checked directly against the parser's media inventory. Encoded media total
236,073 bytes.

| Source event suffix | Variants | Makeup gain | Global instance cap |
| --- | ---: | ---: | ---: |
| `OnCast` | 3 | −14 dB | 2 |
| `OnBuffActivate` | 3 | −12 dB | 4 |
| `OnBuffDeactivate` | 3 | −19 dB | 4 |
| `hit` | 4 | −19 dB | 2 |

All four containers declare equal weights, random/shuffle mode, reset on each
play, zero avoidance, a single play and no continuous sequence. The masters have
no embedded loop. `Stop_*_OnBuffActivate` targets only the active container and
declares a linear 800 ms transition. `Stop_*_OnBuffDeactivate` targets the ending
container and declares a separate linear 125 ms transition.

The inherited attenuation is ID `339248780`, scaling 2, with source-distance
knots at 0, 1750, 2000, 2300, 2750 and 3000. It uses the existing verified bank-145
normalized-value evaluator. Camera ground focus, 0.2 presentation master, mono
distance gain and 20 ms camera smoothing are local mix choices. Native listener,
panning, priority/virtualization and output bus `1259461568` remain unverified.

## Decoding and runtime policy

vgmstream revision `e6afeaacf433bfafd38d873f80c94517e09d5b96` decodes the WEMs with
`-i -W 4`, preserving 44.1 kHz mono float samples. No normalization, gain,
resampling, loop expansion or fades are baked into the masters. Peaks range above
1, so integer conversion would lose headroom. The 13 checked-in WAVs total
5,088,904 bytes. `garen-e-audio-decoded.json` records source/WAV/PCM hashes, full
decoder metadata, sample counts, peak/RMS, endpoint deltas and compiler/binary/
static codec hashes. This authoring build uses libogg 1.3.5 and libvorbis 1.3.7.

The local dispatch adapter starts cast and active recordings at accepted E
activation. It plays each selected clip once. Natural completion, recast or R
starts an ending recording and applies the active container's stop fade. Death at
the E stop suppresses a fresh ending; death during an existing ending applies its
125 ms stop fade. Cast recordings finish naturally. These callback/death choices
are explicit local policies; bank event names do not prove native script timing.

Variant choice is an indexed cosmetic hash of unit, original activation tick and
role. Hits use their event identity. It never consumes simulation RNG. Equal
priority kill-oldest handling implements the separate global source caps; native
shuffle/priority/bus parity is not claimed. One `judgment-hit` event is emitted
per eligible recipient contact, including shielded contacts. Event audience is
captured at contact, and new hits are not replayed after reload.

The controller follows visible casters, suppresses hidden-owner phases, and owns
its sources/envelope/spatial nodes. Mute releases those nodes. Pause suspends the
shared AudioContext. Recreated phase voices seek to simulation age and use the
remaining stop envelope. Source-ready E casts bypass the old synthesized cue;
missing recordings preserve that fallback without retrying every frame.

Snapshot version 77 extends the shared `garenEVisual` presentation interval to
154 ticks after stop (the ceiling of the largest cast/ending tail bound). Source
particles still expire on their own shorter caps. This permits audio continuation
after the particles disappear, including an R interruption just after E starts.
Existing ownership, chronology and stopped-interval validation uses the extended
bound. Older builds remain incompatible under the same-build checkpoint policy.

## Reproduction

Install the pinned CDTB environment from [ASSETS.md](ASSETS.md). The wwiser and
vgmstream revisions above match the existing Ashe/Lux pipeline. This decoder
expects the pinned Ogg source in `.tools/vgmstream/dependencies/ogg` at
`fa80aae9d50096160f2b56ada35527d7aee3f746`, and Vorbis in `.tools/vorbis` at
`2eac96b03ff67953354cb0a649c08aa3a23267ef`. The Xiph GitHub mirrors carry these
same commits when the GitLab fetch is unavailable. Configure the local static
codec build with the existing optional-codec exclusions:

```sh
cmake -S .tools/vgmstream -B .tools/vgmstream/build \
  -DCMAKE_BUILD_TYPE=Release -DBUILD_V123=OFF -DBUILD_AUDACIOUS=OFF \
  -DUSE_FFMPEG=OFF -DUSE_MPEG=OFF -DUSE_G7221=OFF -DUSE_G719=OFF \
  -DUSE_ATRAC9=OFF -DUSE_CELT=OFF -DUSE_SPEEX=OFF \
  -DOGG_PATH="$PWD/.tools/vgmstream/dependencies/ogg" \
  -DVORBIS_PATH="$PWD/.tools/vorbis"
cmake --build .tools/vgmstream/build --target vgmstream_cli -j 8
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-garen-audio.py
.tools/cdtb-venv/bin/python tools/assets/map-garen-e-audio.py
.tools/cdtb-venv/bin/python tools/assets/decode-garen-e-audio.py
.tools/cdtb-venv/bin/python tools/assets/export-garen-e-audio.py
```

The mapper regenerates the bank inventory from verified bytes. Masters remain in
the ignored source cache as well as the unchanged selected public recordings.
Native listening/composition comparison, Q/W/R and basic-attack source audio,
complete Garen presentation and full-match certification remain open.

## Validation

All 928 source/simulation tests and TypeScript pass. Eight new tests cover exact
source/master/profile hashes and float headers, phase/variant reconstruction,
separate stop fades, contact audience, extended checkpoint continuation, node
ownership, global caps and hit deduplication/expiry.

All 23 focused Chrome cases pass across Judgment, Garen controls/particles,
Hawkshot, Light Binding and Illumination audio. Chrome decodes every sample of
all 13 WAVs identically, including headroom above one. Runtime probes cover source
offsets, no synth duplication, hit cues, fades, pause/mute, hidden casters,
on-presence loading and failed-file fallback. The existing Hawkshot arrival
test now explicitly expires its simulation descriptor before waiting for natural
Web Audio completion, avoiding an assumption that those two clocks advance
together under load.

Production build/nested static-host smoke passes with 17 ordinary startup
recordings and the production Garen gate intact. The existing large-bundle warning
remains. Native listening/dispatch/complete mix comparison remains unverified.
