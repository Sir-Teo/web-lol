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

## Garen character data and shared stat integration

`extract-garen-character.py` now verifies the complete Garen character/spell BIN against the frozen Riot archive and retains it in `reference/garen-character.json`. The comparison allows a named string to match an unresolved reference hash only when its FNV hash is exactly equal; numeric values and record structure must still match. This handles four occurrences of the `Champion` tag or `GarenWPassive` name without weakening the value comparison. Repeated extraction verifies the committed pin.

`export-garen-progression.py` produces the source stat profile: 690 base HP, 69 attack damage, 38 armor, 32 magic resistance, 340 movement speed, 175 attack range, 0.625 base attack speed and ratio, and 3.65% attack-speed growth. Health regeneration is 1.6 per second before growth/passive. Resource base/regeneration are explicitly zero; omitted resource growth is represented as zero under the mana-free adapter policy. Original floats remain in the source record.

The profile retains Garen's authored basic attack delay offset and its separate attack-speed scaling parameter (0.5). Its initial 17-tick windup is the existing conventional base-windup adapter calculation, not native timing verification. That scaling parameter must be integrated deliberately when melee attacks are connected; it must not inherit Ashe/Lux's current windup scaling automatically. Passive regeneration and Q/W/E/R are not implemented by importing these base stats.

The live world's spawn, regeneration and level-up paths now use an explicit `championProfile` lookup for supported champions, including attack speed ratio, range, movement speed and initial windup. Unknown identities fail instead of silently choosing Ashe. Garen's generated profile remains outside the playable registry until his kit, melee attack presentation and save/input support are integrated. Existing Ashe/Lux behavior remains covered by all 819 tests and the nested production smoke (17 recordings and real casts), which pass after the registry change.

## Decisive Strike data and shared silence

`export-garen-q.py` exports the named values from the verified `GarenQ` activation record and selected flags from `GarenQAttack`. The five ranked damage values are 30/60/90/120/150 with a 1.5 total-AD coefficient. Movement duration rises from approximately 1.4 to 3.6 seconds, with a 35% speed bonus. The attack window is 4.5 seconds, silence is 1.5 seconds and authored cooldown is eight seconds. The rank-zero and extra seventh slots are excluded using the source five-level tooltip declaration. These named values differ from the older effect array on the child attack record; the exporter does not substitute that array. Attack reset and non-cancellable attack-windup flags remain explicit. Cooldown-start timing, slow removal, empowered attack consumption, lunge and full melee release are still integration work.

The shared simulation now supports `applySilence`: it extends the silence deadline without shortening an existing effect, rejects invalid durations/dead or structural targets, and interrupts recall. New champion spells and Flash are blocked before resource spending or Lux E's early/active recast shortcut. Heal has an explicit silence exception. Movement and basic attacks continue, and current non-channel pending casts still release. New recall requests are blocked during silence. These are the current supported-roster capability policies; native channel-specific exceptions and future item/summoner interactions still require separate evidence and implementation.

Bots skip silenced offensive/peel/scouting/Flash attempts and continue their movement/basic-attack decisions. Unit bars show `SILENCED` below stun/root priority. Snapshot version 66 requires the deadline, preserves remaining duration during restoration and clears it on respawn. No playable Garen or automated Garen Q application is claimed yet.

Validation: all 824 tests across 179 files pass, including blocked casts/Flash, allowed Heal, exact expiry, movement/attack preservation, Lux E recasts, recall interruption, invalid deadlines, snapshot continuation, respawn and silenced bot disengagement. Browser tests verify visible silence status, real keyboard cast rejection/recovery and the existing root behavior. The silence screenshot was visually reviewed. Production build and nested static smoke pass with 17 recordings and real Hawkshot/Light Binding casts.
