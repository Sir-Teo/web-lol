# Ashe source audio investigation

The runtime still uses temporary synthesized feedback in `src/audio/audio.ts`. This investigation prepares source sound banks, event mappings and decoded float masters. Native mixing and runtime source playback remain unfinished; the milestones below distinguish each stage.

## Verified inputs

The pinned patch archive `DATA/FINAL/Champions/Ashe.wad.client`, reference 16.18.8175716 and manifest `29CE6E781C3B6368`, contains these two base SFX banks:

| Source under `assets/sounds/wwise2016/sfx/characters/ashe/skins/base/` | Bytes |
|---|---:|
| `ashe_base_sfx_audio.bnk` | 614,312 |
| `ashe_base_sfx_events.bnk` | 8,052 |

The older `assets/sounds/wwise/` names also appear in the broad cached hash index but do not resolve to these pinned archive entries. The archive's resolved paths establish `wwise2016` here. Localized Ashe archives contain voice assets and are not the selected source for these base SFX banks.

Selective extraction reads 742,371 compressed patch bytes including supporting archive data and writes 622,364 bank bytes to `.cache/ashe-audio-sources`. The [extraction manifest](reference/ashe-audio-extraction.json) pins source path hashes, output hashes, the patch manifest and exact compressed chunk ranges/hashes. Source banks stay outside `public/`; no browser asset request changes.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-ashe-audio.py
```

Existing provenance is verified on subsequent runs. The script resolves only the selected names and archive subchunk table; it does not require the moving global path list for replay.

## Bank inspection

The parser is wwiser revision `71654ed1a2c4642894bd7e7ed79eba66986fb770`, reporting v20260808. Its author documents bank parsing and event/container interpretation, while noting incomplete emulation of Wwise features. Parsing a bank is not proof that an isolated decoded sample reproduces an event. [Pinned parser documentation](https://github.com/bnnm/wwiser/blob/71654ed1a2c4642894bd7e7ed79eba66986fb770/README.md)

With that checkout available at `.tools/wwiser`, run:

```sh
python3 tools/assets/inspect-ashe-audio.py
```

The script checks the parser revision and bank hashes, writes a cache-only XML dump, then generates the [inventory](reference/ashe-audio-inventory.json). Both banks report format version 145 and parse without reported errors. The audio bank contains 44 embedded media entries. The event bank contains 55 sound objects, 41 events, 35 play actions, nine stop actions, 18 random/sequence containers and three attenuation objects. These are object counts, not 41 fully mapped effects or 55 unique audio recordings. No companion name database was available during inspection.

## Next playback requirements

1. Resolve the exact named events referenced by the pinned champion/particle records, beginning with Hawkshot cast, travel, arrival and stop behavior. Preserve event IDs and evidence for name resolution.
2. Trace event actions through containers to media IDs. Record simultaneous layers, random/sequence choices, looping, delays, gain, pitch, attenuation, switches and RTPC dependencies. Retain unresolved references explicitly.
3. Extract and decode the referenced media with a pinned decoder, preserving sample rate/channels and source hashes. Inspect duration, levels, loop boundaries and codec behavior; listen to the complete event composition.
4. Bind one-shot and persistent sound lifecycles to simulation events. Restoring a saved match must not replay old one-shots; persistent sounds need explicit stop/pause/recovery behavior. Filter enemy positional audio through the same permitted information boundaries as visual effects.
5. Compare reference timing and mixing, then replace the relevant synthesized cues. Test rapid repeated casts, overlapping events, mute/unmute, focus loss, saves and memory disposal. Do not normalize every sound independently and erase authored relative levels.

Missing shared-bank references, native audio initialization, exact event mappings and listening comparisons remain open. The browser implementation must continue to work without runtime Riot services or remote audio lookups.

## Hawkshot event graph and encoded media

`python3 tools/assets/map-hawkshot-audio.py` now resolves all six Hawkshot event names from the pinned skin/particle reference using the pinned parser's lowercase FNV-1 hash. Each ID exists as a bank event. The [event graph](reference/hawkshot-audio.json) records action order, playback descendants, inherited parameter nodes, every selected parameter field with its tree path, and media provenance. Inheritance traversal does not expand sibling sounds into an event's playback set.

| Event suffix | Verified bank route and authored parameters |
|---|---|
| `OnCast` | Play action → random/shuffle container 3432; three equally weighted entries; action DelayTime 150; container MakeUpGain −12 |
| `OnMissileLaunch` | Two play actions: random/shuffle container 3429 with three equally weighted entries and MakeUpGain −8; sound 921284325, media 61040111, MakeUpGain −26, Loop 0 |
| `hit` | Sound 108015836, media 381540917, MakeUpGain −9 |
| `buffactivate` | Sound 604153567, media 649034525, MakeUpGain −32, Loop 0 |
| `Stop … OnMissileLaunch` | Two stop actions targeting 3429 and 921284325, each TransitionTime 150 and Linear fade curve |
| `Stop … buffactivate` | Stop action targeting 604153567, TransitionTime 1250 and Exp1 fade curve |

The pinned parser interprets action DelayTime in milliseconds and Loop 0 as infinite. MakeUpGain values are authored gain parameters, not measured output loudness. No final gain is established until inherited buses, attenuation and native dispatch are reconciled. See the pinned checkout's `wwiser/generator/render/bnode_props.py` and `wwiser/wfnv.py` for the inspected interpretation and hash implementation.

The particle reference explicitly attaches `buffactivate` as the linger system's persistent sound and `hit` as the explosion system's creation sound. Cast/launch event presence establishes available bank events; their exact native dispatch timestamps still require observation. The 1.25-second linger stop transition also means the audio tail cannot simply be removed with the current one-second visual tail. Its eventual runtime lifetime must be independent.

Nine distinct encoded WEM files totaling 218,831 bytes are extracted into `.cache/hawkshot-audio-media`. Extraction verifies complete bank hashes, compares the binary DIDX entries with the parser's media inventory, checks DATA bounds and RIFF/WAVE lengths, and records each media file's absolute bank offset, size and SHA-256. All nine selected sound nodes identify the Vorbis plugin. These encoded files have not been decoded or listened to and are not shipped to the browser.

The graph includes 28 event/action/sound/container/inheritance/attenuation objects. Parent mixers 606977369 and 462566399 and attenuation object 339248780 resolve locally. Output bus 1259461568 does not exist in these two banks and remains explicit as an unresolved hierarchy dependency. Native positional mixing, shared-bus behavior, shuffle state and persistent event stop dispatch remain validation work. Regenerating the graph and media produces identical hashes.

## Decoded source masters and browser verification

All nine selected recordings now have unnormalized IEEE float32 WAV masters in `.cache/hawkshot-audio-decoded`, superseding the earlier encoded-only milestone. The [decode manifest](reference/hawkshot-audio-decoded.json) records encoded/decoded/PCM hashes, frame counts, sample rates, channels, peaks, RMS, endpoint deltas, complete decoder metadata, and decoder/library provenance. No recordings have been added to `public/` or runtime playback yet.

The decoder is vgmstream revision `e6afeaacf433bfafd38d873f80c94517e09d5b96`, built locally with the existing libvorbis 1.3.7 and libogg 1.3.5. The manifest pins the binary and three linked codec library hashes because revision identity alone does not guarantee bit-identical floating-point decode across platforms. Build follows the project's [CMake instructions](https://github.com/vgmstream/vgmstream/blob/e6afeaacf433bfafd38d873f80c94517e09d5b96/doc/BUILD.md). On this macOS Homebrew setup:

```sh
cmake -S .tools/vgmstream -B .tools/vgmstream/build \
  -DCMAKE_BUILD_TYPE=Release -DCMAKE_EXE_LINKER_FLAGS=-L/opt/homebrew/lib \
  -DBUILD_V123=OFF -DBUILD_AUDACIOUS=OFF -DUSE_FFMPEG=OFF -DUSE_MPEG=OFF \
  -DUSE_G7221=OFF -DUSE_G719=OFF -DUSE_ATRAC9=OFF -DUSE_CELT=OFF -DUSE_SPEEX=OFF
