# Zenith sword source presentation

The enabled `sword2` mesh now renders through the saved E surface history in the
non-player Leona development fixture. E has all19 authored visible families:
16 surfaces, one private posed skin and two ribbon families. The twentieth
enabled record is a sound carrier with no visible draw. This completes local
visible-family coverage, not native frame matching or full playable E/Leona
acceptance.

A later [original Metal shader harness](LEONA-METAL-RIM-HARNESS.md) executes
VS1/PS9/PS24 with150 explicit synthetic inputs. Metal, WebGL and scalar RGBA8
readbacks match exactly on the recorded M1. Native gameplay bindings and frames
remain unverified; the integration results below retain their original scope.

## Source inputs and explicit policies

The [native SCB normal reading](LEONA-NATIVE-SCB-NORMALS.md) supplies a separate
23,328-byte Float32LE stream for1,944 expanded sword corners. The authored GLB,
source positions/UVs and face-RGB streams stay unchanged. At load time the adapter
checks normal bytes, original source positions, rendered positions and corner
counts by SHA256 before adding the derived normal attribute. Interleaved glTF
accessors are hashed through their values in corner order. Existing/generated
normals, corrupt data or a mismatched source mesh fail without substituting a
fallback stream.

The [reflection-input reading](LEONA-NATIVE-REFLECTION-INPUTS.md) and
[SCB material reading](LEONA-NATIVE-SCB-MATERIAL.md) support a conditional generic
SCB/fresh-empty-map path. The local adapter selects the retained fog-disabled
VS1/PS24 arithmetic: no reflection cube, no vertex-color multiplication, strict
alpha testing and per-vertex rim. Source fresnel `.15` maps to shader exponent
`.8350000381469727`; rim RGB is the authored
`[1,.43921568989753723,.03921568766236305]`. Its source fourth component, zero,
is not an opacity multiplier in that upload.

For this new sword only, the identified blend-zero CPU tint packing is applied:
combined RGB is multiplied by combined alpha, then `kColorFactor.a` becomes one.
The shader's test and rim therefore see texture/lookup alpha. The reference is
five/255, with equality preserved. Other accepted W/R/E surfaces retain their
earlier local tint policy. The shared surface renderer exposes explicit material
and tint hooks, preserving its saved placement, lifetime, UV, visibility and
resource ownership paths. The new material is registered in the shared particle
color list, so an early distortion copy excludes it and the later color pass
renders it.

These resource/placement choices remain explicit local adapters:

- Empty particle lookup borrows the existing white fallback.
- A session-owned zero-alpha remap supplies a local bypass; the actual native
  global remap resource remains unobserved.
- Saved birth audience and current world visibility provide fog culling; native
  shader fog resources are not assumed.
- The existing saved missile-root/source-X-reflected frame, double-sided raster,
  blend/order/depth behavior and history stop policies remain local choices.

The conditional SCB path does not prove actual Leona CPU dispatch, the earlier
resource-format attempt, post-load/reuse mutation, component copying, pass/FOW
flags or native resource-upload success. This integration used no native game
or shader execution; the later isolated shader harness is linked above. The
separate static packages retain bounded original words, tables,
source bytes and original Metal/AIR, not REA MCP Evidence or native captures.

## Reproducible delivery

```sh
python3 tools/assets/export-leona-e-sword-normals.py --check
python3 tools/assets/export-leona-e-sword-material.py --check
python3 tools/assets/verify-leona-native-scb-material.py --check
```

The exporters verify their static reading/source inputs and compare existing
outputs without writing in check mode. Normal delivery is separate from authored
mesh data; material metadata retains exact input-reading hashes and local
policies. The full E surface module graph and binary normal stream now belong
to the saved-match ruleset fingerprint. Schema126 needs no new serialized field.

## Local verification

Five source-surface Chrome tests verify all16 surface families contribute pixels,
saved state/frame equality at ages29 and54, context recovery, six alternating
hit/miss lifecycles and causal sword inputs. The new family contributes up to530
isolated pixels in the sampled fixture. At its zero-alpha birth, hiding the sword
changes250 pixels; using raw exponent changes227; constant normals change249;
preserving zero tint alpha changes250. Restoring all inputs changes zero pixels.

The memory test renders intervening dash/contact/arrival ages before measuring
settled memory. All six rounds settle at24 geometries/47 textures; no additional
image uploads occur after the first complete warmup. Every captured material and
owned buffer retires, with no remaining effect models or soft-depth target.
These are fixture-specific storage observations, not a performance budget or a
normal-match cohort.

Seven independent material Chrome tests cover249 synthetic scalar/GPU samples,
including49 alpha-test cases and the earlier reflective/rim checks. They verify
threshold equality, fully tinted alpha, remap ordering, no-cube programs,
nonuniform scale, interpolation, depth/occlusion and exact context recovery.
Source normal-loader tests cover actual binary identity, interleaved accessors,
corruption/truncation, changed positions and existing normal rejection.

The first integration loader rejected glTF interleaving; its strict accessor
handling and unit fixture are corrected. The first memory probe skipped short
contact stages and saw delayed resident texture uploads. Rendering those stages
warms the actual resources before comparison; the initial records remain retained.
A tint fixture initially sampled before missile release and is corrected to a
zero-alpha flight birth. These failures do not establish native behavior.

The [verification ledger](reference/leona/e-sword-verification.json) retains
source/evidence identities and delivery results. No native-frame, player/support
or full six-character match acceptance follows. Full standard/regression and
production/offline results are recorded there when the increment is accepted.

The accepted standard check passes1,887 unit tests in310 files, TypeScript and
three QA tests. Forty browser cases pass across the material, E surfaces/skin/
ribbons, shared W surfaces, R surfaces/projections/skins and color phase.
Production nested-path delivery passes32 recordings, with development hooks
absent and no unrequested Leona preloads. All965 previous static files are
byte-identical; the only new public asset is the23,328-byte normal stream.

The new offline pack is
`674763529f956c9f2c80554c689f9d56e84f6e01d661d2953dcf3c38a5e74f30`:
1,012 files/513,309,163 bytes. The offline integrity/repair/saved-boot/atomic-update
controls pass, with963 service-worker responses and no production errors.
The complete manifest includes the normal asset; production Leona selection
remains gated, so this is delivery evidence rather than a production Leona cast.
Schema126 uses ruleset
`c485c84bed8be736fb779f5d0f5b2d0c9d07a566377af3d0a28988d5a2f1ed80`.
No normal-match cohort or new performance budget is claimed.
