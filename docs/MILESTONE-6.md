# Milestone 6 — Reference-Mode Audit and 10-Champion Expansion

Completed and certified on save schema **`185`**, ruleset **`e5e3cc7f70fae406cd8bf03ba5a5a90fc7dc87ab2e931ad190b5fe099897cad0`**, and production offline pack **`e74775d99c3a41065334112dbbfce01e7176e880ee3b2549f19655a8760d4c16`** (`1,519` files / `581,692,009` bytes, worker policy `41e26572bb22a1213c268473c6cdbb7bc0aba4b95cf7e6d27ad07131b749873a`).

## 1. Delivered Systems (Patch 26.18 Standard PC Summoner's Rift)

### 1.1 Ten Distinct Champions & Zero-Mirror 5v5 Roster
- Added four complete champions with 3D skeletal GLB 2.0 rigs (`Run`, `Idle`, `Attack1`, `Spell1`–`Spell4`, `Death`), ability/portrait icons, cast timings, VFX (`src/render/milestone6-visuals.ts`), synthesized Web Audio cues, bot combat tactics, save/restore schema `185` validation, and deterministic replay:
  - **Darius** (Top Juggernaut): *Hemorrhage / Noxian Might* (1–5 bleed stacks + bonus AD), **Q** *Decimate* (blade sweet-spot heal + bleed vs shaft), **W** *Crippling Strike* (empowered reset + 90% slow), **E** *Apprehend* (passive armor penetration + cone pull/airborne), **R** *Noxian Guillotine* (stack-scaled true damage + temporary reset on execute).
  - **Vi** (Jungle Diver): *Blast Shield* (max-HP shield on ability hit), **Q** *Vault Breaker* (dash knockback + armor shred stack), **W** *Denting Blows* (3-hit max-HP physical proc + armor shred + attack speed), **E** *Excessive Force* (empowered cleave cone behind target), **R** *Cease and Desist* (unstoppable lock-on pursuit + knockup/slam).
  - **Ezreal** (Bottom Marksman): *Rising Spell Force* (stacking attack speed per ability hit), **Q** *Mystic Shot* (on-hit skillshot reducing all ability cooldowns by `1.5 s`), **W** *Essence Flux* (champion/epic/structure mark detonated for bonus magic damage + mana refund), **E** *Arcane Shift* (blink + homing bolt prioritizing Essence Flux), **R** *Trueshot Barrage* (global magic wave).
  - **Morgana** (Support Catcher): *Soul Siphon* (heal off champion/large-monster/cannon ability damage), **Q** *Dark Binding* (`2.0`–`3.0 s` linear root), **W** *Tormented Shadow* (`5 s` ground DoT scaling with missing HP and reducing cooldown on Soul Siphon ticks), **E** *Black Shield* (`5 s` magic-damage shield granting full crowd-control immunity while active, including the breaking hit), **R** *Soul Shackles* (multi-target tether slow + `1.5 s` stun after `3.0 s` in range).
- Default 5v5 match composition (`createLaneMatch`) now assigns **10 distinct champions with zero mirror matchups** across all five roles:
  - **Blue:** Darius (Top), Vi (Jungle), Ahri (Mid), Ezreal (Carry), Leona (Support)
  - **Red:** Garen (Top), Master Yi (Jungle), Lux (Mid), Ashe (Carry), Morgana (Support)

### 1.2 Season 2026 Role Quests (`src/content/role-quests.ts`, `src/simulation/role-quests.ts`)
- Every champion receives a role-matched quest (`top`, `jungle`, `mid`, `carry`, `support`) tracked in `unit.roleQuest` and rendered on the HUD & Tab Scoreboard:
  - **Top:** Raises level cap from **`18` to `20`** (`LEVEL_19_XP`, `LEVEL_20_XP`) and reduces Teleport cooldown (`300 s` → `210 s`).
  - **Jungle:** Completes at `40` Gustwalker/Mosstomper/Scorchclaw treats (`900` → `1,200` Primal Smite + companion buff + `+4%` monster move speed).
  - **Mid:** Upgrades owned Tier 2 boots to Tier 3 (+5 MS & enhanced stats) and grants **4-second Empowered Recall** (`240` ticks vs `480` ticks).
  - **Carry:** Unlocks a **7th item slot** (`maxInventorySlots(unit) === 7`, keybind `8`) and `+2` bonus gold per lane minion CS.
  - **Support:** Evolves World Atlas (`+300 HP`, `+50%` mana/HP regen, `4` ward charges) and allows holding `2` Control Wards simultaneously.

### 1.3 Epic Objectives, Elemental Rift, Dragon Souls & Elder Dragon (`src/content/epic-objectives.ts`, `src/simulation/epic-objectives.ts`)
- **Upper Pit (`x: 5007, y: 10471`):**
  - **Voidgrubs** (`5:00`, single 3-grub spawn): grants permanent structure-burn stacks (*Touch of the Void*, `1`–`6` stacks) and spawns **Voidmites** at `4+` stacks when attacking enemy structures.
  - **Rift Herald** (`14:00`, despawns `19:45` before Baron): drops **Eye of the Herald**, allowing channel-summon of an allied lane-pushing Herald that executes *Shelly Charge* (`2,000 +` scaling true damage to turrets).
  - **Baron Nashor** (`20:00`, `300 s` respawn): retained with *Hand of Baron* empowered siege waves.
