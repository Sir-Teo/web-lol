# Oracle Lens

Oracle Lens is available as a free trinket swap at the fountain or while dead.
Press **4**, or click its separate HUD slot, to scan for eight seconds. Enemy
wards in range become targetable and lose their sight until the last overlapping
scan leaves or ends. Hidden champions produce sampled silhouettes with no health
bars or ordinary targetability. Saves use schema 104.

The original scanner and all selected particle dependencies are pinned and
converted. The runtime currently draws the scanner and radar, with local ground
projection and a thin range guide. Ten other Buff emitters, Alert/Death systems,
audio and native visual calibration remain unfinished. These are foundations for
the full match goal, not native parity or full-match acceptance.

## Runtime and local policies

The shop prepares the selected scanner/radar assets before committing a swap,
serializes pending purchase/swap clicks, and checks fountain access again after
loading. Failure changes no equipment, resources or saved state. Successful
preparation is reused. Unselected Oracle assets do not preload. A restored Oracle
or an active scan prepares its assets before play resumes.

Swapping preserves stock and the existing short cooldown. It transfers fractional
completed recharge work into a newly captured interval for the selected trinket;
the remaining deadline rounds up. Repeated swaps cannot refill stock or advance
completed work. A pending Ward approach stops on swap, while an already committed
Ward delivery remains independent. Swaps do not occupy a six-item bag slot.

The following are explicit adapters while native dispatch remains unrecovered:

- Radius and each new recharge span interpolate the frozen endpoints using the
  average level of all existing champions, including dead champions. Each capture
  keeps its original values through later level changes. Startup inherits the
  default Ward's one charge and completed recharge fraction.
- Ward detection is continuous within the captured radius, independent of
  terrain/brush sight. It grants direct ward visibility to the scanning team and
  removes that ward from its owner's ordinary vision sources. It does not reveal
  ground, stop ward expiry or make other enemies ordinarily visible. Multiple
  scans disable the ward until the last one leaves or ends.
- Hidden enemy champions within the radius are sampled every 30 ticks. Each
  sample retains position, facing, scan origin and its 30-tick deadline. The view
  draws a frozen source idle silhouette at that saved position, overlaid across
  occluding terrain/vegetation. It supplies no live tracking/animation, health
  bar, minimap marker, selection or attack target. This
  presentation is a local approximation, not the native outline shader/cadence.
- Activation begins on the accepted command tick. Casting permits root/silence
  and rejects stun, death, wrong equipment, empty stock and the short cooldown. It preserves current orders and Recall. A second
  accepted activation spends another charge and replaces the first scan.
- Committed scans follow their owner and survive swaps, death and practice
  refill until their original eight-second deadline. Persist-script metadata
  supports a candidate death-persistence binding but does not establish native
  active dispatch. The existing provisional two-second Ward hit-reveal policy
  remains; exact Oracle-owner-specific hit continuation is still unverified.
- Practice cooldown reset refills the current trinket and clears its resource
  cooldowns while preserving active scans and committed Ward deliveries.

Schema 104 requires equipment kind, the captured recharge duration and starting
progress, and nullable scan/pulse/sample state. The actual first sample time is retained;
an activation accepted between ticks can first sample on the next tick. Expired
samples are removed before combat, so a match-ending Nexus hit cannot freeze an
expired sample. A match that ends before its initial sample retains a valid
pending clock without inventing a sample. Validation checks stock/clock
consistency, exact remaining deadlines, scan duration and radius bounds, pulse
phase, last-pulse sample identity, opposing champion targets, captured range,
unique target samples and expiry. Scan ownership is its enclosing champion state;
an active scan can legitimately remain while a Ward is equipped. Earlier schemas
and fingerprints remain incompatible.

## Evidence and boundaries

[The source pin](reference/oracle-lens-source.json) retains 21 original
Global archive members, totaling 1,308,124 raw bytes, from the fixed
16.18.8175716 manifest `29CE6E781C3B6368`. These include the skinned floating
scanner, its skeleton and animation, three SCB meshes and fifteen TEX images.
Seven original Scripts archive members contain 1,560 bytes and 63 instructions.
Every script has only a main function with metadata assignments and return;
none provides executable detection or swap callbacks. The persist scripts
assign `PersistsThroughDeath=true`; their names and metadata do not establish
which native active effect uses them or its lifecycle.

Item, spell, VFX and text records come from the same frozen, hashed exports
already used by Stealth Ward. Their parent hashes are checked during extraction.
They are metadata evidence, separate from the original archive bytes. REA does
not parse this proprietary resource format; the existing archive and static
Lua readers supply the evidence here.

