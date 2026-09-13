# Ashe source audio investigation

The runtime still uses temporary synthesized feedback in `src/audio/audio.ts`. This investigation prepares source sound banks; it does not claim decoded audio, native mixing or source playback.

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
| `Stop … buffactivate` | Stop action targeting 604153567, TransitionTime 1250 and Linear fade curve |

The pinned parser interprets action DelayTime in milliseconds and Loop 0 as infinite. MakeUpGain values are authored gain parameters, not measured output loudness. No final gain is established until inherited buses, attenuation and native dispatch are reconciled. See the pinned checkout's `wwiser/generator/render/bnode_props.py` and `wwiser/wfnv.py` for the inspected interpretation and hash implementation.

The particle reference explicitly attaches `buffactivate` as the linger system's persistent sound and `hit` as the explosion system's creation sound. Cast/launch event presence establishes available bank events; their exact native dispatch timestamps still require observation. The 1.25-second linger stop transition also means the audio tail cannot simply be removed with the current one-second visual tail. Its eventual runtime lifetime must be independent.

Nine distinct encoded WEM files totaling 218,831 bytes are extracted into `.cache/hawkshot-audio-media`. Extraction verifies complete bank hashes, compares the binary DIDX entries with the parser's media inventory, checks DATA bounds and RIFF/WAVE lengths, and records each media file's absolute bank offset, size and SHA-256. All nine selected sound nodes identify the Vorbis plugin. These encoded files have not been decoded or listened to and are not shipped to the browser.

The graph includes 28 event/action/sound/container/inheritance/attenuation objects. Parent mixers 606977369 and 462566399 and attenuation object 339248780 resolve locally. Output bus 1259461568 does not exist in these two banks and remains explicit as an unresolved hierarchy dependency. Native positional mixing, shared-bus behavior, shuffle state and persistent event stop dispatch remain validation work. Regenerating the graph and media produces identical hashes.
