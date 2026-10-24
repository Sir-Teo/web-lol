# Zenith Blade emission and trail kernels

October 24, 2026. The five prepared E systems now have a reproducible source table
and seekable particle/history/trail samplers. This closes the deferred kernel
preparation. **GameView still does not draw E or play its source audio.** Material
and attachment dispatch, graphics recovery/disposal, native comparison and Leona
player/support integration remain required.

## Source table and scheduling

The compiler reads the [original declarations](reference/leona-e-particles.json)
and [decoded dependency inventory](reference/leona-e-particles-decoded.json),
checks every packaged texture/mesh hash and rejects unknown fields/types. All
twenty enabled records are compiled; thirteen disabled records remain verbatim.
Every enabled field has an explicit route in the profile audit. Primitive,
material, reflection/erosion/palette, UV, bound-size, orientation and sound
declarations remain separate. Retaining a field does not implement its GPU use.

The hashed dash override `{97d68dc062eb5dfa}` retains its raw PATH declaration and
separately resolved empty-texture dependency. Nothing infers a native callback or
binding from that filename. All source systems and disabled declarations remain
available for the eventual renderer.

The local scheduler uses 60 Hz, first-update births, deterministic cosmetic
hashes and finite stop caps. It consumes no World randomness or shared IDs.
Delayed singles, natural lifetimes/probability bounds, independent shape choices,
birth/world acceleration, drag, atlas/lookup routing and bound-size scaling are
seekable. Late seeks visit only potentially surviving births. The three authored
periodic weapon declarations are finite singles; no repeating births are invented.

Omitted lifetime uses an explicit one-second local default. Sphere sampling
retains the pinned reader's naive radius and two full turns. These are documented
reconstruction policies, not verified native defaults, PRNG or target-patch CPU
execution. The full source table remains the authority for authored values.

## Saved phases, visibility and trails

Draw groups use the existing [schema-125 histories](LEONA-E-HISTORY.md): the
actual launch point and every moving flight frame, ordered contacts, dash and
arrival. They never borrow a current live target pose for a historical event.
Shortest-turn facing interpolation retains detached animation clocks. The full
flight path supplies a persistent distance odometer through later seeks.

Moving weapon births use historical visibility. Finite contacts/arrival require
both creation and birth audiences. Only finite events can borrow the frozen
winning frame for delayed births. Contact/sound-carrier dispatch follows the
recorded local eligible contacts; declared sound names alone do not establish
native script callbacks. No E sound is played by these kernels.

Both enabled arbitrary trails retain their source widths, cutoff distances
(1,200/3,000 cm) and birth tiling (805/1,100). Points run newest first. The ribbon
uses local particle-X sides, interior box filtering and raw-side bisectors with
unchanged width. Endpoints and duplicate fixed-update births remain intact.
WAKE UVs use the full path odometer and remove the newest U's even part. Hidden
births split runs before smoothing and cannot create visible bridge triangles.
Point positions, widths and ground-callback heights use source centimetres; a
view binder must convert them to scene metres exactly once.

The external ribbon/quality reader is pinned to a specific reconstruction
revision. Seven independent arrays check straight/curved paths, particle sides,
opposite sides, duplicate births, cutoff and WAKE parity. Its quality table
describes a 16.17 client and 15/20/30-Hz updates. This project retains its local
60-Hz schedule and borrows only the explicit smoothing reach of three. Neither
that reader nor matching arrays establish target-patch native quality/cadence.

## Reproduction and evidence

Ordinary compiler verification requires only shipped files and creates no
private reader cache:

```sh
python3 tools/assets/export-leona-e-particles.py --check
```

With the separately pinned readers retained locally:

```sh
python3 tools/assets/export-leona-e-particles.py --check --readers
node tools/assets/export-leona-e-ribbon-samples.mjs --check
```

Current TypeScript, all 1,782 unit cases/293 files and three Node QA cases pass;
the unchanged kernel contributes 36 cases. Five fresh Chrome cases verify the
kernel and real windup/flight/dash/arrival saves, exact restoration and following
combat. The kernel case samples every enabled family and both ribbons without
mutating either saved world. It compares CPU arrays; it does not draw native E.

The [verification ledger](reference/leona/e-kernel-verification.json) separates
current checks from the earlier frozen kernel's two-seed/ten-minute smoke,
production and offline observations. Those earlier observations keep their
original source identities. No fresh normal cohort or offline run is claimed.
Current production evidence belongs to the accepted visibility build; current
generated files are checked against that retained build. No new kernel is
imported by GameView, so preparing these samplers adds no active frame work.

Schema 125 and current working ruleset
`3f5f13befd26234c86d0603e8fcc4b3236eb6e43b1e4ebf5e47a968d46007653`
remain. The fingerprint includes all three kernels, the table and transitive
curve/motion dependencies. The next renderer increment must also bind the asset
and material dependencies it actually uses. The full project goal remains active;
nothing is pushed.
