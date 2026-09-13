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
