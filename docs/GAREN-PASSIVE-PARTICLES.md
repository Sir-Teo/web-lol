# Perseverance recovery particles

The Garen development fixture now renders the frozen base `Garen_P_Heal`
`healspark` emitter during passive recovery. This is another part of the Garen
kit; it does not expose Garen in the production roster or certify native parity.
Open `/?scene=fixture&champion=garen` during development and lose health without
an active interruption timer, or wait for the eight-second recovery deadline.

## Source and reproduction

[The source pin](reference/garen-passive-particles.json) resolves three exact
base-skin resources from three skin-linked BINs in the frozen 16.18 Riot archive:
`Garen_P_Heal`, `Garen_P_Boost` and `Garen_Heal`. The extractor decodes the original
BINs with the existing CDTB reader, compares complete definitions and validates
archive/chunk/file provenance. This is static resource inspection; no native
client or particle program was executed.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-garen-passive-particles.py
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/export-garen-passive-particles.py
```

Three TEX images decode losslessly to PNG, retaining source/PNG/RGBA hashes.
Together they occupy 45,862 bytes; only the healing flare and color-bellcurve
images are requested by this renderer. The third image belongs to the deferred
boost trail. Existing filenames are accepted only when decoded pixels agree.

The single recovery emitter retains its six-per-second rate, randomized
one-to-three-second life, upward velocity, per-axis drag, orbital velocity,
spawn-offset multiplier tables, twenty-unit emitter height, twenty-unit base
scale, complete scale/color curves and both age-based lookup coordinates. The
quad retains world orientation, full parent binding and additive alpha-weighted
blending. The [derived profile](../src/content/garen-passive-particles.json) records
all these values without rounding source floats.

The boost resource has one enabled arbitrary trail whose dispatch and bound-size
input remain unresolved, plus one explicitly disabled trail. The `Garen_Heal`
resource has a sound binding and no visual emitters. Audio graph/dispatch remain
open; no new synthesized passive sound substitutes for them.

## Saved lifecycle and rendering

Local dispatch begins a cosmetic interval after a simulation update finds Garen
alive, injured and past the passive interruption deadline. Qualifying damage or
control stops emission immediately. Full recovery stops it after regeneration;
death and victory stop it at their accepted simulation tick. Previously born
sparks finish their source lifetimes at a copied stop point. The current root
follows interpolated Garen position while emission is active. Teleports follow
that fully bound root. Native event dispatch and stop/linger behavior still need
comparison, so these boundaries are explicit reconstruction policies.

Schema 111 saves ordered start/stop clocks and the nullable stop point in
`garenPassiveVisuals`. The source maximum life plus first-update/interpolation
coverage bounds history to 182 ticks after stopping. Validation rejects foreign
owners, future/reordered/overlapping clocks, invalid active/dead/terminal states,
missing or malformed points and expired tails. Effect keys use champion/interval/
birth ordinals, consuming no gameplay IDs or World RNG. Earlier schemas and
fingerprints are incompatible under the same-build save policy.

One fixed-capacity draw per Garen carries independent position, UV, tint and
lookup attributes. Birth sampling visits only the last three seconds even after
long recovery intervals. Rapid recovery toggles remain bounded. Empty effects
release both owned GPU resources; textures are session-owned and borrowed.
Unused slots clear on reverse seeks, so all buffer bytes reconstruct exactly.
The lazy loader shares concurrent requests and retries missing images without
redownloading successful ones. Ordinary Ashe/Lux entry does not load these images.

Enemy effects require current unit visibility and every triangle corner to be
observed. Revealed recovery resumes at its current saved phase. Context recovery
recreates GPU state from these intervals; terminal presentation drains without
advancing or changing the frozen match.

Birth RNG, shared per-axis probability sampling, first-update rate budgeting,
60 Hz linear drag, radians-per-second orbit, source-to-world axes/root height,
quad frame, sampler state and native audiovisual composition remain explicit
calibration limits. These adapters reuse the existing local particle conventions.
Source extraction, independent draw comparisons and browser recovery are not
native runtime captures.

## Validation

The [verification ledger](reference/garen-passive-particles-verification.json)
records all file identities and commands. Run
`node tools/qa/verify-garen-passive-particles.mjs`.
All 1,407 unit tests across 258 files, TypeScript, 22 focused Chrome cases and
nested-path production validation pass. Production retains 32 source recordings
and no development hook or Garen selection. Game/Three chunks are
883.34/658.93 KB; the size warning remains.

Thirteen sustained/stopped/empty samples match separate source quads in every
RGBA byte; the mature sample uses one draw instead of fifteen. The integrated
fixture changes 2,664 framebuffer bytes. Reverse seeking and real context loss
restore every buffer/framebuffer byte and preserve the exact checkpoint.
Fog, full-health/interruption stops, death/terminal tails, disposal, failed-image
retry and rapid-toggle capacity are covered. The recovering Garen capture was
visually reviewed. These checks do not establish native parity or full-match FPS.

The initial reverse-seek failure was repaired by clearing unused buffer slots.
A subsequent recovery-test failure came from reading a non-preserved canvas in
a later task; explicit rendering immediately before readback fixes that probe.
Both original logs and failure traces remain retained. Normal-rules match
cohorts were not rerun for this increment. Earlier schema-110 diagnostics remain
historical, not certification of the changed schema. Six complete champions,
100-seed, native comparison, offline and full-match browser/performance gates
remain open.