The current item fields specify eight seconds, two charges, recharge endpoints
of 160 and 100 seconds, and radius endpoints of 600 and 750. The spell is self
targeted, retains its five-second short cooldown, preserves channels and excludes
ability haste from ammo recharge. Its six ordinary ammo slots are 2; the final
slot is -1. `GameTimeThreshold=14` and `MaxAmmoPre=1` remain uninterpreted.
Neither field establishes startup ammo or a fourteen-minute transition.
The exact scaling population, interpolation, sample phase, swap conversion,
detection cadence and hidden-unit presentation remain unrecovered.

[Riot 26.1](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/)
published the duration increase from six to eight seconds. One retained external
string still says six, while current dynamic text and the item field say eight.
Several authored particle lifetimes still run about ten seconds; they remain
separate from gameplay duration.
[Riot 13.10](https://www.leagueoflegends.com/en-us/news/game-updates/patch-13-10-notes/)
records two charges, the recharge endpoints, and two seconds of vision from the
Oracle owner's last hit on a ward as the scan ends. That historical description
does not recover current native callback dispatch.

## Converted assets

[The asset ledger](reference/oracle-lens-assets.json) covers four GLBs totaling
258,588 bytes and fifteen PNGs totaling 700,813 bytes. The scanner has 638
triangles, three bones (`Base`, `Top`, `Eye`) and one two-second animation.
The radar, core laser and laser have 186, 408 and 64 triangles respectively.
The radar has no source face-color block; the two lasers have one. That
distinction survives conversion, together with source bounds, central points,
flags and opaque tails. No emitter transforms are baked into the geometry.
The official 16.18.1 icon is separately pinned in the reference manifest.

[Independent binary comparison](reference/oracle-lens-geometry-verification.json)
checks all 513 scanner vertices, original triangle order, scaled positions,
UVs, weights and weighted joint indices. It checks every expanded SCB face
corner, UV and optional RGB against the raw source buffers, without using the
decoder's intermediate geometry. Zero-weight joint slots use glTF's canonical
zero index. The inherited unlit converter omits normals from the preview GLB;
the frozen SKN retains them. Animation evaluation and native particle shading
are outside this binary comparison.

Open `/tools/qa/oracle-lens.html` on the development server to inspect and scrub
the scanner, or select each static mesh with its original texture. This review
uses preview materials, individual geometry and a fitted camera. It does not
combine emitters, apply their attachment transforms or simulate detection.
All four Chrome captures were visually reviewed. The GPU probe reports 174,566
scanner pixels, 72,006 radar pixels, 123,027 core-laser pixels and 2,662 laser
pixels relative to hiding each object. These prove rendering contribution in
this review scene, not gameplay visibility or native appearance.

## Complete declaration preview — October 22, 2026

`/tools/qa/oracle-particles.html` now reconstructs all seventeen frozen emitter
declarations: twelve Buff, four Death and one Alert. Sixteen have visual geometry;
the remaining Buff emitter is an invisible parent with an explicit
`childEmitOnDeath` edge to Death. The preview can isolate any layer, scrub in either
direction, play the combined sequence and test moving anchors or uneven ground.
This renderer is not yet connected to the match. The existing live scanner/radar
implementation and schema 104 remain the current gameplay boundary.

[Normalized profiles](reference/oracle-particle-profiles.json) retain constant
values, every temporal key and per-axis probability table, original dependency
paths, shape axes, binding, local orientation, lifetime/linger, color lookups,
atlas/UV fields, passes and render flags. The exporter checks every converted
dependency hash and links the existing pinned default-reader evidence. Missing
frame count remains **one**, independently of a 2×2 `texDiv`; the first exporter
incorrectly inferred the cell count and was corrected after image review. Alert's
`hudAnchorPositionFromWorldProjection` is explicitly **false** in the source.

The playback adapters are explicit rather than native claims:

- Birth values sample normalized emitter age; appearance samples normalized
  particle age. Indexed random channels permit arbitrary seeks without touching
  simulation RNG. Shared 60 Hz acceleration/drag reconstruction is reused by
  existing Gromp death/missile playback without changing its stepping policy.
- First-update emission respects delay and continuous budgets. Stopping prevents
  subsequent births and caps surviving particles at stop plus authored linger,
  without stretching their appearance curves. The invisible parent's first birth
  is tick 1; an eight-second stop dispatches its child at tick 510 (8.5 seconds).
  Canceling before that first birth dispatches no child. The child root captures
  the parent's then-current anchor plus its 450-unit vertical offset.
- Bind weight interpolates between each particle's birth and current anchor.
  Motion, orbital radians, source rotations, camera-facing/direction-stretched
  quads and source-unit half-extents are local reconstruction conventions.
  RadarMesh and Ring vertically project each vertex onto the supplied height
  field; native projection range/fade and navmesh masks remain unimplemented.
- Unskinned layers use the existing initial RGBA product and local blend factors.
  The original rig uses Three's skinning with local unlit shading. Atlas scale,
  offset and scrolling remain separate from color-lookup coordinates. CoreLaser's
  raw fractional UV divisor `[0.5099999904632568, 1]` is preserved and applied as
  a reciprocal scale; the pinned reconstruction reader instead rounds atlas
  divisions to whole cells. Native UV_MODE and this fractional mapping still need
  calibration. Reflection/fresnel, complete blend/material behavior and audio
  remain open.

All sixteen visual layers contribute pixels in isolated fitted Chrome views;
random seeks reproduce both normalized state and the framebuffer exactly. Four
new browser checks cover those layers, explicit child timing, resource retirement,
moving bound/unbound anchors and terrain projection. The source review requests
exactly four GLBs and fifteen PNGs. Preparation shares pending requests, disposes
successful partial loads after failure, permits retry and caches complete assets.
The current revision passes TypeScript and all **1,301 tests across 244 files**,
including nine new source/playback/loading checks. Twelve targeted Chrome cases
pass, including the four preview cases, the original geometry review, four Gromp
death/missile regressions and all three live Oracle encounters. Both generated
files reproduce byte for byte. Production build and strict nested-path smoke pass
with the existing live equipment/activation/restoration. Nine preview captures
and the current production Oracle/companion captures were visually reviewed.
These results remain separate from the historical runtime validation below.

Image review retains a concrete fidelity gap: the source `sparks` texture and 2×2
UV policy produce hard cropped edges on stretched quads. The combined view also
keeps the authored dim early scanner fade and small ending at its original scale.
Pixels establish contribution, not native appearance or match visibility. Do not
promote this preview to visual parity. Alert's gameplay event/recipient remains
unresolved and manual preview does not manufacture a detection trigger.

Next connect the complete renderer to saved active/stopped presentation histories,
retain the child anchor through reload/recasts/match end, and calibrate the noted
UV/material/attachment behavior. Per-particle preview draws also require batching
and match-scale performance verification. [The preview validation ledger](reference/oracle-particle-verification.json)
records the commands and exact scope separately from live Oracle behavior.

## Reproduction and validation

Run from the repository root, with the existing pinned export caches and tool
dependencies prepared:

```sh
PYTHONPATH=.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/extract-oracle-lens.py
node tools/assets/convert-roster-base.mjs OracleLens
node tools/assets/convert-oracle-lens.mjs
node tools/assets/verify-oracle-lens.mjs
PYTHONPATH=.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/export-oracle-lens.py
PYTHONPATH=.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/export-oracle-particles.py
```

The source import at `be04cd5` reproduced all 27 pin, ledger, profile and
converted files byte for byte; the expanded runtime profile also reproduces
exactly. The underlying converted geometry/textures are unchanged. The source
review and independent binary comparison remain separately scoped evidence.

[The source validation ledger](reference/oracle-lens-verification.json) records
that import. [The runtime validation ledger](reference/oracle-lens-runtime-verification.json)
records current simulation, browser, saved restoration and production scope.
Neither establishes native parity or full-match completion.

At the live-runtime milestone `ae39178`, TypeScript and all **1,292 tests across 242 files** passed with one
worker, including fourteen new Oracle cases. The focused boundary run passes
41 cases: those fourteen, fourteen Ward regressions and thirteen structure cases. Two long existing clock tests hit
the default five-second limit with two workers; the serial run passes without
changing limits.

All 23 targeted Chrome scenarios pass: three new Oracle encounters and twenty
companion, Ward, inventory, shop-layout and queued-input/save regressions. Image
review prompted the silhouette overlay repair. All three Oracle cases pass
again after that change and the later sampling/match-end checkpoint repairs. The six final Oracle captures were visually reviewed,
including the 600x700 shop. Encounter positions, AI suppression and later clock
advancement are diagnostic; equipment, casts, clearing and save/reload use real
input. This does not certify a natural full match.

Production build and the strict `/nested/rift/` probe pass. Oracle assets do not
preload before selection; four scanner/radar GLB requests cover preparation and
active saved restoration. Existing Ward and companion state survive. There are
no failed/outside-prefix resources or development hooks. All five production
captures were visually reviewed. Production checks activation/restoration with
an explicit practice cooldown refill, not an injected enemy encounter. All GLBs
and the map validate with zero errors/warnings. The chunk warning remains:
715.88 KB game and 659.92 KB Three.

## Remaining implementation

Reconstruct the remaining source emitter layers, native stop/linger and material
bindings, audio and reference calibration. Verify native startup, scaling phase,
swap conversion, detection cadence and death/swap dispatch. Control Wards,
Farsight, Faelights, traps, strategic ward bots and the wider full match, roster,
delivery/offline and performance requirements remain in scope.
