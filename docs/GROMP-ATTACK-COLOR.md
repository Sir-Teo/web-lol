# Gromp missile float32 color and truncating packets

All four missile emitters now use the checked conditional Complex color policy.
The first three sample precompiled float32 raw keys; trailorbs keeps its constant
white base. CameraQuad and plane batches store normalized BGRA bytes and decode
those channels in the shared particle shader. Modes 0 and 2 premultiply float32
RGB by alpha and replace alpha with one before truncating; mode 4 keeps alpha.

The [original source reading](NATIVE-GROMP-ATTACK-COLORS.md) restores
1,114 original Troy bytes and replays the checked loader/primitive/color paths.
Its source keys and instruction lineage distinguish this truncating path from
the separate rounded Ray path. Local phases, RNG, motion, geometry, UVs and
framebuffer blend factors retain their existing policies.

An independent host-C reference parses original source strings with `sscanf`,
prepares and samples float32 keys with FMA contraction disabled, then performs
source-mode premultiplication and truncating BGRA conversion. It neither imports
production TypeScript nor executes native game code. Fixed fixtures cover 48
profile/phase combinations; seven additional unit cases check premultiplication,
borrowing, mode scope and the actual material decoder.

The whole-sampler comparison checks 5,058 calls over varied projectile identities,
launch clocks and stop times. All 10,666 particle states retain every noncolor
field exactly and match C raw colors and packed bytes. Another 4,035 knot-adjacent
and deterministic random phases match C. There are 1,620 changed float32 color
states and 6,234 differences from the former float attribute channel values.
This is a conditional color correction, not a claim of full native appearance.

The four color buffers retain six local vertices per particle. Each tint changes
from 16 to 4 bytes per vertex, saving 72 bytes per particle slot. The existing
21-slot total capacity across one projectile's four batches changes from 2,016
to 504 color bytes, saving 1,512 bytes. Geometry, texture storage and draw counts
are unchanged. No frame-rate improvement is claimed.

The browser proof uses actual batches and source textures at seven times, three
views, two target sizes and both runtime/raw blend settings for each emitter.
All **336 comparisons contribute pixels and match C exactly**. The reference
expands C bytes into float RGBA and bypasses both the production byte writer
and BGRA shader decoder. The former float path changes 44,046 channel bytes
across these probes; the constant-white trail has zero differences. These are
isolated diagnostic comparisons, not registered native screenshots.

The initial batch passed seven cases and failed one probe's visibility assertion:
two edge-on flare views at 64 pixels were empty, while all C comparisons were
already exact. The final probe derives oblique views from the actual plane
geometry, retaining the complete batch and every nonempty/pixel assertion.
The final eight-case batch passes, including real flight/Flash/reset, fog,
byte-exact save/reload, buffer retirement and death-layer regression checks.
No runtime geometry, camera or arithmetic changed to repair the probe.

The full unit run has **3,379 passing tests out of 3,381 across 400 files**.
The two unchanged baseline failures retain their original assertions: missing
Leona Eclipse evidence and the host-sensitive Lux missile digest. All 256
focused tests across eight files, TypeScript and 16 Node QA checks pass.
The build, all 32 nested-path production scenarios and the complete offline
audit pass for pack `556315eb1be84a02ce411b2e5aa339a80c0990e5913b80f6820f8e9e206edf88`
(1,202 files / 538,092,670 bytes). Offline integrity failure, cancellation/retry,
saved-tick restore, a new Lux lane match and atomic version activation pass with
978 service-worker responses and zero page errors. All 1,125 public asset/data
file sizes and mtimes and all 539 cohort input hashes remain unchanged.
Schema 163 and rules fingerprint
`1a1c286c5148bc1fef511cbf6ac28915e3638c0cd8834faed99ee2bc10fbb7d6`
are unchanged. The [verification ledger](reference/gromp-attack-color-verification.json)
retains this fresh application acceptance.

```sh
node tools/qa/verify-gromp-attack-color.mjs --output-dir .cache/fresh-missile-color
npx vitest run tests/gromp-attack-color.test.ts tests/gromp-attack.test.ts --maxWorkers=1
npx playwright test e2e/gromp-attack-color.spec.ts e2e/gromp-attack.spec.ts e2e/gromp-death.spec.ts --workers=1
```

The original source record, independent reference source/compiler identity,
input freezes, early failure, final comparisons and fresh application identity
are retained in the ledger. Native phase construction, cache backing modes,
external modifiers, FPCR, admission and final composition remain unobserved.
Root/gravity/height, impact effects and audio remain unfinished.
