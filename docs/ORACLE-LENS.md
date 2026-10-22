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

## Reproduction and validation

Run from the repository root, with the existing pinned export caches and tool
dependencies prepared:

```sh
PYTHONPATH=.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/extract-oracle-lens.py
node tools/assets/convert-roster-base.mjs OracleLens
node tools/assets/convert-oracle-lens.mjs
node tools/assets/verify-oracle-lens.mjs
PYTHONPATH=.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/export-oracle-lens.py
```

The source import at `be04cd5` reproduced all 27 pin, ledger, profile and
converted files byte for byte; the expanded runtime profile also reproduces
exactly. The underlying converted geometry/textures are unchanged. The source
review and independent binary comparison remain separately scoped evidence.

[The source validation ledger](reference/oracle-lens-verification.json) records
that import. [The runtime validation ledger](reference/oracle-lens-runtime-verification.json)
records current simulation, browser, saved restoration and production scope.
Neither establishes native parity or full-match completion.

Current TypeScript and all **1,292 tests across 242 files** pass with one
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
