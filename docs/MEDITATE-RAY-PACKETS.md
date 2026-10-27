# Meditate ray packet precision

Yi's private Meditate cast `fireline` and buff `bigray` now use normalized BGRA
byte vertex colors and half-rounded lookup coordinates. The source color curves
stay unquantized in the samplers. The existing shared surface renderer packs the
bytes into each ray's owned geometry and supplies a white tint uniform.

Both source rays use explicit blend mode 4, unit UV transforms, an omitted
lookup texture with the existing white fallback, no multiplier, and an omitted
modulation factor with the witnessed white constructor default. The cast ray
has one static 1×1 frame. The buff ray retains static frame 3 on its 2×2 atlas;
its base UV corners remain exactly representable. Two assumption guards require
these properties. Only ray profiles opt into the byte stream; the other cast
and buff emitters retain their existing material and packet paths.

The [native ray builder](NATIVE-RAY-PACKET.md) and
[normalized vertex declaration](NATIVE-PARTICLE-VERTEX-FORMAT.md) establish the
same packet operations used by the earlier
[primary-hit ray correction](PRIMARY-HIT-RAY-PACKETS.md). For the retained mode-4
rays, finite color components clamp to the unit interval and convert with
float32 `fma(value,255,0.5)` before truncation. Actual normalized Uint8 BGRA
attributes preserve the recovered input format; a float uniform can differ at
GPU conversion/interpolation boundaries. The mode-0/2 premultiplication path is
outside this correction.

The independent comparison archives the complete source graph and matching
lockfile at `541d7bddbda752f997a473f330568ffd9499a88b`, then bundles its Meditate
samplers and shared renderer. Across 2,178 sampler calls, all 50,969 sampled
non-ray states and every other field of the 1,062 rays remain exact. Raw source
color arrays remain unchanged. The C/Python reference checks the candidate
lookup coordinates and the renderer's byte projection:

| Family | Ray samples | Changed packed colors | Changed half lookup pairs |
| --- | ---: | ---: | ---: |
| Cast | 522 | 306 | 513 |
| Buff | 540 | 531 | 504 |

These are corpus counts, not native event frequencies. Native clocks, RNG,
curve arithmetic, optional external modifiers, transform inheritance, FPCR and
actual draw-specific shader selection remain unobserved.

The GPU oracle reads material/color routing from the actual `MeditateCasts`
and `MeditateBuffs` program instances. It renders the authored ray textures
through `SourceParticleSurfaces`, comparing against independently C-derived
normalized byte attributes and half coordinates. A float-color counterfactual
keeps the original values. Seven source phases, three cameras, two target sizes
and raw/runtime blending yield 84 nonempty cases per family. All 168 cases match
exactly, with no GL errors. The original cast/buff paths differed by 5,826 and
5,320 channel bytes respectively; those failures and traces are retained.

All 39 focused checks pass, including the two new source-assumption guards.
TypeScript and all six Node QA cases pass. The full suite records 3,098 passing
tests out of 3,100 across 391 files, with the same two baseline failures and
the original wave deadline. No golden or assertion was weakened.
Real cast/buff Save/reload descriptions now include the packed color buffer as
well as uniforms, UVs and transforms. The final full-suite, browser, production,
asset-identity and snapshot evidence is retained in the
[verification ledger](reference/meditate-ray-packets-verification.json).

```sh
node tools/qa/verify-meditate-ray-packets.mjs --output-dir .cache/meditate-packet-check-new
npx playwright test e2e/meditate-ray-packets.spec.ts
```

This is a WebGL packet-format calibration under the existing local effect
policies, not native Metal execution or complete native visual parity. Geometry,
source atlas selection, motion, birth/stop policies, visibility, audio and all
other effect families keep their existing behavior. No new performance claim.

All 15 browser cases pass: four real cast cases, five real buff cases, both
packet oracles and four shared particle comparisons. The native ray and vertex
declaration records also replay normally and with optimized Python. All 18
Meditate asset/data outputs and 14 accepted primary-hit exports retain their
bytes and timestamps.

The production build and nested-path smoke check pass 32 recordings, with
eight fresh screenshots and zero unintended private preloads. Schema remains
163. The pack contains 1,201 files / 538,085,472 bytes, 426 bytes larger than the
preceding pack, including a small shared JavaScript chunk for half conversion.
No public texture or model bytes change; the public selector remains Ashe/Lux.
