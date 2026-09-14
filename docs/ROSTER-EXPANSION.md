# Garen and Ahri roster expansion

September 14, 2026. Garen and Ahri are the next proposed additions: melee frontline and a mobile mage. They are **not yet playable**. Ashe and Lux remain the selectable roster until each new champion has its own integrated kit, presentation, HUD, bot policy and save validation.

## Verified source foundation

The new `extract-roster-model.py` supports both champions. Initial import uses versioned CommunityDragon JSON as a naming dictionary, extracts the actual skin/animation BIN files and referenced assets from the already frozen Riot manifest `29CE6E781C3B6368`, then requires exact equality between the decoded BIN definitions and those named records. The resulting pins contain source URLs, definition hashes, archive/chunk/file hashes and complete atomic animation mappings. Later runs use the committed pins and verify extraction without accepting changed source bytes.

| Champion | Verified files | Atomic clip mappings | Important presentation requirements |
|---|---:|---:|---|
| Garen | 38 | 36 | Source mesh/skeleton, diffuse, gloss and reflection resources; attack/Q/spin animation integration |
| Ahri | 57 | 55 | Distinct body/tail materials, hidden large-tail submesh, dynamic ultimate materials and turn-driven tail/hair rig modifiers |

The counts distinguish animation graph entries from unique files. Material resources are collected alongside mesh and animation dependencies, including referenced secondary textures. This avoids applying the body diffuse texture indiscriminately to Ahri's tails or dropping Garen's gloss/reflection sources during preparation.

Ahri's named shader and ClientStates links initially differed from the decoder's unresolved entry hashes. Registering those exact source strings in the entry hash dictionary resolved the discrepancy; no BIN values were changed or comparison bypassed. Both complete definitions now match. Two consecutive extractions verified the same files and clips.

Reproduce from the repository root:

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-roster-model.py Garen
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-roster-model.py Ahri
```

Pins: [Garen](reference/garen-model.json), [Ahri](reference/ahri-model.json). Extracted binary assets remain in the ignored `.cache/<champion>-current-sources` directories. No extra runtime downloads or incomplete champion-selection buttons have been introduced.

## Integration sequence

1. Convert and validate both rigs/atomic clips as GLB, preserving materials, source scale and submesh visibility. Inspect idle, movement, attack, cast and death poses in a browser preview. Animation graph logic and shader behavior remain separate from atomic clip conversion.
2. Implement Garen's distinct resource-free progression and melee attacks, then passive recovery, empowered attack/silence, defensive window, spin and targeted ultimate from pinned spell data and behavioral evidence. Integrate cast/CC capability rules rather than routing him through Ashe defaults.
3. Implement Ahri's returning projectile, charm, dash/recast state and other kit mechanics with source-derived timings and explicit unresolved behavior. Her source tail modifiers and ultimate materials need dedicated presentation work.
4. Add champion-specific input, HUD/tooltips, items, tactical decisions and lane assignments. Extend snapshot validation and interruption/restore scenarios before exposing selection.
5. Compare complete fights, then add the champions to lane matches and run seeded multi-champion matches. Evaluate group disengagement with the new melee/ranged mix rather than assuming current attack-power estimates are sufficient for burst or frontline roles.

Source import is not proof of native gameplay or pixel parity. Full interaction coverage, material/animation calibration, audio, ability effects and role AI remain implementation work.

## Browser models and animation review

`convert-roster-base.mjs` now converts either pinned roster model with the existing lol2gltf/glTF Transform toolchain, verifying every input against its source pin before conversion. It retains all atomic clips, applies the same unit conversion to positions, skeleton translations, inverse-bind translations and animation translations, and canonicalizes only zero-weight joint slots. Omitted source `skinScale` currently uses identity; native scale calibration remains open. No geometry simplification is applied.

| GLB | Bytes | Source triangles, including hidden geometry | Bones | Clips |
|---|---:|---:|---:|---:|
| Garen base | 2,764,444 | 6,336 | 68 | 36 |
| Ahri base | 19,854,544 | 21,678 | 211 | 55 |

The generated manifests in `public/assets/models` retain source provenance, output hashes, material-to-texture assignments and clip durations. Both outputs pass glTF validation with zero errors and zero warnings. Build copies match their manifest hashes. Ahri's larger pack retains the complete atomic set; pack splitting/compression should be measured without reducing animation quality. Neither asset is requested by the current Ashe/Lux match loader.

Materials use unlit preview shading. The converter resolves explicit material overrides to their diffuse samplers, so Ahri's Body/Eyes use the body texture while Tails/Tail_Large use the tail texture. Authored material blend flags are retained where supplied. Her `Tail_Large` remains in the asset with `defaultHidden` material metadata, which the preview honors. Garen's gloss/reflection and Ahri's dynamic ultimate materials and rig-pose modifiers remain source-pinned but are not rendered by this preview. A future match loader must honor hidden-submesh metadata too.

Reproduce conversion after extraction:

```sh
node tools/assets/convert-roster-base.mjs Garen
node tools/assets/convert-roster-base.mjs Ahri
```

During `npm run dev`, open `/tools/qa/roster-models.html` to select champions and any atomic clip, play/pause, or scrub time. The preview retains source scale and uses a common camera/grid. Ahri's `idle_var2` and Garen's `idle1_base` are inspection defaults, not completed animation graph policies.

The browser scenario samples every clip at zero and 37% duration, checks finite bone matrices and animated pose changes, distinct diffuse textures and hidden geometry, then exercises actual selection/play/pause controls. Screenshots of idle and action poses were visually reviewed for both champions. TypeScript, all 819 tests and the production build pass. This establishes loadable animated models, not playable champion kits or native pose/shader parity.
