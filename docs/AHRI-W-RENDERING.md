# Ahri W rendering

This branch starts from the verified schema 178 W visual history. The primary
work branch still runs the accepted Q projectile renderer. W particle assets
are staged publicly and the joined source effects are connected to this branch’s
scene. Full rendering acceptance and primary integration remain pending.

The history adapter dispatches only orbit, flight and genuine hit groups. Cast
and weapon resources remain unjoined. Orbit placement ends at the saved dispatch
anchor; flight begins from that anchor and follows actual moved samples. Impact
placement retains the terminal heading. Enemy unbound samples require visibility
at both interpolation neighbours; an exact visible sample can enter sight.

Phase paths cache cumulative source-unit distance between immutable history
updates. Binary searches support seeks in either direction, and weak fire keys
release replaced histories. New samples, dispatch/end anchors and refreshed birth
visibility invalidate the cached path. Five focused adapter tests and TypeScript
checking pass. These adapter checks establish placement behavior; the browser verification
below covers the connected scene.

## Staged public assets

The [publication ledger](reference/ahri/w-publication.json) stages all 30 profiles,
35 textures / 292 mips and two native-coordinate GLBs. Twenty-nine PNGs and two
GLBs add 31 files / 1,776,675 bytes. Three textures borrow Q cast ownership and
three borrow Q projectile ownership after complete native identity, mip and PNG
byte comparisons. No duplicate shared texture is published.

The whole output closure is checked before any file is written. Normal and
optimized guards reproduce the package from committed transports, reject eight
changed input pins, corrupt borrowed assets and symlinks, and prevent partial
publication on a final-ledger conflict. Three asset tests verify exact public
bytes, ownership and preserved missing/signed source fields. All 30 authored
profiles remain available; the scene consumes only the 23 joined orbit,
flight and hit profiles.

## Joined asset loader

The lazy page-owned loader selects the 23 joined profiles: 30 texture references
and the sharp flight mesh. It loads 24 W textures, borrows three textures from
each Q owner, and excludes the five cast-only textures and swirls geometry.
Failed mesh loads can retry without discarding verified textures. Concurrent
calls share one promise; owned mesh coordinates convert once to metres while
native normalized RGBA and absent normals remain preserved. The BGRA shader
attribute derives directly from the retained source colors.

The loader test uses the actual GLB and verifies every position/color component,
retry behavior, address-mode sampler caching, borrowed ownership and excluded
cast-only requests. Scene attachment is covered separately by the lazy wrapper and browser cases.

## Native flag types

The [native type reading](reference/ahri/w-native-types.json) retains all 65
ordinary emitter field names (the 66th projected field is the struct type),
including 82 authored FLAG fields across all 30 emitters. It reparses the pinned
original BINs after the existing complete-native verification. Normal and
optimized checks reproduce the same reading.

`ParticlesShareRandomValue` is native FLAG `0x87`, payload `1`. CDTB serializes
that payload as an integer; the type reading keeps its native flag identity
separate from the raw JSON. Rotation, direction and single-particle controls
also use FLAG tags. This evidence does not certify a native random stream.
Rechecking the type reading requires the retained native source and decoder;
the portable CI source checks do not claim to reparse those private inputs.

## Seekable joined sampler

The sampler covers all 23 joined emitters using source-referenced schedules,
birth/shape values, motion, appearance, spin, UVs and erosion. Missing emitter
lifetimes remain null in the source window; existing gameplay phase limits bound
the precomputed schedules. Indexed cosmetic draws consume no World RNG or IDs.
The native shared-random flag keeps one emitter chance across births.

Only empty live probability tables with multiplier one are removed from the
prepared arithmetic; complete authored metadata stays in the public profile.
Nonneutral live tables reject until a flicker adapter exists. Animated atlases,
live FireCards rotation, surface/volume spheres and the authored Y orbital speed
participate. Root binding accumulates saved movement separately from local
particle motion, with the source X reflection left to the surface adapter.