- **Lower Pit (`x: 9866, y: 4414`):**
  - **6 Elemental Drakes** (`5:00`, `300 s` respawn): **Infernal**, **Mountain**, **Ocean**, **Cloud**, **Hextech**, and **Chemtech** stacking team buffs.
  - **Elemental Rift Transformation:** After the 2nd drake is slain, the 3rd drake's element locks the Rift theme for the rest of the match.
  - **Dragon Soul:** First team to `4` drakes claims the permanent Elemental Soul passive.
  - **Elder Dragon** (`360 s` after Soul): grants **Aspect of the Dragon** (`150 s` true-damage burn + **20% max-HP Elder Immolation execute**).

### 1.4 Vision Variants & Season 2026 Faelights (`src/content/faelights.ts`, `src/simulation/wards.ts`)
- **Farsight Alteration (`3363`):** Level `9+` trinket swap (`4000` cast range, `1` HP visible untargetable-by-sweeper blue orb, `500` vision radius, `45 s` reveal pulse).
- **Control Ward (`2055`, `75g`):** Purchasable `4`-pip visible detector (`900` sight/true-sight radius) that reveals and disables nearby enemy Stealth Wards (`1` active per player, `2` after Support Quest completion).
- **Season 2026 Faelights:** `8` luminous ward pads at river/jungle entrances (`FAELIGHTS`); placing an allied Stealth or Control Ward inside a Faelight (`165` capture radius) expands vision by **`+25%`** and pulses **`45 s` of bonus super-region reveal**.

### 1.5 Expanded 58-Item Catalog, Actives, Passives & Fountain Undo (`src/content/expanded-items.ts`, `src/simulation/item-effects.ts`)
- Expanded shop from `25` to **`58` items** across Starter, Boots, Basic/Epic components, and Fighter/Marksman/Mage/Tank/Support Legendaries, with strict uniqueness enforcement (`boots`, `last-whisper`, `lifeline`, `spellblade`, `sunfire`, `tiamat`, `void-pen`, `support-quest`, `jungle-companion`).
- Active items bound to keys `1, 2, 3, 5, 6, 7` (plus `8` for 7-slot Carry): **Health Potion** (`2003`, 5-stackable `15 s` regen), **Control Ward** (`2055`), **Zhonya's Hourglass** (`3157`, `2.5 s` invulnerable/untargetable Golden Stasis), **Youmuu's Ghostblade** (`3142`, *Wraith Step*), and **Locket of the Iron Solari** (`3190`, AoE team shield).
- Named item passives: *Spellblade* (Sheen / Trinity Force), *Lifeline* (Sterak's Gage), *Immolate* (Bami's Cinder / Sunfire Aegis), *Torment* (Liandry's Torment), *Tempest* (Luden's Companion), *Mist's Edge* (Blade of the Ruined King), *soul-siphon* / *Grievous Wounds* (Thornmail), *Absorb* (Force of Nature), and **Fountain Undo** (`undoShopTransaction`, cleared upon leaving fountain or affecting combat).

### 1.6 Editable Runes & Stat Shards (`src/content/runes.ts`, `src/simulation/runes.ts`)
- Every champion has a curated default Rune page and full **New Match** customization across:
  - **6 Keystones:** *Press the Attack*, *Conqueror*, *Electrocute*, *Arcane Comet*, *Grasp of the Undying*, *First Strike*.
  - **5 Secondary Runes:** *Triumph*, *Presence of Mind*, *Transcendence*, *Coup de Grace*, *Bone Plating*.
  - **3 Stat Shard Rows:** Offense (`Adaptive Force`, `Attack Speed`, `Ability Haste`), Flex (`Adaptive Force`, `Move Speed`, `Scaling Health`), Defense (`Flat Health`, `Tenacity`, `Scaling Health`).

### 1.7 Exhaustive Patch 26.18 Reference Coverage & Deviations Ledger (`src/content/reference-coverage.ts`)
- Every advertised champion, ability, role quest, epic objective, vision variant, item, rune, and core system is cataloged across **`158` entries**:
  - **`49` `verified-behavior`**
  - **`34` `verified-data`**
  - **`75` `approximation`** (with explicit player-facing deviation notes)
  - **`0` `unimplemented`**
- Exposed directly to players under **Pause → Reference & patch 26.18** with live summary counts, category filters, and explicit licensing/asset provenance notes.

---

## 2. Verification & Multi-Browser Acceptance

