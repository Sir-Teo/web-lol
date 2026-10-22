# Oracle Lens source preparation

The original scanner and all selected particle dependencies are now pinned,
converted and reviewable. **Oracle Lens is not yet available in gameplay.**
The current trinket remains Stealth Ward, and saves remain schema 103.
This source import advances the vision system toward the full match goal; it
does not establish working detection or native visual parity.

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

All 27 source-pin, ledger, generated-profile, GLB/sidecar and PNG files reproduce
byte for byte. Texture reproduction independently compares decoded RGBA bytes.
All GLBs and the map validate with zero errors and warnings. TypeScript and
1,278 tests across 241 files pass with `npm run check -- --maxWorkers=2`,
including three new source cases. The first default-worker run reached two
five-second timeouts in existing long lane and jungle simulation cases;
the bounded run passes without changing test limits. The new Chrome source
case passes, including real select, scrub and play controls, finite animated
bone poses and GPU checks for all four meshes. Production build passes; the
existing 700.69 KB game / 659.92 KB Three chunk warning remains.

[The validation ledger](reference/oracle-lens-verification.json) records exact
scope and evidence. No new full-match, gameplay Oracle, production interaction
or native comparison acceptance is claimed by these checks.

## Remaining implementation

Connect free trinket swaps to the shop with selected-asset preparation and
revalidation; conserve charges and recharge progress across repeated swaps.
Implement moving scans, enemy ward detection and disabled ward vision without
turning hidden champions into ordinary targetable vision. Preserve active scan
and recharge clocks through exact saved continuation. Add source-effect
playback, real input and HUD state, then exercise overlapping teams, terrain,
death, expiry, swapping, practice reset and ward clearing in unit, browser and
production checks. Unrecovered native bindings must remain named local policies.
Control Wards, Farsight, Faelights, strategic ward bots and native calibration
remain part of the wider unfinished project scope.
