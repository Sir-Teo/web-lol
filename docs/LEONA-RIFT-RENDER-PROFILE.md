# Leona Rift rendering measurement

The benchmark now accepts explicit development Leona context and player-camera
options. It validates the input through the live battlefield decoder, writes the
canonical checkpoint into the trial's separate save slot, and requires exact
restoration before measuring. Input bytes retain their own SHA-256. This accepts
ordinary file whitespace without weakening version or battlefield validation.
The default ordinary roster still uses its existing save slot and camera policy.

The previous tool could not restore the trial checkpoint: it wrote to the
ordinary slot, and compared canonical saved text against a newline-terminated
input. That failure and the exact original tool are retained. Leona checkpoints
now require the explicit context option. Existing result files are protected
against overwrite; a repeated attempt preserves both report and capture bytes.

## Selected source and scope

The input is seed 26018 at tick 118,800, minute 33, from the verified support
corpus. Selection inspected 43 living-Leona checkpoints after minute ten and
at least two simulation minutes before victory. It ranked other living,
team-visible champions within 1,600 units, then enemy champions, minions and
projectiles, with clock/seed ties. The selected point has four nearby champions,
two enemies, four nearby minions and 133 world unit records. Selection preserves
each checked world exactly. The copied checkpoint SHA-256 is
`52c3e02d8a3470e5e3317b67d5deb62c796574552731197bb576e9d559b60249`.

The camera follows owned Leona throughout the live run. All ten champions keep
their existing AI and match rules. Each run warms 120 frames, then samples 1,800
animation-frame timestamp intervals. A separate run adds GPU elapsed queries.
A fresh two-minute ordinary match confirms default-context restoration and
camera selection. The reports record actual graphics driver and audio context.

These measurements use Apple M1, 16 GiB memory, Chrome 156.0.8078.47, ANGLE Metal,
1920×1080 and display scale one. The Leona capture was visually reviewed: she is
alive near the blue base, with the ongoing structure fight visible. Activity
reaches seven living, team-visible champions in the viewport. Maximum world
projectiles is 32, singularities one and Lux beams zero; these global counters
are not proof that every effect is on screen together.

| Measurement | Median | p95 | p99 |
| --- | ---: | ---: | ---: |
| Leona frame timestamp interval, uninstrumented | 16.7 ms | 16.8 ms | 16.8 ms |
| Leona application render call | 4.4 ms | 7.4 ms | 10.7 ms |
| Leona simulation step | 1.5 ms | 2.5 ms | 4.5 ms |
| Separate GPU elapsed query | 2.72 ms | 5.68 ms | 7.44 ms |
| Ordinary-control frame timestamp interval | 16.7 ms | 16.7 ms | 16.8 ms |

Both Leona runs have two intervals above 25 ms; the ordinary control has zero.
The uninstrumented Leona run has 1,798 render calls, with median/p95 draw calls
117/154 and triangles 243,267/318,974. GPU sampling likewise resolves all 1,798
actual render queries, with no discarded, skipped or unresolved queries. Render
count differs from browser callback count because the application paces renders.

Application render includes fog work; the timers overlap and must not be added.
GPU elapsed includes application commands and possible submission gaps. Frame
timestamps describe browser callbacks, with physical presentation unmeasured.
Audio remains not unlocked in these runs, so this does not measure its runtime
cost. The unchanged source visual quality is retained. This one device/scene
observation leaves complete-match, audio, worst-case effects and device/browser
matrix performance acceptance open.

With the development server running, use fresh output stems:

```sh
node tools/qa/benchmark-rift.mjs http://127.0.0.1:5198 .cache/leona-rift-render-v1-20261025/selected.match.json artifacts/leona-cadence --development-leona --follow-player
node tools/qa/benchmark-rift.mjs http://127.0.0.1:5198 .cache/leona-rift-render-v1-20261025/selected.match.json artifacts/leona-gpu --development-leona --follow-player --gpu
```

Only QA tooling/documentation changes. Shipped schema 130, ruleset
`ca5d6fe53f056aea0943668b0596546e68869e922d4bab91a254888db59931cd`
and pack `ad6604e58b19fa9b8b26cd1519898f3733184607e9094a42543df8037e8b7b6a`
remain unchanged. The [ledger](reference/leona/rift-render-verification.json)
binds exact sources, selected input, failures, measurements and reviewed capture.
