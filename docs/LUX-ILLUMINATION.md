# Lux Illumination

## Evidence

`reference/lux-illumination.json` retains all three passive ability/spell records from the same hash-verified 16.18 response as Lux's champion stats. The standard-mode parent has `DebuffDuration = 6` and `APRatio = 0.35`; the Arena override is 0.5 and is not used. Its `ByCharLevelFormulaCalculationPart` contains a level-zero entry of 20, followed by 30 through 200 for levels 1–18. Indexing that array as a zero-based playable-level list would understate every level by ten. [Pinned character data](https://raw.communitydragon.org/16.18/game/data/characters/lux/lux.bin.json)

Riot describes damaging spells charging a target and Lux's next attack igniting that energy for bonus magic damage. Its 13.17 notes independently establish the 30–200 level endpoints, but their older AP ratio is not the current source value. [Champion description](https://www.leagueoflegends.com/en-gb/champions/lux/), [13.17 notes](https://www.leagueoflegends.com/en-gb/news/game-updates/patch-13-17-notes/)

## Implementation

A surviving enemy hit by Lux Q receives a mark with source ID and a six-second deadline. A subsequent Q refreshes that owner's deadline instead of stacking or detonating it. Allies and structures are excluded. The existing generic binding diagnostic can still use Ashe as its caster; that does not apply Illumination.

Lux's basic attack checks the mark at impact, removes it once and deals ordinary physical attack damage followed by separately mitigated magic passive damage if the victim survives. Passive damage samples Lux's level and AP at impact. An already committed attack can trigger after caster death. Another champion's attack cannot consume the mark. Multiple Lux actors have independent marks; this is an explicit local ownership policy pending native duplicate-champion comparison.

Expiry occurs before combat on the deadline tick. Target death clears every mark; caster death preserves marks on other targets. Marks neither grant sight nor change targeting eligibility. Health bars show `ILLUMINATED` once higher-priority protected/stun/root/slow statuses are absent, using the existing visibility boundary.

Snapshot 38 requires a mark list on every unit and validates distinct enemy Lux owners, living nonstructure victims and deadlines strictly after the current tick but no more than six seconds ahead. It supports saving during both the mark lifetime and a basic attack's flight.

## Validation and remaining work

All 533 source/simulation checks pass. Seven new cases cover level 1/18 mixed damage and repeat attacks, Q refresh, exact saved continuation, expiry on the impact tick, owner isolation/caster death/target respawn, and malformed snapshots. Three focused Chrome cases cover binding, the Lux rig/cast/recall and Q → mark readout → attack consumption. Production build and nested-path smoke pass.

The native mark/trigger particles, passive attack animation selection and any special attack projectile behavior are unfinished. The child spell's older-looking missile metadata is retained without replacing the independently pinned basic attack. Impact-time AP sampling, component ordering, duplicate-Lux ownership and native visual timing remain comparison targets. R now consumes and refreshes marks (`LUX-R.md`); E application, spell shields, cleanse and other unimplemented systems still need integration; this milestone does not complete Lux's kit. No full browser, full-match or performance rerun was performed.

## Native mark asset extraction

The complete base mark definition and original textures are now pinned in [lux-illumination-vfx.json](reference/lux-illumination-vfx.json). The Skin0 resource alias `Lux_P_debuff` points to `Characters/Lux/Skins/Skin0/Particles/Lux_Base_P_debuff`, inside `lux_multi_skins_skin0_skins_skin1_skins_skin2_skins_skin3_skins_skin4_skins_skin5.bin`. The selective extractor verifies the original six source files against the frozen release manifest, re-parses the binary and requires exact equality with the complete recorded definition. This is the persistent mark, not the separate `Lux_P_tar` trigger burst.

| Emitter | Authored behavior retained in the record |
|---|---|
| `luxdebuff1` | One six-second starburst; half-size 60; X rotation velocity −10 degrees/second; pass 1; full target binding; `color-eyefade` lookup. |
| `luxdebuff2` | Same lifetime/size/lookup; initial X rotation 20 degrees and velocity +10 degrees/second. |
| `rays` | `VfxPrimitiveRay`; rate 10, six-second emitter lifetime, particle lifetimes sampled from 0.5–1 second; random rotation/scale, alpha and size curves. |
| `smallball` | Rate 1, six-second emitter lifetime, 0.4-second particles; pass 3, blend mode 4, color curves and scrolling rainbow multiplier. |

The small glow's hashed filtering record resolves to `VfxEmitterFiltering.keywordsExcluded = ["SteelLegionLux"]`; it is an exclusion, not an instruction to render this layer only on that skin. The exporter verifies those field/type hashes directly. The ray type hash is also verified against `VfxPrimitiveRay`. Raw fields and all probability curves remain in the audit; the extract does not flatten them into guessed playback defaults.

Five texture payloads are exported with exact decoded RGBA verification, including alpha: 512×512 `starburst-spectral`, 64×64 `color-eyefade`, 256×256 `Lux_Base_P_RainbowRay`, 256×256 `Diana_Base_R_Glow`, and the existing 64×4 rainbow multiplier shared with Final Spark. Four new PNGs are checked in; the multiplier reuses `lux-r-4.png`. The starburst texture was visually inspected.

Reproduce and verify:

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/export-lux-illumination-vfx.py
```

This milestone prepares the complete source asset set; **the mark particles are not yet rendered in gameplay**. Native attachment origin/bone, lookup coordinates, default blend/sampler behavior, the ray primitive basis, emission cadence and refresh/restart policy require explicit treatment. Current simulation records only owner and expiry; reconstructing a particle age from expiry would restart it on refresh, which must be labeled and checked rather than silently treated as native behavior. The eventual renderer must respect visibility, expiry, target death and passive consumption without granting sight. Source/texture re-extraction and exact equality pass; runtime suites were not repeated for this asset-only addition.

## Ray geometry groundwork

`src/render/ray-quad.ts` now implements the `VfxPrimitiveRay` geometry used by the mark's `rays` layer. It follows the [pinned LeagueToolkit quad reconstruction](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/shaders/quad.ts): the particle's transformed +Z axis determines length, the camera determines the transverse direction, and the transformed source X axis handles a camera exactly on that axis. The reflected source frame determines the cross-product sign.

For this primitive, `size.x` is the **full width**, `size.y` the length, and `size.z` the near-edge axial displacement. Applying the ordinary camera-quad half-extent rule would double the ray width. Source UVs span width horizontally and run from V=1 at the near edge to V=0 at the far edge. The helper writes six vertices into caller-owned position/UV buffers without allocating replacement GPU buffers. Callers supply an orthonormal world-space source frame and converted dimensions; it does not guess the attachment bone or character transform.

Four numerical regressions cover dimensions/displacement/UVs, camera rotation, degenerate eye alignment, buffer boundaries and invalid input. A GPU regression projects the same ray from two orthogonal camera positions and verifies the exact expected 4×8-pixel coverage in a 12×12 framebuffer, with one geometry allocation throughout. TypeScript and all 755 unit tests pass. The helper is not yet connected to the Illumination renderer, so this is primitive validation rather than a complete-mark visual comparison.

The [pinned emitter reader](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/readVfxSystem.ts) reconstructs omitted color-lookup selectors as lifetime on X and constant on Y, with unit scales and zero offsets. The exported `color-eyefade` image has 64 identical rows, so its row selection does not change sampled pixels. Its alpha is 255 at the inspected lifetime samples; the ramp changes RGB brightness, not alpha. Native attachment/refresh behavior and complete effect composition remain open.
