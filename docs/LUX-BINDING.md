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

## Source missile playback

`LuxBindingFlightAudio` now plays the two source missile-launch recordings from visible live binding projectiles and retained stop records. Startup loads both through the configured base path. `bindingFlightAudioStates` restores elapsed sample position from the saved launch tick, predicts the unobstructed range deadline while the missile is live, and uses the captured stop tick/point after impact. It clips playback eligibility to the actual recording length as well as the source fade deadline. Recordings play once; the three-second stop fade does not cause a short recording to repeat or extend.

The adapter owns separate source, fade-envelope and spatial-gain nodes. The envelope schedules the source Linear fade and updates when an earlier collision replaces the predicted range stop. Camera/emitter attenuation uses a separate gain node, so its local 20 ms smoothing cannot overwrite the stop ramp. Gain uses the independently verified binding attenuation and −7 dB container makeup gain, followed by the existing 0.2 local mix. While live, the local emitter follows the missile; after removal, it stays at the saved intersection/range endpoint. Native emitter/listener/bus calibration and listening comparison remain unverified.

The runtime supplies the same visible live-projectile policy used by presentation. Stopped friendly flights remain eligible; enemy stops require current point visibility. Removing an eligible record disconnects its nodes. A still-young recording can resume at its saved phase after sight returns or mute is lifted. Pause suspends the shared AudioContext. Natural completion and equal-priority four-instance kill-oldest handling mark the affected ID finished until it leaves the eligible state set, preventing replay on a frozen simulation frame. The adapter releases all three owned nodes on removal, completion, stealing or mute. It does not synthesize a substitute flight sound if loading fails.

Snapshot version 65 adds the selected missile recording (0/1) to live and stopped flights and saves the next selection. With two source variants and avoid-repeat count one, successful launches alternate; rejected launches do not advance selection. The initial choice of zero and world-wide selection scope are local reconstruction policies, not verified native shuffle initialization/scope. Selection consumes no simulation RNG and remains stable across reload. Version 64 and older snapshots are rejected; non-binding projectiles cannot carry this variant field.

Two added numerical cases cover alternating selection across reload, rejected launches, unchanged simulation randomness, invalid selection state, stable range-stop prediction, exact stopped-fade age and natural sample expiry. All 799 unit tests pass. Two new Chrome cases use real Web Audio nodes to verify live playback, offset restoration, impact fade scheduling, independent camera gain, pause/mute, visibility removal/re-entry, voice stealing and completion without frozen-frame replay. The test checks scheduled gain commands because an immediate AudioParam value read can precede the next audio render quantum. Seventeen distinct browser cases pass across missile, cast, binding resolution, Hawkshot and passive audio coverage. The production nested-path smoke passes with seventeen integrated recordings, a real Lux Q cast and lane restart.

Root activation, its continuous layer, deactivation/release audio, native dispatch comparison and full listening parity remain outstanding.

## Complete target-effect source audit

`tools/assets/extract-lux-binding-target.py` verifies the Skin0 `Lux_Q_tar` resource alias and the complete `Lux_Base_Q_tar` definition against the frozen Riot BIN. Cached CDragon JSON supplies names only on the first run; the shared BIN must match its previously pinned bytes/hash, and the decoded record must exactly match the naming seed. Subsequent runs use the committed `reference/lux-binding-target-vfx.json` and the verified archive, so the naming cache is no longer required.

The record has eleven emitters and refers to eleven TEX images and three SCB meshes. All fifteen source files (including the BIN) are retained by hash with frozen manifest/chunk provenance. Eleven lossless PNG mappings preserve decoded RGBA hashes and encoded PNG hashes. Four existing texture outputs are reused; seven new images are exported, and none duplicates the decoded RGBA payload of another existing effects PNG. The three source meshes remain in the verified cache for subsequent topology/UV decoding.

| Source layer | Primitive | Rate / single flag | Explicit particle lifetime | Emitter lifetime / pass |
|---|---|---|---|---|
| `blastring` | Default quad | 1 / false | 0.3 s | 1 s / default |
| `orbitrunes` | Arbitrary quad | 12 / false | 0.5 s | 2.5 s / default |
| `bars` | Arbitrary quad | 100 / false | 0.7 s | 2 s / default |
| `orbitcap1` | Arbitrary quad | 12 / false | 0.5 s | 2.5 s / default |
| `fireCircleTimer`, `fireCircleTimer1` | Portal-edge mesh | 1 / true | Omitted | 2.5 s / 5 |
| `Constelations`, `Constelations1` | Fixed-circle mesh | 1 / true | Omitted | 2.5 s / 550 |
| `energy_Float` | Arbitrary quad | 10 / true | 1.5 s × probability 0.5–1.3 | 1 s / −100 |
| `up_glow` | Cylinder mesh | 3 / true | 0.6 s | 0.1 s / default |
| `up_glow1` | Cylinder mesh | 3 / true | 1 s | 0.1 s / −1 |

