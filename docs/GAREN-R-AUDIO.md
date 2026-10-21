# Demacian Justice source audio

Garen R now uses seven source recordings for accepted cast, recipient hit and a
lethal R result. The cast and hit containers each have three mono variants; the
kill container has one stereo recording. All are unchanged 44.1 kHz float WAV
masters, including values above one. This is a local dispatch/mix adapter, not
native timing or listening certification. Garen remains outside production
selection.

## Source graph and the kill event

The existing frozen Garen audio extraction pins both `Garen_Base_SFX` banks to
Riot 16.18.8175716. The version-145 inventory still has 85 embedded media entries
and 37 declared events. The new `reference/garen-r-audio.json` contains all three
R events, their actions, 19 selected/inherited parameter trees, seven encoded
media entries totaling 222,129 bytes, and unresolved output bus `1259461568`.
Event IDs use the pinned wwiser lowercase UTF-8 FNV-1 implementation; file paths
retain the separate WAD hashing scheme.

| Declared event suffix | Runtime role | Variants/channels | Makeup gain | Global cap |
| --- | --- | --- | ---: | ---: |
| `OnCast` | Accepted R cast | 3 mono | −11 dB | 2 |
| `OnHit` | Valid recipient release | 3 mono | −12 dB | 2 |
| `buffactivate` | Lethal R result | 1 stereo | −13.5 dB | 4 |

The `buffactivate` name alone does not establish a legacy buff callback. The
verified `Garen_R_Champ_Kill` particle's `soundOnCreateDefault` explicitly names
`Play_sfx_Garen_GarenR_buffactivate`. A separate pin,
`reference/garen-r-kill-audio-link.json`, decodes that complete four-emitter
record from the same frozen linked BIN already pinned for R's primary particles.
It retains the source file hash, model/particle pin hashes and exact binding.
The passive notification resources name a different event.

This link establishes the source particle-to-sound dependency; it does **not**
prove when the modern spell script creates that particle. The local adapter plays
its sound only when R's own damage is lethal. The optional `Champ_Kill` particle
system's extra visual layers are not implemented by this audio increment.

All three containers declare equal playlist weights, random/shuffle mode, reset
on play, no avoidance, one play and no continuous sequence. Child sounds have no
extra gain/pitch properties and the masters contain no embedded loops. There are
no declared R stop events/actions. The shared mixer inherits priority 60 and
attenuation `339248780`; its normalized bank-145 distance curve and −96.3 dB
endpoint floor match the existing [Judgment audio](GAREN-E-AUDIO.md) evaluator.
The containers and sounds inherit positioning from that mixer, which declares
listener-relative `PositionAndOrientation` spatialization with attenuation enabled.
The current adapter supplies distance gain and retains the stereo image; it does
not implement that native orientation/panning stage.

## Masters, runtime and persistence

Pinned vgmstream revision `e6afeaacf433bfafd38d873f80c94517e09d5b96`, with the
existing static Ogg/Vorbis toolchain, decodes every WEM using `-i -W 4`. No gain,
normalization, resampling, looping or fades are baked in. The seven float WAVs
total **5,328,644 bytes**. The decoded ledger retains encoded/WAV/PCM hashes,
frame and channel counts, peak/RMS/headroom, complete decoder metadata and the
binary/compiler/static codec hashes. The stereo kill master remains two
independent channels; it is not downmixed to fit the mono cast/hit path.

The controller starts the cast at accepted activation, the hit at a valid
recipient release, and the kill cue at that same release only if the simulation
captures a lethal R result. A canceled cast never gains a hit/kill; a shielded or
invulnerable recipient can still receive a valid released hit presentation.
A recipient dying later, even during the same tick, never changes the recorded
lethal flag. Source event names do not establish native callback timing.

The cast follows the caster's current point and requires caster visibility.
Hit/kill sounds use the frozen release point and retain their release audience.
R only targets an opposing champion, with caster-team sight through its windup:
both participating teams observe its release. This keeps an incoming lethal
cue audible when the victim's last local vision source dies. Later caster fog,
recipient disappearance and caster death do not remove an observed hit/kill tail.
Camera-distance attenuation still applies. Native listener, stereo routing,
panning, virtualization, bus processing and fog-audio behavior remain unverified.

A 0.2 presentation master and 20 ms camera-gain smoothing follow the existing
local mix. The same gain applies to both kill channels. Indexed cosmetic
variants use caster, original start tick and role without consuming simulation
RNG. Equal-priority kill-oldest handling applies the separate global source caps;
native global shuffle/priority behavior is not reproduced.

