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
