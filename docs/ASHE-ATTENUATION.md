# Hawkshot source attenuation

This isolates the source distance curve from playback placement. The evaluator is not yet connected to the runtime audio graph. No listener position, source-to-world distance scale or native spatial mix has been assumed.

## Source evidence

The [pinned audio graph](reference/hawkshot-audio.json) resolves the Hawkshot sound/container positioning chain through mixer 606977369 to mixer 462566399. The latter overrides parent positioning, enables attenuation and references attenuation object 339248780. Its listener-relative routing flag is enabled, spatialization mode is PositionAndOrientation, and the emitter/listener hold flags and diffraction flag are disabled. The selected sound/container nodes do not override that positioning. Output bus 1259461568 remains unresolved.

The attenuation object contains one six-point curve, with scaling code 2 (`dB`), and no enabled cone or height spread. Its complete 19-entry curve-routing table is preserved without assigning undocumented meaning to every slot. The first three slots select curve 0; the others retain their original negative sentinels.

Wwise's official documentation describes attenuation curves as mapping properties to driver values such as distance from the listener; that establishes the system's role, not League's listener placement or game-specific units. [Audiokinetic attenuation documentation](https://www.audiokinetic.com/library/2019.2.0_7216/?id=applying_distance_based_attenuation&source=Help)

| Source distance | Stored value | Outgoing interpolation | Pinned parser result |
|---|---:|---|---:|
| 0 | 0 | Constant | 0 dB |
| 1,750 | 0 | Log1 | 0 dB |
| 2,000 | −0.7488113641738892 | Log1 | approximately −12 dB |
| 2,300 | −0.93690425157547 | Log1 | approximately −24 dB |
| 2,750 | −1 | Constant | −96.3 dB |
| 3,000 | −1 | Linear | −96.3 dB |

The stored values are not literal decibels. In particular, −1 must not become −1 dB. The checked parser interpolates stored values first, then applies its bank-version-145 scaling interpretation. Log1 uses `(t−3)*t*0.5*(initial−target)+initial`. Scaling clamps the stored value to [−1,1], returns −96.3 dB exactly at −1, otherwise returns `20*log10(value+1)`. The resulting amplitude is `10^(dB/20)`.

These equations come from the pinned wwiser revision `71654ed1a2c4642894bd7e7ed79eba66986fb770`, specifically `wwiser/generator/render/bnode_rtpc.py`. That implementation documents uncertainty in its scaling interpretation. It is an independent reference implementation, not a native-client measurement.

## Reproduction and checks

Run `python3 tools/assets/export-hawkshot-attenuation.py` with the pinned wwiser checkout available. It verifies hierarchy/flags/scaling assumptions, writes `src/content/hawkshot-attenuation.ts`, and generates the [reference sample ledger](reference/hawkshot-attenuation.json). The ledger pins the graph hash, parser revision and exact parser-file hash. Its 86 samples execute the parser's own graph implementation at knots, segment midpoints, a regular distance grid and immediate boundary neighbors.

`src/audio/hawkshot-attenuation.ts` evaluates the prepared curve and validates its distance input. Three focused tests check the source/profile link, compare output against all independent parser samples, and reject negative/nonfinite distances. TypeScript checking passes. Repeated export produces byte-identical profile/reference files. Runtime integration, output playback and the full gameplay suite were not exercised for this isolated data/evaluator step.

The near-floor samples expose an important interpretation limit: at 2,749.999 source units the parser gives about −143.085 dB, but exactly at 2,750 it returns its explicit −96.3 dB floor. The evaluator preserves this reference behavior rather than silently inventing a clamp. This tiny-amplitude discontinuity is not claimed to exist in native League. A future runtime decision must reconcile the native floor/muting rule explicitly.

## Required placement and mixing calibration

Before wiring the curve into live voices, compare a fixed emitter while moving the champion with a locked camera, moving the champion with a fixed free camera, and panning the free camera while the champion remains still. This distinguishes champion-, camera-, and combined-listener behavior. Record distances, camera height/zoom, native audio settings and game patch with the observations.

Then test source heights and both team orientations, compare the 1,750/2,000/2,300/2,750 reference distances after establishing coordinate scale, and resolve the shared bus's gain or dynamic processing. Keep positional gain separate from source MakeUpGain and scheduled lifetime fades so camera movement cannot overwrite a stop fade. Stereo panning, near-floor behavior, loop seams, maximum-distance virtualization and actual listening comparison remain separate unresolved concerns.
