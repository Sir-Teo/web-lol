# Zenith Blade source ribbons

Two saved-flight arbitrary trails now draw in the development GameView:
`Kayn_Primay_Broken` (global profile 11) and `Trail1` (14). They consume the
prepared emission/history/ribbon kernels without changing those frozen sources.
Together with fifteen nonreflective surfaces and the arrival skin, eighteen
visible E families draw. The reflective sword and source E audio remain open.

## Shader and per-vertex inputs

[The shader reading](reference/leona-e-trail-shader-reading.json) retains three
native quad Metal/AIR/disassembly samples and revision-bound external readers.
The external ribbon draw selects the quad path. Native E CPU dispatch remains
unverified; the bounded inventory does not prove no other shader exists.

Expanded geometry provides position, transformed base UV, RGBA tint and lookup
UV per vertex. The external prelude compensates the native BGRA input swizzle;
application RGBA receives no additional swap. Profile 11 samples its authored
16-row gradient at `(9 + .5) / 16 = .59375`. Palette U uses the untinted base
RGBA dot `[.299,.587,.114,0]`; palette RGB replaces base RGB while base alpha
survives. Tint and particle lookup multiply afterward. Optional global remap
replaces RGB only when its sampled alpha is positive. The actual E binding uses
a neutral missing particle lookup and omits the unknown global remap. Neither is
a claim about native resource defaults.

Both declarations use source-alpha additive blending. The local adapter retains
render order, alpha reference and polygon bias, uses repeat base sampling and
clamped palette/lookup sampling, and binds native depth push/pull to zero.
Positive shader depth push moves along the camera-to-vertex direction. Native
sampler, blend, depth/alpha-test and CPU uniform bindings remain unverified.

## Saved placement and ownership

Each source birth is placed in the same source-Y-forward/source-Z-down missile
frame as the weapon surfaces. A binding adapter turns the prepared upright points
about each retained birth origin. These two declarations are bind-zero, local,
and have no world acceleration. Width, sides, WAKE odometer, UV scroll, tint,
lookup and source smoothing/cutoff remain unchanged by that frame adapter.
Contact/dash roots do not substitute for a stopped missile. No live caster pose
or current missile origin is used for old segments.

Hidden historical births split runs before smoothing. Current point vision can
suppress runs too; no segment joins across a hidden point. The local high-quality
smoothing reach remains three. Authored rates are sampled through the existing
60 Hz source scheduler; no native scheduling or frame parity is claimed.

Each active group/profile owns a dynamic geometry and material. Buffers grow in
powers of two; replacement disposes the old uploaded geometry. Expiry or view
disposal releases owned resources once. Image decoding is session-shared, and
sampler clones remain session-owned. Loading stays lazy outside Leona fixtures,
with a retry after failed loads and a disposal guard.

## Verification

Unit cases cover finite buffers and palette/lookup state, saved birth-frame
placement, exact saved futures, historical/current visibility, resource expiry,
caster death and terminal presentation. Browser probes separately isolate the
two trails against synchronous source-off frames, restore exact arrays and
framebuffer through Save/reload and graphics recovery, and exercise repeated
hit/miss storage. Synthetic GPU samples verify per-vertex tint/lookup, palette
ordering/row/alpha, remap alpha, alpha reference, additive blend and depth push.
No native target or shader executes during these local checks.

The shared surface storage diagnostic initially grew from 35 to 37 textures,
then stayed at 37; every material/ground grid and soft-depth target still retired.
It had skipped early presentation frames, so session image creation was not
fully exercised before its equality assertion. Rendering ages 16/18/20/24/29
keeps the strict equality check and settles all six rounds at 22 geometries/37
textures. Failed logs/traces and the diagnostic counts remain retained. No
runtime resource-lifetime workaround or weakened memory assertion is used.
The initial TypeScript check also caught an unused test import, now removed.

Final checks pass TypeScript, 1,803 unit cases/297 files and three Node QA cases.
Twenty-one unique Chrome cases pass across the combined run and the corrected
surface-storage rerun; all 448 synthetic shader samples have zero byte error.
Isolated source-on/off maxima are 3,822 pixels for profile 11 and 5,486 for 14.
Both saved flight ages restore exact arrays and whole framebuffer after reload
and graphics recovery. Six progressive hit/miss rounds retire both ribbon
materials and geometries and settle at 22 geometries/37 textures.

Fresh nested production passes 32 recordings without a development hook or
unrequested Leona preloads. The new offline manifest contains 946 files and
506,726,009 bytes. Delivery evidence and the exact pack identity are retained in
[the verification record](reference/leona/e-trail-verification.json).
Run `node tools/qa/verify-leona-e-trails.mjs`, adding `--historical` after later
canonical changes. Schema 125 and ruleset 3f5f13be remain unchanged. No new
normal-match cohort or CPU benchmark is claimed. Native acceptance, the sword,
source E audio and Leona player/support integration remain open.

The fresh 946-file offline pack passes integrity, cancellation/retry, repair,
saved/new-match boot, scope removal and atomic two-version activation, with
963 service-worker responses and no production errors.