Bound-object size is an explicit sampler input in source units; the standalone
preview default of 100 is local policy, not a native bounding-box certificate.
Six tests cover all profiles, cached/fresh seek equality, stop changes, returned
buffer ownership, UV/rotation/shared chance, flex, shapes and malformed inputs.
Native random-stream and pixel equivalence remain unverified.

## Scene effects preparation

The renderer draws all 23 joined families: 21 surface profiles and two packed
flight ribbons. It uses the shared ground projection and source fragment paths,
normalized soft-depth inputs, packed ray colors and per-vertex ribbon lookup /
erosion data. Source-sampled velocity stretch remains separate from placement.
Unbound palette declarations stay marked on material metadata; no unnamed
palette texture is invented.

The local root height is 0.9 metres, matching the existing missile preview.
Hit flex uses the retained target's gameplay collision diameter as an explicit
local bound-size input, with a 100-source-unit fallback; this is not certification
of a native mesh bounding-box convention. Historical root binding is accumulated
before placement. Fully bound enemy effects can enter sight later; unbound births
and ribbons retain their saved sight boundaries.

Six scene tests and four ribbon tests cover all families, restored / rewound
drawings, caster Flash, genuine brush-style sight calculations, terminal drain,
owned disposal, terrain projection and authored vertical offsets. Existing Q,
Leona and shared surface tests pass. The view wiring and browser checks below
exercise these effects in the connected scene.

## Lazy view wiring

The view now owns the W loader, on-ready redraw and soft-depth preparation.
Rosters without Ahri never request the W module's assets. While loading or after
failure, the existing fallback fireballs remain; once ready, their owned meshes
are removed and the saved source histories draw. A failed load requires explicit
retry. Disposal during a pending load prevents late scene construction.

The compatibility collector now roots the W renderer and lazy wrapper, including
their consumed profiles, assets and source kernels. Three loader lifecycle tests
and the W scene/ribbon suites pass (13 tests), and TypeScript checking passes.
The four W browser cases below pass; the staged source does not yet have
full rendering acceptance or primary integration.

## Browser verification

Four Chromium cases pass against rendering revision 124cc67 (ruleset
ff8abc1be3d5e4191d0544c600ed32c1e3d89b5bf969d9f2a57c591cde81dbe9):
keyboard cast with orbit / flight / hit drawings and restored packets; actual
practice-brush sight boundaries; committed flights after caster death and terminal
drain; and a roster without Ahri making zero W asset requests. The joined loader
requests 24 owned textures and the sharp mesh, borrowing the other textures.
No JavaScript or shader errors were reported. Open-lane orbit and flight captures
were inspected in artifacts/ahri-w-browser-v2. Software Chromium establishes
functional behavior, not device performance or native pixel equivalence.
Full regression and archived gameplay comparison remain pending.

## Archived regression comparison

Rendering revision 14d68cc preserves all 45 complete state projections from the
accepted W observer's seed-one development-roster archive, including W history.
Only version and ruleset metadata are excluded. Both archives independently pass
cohort verification. The match ends with Blue victory at tick 157,116; 44 snapshot
round trips and 43 future comparisons cover 2,580 additional ticks. This is one
seed, not the hundred-seed gate. The committed comparison and source-delta
receipts retain both archive identities and all source hashes.

The full unit run covers 9,077 tests across 553 files. Five tests initially time
out under concurrent work; rerunning their four files with one worker passes all
45 tests without changes. The combined result is 9,075 passes and the two known
baseline failures (missing Leona private reference reader and the Node 24 Lux
sampler golden). All 245 Node QA checks pass. A clean committed export without
private caches or tools passes 735 tests across 96 files and all 63 workflow
commands, including a recorded rerun after the same history-test timeout.

All seven Q rendering browser cases pass. The three Fox-Fire audio cases pass
with the initially timed-out readiness case rerun separately. All 334 WAV files,
including the 76 Ahri masters, match the accepted observer bytes. The production
build and complete pack byte audit pass; production and offline browser gates
remain pending.
