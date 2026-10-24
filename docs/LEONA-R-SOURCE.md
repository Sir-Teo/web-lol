# Solar Flare source package

All six standard-game Leona R systems are now frozen from 16.18.8175716 BINs,
including all 44 enabled and nine disabled emitter records. All 45 authored
asset dependencies are packaged: 41 TEX images and four SCB meshes. This is source
preparation; the new R source systems have no GameView integration, compiled
emission kernel, saved presentation history or source SFX dispatch yet.

## Inventory and provenance

The Leona skin's resource map declares these exact aliases:

| Alias | Enabled | Disabled | Source families |
| --- | ---: | ---: | --- |
| `Leona_R_buf` | 4 | 0 | attached skin, two quads, billboard |
| `Leona_R_cas` | 4 | 3 | mesh, two ground quads, billboard |
| `Leona_R_hit_aoe_green` | 6 | 0 | ray, planar projection, four quads |
| `Leona_R_hit_aoe_red` | 6 | 0 | ray, planar projection, four quads |
| `Leona_R_hit_impact` | 21 | 5 | six meshes, ray, eleven quads, three billboards |
| `Leona_R_tar` | 3 | 1 | three billboards |

The enabled total is 23 arbitrary quads, eight billboards, seven meshes, three
rays, two planar projections and one attached skin. The complete definitions,
system declarations and disabled records remain in the
[source pin](reference/leona-r-particles.json). Four raw BINs are independently
re-decoded and compared with every selected object. The pinned Riot manifest,
WAD subchunks, paths/hashes, compressed ranges and decoded source bytes are
retained. No new native target or shader executes during packaging.

Both green/red systems author `visibilityRadius=5000` and the same buffactivate
sound name. Impact authors its own hit cue. These associations do not establish
native dispatch, which color alternative a team sees, or whether two alternatives
share one sound dispatch. OnCast is separately declared in the SFX bank.

## Exact decoded assets

TEX decoding preserves original dimensions and RGBA bytes. The 41 PNGs total
958,304 bytes; 18 existing images remain byte-identical and 23 images are new.
No resizing, texture replacement or inferred missing-texture resource is used.
`R_buf/Activate` has no authored base texture, and remains explicitly marked as
missing one.

All four SCBs preserve source positions/UV, original source vertex BGRA and
per-face RGB where present. Packaging expands original triangle corners and
converts only render POSITION from centimetres to metres. Raw source positions,
bounds, pivot, materials, flags, source index hashes and independent attribute
hashes remain inspectable. No normals, pivot transform or winding changes are
generated.

| Package | Source vertices | Triangles | Source color streams |
| --- | ---: | ---: | --- |
| Existing E contact cylinder | 40 | 40 | none |
| New R cast funnel | 90 | 162 | vertex BGRA |
| New R praxis | 100 | 160 | vertex BGRA and face RGB |
| Existing W smoke 01 | 400 | 720 | vertex BGRA |

The E cylinder and W smoke GLB/manifests are regenerated in memory and required
to match their existing bytes. The two new GLBs total 40,540 bytes; all four total
125,824. Node GLTF validation reports zero warnings/errors and exact attribute
round trips. A separate Python reader checks real GLB accessor bytes against the
raw SCB arrays. Chrome loads the four actual packages, hashes every attribute and
renders original triangles and an exact position-copy wireframe with no GL error.
The position copy avoids Three's existing interleaved-wireframe helper issue;
the original triangle geometry is verified first.

## Open binding and history work

`Focused_Sun` is an authored planar projection, with Y range/fading 500 each.
It is retained as that primitive and has no quad replacement. External source
reading points to the UNLIT_DECAL path; native shader/CPU binding work is separate.
The cast ground declaration retains `stencilRef=7` and linger type 1. It authors
no stencil mode, so that reference alone does not establish a native test/write.
Impact also has ground-layer meshes/ray, probabilistic orbital velocity and
field-noise declarations. These need their own supported interpretation before
runtime drawing. Attached-skin multiplier, lookup scales/offsets, erosion,
distortion and atlas streams remain authored dependencies.

Existing gameplay R state stores windup/release/impact, position and damage,
then retires on impact. Source playback needs retained phase/impact/target
histories, strict validation and bounded expiry before full integration. Native
attachment/matrix defaults, update cadence, terrain projection, effect dispatch,
audio mix, rendering acceptance and Leona player/support remain open.

## Verification and delivery

TypeScript, 1,815 unit cases/299 files and three Node QA cases pass. Four package
unit cases verify complete records/declarations, dependencies, exact shared
assets and unsupported/missing fields. One fresh Chrome case verifies all four
actual meshes. Independent BIN/TEX/GLB checks and Node validator/round trips pass.
Fresh nested production passes 32 recordings, no development hook and no
unrequested Leona preloads. The new manifest contains 996 files / 510,449,057
bytes. No new normal-match cohort or CPU benchmark is claimed.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-leona-r-particles.py --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/decode-leona-r-particles.py --check
node tools/assets/convert-leona-r-particles.mjs --check
node tools/qa/verify-leona-r-source.mjs
```

The extraction/decode check paths read only retained inputs; they do not fetch or
rewrite assets. The [verification record](reference/leona/r-source-verification.json)
freezes source/evidence/generated files. Add `--historical` to the final verifier
after later canonical changes. Schema 125 and ruleset 0f7b3e3b remain unchanged.
The full project goal stays active.

The subsequent [explicit-input decal material](LEONA-R-DECALS.md) verifies six
UNLIT_DECAL selections and their GPU arithmetic. Native R CPU dispatch and
receiving-triangle/matrix/state setup remain open; no projection is drawn in
GameView yet. The delivery results above remain scoped to this source package.

The fresh full offline pack passes integrity, cancellation/retry, repair,
saved/new-match boot, scope removal and atomic two-version activation with
963 service-worker responses and no production errors.