cmake --build .tools/vgmstream/build --target vgmstream_cli -j 8
python3 tools/assets/decode-hawkshot-audio.py
node tools/qa/verify-hawkshot-audio.mjs
```

The CLI target uses an underscore; its output executable is `build/cli/vgmstream-cli`. The decode command uses `-i -W 4`: ignore loop expansion and preserve float samples. No normalization, resampling, downmixing, authored gain or fade is baked into the master.

| Recording group | Frames at 44.1 kHz | Duration |
|---|---:|---:|
| Three cast variants | 38,587 each | 0.875 s each |
| Three launch variants | 165,375 each | 3.750 s each |
| Launch loop, 61040111 | 197,242 | 4.473 s |
| Arrival, 381540917 | 317,887 | 7.208 s |
| Linger loop, 649034525 | 203,769 | 4.621 s |

All are mono and report no embedded loop markers. Bank Loop 0 still requests infinite playback for the two loop sounds; the runtime must reconcile end-to-end looping with native behavior rather than infer WEM loop points that are absent. The arrival recording also outlasts its explosion visual, providing another reason to track audio lifetime independently.

The masters total 5,323,532 bytes. Five recordings contain 22 float samples above unit magnitude in total, with the highest peak approximately 1.0961. A direct 16-bit conversion before applying bank gain would clip these values. Keeping float masters preserves them and leaves authored attenuation to playback. These measurements do not establish audible clipping in League's final mix.

Validation checks source hashes, RIFF chunk bounds/lengths, float format, rate/channels/frame counts, finite samples and non-silence. Repeated decoding yields identical manifest/WAV hashes on this pinned local environment. Chrome 152.0.7977.83 decoded every WAV through a real `OfflineAudioContext` at its source sample rate; the verifier compares the full decoded PCM hash and confirms every float sample, including headroom, matches. It tests decoding only: browser output at a different device sample rate, actual scheduling, loops, native mixing and listening comparison remain outstanding. No claim of auditory review is made.

## First runtime source playback: cast

Hawkshot's cast cue now plays the three verified float recordings with the bank's 150 ms delay and −12 dB MakeUpGain. `tools/assets/export-hawkshot-cast-audio.py` derives the profile from the mapped event/action/container and verifies each shipped WAV against its decoded master. The browser preloads and decodes these three files before the loading screen completes; a failed audio load permits the match to start with the previous synthesized cue.

Runtime scheduling uses the event's simulation tick: late delivery reduces remaining delay or seeks into the recording, and an entirely elapsed sound is skipped. A local equal-weight shuffle bag selects each variant once per bag without consuming gameplay RNG. The shuffle state is presentation-only and is not persisted. Native shuffle scope/order, dispatch timing, positional attenuation and shared output bus behavior remain unverified. The additional master gain 0.2 is explicitly a local mix setting, not a recovered Riot value. This is the cast layer only; launch, arrival and linger source sounds are still pending, and other game cues remain synthesized.

AudioContext suspension now follows match pause, including focus loss and graphics recovery. Serialized suspend/resume operations follow the latest pause intent, preserving scheduled delays and sample positions while the simulation is paused. Mute stops and disconnects all active/scheduled voices immediately; unmuting does not restart them. Ended sources release their gain connections. Construction primes the event cursor from existing history so restoring a checkpoint cannot replay old one-shots. Sounds becoming audible after having been consumed while disabled are not replayed.

Validation: 281 source/simulation checks, seven focused Chrome audio/checkpoint scenarios, production build and a real-input production Hawkshot smoke test pass. The new scenarios inspect real scheduled AudioBufferSourceNodes, variant coverage, delay/seek compensation, authored gain, frozen context time, rapid pause/resume, immediate mute cleanup, source completion, checkpoint-history suppression and missing-source fallback. Full sample browser decoding was verified in the preceding milestone. Profile regeneration is byte-identical. No auditory or native-mix parity claim is made; the full gameplay browser suite and full-match performance benchmark were not repeated.

## Arrival source playback

The arrival recording now plays from a dedicated `scout-arrival` simulation event emitted once when the projectile reaches its endpoint, after the reveal area is created. This corresponds to the source explosion system's `soundOnCreateDefault` binding. The event uses the normal fixed-at-emission audience calculation; a hidden enemy arrival cannot become audible when its location is revealed later. It contains source-unit/team identity and the actual endpoint/tick, and it is transient rather than reconstructed from a lingering visual descriptor on checkpoint restore.

`tools/assets/export-hawkshot-arrival-audio.py` verifies the event→action→sound→media chain, checks the absence of an action DelayTime property, derives the −9 dB MakeUpGain and copies the verified float master to `assets/audio/hawkshot-arrival.wav` (1,271,592 bytes). With no authored action delay present, the adapter starts at arrival. Late frame delivery seeks by simulation age; entirely elapsed recordings are skipped. Native engine dispatch latency remains unmeasured.

The 317,887-frame recording lasts about 7.208 seconds and owns its AudioBufferSourceNode independently of vision and visual descriptors. It finishes naturally after the six-second saved visual lifetime and uses the common pause/mute/disposal behavior. Arrival and cast assets load independently, so failure of one set does not disable the other. A failed arrival load leaves this cue silent and permits the match to continue.

Validation: all 284 source/simulation checks, five focused Chrome audio scenarios, production build and real-input production Hawkshot smoke test pass. New simulation checks verify exact landing tick/endpoint, single emission, non-replay after snapshot restore, and fixed hidden-enemy audience despite later vision. The browser observes the real source node surviving visual retirement and then being released, verifies authored gain/full frame count, and checks late seeking and suppression of an elapsed recording. Export regeneration is byte-identical. The full browser gameplay suite and unchanged model validation were not repeated.

As with cast playback, the master gain 0.2 is a local setting and spatial attenuation/shared-bus behavior remain unresolved. No listening comparison or native audiovisual parity is claimed. Launch layers and persistent linger audio are still pending.

## Persistent linger playback and saved fade

The source linger recording now loops at the endpoint with its authored −32 dB MakeUpGain. `tools/assets/export-hawkshot-linger-audio.py` verifies play/stop action targets, infinite Loop 0, source gain and stop parameters before exporting the 815,120-byte float WAV. It has no embedded loop markers; the adapter uses the complete 203,769-frame recording as an end-to-end loop and restores its phase from simulation age. This loop interpretation and seam quality still need native/listening comparison.

Rechecking the mapped stop action corrected the earlier documentation: its 1,250 ms transition uses curve ID 6, **Exp1**, not Linear. The bank graph always retained the correct value; the summary table above is corrected. The runtime uses the pinned wwiser `bnode_rtpc.py` Exp1 polynomial for normalized fade progress `t`: `1 − 0.5*t*(t+1)`, applied to linear amplitude through a 257-point Web Audio automation curve. At half time the amplitude factor is 0.625. The parser's `hnode_envelope.py` also cautions that TXTP fade reproduction is approximate. Applying this interpolation to action-fade amplitude is explicitly a local interpretation; native mixing domain and curve parity are unverified.

The loop starts fading at the existing five-second scouting stop policy and ends 1.25 seconds later. The shared saved `scoutVisuals` presentation descriptor now retires 6.25 seconds after arrival. Particle births/lifetimes and gameplay sight are unchanged; the last quarter-second retains audio presentation only. Snapshot **version 22** rejects version 21 and validates the new retirement bound. A restore during that final interval reconstructs loop phase and remaining fade without granting sight or replaying the arrival one-shot.

Persistent voices are keyed by flight identity and created only once per active audible interval. Pause freezes context time. Mute immediately stops/disconnects the voice; unmuting rebuilds an eligible persistent loop at current simulation phase. Removal or enemy visibility exclusion disconnects it, and later visibility can resume a currently active persistent loop. Friendly loops remain eligible independent of fog. Natural completion records a finished identity until retirement to prevent a slightly delayed simulation frame from restarting the end of a completed fade. Distinct overlapping casts own separate voices, gain nodes and automation.

All 286 source/simulation checks, ten focused Chrome audio/checkpoint scenarios, production build and real-input production Hawkshot smoke pass. Tests verify source parameters/hash, fade shape, restoration after visual particle expiry, unchanged absence of vision, exact retirement and old-version rejection. Browser checks use real source/gain nodes to verify loop bounds/phase, no duplicate creation, scheduled fade values, pause, mute/resume and exclusion cleanup; existing arrival completion and checkpoint failure behavior pass. Export regeneration is byte-identical. No full-match benchmark or full gameplay browser-suite repeat was performed.

The source cast, arrival and persistent linger cues now have runtime adapters. Launch variants and its separate loop remain pending. Shared-bus gain, spatial attenuation, native stop dispatch/curve semantics and listening comparison remain unresolved; the additional local master gain remains 0.2.

## Flight launch variants and persistent loop

Both source launch actions now have playback adapters: a single 3.75-second launch variant at authored −8 dB MakeUpGain and the separate 4.473-second infinite loop at −26 dB. The four verified float WAVs add 2,773,644 bytes. `tools/assets/export-hawkshot-flight-audio.py` checks the paired play/stop targets, both 150 ms transitions and Linear curve IDs, source infinite loop and shuffle mode, gains and decoded master hashes before shipping them.

The active projectile provides saved launch tick, remaining distance and fixed speed. The adapter predicts the exact arrival tick using the same remaining-distance epsilon as simulation; the saved endpoint descriptor supplies the actual arrival tick after landing. Both layers schedule a 150 ms linear stop fade at that boundary. The non-looping launch recording can finish naturally first on a long flight. The separate loop repeats end-to-end because its WEM has no embedded loop markers. Each flight/layer has its own source, gain, stop automation and completion identity; a completed voice cannot restart while waiting for a delayed simulation frame to retire its state.

Restore and re-entry seek by flight age, using modulo recording duration only for the loop. A deterministic hash of saved flight identity selects a variant without consuming gameplay randomness. This intentionally remains a local approximation of the source equal-weight shuffle container: native cross-cast shuffle scope/order and saved shuffle state are not reproduced. Applying stop at projectile arrival is the current lifecycle interpretation; native event dispatch remains unmeasured.

Friendly flights are eligible throughout travel; enemy flight sounds require current projectile/endpoint visibility. Exclusion or removal stops and disconnects both layers immediately. Pause freezes context time, and mute clears the voices. Eligible unmute/re-entry rebuilds ongoing layers at their current phase; an already-ended launch recording is not restarted. Existing projectile and endpoint fields supply the state, so this change adds no snapshot field or version bump beyond version 22.

All 289 source/simulation checks and the production build pass. Eight distinct Chrome audio scenarios pass across the initial run and focused follow-up: six existing cases and two flight cases. The follow-up changed the test to inspect authored AudioParam scheduling rather than reading its pre-render-quantum default value. New tests verify source files/parameters, exact predicted arrival for short and long flights, preserved state/variant through restore and the nine-tick stop tail. Real AudioBufferSourceNodes verify both layers, source gain scheduling, restore offsets, pause/mute/exclusion cleanup, natural variant completion, 150 ms stop completion and suppression of tail restarts. The real-input production Hawkshot smoke also passes without console/request errors. Export regeneration is byte-identical; full browser gameplay regression and full-match performance were not repeated.

All nine prepared source recordings now have runtime paths across cast, launch, arrival and linger. This is source-event coverage, not native audio parity. Spatial attenuation, shared buses, native shuffle/stop/fade semantics, loop seam and listening comparison, behavior under sustained simulation overload, and broader game audio remain open. The local master gain remains 0.2.
