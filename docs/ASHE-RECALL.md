# Ashe recall animation

The base champion now plays the source Recall sequence instead of looping Channel. The pinned `Characters/Ashe/Animations/Skin0` graph defines a `SequencerClipData` with `Idle5`, then `Idle2`. Both are atomic clips with their original animation files. The complete binary-verified record and CommunityDragon URL are in [the source pin](reference/ashe-model.json); assets and rebuild commands are in [the asset pipeline](ASSETS.md#pinned-base-ashe).

The [Divine Skins animation graph documentation](https://wiki.divineskins.gg/en/docs/lol/animations/animation-bin-clips-and-transitions) describes sequencer clips as ordered playback. This supports the sequence interpretation; it does not verify native transition blending or reference pixels.

Playback uses the actual GLB durations: Idle5 runs for 5.966667175 seconds, then Idle2 begins. The existing eight-second gameplay recall ends before Idle2 finishes. No time stretching or invented repetition is applied. If sampled beyond the sequence, the helper holds its final pose; current gameplay never reaches that case.

The simulation and renderer share the recall duration constant. Rendering derives elapsed time from the saved recall deadline, current simulation tick and interpolation fraction. It seeks one clip directly, without accumulating render time or retaining blend history. This preserves the pose through late rendering, pause and a fresh restored rig. Recalling again starts at zero; cancelling, taking damage or dying returns control to the ordinary animation controller. Active recall takes priority over stale interpolated movement from its starting frame.

Source-order checks validate the two clip names against the pinned graph. Browser checks cover both stages, elapsed phase, exact paused/restored bone transforms, cancellation, restart, completion, damage and death. Locomotion, attack and death phase regressions also pass. Inspected screenshots are stored locally as `artifacts/browser-recall-first.png` and `artifacts/browser-recall-second.png`.

Native entry/sequence transition blending remains uncalibrated. Recall particles, sound, empowered recall and exact reference capture matching remain unfinished. The existing source-hash checkpoint policy still applies: changes to simulation source reject checkpoints from an earlier build even when the snapshot schema is unchanged.
