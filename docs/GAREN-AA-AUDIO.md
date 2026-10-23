# Garen basic attacks: source audio and ordinary swing selection

Garen's development fixture now uses both ordinary source swing animations and
all six declared basic/critical SFX events. Eight play actions expand to seventeen
profiles: separate cast layers, four material branches per hit switch and both
critical layers. Q retains its independent empowered-swing history and audio.
Production selection remains Ashe/Lux; complete Garen/native acceptance is open.

## Frozen source contract

The [bank graph](reference/garen-aa-audio.json) retains 105 hierarchy nodes and
34 unique media records from the frozen Riot Garen SFX banks. The shared mapper
now understands switch-container descendants and retains their complete original
parameters, children, default and branch packages. It does not flatten their
media into an arbitrary random pool. Original bank hashes, event FNV hashes,
actions and DIDX/DATA ranges are verified with the existing extraction/wwiser
pipeline. No native client was executed.

The three hit switches use group ID 1559186049, whose textual name is unresolved.
Their four value IDs exactly match pinned wwiser FNV hashes of `Flesh`, `Metal`,
`Stone` and `Wood`. Flesh is their authored default. The selected basic/critical
spell records all enable `mApplyMaterialOnHitSound`; the
[reading ledger](reference/garen-aa-source-reading.json) links each of 29 current
rigs to its pinned skin `armorMaterial`. The field-to-switch dispatch is a
source-informed reconstruction; the native setter/script remains unavailable.

This matters for ordinary play: blue siege/super minions declare Stone, red
siege/super minions Metal, Blue Sentinel/Krugs Stone and Red Brambleback Wood.
Current champion and most other minion/monster skins declare Flesh. Structures
and Sight Ward declare Stone. Unknown/dummy rigs use the bank's explicit default.
New roster/skin entries still need their own material evidence.

| Source layer | Gain before sound-level makeup | Pitch | Container cap |
| --- | ---: | ---: | ---: |
| Attack1 cast | −18 dB | 0 cents | 2 |
| Attack2 cast | −18 dB | 0 cents | 2 |
| Critical cast, action 0 | −19 dB | −500 cents | 2 |
| Critical cast, action 1 | −13 dB | 0 cents | 2 |
| Attack1 hit, Flesh/Metal/Stone/Wood | −17/−15/−16/−17 dB | 0 cents | 4 per branch |
| Attack2 hit, Flesh/Metal/Stone/Wood | −17/−15/−16/−16 dB | 0 cents | 4 per branch |
| Critical hit, action 0 | −15 dB | −100 cents | 2 |
| Critical hit, material action | −15/−15/−14/−14 dB | 0 cents | 4 per branch |

One critical impact variant adds −3 dB sound-level makeup. Switch and child gains
sum; they are not alternatives. Parent/switch instance limits are zero, while
leaf limits remain separate. Source random/shuffle, equal child weights, global
scope, kill-oldest and one container iteration are retained. No range modifiers,
play delays, embedded loop regions, sound loops or stop actions occur in this
selected closure. Priority is 56; the three-point attenuation 134343538 is distinct
from the ability curves. Output bus 211064428 remains unresolved.

## Source masters and reproduction