Numbers above are rounded for reading; the full record retains exact source floats, probability tables, colors, transforms, texture multiplication, emission flags and unnamed fields. An omitted particle lifetime is not silently replaced with the emitter lifetime. The rune/cap layers use color lookup Y mode 3; bars and energy carry soft-particle settings. Mesh timers multiply by the Q gradient with U scroll −0.48. The late cylinder multiplies by its own cylinder texture with U scroll −0.1. Unknown `{4ffce322}` blocks and the system's `{3aae4707}` value 260 remain unresolved, rather than being labeled as verified distortion or range.

The 128×128 cap texture is white in RGB with alpha 0–175; it is a mask, not an empty white asset. The cap and 256×256 cylinder PNGs were visually inspected, and the complete extraction/verification passes on repeat with identical pinned output. Reproduce with `PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-lux-binding-target.py`.

Unlike the passive detonation record, this target record does not contain an explicit audio event attachment. It therefore does not establish whether native Q target presentation dispatches the ordinary or `Mis` root event family. That mapping, mesh decoding, lookup/soft-particle interpretation, attachment height/orientation, gameplay lifetime control and rendered/native comparison remain outstanding. These assets are not yet a rendered replacement for the target effect.

All three mesh headers identify SCB 3.2 with flags 2: the cylinder reports 40 vertices/40 triangles, the fixed circle 180/240, and the portal-edge circle 300/480. Those header counts do not yet validate topology or UV interpretation. The production build/nested-path smoke passes with the existing seventeen audio recordings, and all eleven production PNG copies match their verified hashes.

## Decoded target meshes and browser packaging

`decode-lux-binding-target-meshes.py` now decodes all three exact SCB 3.2 files using the field layout inspected in LeagueToolkit revision `76bf57bf4fd195343dec610bf0f912a06b910914`. The manifest records that revision and hashes of the inspected reader files; this is a local decoder based on that layout, not an independently executed second decoder. It verifies source file hashes, flags 2, the absent vertex-color block, every face index, finite positions/UVs, complete byte consumption and single-material coverage. All source vertices are referenced. The source headers empirically agree with minimum corner plus extents within float tolerance, rather than minimum/maximum corners. Raw header bounds and central points remain metadata and are not applied as geometry offsets.

`convert-lux-binding-target-meshes.mjs` exports three geometry-only GLBs, totaling 49,652 bytes. Each face corner remains separate to preserve per-face UV seams and triangle order. Positions use the project's 0.01 unit scale with float32 output; no axes, winding, center offsets, emitter rotations or simplification are applied. UV values remain exact float32. No particle texture or material is baked into these reusable meshes. The complete outputs, source linkage, bounds, counts, float-buffer hashes and validation reports are retained in `reference/lux-binding-target-meshes.json`.

Each output passes glTF validation with zero errors/warnings and a NodeIO round trip with exact scaled position/UV values. A Chrome test loads all three through the actual Three.js GLTFLoader and verifies those same values, including interleaved attribute access, corner counts and unindexed topology. The dev-only `tools/qa/lux-binding-target-meshes.html` preview displays UV diagnostic colors and wire edges; its screenshot was inspected. Each object is enlarged to a common viewing size only for that preview, which is not a final effect or native scale comparison.

Run `node tools/assets/convert-lux-binding-target-meshes.mjs` after source extraction. Repeat export produces byte-identical GLBs and manifest. The production build/nested-path smoke passes, and all three production GLB copies match their verified hashes. Particle materials, mesh-emitter transforms, gameplay attachment/lifetime and native effect comparison remain outstanding.

## Target color lookup interpretation

The pinned ltk-manager reader identifies lookup selectors 0/1/2/3 as constant, normalized particle lifetime, measured travel speed and birth random respectively. Constant returns the authored scale alone and ignores offset; other selectors apply scale and offset. Velocity uses actual travel in source units per second, without an implicit normalization divisor. Birth random is fixed for that particle, so the Y mode 3 used by `orbitrunes`, `bars` and `orbitcap1` must not be animated with particle age.