| Gate | Command / Config | Result |
| --- | --- | --- |
| Asset & Map Validation | `npm run assets:validate` | **Passed** (`90` GLBs + map, `0` errors, `0` warnings) |
| Milestone 6 Systems & Replay Unit Suite | `npx vitest run tests/milestone6-systems.test.ts` | **Passed** (`10/10`) |
| 10-Champion Zero-Mirror Roster Contract | `npx vitest run tests/milestone6-roster-contract.test.ts` | **Passed** (`15/15`) |
| Archived Reference Trajectory Regression | `npx vitest run tests/ahri-*-gameplay-reference.test.ts tests/item-selling.test.ts tests/smite.test.ts tests/bot-jungle.test.ts` | **Passed** |
| Offline UI Ownership Suite | `CHROMIUM_PATH=/opt/google/chrome/chrome npx playwright test -c tools/qa/offline-ui.playwright.config.ts` | **Passed** (`12/12`) |
| Multi-Browser Milestone 6 Acceptance | `xvfb-run -a npx playwright test -c tools/qa/milestone6-multibrowser.playwright.config.ts` | **Passed** (`3/3`: Chrome `157`, Firefox `155`, WebKit `26.6`) |
| Public Rift 7-Reload & Sequential Lifecycle | `npx playwright test e2e/milestone4-public-rift.spec.ts e2e/roster-player-selection.spec.ts e2e/game.spec.ts` | **Passed** (with `pagehide` → `disposeSession()` GPU context cleanup) |
| Production Nested Subpath Audit | `npm run test:production` | **Passed** (`10` public champions, `0` failed/out-of-prefix requests) |
| Production HUD Keyboard & Audio Gate | `node tools/qa/production-hud-keyboard.mjs` | **Passed** (`0` errors) |
| Full Offline Pack Browser Audit | `node tools/qa/offline-pack.mjs m6-final-pack` | **Passed** (`1,518` SW responses, `581.69 MB`, `0` errors) |
| 16-Minute 10-Champion 5v5 Simulation Sweep | `node tools/qa/simulate-rift.mjs 960 artifacts/milestone6-rift-simulation.json public` | **Passed** (`57,600` ticks, `0` violations, `restoredEqual: true`) |
| Node QA & Milestone Verifiers | `npm run test:qa` | **Passed** (including `verify-milestone5` & `verify-milestone6`) |

---

## 3. `morluto/rea` (`rea-agents@6.10.1`) Shipped-Artifact & Runtime Certification

Certified against the final Prettier-formatted `dist/` deployment (`root_artifact_sha256: e8a5826dad55d9c8a06131a556cb3e0215ad8bd047dfffbcbc493dd666837633`, `pack: e74775d99c3a41065334112dbbfce01e7176e880ee3b2549f19655a8760d4c16`) and exported to `artifacts/milestone6-rea-evidence-bundle.json` (`65,726,744` bytes, SHA-256 `7dbdfc6f5adf4f53f09ec0a04d7982c6438d12f4a60bd766e1801e3a1984fc5d`, `12` canonical Evidence records, `1` tracked Unknown, verified via `rea-import_evidence_bundle`):

- **Release Exposure Audit (`ev_e7efb70c76e14e7a1c43e6f384708a51dfa9d3fd2ca1547be6717e53728b5955`):** `0` exposed checks, `0` credential markers, `0` debug companions, `no_exposure_observed_in_assessed_checks: true`.
- **Static JavaScript Application Graph (`ev_3415fba92fcdab04683560ccfe8f0a7f07371db7f01acd3200fd6178e1dd7c29`, summary `ev_293cfae3bb917963bfac9e4bd34bd5cf318917e652fd5bfb34a098d84c069b0b`):** Parsed `assets/game-D3H4CujO.js`, `assets/rules-jGs98ZHQ.js`, and `offline-worker.js` (`1,793,557` text bytes, `439,996` AST nodes, `2,246` findings, `0` parse failures).
- **Feature Trace (`ev_0eff701efda486ee87ac9ee75ca22bc24644098405bff28adab6b480e18047a7`, summary `ev_881ffeebb30de8dd4ce4d61da204044e3e1c82930604c1feddfe4fbf73e9482d`):** Traced `357` nodes and `917` edges from `assets/game-D3H4CujO.js` (`0` native handoffs).
- **Passive CDP Inspection, Screenshot & Runtime Reconciliation (`ev_2283593c…`, `ev_ae8b5380…`, `ev_40d1e5e3…`, `ev_88656d4fa1089dd72dedf0b88c1ef163a1ca1d1f8b12e1f13a88c0e371a81021`):** Reconciled live `http://127.0.0.1:4188/` WebGL 2 page state against the static `dist/` graph.
- **Controlled Browser Scenario (`ev_3d87c3ac5d1a2d0ee418fe7e7b30326dad635b78611a817081fd32433362fa07`, summary `ev_39ddce46553d893732e5ca432a6c3fc9f94135cbe8efb33672e91f836277e799`):** Completed `10/10` steps (`0` errors) opening Pause → **Reference & patch 26.18**, inspecting the 158-entry ledger, opening **New match**, selecting **Ezreal** and **First Strike**, and resuming Summoner's Rift.
- **Residual Unknown (`unk_2fd7749ba474e6a690b356f972d4a5808bd8c52121a77d14924039050ad79b6c`, `low` severity):** Tracks native Riot 26.18 WAD mesh/bone/Wwise bank comparison for Milestone 6's local rigs and synthesized cues pending licensed offline reference archives.