The 34 public mono 44.1 kHz IEEE float32 WAVs total **5,088,352 bytes**. Every source
frame and original headroom is retained without normalization, resampling,
gain/pitch baking or fade expansion. The [decoded pin](reference/garen-aa-audio-decoded.json)
records encoded/WAV/PCM hashes, vgmstream/compiler/static-codec provenance, frame
counts and metadata. Repeated material media IDs share one decoded buffer and one
request even when several profiles reference them.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-garen-audio.py
.tools/cdtb-venv/bin/python tools/assets/map-garen-aa-audio.py
.tools/cdtb-venv/bin/python tools/assets/decode-garen-aa-audio.py
.tools/cdtb-venv/bin/python tools/assets/export-garen-aa-audio.py
```

Garen presence loads this resource set; ordinary Ashe/Lux startup skips it.
Concurrent loads share one promise. Failed loads keep successfully decoded
masters and do not retry on frame updates. An explicit load retries only failed
media. Existing generic release feedback remains available while the pack is
unavailable. Session-local swing suppression prevents that fallback from doubling
when source readiness arrives. Later swings can use native recordings. The
user-facing content-pack failure/retry interface remains open.

## Saved swings, contacts and animation

Schema **113** adds ordered `garenAAVisuals` per champion: start/planned-release/
end ticks, selected kind, target identity/team/rig, origin, creation audience,
nullable cancellation and a separately accepted contact with point/material/
audience. It records contact before shield/lethal processing can clear state or
remove vision. The existing release event gains its swing tuple for fallback
coordination; no new gameplay event, ID or World RNG draw is allocated.

The root character record declares two ordinary slots with weights 0.5/0.5.
An indexed visual hash chooses between them independently of combat RNG. The
first spell omits an animation override; the local default remains the pinned
Attack1 clip. Attack2 and Crit explicitly name their clips. The existing critical
combat roll selects Crit. Both normal clips are required at model loading and
the pose selector uses the same saved identity as the sound history. Source
native shuffle/dispatch and complete attack-graph timing remain unverified.
BasicAttack3 exists as a spell/voice reference but is not a declared extra slot in
this root or one of the selected SFX events; its native script usage is unresolved.

Local dispatch starts cast actions at accepted windup and hit actions only at an
accepted melee contact. Cancellation, target loss, stun, death, spell interruption
or victory can cancel a pending contact without inventing a hit. Already accepted
cast one-shots finish naturally; this is explicit policy pending native script
comparison. Q is never reclassified as an ordinary swing.

History remains through the latest of the captured cycle end, start plus 125
source cast ticks, and planned/accepted release plus 84 hit ticks. Tail bounds
include authored pitch. Validation rejects foreign owners, missing active swings,
wrong deterministic kinds, target/rig/team mismatches, invalid audiences, forged
contact/material clocks, cancellation/contact contradictions, reordered/duplicate
records and expired histories. New schemas/fingerprints reject earlier saves.
Combat damage, critical RNG, reach, windup and cooldown rules are unchanged.
The existing full-clip playback-rate policy remains; native contact-frame and
attachment calibration are still required.

## Playback and privacy

Each accepted action retains its own indexed cosmetic variant, source gain,
pitch, distance curve and leaf-container cap. Web Audio playback rate is
`2 ** (pitchCents / 1200)`; seeks convert elapsed seconds into original-buffer
seconds using that rate. Runtime pitch changes do not rewrite decoded PCM.
Critical actions share one context-clock sample per update. Native shuffle,
listener, spatial attachment and bus/mix calibration remain open; monitoring gain
is the existing local 0.2 policy.

Enemy cast playback requires both its saved creation audience and current caster
visibility. A later reveal cannot expose an unseen cast. A fixed contact cue uses
its captured audience and accepted point: a known lethal impact remains audible
after the last local vision source dies, without following hidden target motion.
Pause/mute/reload retain original offsets, voice caps retire oldest local voices,
and finished/stolen keys cannot restart during frozen history. AudioContext time
drains final source tails after victory without changing the saved world.

## Verification scope

The [verification ledger](reference/garen-aa-verification.json) records commands,
source/runtime identities,
float decoding, material/animation routing, cancellations, save/reload,
known/unseen audiences, actual critical pitch/layers, failure retry and finite
victory cleanup. Adjacent passive, Q/W/E/R audio, player controls, selection and
match transfer are included. All **1,422 unit tests across 260 files**, TypeScript,
**50 focused Chrome cases** and nested-path production validation pass. Default
production retains 32 source recordings, ordinary Ashe/Lux selection and no
development hook. Game/Three chunks are **890.26/658.93 KB**, with the size warning
retained. Run `node tools/qa/verify-garen-aa.mjs`.

Full browser, native listening, full-match cadence
and normal-rules match cohorts are not certified by these focused checks.

An initial browser fixture injected Red Brambleback without loading its model.
The corrected fixture explicitly loads its source rig before injection; the
failure log/trace are retained. A source assertion initially assumed Attack1's
animation override existed. The corrected reader retains its absence and records
the local default, rather than inserting a source field. No attack particles,
voice assets or new Garen production-selection entry are claimed here.

The later [basic-attack particle implementation](GAREN-AA-PARTICLES.md) adds
twelve linked emitter adapters and schema-115 pose/visibility history. Audio
retains its independent confirmed contacts and one-shot lifetime; a bound swing
particle stop does not cancel an already accepted sound. Unlinked critical
weapon dispatch and source distortion remain explicitly deferred.