`tools/assets/verify-particle-color-lookup.mjs` fetches and checks the inspected `enums.ts`, `colorLookup.ts` and `readVfxSystem.ts` at revision `65a7d2a746b9d02d65dab788b5f7b8198d5e555e`. It executes the reference lookup implementation to produce sixteen comparison cases, retaining file URLs/hashes and outputs in `reference/particle-color-lookup.json`. The target-specific export `LUX_BINDING_TARGET_LOOKUPS` retains all eleven emitter names, lookup texture paths, selectors, scales and offsets, with source-reader defaults of lifetime X, constant Y, scales [1,1] and offsets [0,0]. Its generated header identifies the complete target record by hash.

`particleColorLookup` implements those four selectors without prematurely clamping coordinates. It expects the caller's final measured travel and retained birth draw; input precision is left to that caller and GPU attributes perform float32 conversion. Unknown selectors are rejected. Existing passive detonation appearance now uses this shared evaluator for its supported constant/lifetime modes; its guard still requires explicit integration before adding any motion-driven selector there.

Three added numerical cases verify the independently executed comparison samples at GPU float precision, target rune/bar birth-color stability while lifetime advances, non-clamped coordinates, constant-offset behavior and unknown-selector rejection. TypeScript and all 802 unit tests pass. Five passive detonation browser cases pass, including rendered layers, seekable geometry, saved gameplay continuation and visibility. The target effect is still not rendered: birth-draw provenance, all remaining appearance/motion settings, soft particles, mesh transforms, attachment and native comparison remain outstanding.

The production build/nested-path smoke also passes with all seventeen integrated audio recordings and real Lux Q gameplay.

## Hashed-field resolution and lifetime default

A follow-up audit found that the first lookup export incorrectly defaulted the two `fireCircleTimer` layers' scales to [1,1]: their authored `colorLookUpScales` remained under hash `{f02bd44d}` in the source JSON. The exporter now reads named or hashed fields using League BIN's lowercase FNV-1a names, rejects duplicate representations, and retains the exact values [0.30000001192092896, 0.6000000238418579]. These particular mesh layers have no lookup texture, so this repairs source-profile completeness without claiming a current visible color change.

`audit-lux-binding-target-fields.mjs` checks three pinned reader files against their inspected cache, resolves only names explicitly declared through `nameHash`, and retains source file hashes and declaration lines. `reference/lux-binding-target-fields.json` contains the original target pin's hash, thirteen resolved names, a derived readable definition and the still-unresolved field hashes. The original verified BIN definition remains unchanged.

| Hash | Reader field name |
|---|---|
| `{264afd39}` | `uvMode` |
| `{27d40903}` | `isGroundLayer` |
| `{2b32227b}` | `erosionMapAddressMode` |
| `{324f9f10}` | `texAddressModeBase` |
| `{6563bee8}` | `miscRenderFlags` |
| `{6b89d541}` | `beginIn` |
| `{76f8ad24}` | `startFrame` |
| `{7c7970d8}` | `erosionSliceWidth` |
| `{a6630e0a}` | `uvScrollClamp` |
| `{b9198a2a}` | `birthUVOffset` |
| `{b99310f4}` | `alphaRef` |
| `{cfb707de}` | `birthUvScrollRate` |
| `{f02bd44d}` | `colorLookUpScales` |

The verified `readValue.ts` defaults an omitted particle lifetime to three seconds. That is the reference reader's particle default, not the emitter's 2.5-second duration and not an independently observed native lifetime. The four single-particle ring emitters omit their particle lifetime. Their eventual gameplay stop/linger behavior still needs implementation and native comparison. Resolving names also does not prove that the clone already implements ground-layer placement, render flags, erosion, addressing or soft-particle behavior.

Five field hashes remain unresolved: `{3aae4707}`, `{4ffce322}`, `{95111b29}`, `{c0bf561e}` and `{dddde180}`. Unnamed type identifiers are also retained. Reproduce with `node tools/assets/audit-lux-binding-target-fields.mjs` and `node tools/assets/verify-particle-color-lookup.mjs`; repeat output is byte-identical. A regression case verifies the hashed timer scales against the original source record. TypeScript and all 803 unit tests pass. Target rendering remains unfinished.

The production build also passes. This step changes source metadata/export handling rather than the live target renderer.
