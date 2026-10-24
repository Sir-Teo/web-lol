# Offscreen skeleton CPU work

This follows [health-bar caching](CPU-HEALTH-BARS.md). Feature work remains
deferred while reducing active-game CPU cost.

Unmarked minions and structures now stop pose sampling when their complete
all-animation envelope misses both the display camera and GameView's owned
directional shadow camera. Champions, monsters, wards and unsupported rigs
remain awake. The envelope includes hidden submeshes, normal clip blends,
instance placement, parent scale and authored shear. It reuses the existing
validated source bounds and inflates matrix/union results conservatively.

Sleeping skeletons also pause local/world matrix calculations in private bone
branches. Ancestors of renderable meshes keep updating, preserving ordinary
mesh camera/shadow rejection. Each bone's authored update flags are retained
and restored before sampling on camera return, shadow entry or an attached
Sunlight/Illumination mark. The first pose and newly visible sort-sphere samples
remain awake. Root placement, health bars, effect visibility and simulation
continue normally. No rendering quality setting or gameplay rule changed.

The last sampled offscreen bone pose is intentionally retained. Saved absolute
clip/transition clocks reconstruct the current pose before it becomes observable.
A new live-bone attachment on these unit kinds must be included in the wake guard.
The current model readers were audited; root-only silence labels keep fresh root
placement, and other live-bone readers apply to excluded champion/monster kinds.

## Measured observation

A fresh baseline at aad478c and the final code use the exact same saved
120-second ten-champion Rift state, Chrome 156/M1 and 1440-by-900 viewport.
Both run alone through the same short CPU-profiling tool; its only change adds
the helper to the source-hash manifest.

| Active observation | Baseline | Final |
| --- | ---: | ---: |
| Mean application render call | 6.75 ms | 6.09 ms |
| Renderer task CPU / wall time | 3.798 / 6.231 s | 3.539 / 6.206 s |
| Mixer updates / counted renders | 28583 / 360 | 17516 / 362 |

This sample observes **9.9% less mean render time**,
**6.4% less renderer CPU per wall second**,
and **39.1% fewer counted mixer updates per render**.
Paused and synthetic-hidden states retain zero renders and simulation steps.
The preliminary pose-only sample is retained separately. Short instrumented
timings vary with scheduling/profiling and do not measure physical temperature,
total machine energy, GPU cost or certified display FPS.

## Verification

- TypeScript, all 1,777 unit cases/293 files and three Node QA cases pass.
- Six helper cases cover first samples, current placement/parents, shadow-only
  casters, unsupported rigs, hidden submeshes, sort spheres, shear and bone flags.
- Twenty-four serial Chrome cases pass: all ten champion/minion loop reloads,
  interrupted blends, health labels, sleeping idle states, graphics recovery,
  structure visibility and the new offscreen integration case.
- A minion and turret perform zero mixer updates during twenty sleeping renders;
  marks and shadow entry wake them. After 300 simulation ticks and camera return,
  visible bone matrices and pixels match freshly instantiated rigs exactly.
  The fixture extends only diagnostic pan limits to reach distant test positions.
- Forty paired original/current frames preserve every pixel, visible bone matrix,
  complete label markup and world snapshot. These fixture samples keep their
  original strict comparison; no bone exclusion or pixel tolerance was added.
- Building checks validate 10,231,059 sampled vertices across six source rigs
  and fourteen exact culling camera/shadow pairs, including destruction.
- Production build and nested static-host smoke pass with 32 recordings and no
  development hook. The existing bundle-size warning remains.

Schema **125** and ruleset **`982958c23a5e30418d2a752119a499c15f6f42ac161331de5e7bf70e65cc91c5`**
are unchanged. Asset payloads are unchanged. No fresh offline audit, full browser
suite, full-match/device performance or native-parity certification is claimed.
The previous offline audit applies to its own earlier build.

The [evidence record](reference/offscreen-pose-verification.json) pins
1594 inputs, generated build files, raw profiles/observations and preserved
failed probes. The initial audit used an unresolved bare browser import. The
first shear test omitted the manual-matrix dirty flag; the helper now explicitly
refreshes manual placement. The first camera-return test exceeded fixture pan
limits; its diagnostic view now extends those limits. Those epochs are retained,
and the corrected complete checks use frozen source epoch V4. Existing deferred
Zenith work is preserved. The broader project goal remains active.
