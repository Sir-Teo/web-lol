# Master Yi primary attack audio

The private human/NPC fixtures play the current ordinary Attack1 and critical
attack from the frozen base SFX banks. Ten source profiles cover two cast cues
and four material branches per impact. Their 24 unique mono 44.1 kHz float WAVs
total 2,242,600 bytes and exactly match the [decoded masters](reference/masteryi/audio-decoded.json).
Loading verifies each WAV's SHA-256 before constructing AudioBuffers directly
from float PCM, preserving source headroom without browser decoder clipping.

The [reading](reference/masteryi/aa-audio-reading.json) preserves raw spell event
suffixes, including the critical hit suffix that lacks `Play_`. Adding that
prefix to resolve its bank event is an explicit local binding policy. Ordinary
cast delay is 50 ms; critical cast delay is 200 ms; impact has no action delay.
Inherited source gains, attenuation, material switches and ordinary ±100/critical
±200 cent pitch ranges remain separate from combat windup and contact clocks.
The current body selection remains Attack1/critical. Attack2, Double Strike's
two-action composite and ability audio require separate dispatch work.

Indexed variant/pitch sampling consumes no combat RNG or entity IDs. Native
shuffle state, bus 211064428, listening/mix calibration and delayed voice-cap
arbitration remain unverified. The adapter uses local queue-time global caps of
two cast/four material-container voices, killing the oldest, and an explicit
0.2 master gain. These choices do not establish native playback equivalence.

Accepted windups capture visibility and target identity. Only real primary
contact captures an impact/material/position and audience, before damage can
kill the target. Cancellation retains a finite cast tail without inventing a
hit; the independent Double Strike child adds no ordinary attack cue. Conservative
history tails include action delay and the slowest pitch endpoint (88 cast/51
hit ticks). Schema 146 validates these histories and preserves exact save futures.
Pause/mute stops voices; resume seeks using the saved clock and selected pitch.
Finite completed voices do not restart, and victory tails use the existing
terminal audio clock without advancing combat.

The resource loads only when Yi is present. Failed loads retain verified buffers
and require explicit retry; the release event uses one existing fallback tone
while unavailable. A swing that used fallback stays suppressed after recovery.
Ordinary production selection remains Ashe/Lux; development URL flags grant no
production access or Yi asset preload.

The shared material lookup also includes later frozen base skins: Leona Metal,
Ahri Flesh and Master Yi Flesh. A separate [source record](reference/champion-attack-materials.json)
preserves these additions while retaining the original 29 mappings unchanged.
Garen's saved attacks now accept these known target rigs using the existing
complete attack-rig enum, with the same identity/material validation. Regressions
first reproduced the rejected Garen save and incorrect Leona Flesh impact, then
cover all nine attacker/target combinations for Garen, Leona and Yi.

Recheck the export without modifying files:

```sh
python tools/assets/export-masteryi-aa-audio.py --check
python -O tools/assets/export-masteryi-aa-audio.py --check
python tools/assets/test-masteryi-aa-audio.py
python -O tools/assets/test-masteryi-aa-audio.py
python tools/assets/export-champion-attack-materials.py --check
python -O tools/assets/export-champion-attack-materials.py --check
python tools/assets/test-champion-attack-materials.py
python -O tools/assets/test-champion-attack-materials.py
npx vitest run tests/masteryi-aa-audio.test.ts tests/masteryi-aa-history.test.ts --maxWorkers=1
```

The final focused run passes 75 cases across six files, including all 18 Leona
contact-history cases after correcting the older Flesh fixture and adding Leona
Metal coverage. Before the material extension, the broad run passed 2,447 cases
with the three established source-audit failures. The final-runtime broad run
passed 2,450 cases with those three failures plus the old Leona/Flesh fixture;
only that test fixture changed afterward. Its original material/pose/future
assertions remain. This is not a clean full-suite certificate. The remaining
baseline failures are the absent Leona native/research input, original distortion
shader artifacts and unchanged Lux sampler digest discrepancy.

Six primary export guards and three supplemental material guards pass in normal
and optimized Python, as do actual export checks without writes. TypeScript,
three Node QA cases and the production build pass. The pack contains 1,098 files
and 528,932,898 bytes. All old public assets retain their original bytes.

Seven final browser cases pass with system Chromium 154 and unchanged assertions
and deadlines: exact float buffers, normal/critical source playback, real Save
match/reload futures, late loading, fog/lethal contact, failed-media retry and
cross-champion materials/saves. An initial batch was interrupted after a late
test spawn omitted rig preparation; its log/trace remain. The corrected setup
loads the rig before adding Yi. Final logs also retain deliberate media-failure
warnings and late Leona loading warnings around reload; no page errors are
accepted. Native listening, hardware/device/FPS and full browser/offline
certification remain open.

The production smoke passes beneath `/nested/rift/`, retaining all 32 ordinary
recordings, real public champion inputs, purchases and restores. Both Yi
development flags remain rejected and no Yi rig or attack WAV preloads. Evidence,
hashes and exact staged results: [verification ledger](reference/masteryi/aa-audio-verification.json).

## Applied-rate seek correction

Attack and critical cast samplers now round the selected playback rate to the
float32 value retained by WebAudio before calculating source-second offsets.
This removes a restore/resume discrepancy without changing source recordings,
authored pitch ranges, delays, contact clocks or saved history shape. The
state/player modules and their runtime dependencies now participate in saved-match
compatibility hashing; the schema remains 149.

The new normal/critical unit regressions failed against the old sampler. A real
normal-attack Save/reload also failed the tightened ten-decimal source-second
check (difference 6.46e-10 seconds). The corrected sampler passes 65 focused
cases across attack history/audio, Q audio and compatibility hashing. The
production build passes. Both normal and critical browser saves retain exact
histories and later simulation; all existing attack-audio browser coverage is
retained. The initial unit fixture sampled beyond a short ordinary clip and was
corrected to use an active source age; that diagnostic is preserved.

Exact source and staged evidence are recorded in the
[seek correction ledger](reference/masteryi/aa-seek-verification.json). The
previous full-suite and production acceptance above are historical results;
this narrow correction does not claim another full-suite or listening certificate.