All three roles are one-shots and finish naturally, including a cast canceled by
caster death. This is an explicit local lifetime policy in the absence of a
declared stop action. Mute releases owned sources/gains; pause suspends the shared
AudioContext. Restored or unmuted voices seek to current simulation age.
Natural completion is remembered while that phase remains live so a frozen
simulation clock cannot restart a finished sound.

R controller/profile code loads through a dynamic import on Garen presence.
Ordinary Ashe/Lux startup adds no R recording requests and retains its 17-file
baseline. An initial Garen roster awaits source readiness or establishes fallback
before becoming ready. A later Garen unit starts the same cached seven-file load.
Failed files preserve the synthesized cast cue without repeated frame-driven
fetches. If a late cast used synthesis while files were loading, that cast's
source recording is suppressed; subsequent source hit/kill cues remain eligible.

Snapshot **79** adds required `killed` to `garenRVisual`, initialized false and
captured immediately after R damage at release. The decoder rejects a pending or
canceled lethal flag, missing fields and the existing foreign/contradictory R
histories. The flag records a past result rather than inferring from mutable
current target health or a kill counter.

The shared presentation retention bound grows from 180 to **303 ticks** after
release/cancellation, the ceiling of the longest source tail (5.03735 seconds).
The exported timing constant is separate from the larger audio profile so the
simulation does not pull the R-only controller/data into ordinary entry loading.
Source particles still expire on their shorter natural lives. The existing
history field name remains `garenRVisual`, and earlier same-build saves remain
incompatible under the existing checkpoint policy. Practice cooldown resets can
replace the single retained R history and retire those tails, as with its particles.

## Reproduction

Use the toolchain from [ASSETS.md](ASSETS.md) and the pinned decoder build in
[GAREN-E-AUDIO.md](GAREN-E-AUDIO.md). No new runtime dependency is required.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-garen-audio.py
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-garen-r-particles.py
PYTHONPATH=.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/pin-garen-r-kill-audio.py
.tools/cdtb-venv/bin/python tools/assets/map-garen-r-audio.py
.tools/cdtb-venv/bin/python tools/assets/decode-garen-r-audio.py
.tools/cdtb-venv/bin/python tools/assets/export-garen-r-audio.py

npm run check -- --maxWorkers=4 --testTimeout=30000
npm run test:browser -- e2e/garen-r-audio-assets.spec.ts e2e/garen-r-audio.spec.ts
```

Judgment and R now share the graph traversal and float-decoding helpers while
retaining separate spell-specific wrappers, caches and explicit export checks.
The complete existing Judgment mapping/decode/export reproduced its original
pins, profile and all thirteen WAVs byte-for-byte after this refactor.

## Validation

Nine new source/state/controller cases check every master and source link,
mono/stereo frame layout, independent roles/anchors/visibility, actual versus
later kills, rejected pending kill flags, full-tail continuation, node ownership,
instance caps, natural-completion deduplication and loading-fallback suppression.
Chrome compares every decoded float sample in all seven recordings, including
both stereo channels and headroom, against the committed PCM bytes. Runtime
scenarios cover cast/hit/kill offsets, no synthetic duplication, pause/mute,
expired particles with live sound, caster death, checkpoint reload, cancellation,
nonfatal/later death, presence-based loading, failed files, incoming lethal fog
and gated late-load fallback.

All 956 source/simulation checks and TypeScript pass with four workers and a
30-second per-test deadline. Under concurrent host load, the existing default
five-second wall limit timed out the long full-Rift/determinism cases; the bounded
rerun covers their full assertions and simulated durations without changing the
committed test configuration. This is not performance certification.

All 43 focused Chrome scenarios pass across R, the existing Garen kit/player/save
surface, Judgment, Hawkshot and Lux audio. The R restore check also waits for
natural Web Audio completion and verifies that an unchanged simulation clock
does not replay completed tails. All 30 GLBs and the map validate without errors
or warnings. Production build and nested-host smoke pass with 17 ordinary startup
recordings and the production Garen gate intact. The R audio controller/profile
occupies a separate 6.72 KB chunk (2.95 KB gzip); the existing large-bundle warning
remains. [PROGRESS.md](PROGRESS.md) retains the broader project acceptance scope.
Native listening/dispatch/bus comparison, the optional kill-particle visuals,
scene distortion, Q/W/basic/voice audio and complete production/full-match
acceptance remain open.
