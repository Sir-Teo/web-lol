# Camera-control build: scoped renderer observation

Two short active/paused/hidden observations import the exact tick-7,200
ordinary seed-26018 checkpoint, with ten champions, under the current simulation
fingerprint. Both observe **zero renders, mixer updates, HUD/audio updates or
simulation steps** during their paused and synthetic-hidden sampling windows.
There are no page errors. Both frozen match audits resume after recorded quiet
sampling pauses.

The benchmark now accepts `--system-chromium` while retaining its existing
Chrome default and URL/output positionals. It records WebGL vendor, renderer,
version, shading language, unmasked backend when available, and timer-query
availability before sampling. The final run uses system Chromium 154.0.8037.57
and reports **ANGLE / Vulkan / SwiftShader Device (Subzero)**, with no
`EXT_disjoint_timer_query_webgl2` extension. This host uses software rendering.

| Final observed state | Wall seconds | Render calls | Simulation steps | Renderer task seconds | Renderer script seconds |
| -------------------- | -----------: | -----------: | ---------------: | --------------------: | ----------------------: |
| Active               |        7.701 |           17 |              102 |                 7.700 |                   0.501 |
| Paused               |        6.003 |            0 |                0 |              0.003687 |                0.000077 |
| Synthetic hidden     |        6.003 |            0 |                0 |              0.062765 |                0.000267 |

The active observation requests a six-second wait; its actual delivery window
is longer and is reported above. Counters span instrumented calls around CDP
setup/drain boundaries. The sample's render-call total is 302.8 ms; it overlaps
other categories and must not be added to task time. It is an application-call
timer, with native/driver work outside JavaScript attribution. CPU sampling is
retained separately and most sampled time is in the profiler's `(program)`
category. That category does not identify a particular GPU, driver or JavaScript
cause. These observations therefore do not justify a targeted code optimization.

This is a short, instrumented development-server observation on one software
backend. Synthetic hidden state tests the application's guard while retaining
the browser's ordinary RAF capability; it does not measure physical tab
presentation or operating-system throttling. There is no measured physical
frame rate, GPU duration, thermal/energy result or acceptance claim for another
device. The full-match performance budget remains open.

## Reproduction and evidence

```sh
npm run dev -- --port 5198 --strictPort
node tools/qa/benchmark-energy.mjs http://127.0.0.1:5198 \
  artifacts/fresh-profile/reading.json --system-chromium
```

The tool reuses `match.snapshot.json` beside its output if present. With no
input there, it creates its existing 120-second ten-champion fixture. This run
instead pins a real cohort checkpoint and removes only its retained file newline
so it can compare the canonical save exactly. No state fields are edited.
Profile output stems must be fresh. Run serially with competing match workers
paused, and retain their pause/resume receipts.

[The ledger](reference/controls-render-observation-verification.json) pins the
input, original and updated benchmark sources, raw readings, CPU profiles and
summaries, logs and receipts. The original sample remains alongside the repeat;
there is no before/after performance-gain claim. Syntax, formatting and the real
updated CLI run pass. This tool/documentation step leaves the application build,
pack `180aadb3005305d4982afdacd9328e58b8b98fc302203f3bffc703a49c8d710e`,
schema 163, simulation fingerprint and saved fields unchanged. The preceding
production/offline evidence retains that exact build.
