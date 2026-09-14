# Light Binding source audit and root foundation

`reference/lux-binding.json` pins the 16.18 Lux root spell, missile child and shared Flash record, plus the 16.18.1 Data Dragon Q entry. Both binary-export responses were fetched and their hashes verified. The records are separate because their fields are not interchangeable. [Lux spell records](https://raw.communitydragon.org/16.18/game/data/characters/lux/lux.bin.json), [shared spells](https://raw.communitydragon.org/16.18/game/shared.cdtb.bin.json), [Data Dragon Lux](https://ddragon.leagueoflegends.com/cdn/16.18.1/data/en_US/champion/Lux.json)

The Q root spell's standard-mode named values specify 80/120/160/200/240 base damage for ranks 1–5, a 0.75 AP ratio and a two-second root. Its cast time is 0.25 seconds. Data Dragon describes up to two enemy units, with 50 mana and a ten-second cooldown at all ranks. The child missile specifies fixed speed 1,200, width 70, a weapon launch bone and range projection. It also carries older-looking coefficient/cooldown fields (0.9 and 12 seconds), which must not silently replace the parent spell's named damage calculation and Data Dragon cooldown.

Range metadata also differs: parent targeting range 10,000, displayed range 1,175, child range 1,300 and a 1,310-unit client targeter. These fields are preserved as evidence; the final flight distance, collision radius and indicator relationship still need reconciliation. The native secondary-hit mechanism and its visual change after the first hit remain unimplemented. This audit is not a complete projectile specification.

## Shared root state

Units now have a saved `rootUntil` deadline, distinct from `stunUntil`. `World.applyRoot` extends to the later deadline and rejects dead units, structures, invalid durations and ended matches. During root, movement orders remain queued but walking is blocked. In-range attacks, committed attack windups and ordinary spells continue. Expiry restores movement without issuing a replacement order. Respawn clears the deadline. This separation is consistent with Riot's fixes explicitly preserving basic attacks while rooted. [Riot patch 14.7](https://www.leagueoflegends.com/en-au/news/game-updates/patch-14-7-notes/)

Flash's pinned `cantCastWhileRooted` flag now participates in ordinary cast validation, before resource/cooldown consumption. A queued Flash can therefore be rejected if root arrives before execution. The emergency bot planner also avoids selecting Flash while rooted. Unit bars show `ROOTED`, with stun taking precedence when both restrictions overlap.

Snapshot version 35 requires the root deadline and rejects earlier formats. Five simulation scenarios cover saved expiry, attack continuity, non-movement casting, queued Flash validation, overlapping duration and respawn/invalid applications. A browser case checks the actual status, delivered attack and resumed movement; related Flash and save cases pass.

No existing playable spell applies root yet. Lux champion identity, Q dispatch, passive integration and source effects/audio remain next integration work. Tenacity, cleansing, immunity, movement-spell exceptions and root-only interactions with channels/recall have not been audited. The generic deadline is a foundation rather than a complete crowd-control system.

## Binding projectile resolution

`World.releaseLightBinding` now launches a fixed-direction resolution primitive with captured damage. It is not yet connected to champion input, mana, cooldown, windup or passive application. The primitive uses the child missile's 1,200 speed and 1,300 flight range, with width 70 interpreted provisionally as collision radius. These choices make the remaining range/width uncertainty explicit rather than certifying native geometry. Parent rank damage and AP ratio are retained in `content/lux-binding.ts` for the later cast integration.

Each tick sweeps against living enemy non-structures, including minions and practice dummies. Contacts sort by intersection time, then stable unit ID for exact ties. The first two distinct contacts each receive captured magic damage and a two-second root if still alive; the second contact removes the missile. Hits do not apply Ashe's Frost Shot. Allied units and structures do not consume the limit. A caster dying after release does not erase the committed flight. There is no visibility filter on physical collision, so hidden enemies can still be hit.

Snapshot 36 preserves zero or one prior contact for an active binding. It requires an owned champion source, rejects incompatible hit histories, and permits an already removed victim's allocated ID. It rejects ally/structure/projectile IDs where still present, source IDs and unallocated IDs. Five simulation cases cover both teams' saved continuation after caster death, travel-order resolution across a fast tick, minion interception, once-only damage and malformed saves. The browser diagnostic renders the interim generic missile, verifies two roots and an untouched third target. That rendering is not Lux's final source effect.

## Champion-owned Q integration

`World.spawn('champion', team, point, 'lux')` now creates a distinct Lux actor. A normal queued Q cast spends 50 of her mana, begins her own 600-tick cooldown, cancels an unreleased basic attack and recall, faces the aim point and captures rank/AP damage. After 15 ticks it releases the existing two-contact binding. Changing AP during windup does not change that cast's damage. Snapshot 37 preserves the complete windup and validates cast identity. Lux does not require or gain Ashe Focus, and her attacks do not apply Frost Shot.

The runtime plays Lux's `spell1` clip for Q. Binding and basic-attack particles remain generic, audio remains synthesized, and Illumination now applies through the shared passive integration (see `LUX-ILLUMINATION.md`). Collision width/range interpretations and cast-animation event alignment still need native comparison. There is no champion-selection UI or Lux Q AI planner yet; the human remains Ashe. Lux W/E cannot learn or cast until implemented; R now has its own integration (see `LUX-R.md`).

## Source audio graph and decoded masters

`tools/assets/map-lux-binding-audio.py` now resolves all nine Light Binding event registrations in the pinned Skin0 model through the verified Lux base banks. It reuses the Illumination mapper's bank-byte verification, fresh pinned-wwiser parse, object index and independently checked DIDX/DATA boundaries. The resulting `reference/lux-binding-audio.json` preserves 47 event, action, target and inherited nodes with complete parameter paths. Stop actions explicitly identify affected media; they are never classified as playback. Shared parent mixers do not pull unrelated sibling sounds into the extraction.

| Registered event suffix | Action target(s) | Unique affected recordings |
|---|---|---:|
| `LuxLightBinding_OnCast` | 1151 | 3 |
| `LuxLightBindingDummy_OnMissileLaunch` | 1155 | 2 |
| `LuxLightBinding_OnBuffActivate` | 1152 | 2 |
| `LuxLightBinding_OnBuffDeactivate` | 1153 | 3 |
| `LuxLightBindingMis_OnBuffActivate` | 1157 and 994928353 | 4 |
| `LuxLightBindingMis_OnBuffDeactivate` | 1158 | 3 |

These six Play events accompany three Stop events targeting 1152, 1155, and both 1157/994928353 respectively. The cast action stores DelayTime 100 (milliseconds in the pinned reader's delay convention). Stop actions store TransitionTime 150 for activation targets and 3000 for the missile-launch target, with Linear fade-curve value 4. These are source action parameters, not proof of when the native game dispatches each event.

The two deactivation containers use the same three recordings through distinct sound objects. The `Mis_OnBuffActivate` event starts two actions: a three-variant impact container at −12 dB makeup gain and a separate single-recording continuous container 994928353 at −28 dB. That continuous container has loop count 0 and continuous mode enabled. Its WEM has no embedded loop metadata; container repetition must not be inferred solely from WAV loop markers. Cast, ordinary activation, deactivation and missile-launch containers have makeup gains −16, −8, −20 and −7 dB respectively. These values do not include the unresolved shared bus 1259461568 or certify native mixing.

Fourteen unique encoded WEMs total 232,194 bytes. The existing pinned-vgmstream decoder now accepts `--effect binding` while retaining Illumination as its default. The decoded masters are mono 44.1 kHz float32 WAV, total 6,115,248 bytes, and retain above-unit headroom without normalization, resampling, expanded loops or fades. Encoded, WAV and PCM hashes, frame counts, diagnostics, decoder revision and linked library hashes are preserved in `reference/lux-binding-audio-decoded.json`. Source masters remain in the ignored cache; they are not yet shipped or played by the game.

Reproduce after the existing Lux bank extraction:

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/map-lux-binding-audio.py
.tools/cdtb-venv/bin/python tools/assets/decode-lux-illumination-audio.py --effect binding
```

The mapping and decode chain passes twice with byte-identical output. The default Illumination decoder was also rerun and its graph/decoded artifacts remain byte-identical. No runtime behavior changed in this milestone. Exported playback profiles, source dispatch/lifetime integration, browser decoding, attenuation, listening comparison and native mix verification remain outstanding.

## Browser-ready source audio assets

`tools/assets/export-lux-binding-audio.py` now ships the fourteen verified float32 WAVs and generates `src/content/lux-binding-audio.ts`. The exporter verifies the graph/decoded linkage and every WAV's hash and size before writing any payload. The profile retains all nine named events and their ordered Play/Stop actions, source action types, fade curves and raw properties. Seven containers retain playlist order, sound/media identities, listed weights, sound properties, makeup gain, repeat/global/reset/instance policies, loop count and transition settings. Shared media appear once in the asset list; distinct source sound objects remain distinct playlist entries.

Container 994928353 specifically preserves SampleAccurate transition mode 4, infinite continuous repetition (loop count 0), and its stored transition time fields. Runtime code must interpret that mode before using a transition time; the stored 1000 value is not automatically a one-second delay between repeats. Source millisecond properties remain explicitly named `DelayTime` and `TransitionTime` rather than silently becoming seconds.

Run `.tools/cdtb-venv/bin/python tools/assets/export-lux-binding-audio.py` after mapping/decoding. Repeat export produces identical profile and WAV bytes. A new Chrome case fetches all fourteen assets, verifies their SHA-256 hashes, and compares every decoded float sample with the WAV payload; it also verifies frames, rate, channels, duration and source peak. The existing Illumination decode regression passes alongside it. TypeScript and all 790 unit tests pass. The production build and existing nested-path gameplay smoke pass, and all fourteen copied production WAV hashes match their source masters. The smoke's twelve loaded recordings still cover the previously integrated audio; Light Binding runtime loading and playback are not connected by this asset change.

## Source cast playback

A real queued Lux Q now replaces its synthesized cast tone with one of the three source cast recordings. The generated `LUX_BINDING_CAST_AUDIO` profile derives the 100 ms action delay, −16 dB container makeup gain, playlist and selection/instance policy from the verified event graph. Startup loads just those three newly integrated recordings through the configured base path. Other Light Binding event recordings remain exported but do not yet play.

Playback starts after the remaining source delay; late delivery seeks past the delay into the recording, and a fully elapsed recording is skipped. Repeated updates cannot schedule the same transient event twice. Existing event visibility filtering and the audio history cursor still apply. The two-instance source cap uses the same explicit local equal-priority kill-oldest interpretation as passive audio. A generalized cosmetic variant selector preserves the existing passive selection behavior and gives the cast container its own recent-two exclusion state; native shuffle/reset/random-stream equivalence is not claimed.

The binding attenuation export independently checks all selected sound/container positioning inheritance and mixer 1150, then resolves the parent positioning override and attenuation curve through mixer 413871746. Run `.tools/cdtb-venv/bin/python tools/assets/export-lux-illumination-attenuation.py --effect binding` to reproduce the profile and independent pinned-parser samples. The default Illumination export remains byte-identical. Including cast makeup gain, the source evaluator gives −16 dB through 1,750 source units, about −28 dB at 2,000 and −40 dB at 2,300, before the local presentation mix.

As with passive audio, the local listener is the camera ground focus, the emitter stays at its captured event position, and gain updates use 20 ms smoothing and the existing 0.2 presentation mix. Native emitter tracking, listener calibration, shared-bus gain and listening parity remain unverified. Pausing suspends the shared audio context; mute stops and disconnects both pending and playing cast voices. Completion releases ownership. If source loading fails, the existing synthesized cast feedback remains available.

Three added numerical cases compare source linkage and attenuation against the independent parser, including invalid input handling. Three Chrome cases cover actual queued Q dispatch with the 100 ms delay and no synthesized oscillator, delayed-event seek, duplicate suppression, three-variant exclusion, voice stealing, pause/mute, pending-start cancellation, elapsed-event silence and natural completion. All 793 unit tests and fourteen distinct audio browser cases pass, including nine Hawkshot and two passive regressions. Full Light Binding missile/root/release playback and native listening comparison remain outstanding.

The production build/nested-path smoke passes with fifteen integrated source recordings loaded under `/nested/rift/`, including a real Lux Q cast and lane restart. This confirms deployment-path loading and existing gameplay smoke behavior, not native listening equivalence.

## Saved missile stop history

Light Binding now retains a `BindingFlightStop` after projectile removal. It stores the original projectile ID, caster/team, launch origin and tick, stop tick, endpoint and whether the second contact or maximum range stopped flight. On the second contact, the endpoint is the swept-circle intersection within the tick, not the tick's full travel endpoint. This presentation capture does not change damage ordering, root application or the existing two-target limit.

The generated `LUX_BINDING_FLIGHT_AUDIO` profile independently selects launch event/container 1155 and its matching Stop action. It preserves two recordings, −7 dB makeup gain, single-play container policy and the authored three-second Linear stop transition. The recordings are not marked as loops. `LUX_BINDING_STOP_HISTORY_TICKS` retains the stop record for 180 ticks from that transition; a recording can naturally end before the retained deadline.

Snapshot version 64 includes these records and rejects prior formats. Validation checks unique allocated identities (including conflicts with live entities and other retained presentation), champion ownership/team, launch/stop chronology, flight duration, tail expiry, maximum distance, plausible travelled distance and the exact range endpoint for a range stop. Removed projectiles cannot remain live under the same ID. The stopped descriptor survives caster death and serializes without replaying a transient cast event.

Four added simulation cases cover the exact second-contact intersection and untouched third target, actual queued-cast range completion, save/reload through the expiry boundary, a saved live flight finishing after caster death, and malformed identities, ownership, timing and geometry. TypeScript and all 797 unit tests pass. This is the saved lifetime foundation; missile sound scheduling, stopping, visibility and reload playback remain to be connected.

The existing browser binding-resolution case and all three source-cast audio cases pass, as does the production nested-path smoke with fifteen integrated recordings and a real Lux Q cast.
