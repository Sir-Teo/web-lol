# Structure progression and base assets

## Retaliation target recovery

Turrets now release a retaliation order when its champion target becomes invalid or leaves the current attack boundary (turret range plus target radius), then reacquire an eligible visible target in the same simulation tick. Previously an out-of-range but still visible champion could leave the tower indefinitely holding an unusable attack order, preventing lane defense.

This correction preserves the existing attack deadline and any missile already released. A valid committed windup keeps its existing semantics; this change does not reconstruct native windup leeway or retarget delay. Ordinary mobile-unit pursuit is unchanged. Five simulation cases cover reacquisition, in-range priority, target death, visibility, range boundaries, released missiles and saved continuation. A browser case observes actual resumed minion damage after champion retaliation ends.

The default Rift contains 22 towers, six inhibitors, and two Nexus objects at the source-authored transforms. Both teams use matching patch 16.18 meshes, rigs, painted textures, and retained animation clips. This establishes the building dependency chain and a terminal local-game result; it does not certify full structure or match fidelity.

## Data and implemented rules

`docs/reference/structure-rules-source.json` freezes seven selected CharacterRecords with source URLs, file hashes, and resolved property keys. Unresolved record names are matched using the game's lowercase FNV-1a path hash. The layout exporter validates that snapshot's hash and includes the selected statistics in `rift-layout.json`.

| Structure | Initial health | Armor / MR |
|---|---:|---:|
| Outer turret | 9,000 | 60 / 60 |
| Inner turret | 5,000 | 60 / 60 |
| Inhibitor turret | 4,750 | 60 / 60 |
| Nexus turret | 3,500 | 60 / 60 |
| Inhibitor | 4,000 | 0 / 0 |
| Nexus | 5,500 | 0 / 0 |

The turret values agree with Riot's [26.1 patch notes](https://www.leagueoflegends.com/en-sg/news/game-updates/patch-26-1-notes/). The runtime also applies the selected base damage/range/attack-speed values and source health-bar heights. This is base data only: item/script modifiers, timed damage scaling, plates, and backdoor protection remain unfinished. Gameplay radius uses the explicit override where present and otherwise the pathfinding radius; that fallback still needs reference collision calibration. Inhibitor/Nexus regeneration currently interprets the static regeneration field as health per five seconds; its timing and health-segment behavior are not certified.

Riot's [game guide](https://www.leagueoflegends.com/en-us/how-to-play/) describes clearing a lane through three towers and an inhibitor, then the two Nexus defenders. The simulation checks protection both during target acquisition and at damage application. Inner defenders require the earlier towers in their lane to be destroyed. An inhibitor requires its lane's defenders to be destroyed. Nexus turrets require at least one allied inhibitor to be down; the Nexus additionally requires both of its turrets to be down. Other lanes remain protected independently.

Inhibitors currently return after 300 seconds, at full health and at the same authored position. The exact timer remains a reference-reconciliation item: its boundary is tested, but it has not yet been independently recovered from the pinned gameplay scripts. Nexus turrets return after 180 seconds at 40% health, following the respawn timing introduced in [25.S1.1](https://www.leagueoflegends.com/en-au/news/game-updates/patch-25-s1-1-notes/) and the health change in [26.1](https://www.leagueoflegends.com/en-sg/news/game-updates/patch-26-1-notes/). Regrowth can protect the Nexus again.

Destroying either Nexus sets the opposing winner, clears orders and pending commands/waves, and stops subsequent simulation steps and purchases. The result dialog offers a restart, traps keyboard focus, and cannot resume a finished game. Rendering continues the destruction animation behind the result. This is a valid terminal condition in the local practice simulation, not a complete nine-bot match implementation.

## Asset reconstruction

`base-structure-definitions.json`, `base-structure-extraction.json`, and `base-structure-wad-paths.json` retain the four skin/animation definitions and pin 40 source assets from 56 CDN chunks. The extractor yields 8,317,618 source bytes. The shared structure converter preserves source submesh names and state metadata, geometry precision, skinning, and full-resolution textures. Tower outputs remain byte-identical after moving their conversion into this shared module. Rebuilding all four base models also reproduces their committed bytes exactly.

```sh
PYTHONPATH=.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/extract-reference-base-structures.py
node tools/assets/convert-base-structures.mjs
.tools/cdtb-venv/bin/python tools/assets/export-rift-layout.py
npm run assets:validate
```

The idle body and destroyed submesh remain separate. Nexus death plays once and clamps; inhibitor death transitions into its authored dead-idle clip. Regrowth currently switches back to the intact idle state at the gameplay deadline. Spawn/respawn clips and particle event definitions are retained, but their complete event sequencing, ambient effects, sounds, shader glow, and final-match camera choreography remain unfinished. A generic glTF viewer must honor the node visibility extras to avoid overlapping intact and destroyed parts.

## Verification and next work

Simulation scenarios cover initial structure counts/health/protection, rejection of protected attacks and damage, lane-specific exposure, inhibitor and Nexus-turret respawn boundaries, fixed positions, and immutable terminal results for either team. Browser scenarios cover both base layouts, destruction/dead-idle playback, a real right-click final attack, bot-driven defeat, continued rendering after game end, keyboard focus, and restart. Tests preserve the original practice fixture separately.

Destroyed inhibitors now affect future lane waves through the [super-minion foundation](MINIONS.md), including both-team source models and the frozen barracks counts. Minion speed, economy, scaling, and mid/late wave cadence still need reconciliation with the 26.1 changes and later patches through 26.18. Permanent plates, structural rewards, regeneration thresholds, siege damage modifiers, exact building-knowledge calibration, and full-match bot behavior remain required production work. Known building presentation is described in [vision policy](VISION.md).

## Animation-aware rendering bounds

`src/render/animation-bounds.ts` prepares conservative spheres once on each unplaced building reference. For each bone, the importer records the largest influenced-vertex radius after the inverse bind transform. Rest transforms and all ordinary clip keys bound local translation magnitude and scale. The ancestor recurrence `offset = parentOffset + parentScale * localTranslation` and `scale = parentScale * localScale` then bounds the joint's contribution for any rotation. Positive skin weights combine these contributions; the sphere is transformed back into mesh space with an upper bound on the inverse transform's operator norm. Small margins cover numerical quaternion error.

This supports the pinned TRS building rigs and normal clip blends. Animated mesh ancestors, additive clips, cubic interpolation, morph targets, detached binding, malformed weights, or unsupported bindings retain disabled culling. Source bounds survive skeleton cloning. Native per-mesh frustum tests run separately for the gameplay and shadow cameras; building knowledge and offscreen simulation remain unchanged. No per-frame vertex scan is added to gameplay.

The browser regression samples every vertex at 17 poses per imported clip across all six building assets, including initially hidden parts. It checks over 10 million deformed positions against the cloned spheres. Fourteen frozen gameplay renders compare every framebuffer byte with culling enabled and disabled, covering the center, both bases, offset views, and destruction poses with shadows enabled. All sampled comparisons are identical; center-view intact draw calls fall from 182 to 113 in this controlled fixture. The mathematical envelope covers between-sample poses under the supported assumptions; the sampled test guards implementation and asset changes. Arbitrary future rigs or additive animation must not inherit certification without extending these checks.

## Destruction phase reconstruction

Animated structures now seek their source destruction clip from elapsed time since the known death tick. Once that clip completes, structures with a destroyed-idle clip enter it at the corresponding loop phase. A late first render or fresh restore of a dead structure does not restart its collapse. Terminal presentation still completes the transition while gameplay is frozen. Terminal elapsed playback is not stored; terminal restores continue from the saved simulation age. Static tower rubble remains at its authored destroyed pose.

The renderer retains the known destruction clock while the destroyed representation remains active. Hidden inhibitor regrowth therefore cannot reset the visible rubble animation by clearing the live unit's death tick. An observed regrowth returns the model to its living state. For a fresh view of remembered rubble whose live unit has already regrown unseen, the original death timestamp is unavailable in the knowledge snapshot: the renderer initializes a completed destruction and starts the destroyed-idle loop. That remembered loop phase is not a save guarantee.

The browser scenario verifies both teams' inhibitor skeletons at a late initial render and on fresh restoration, with pose components matching within 1e-7. It also checks the remembered enemy clock and expected destroyed-idle loop phase across controlled hidden live regrowth. Existing base destruction, terminal results, fog visibility, and regrowth scenarios remain applicable. Exact source particle events and respawn transition sequencing remain unfinished.


## Saved intact animation phase

Schema 60 adds `structureIdle`: the actual idle-entry tick plus the last observed entry tick for each team. Initial placement establishes the entry; an inhibitor or nexus turret returning from destruction starts a new idle segment. Each team's observed tick updates only while the intact structure is visible. The existing public destruction knowledge remains unchanged. A hidden regrowth therefore cannot disclose its new idle phase under fog.

The renderer seeks the source `idle1` clip from the known entry tick and display interpolation, modulo its actual loaded duration. Missing render frames, repeated paused draws and restoration no longer advance or restart intact structure animation. Terminal presentation retains its elapsed-time extension after the match stops. Destruction/ruined-state animation keeps its existing separate path; native regrowth event sequencing is still uncalibrated.

The decoder requires the clock on the three structure kinds, checks actual entry against match/death chronology, and rejects observations newer than the actual entry. Simulation tests cover both teams' hidden inhibitor regrowth, saved observation state, sight acquisition/loss and malformed clocks. All 711 unit tests pass.

A browser check covers both teams' turret, inhibitor and nexus rigs on the full Rift, verifying three interpolation phases, exact paused bone matrices and real browser save/reload. Six existing browser regressions cover source placement, victory/defeat, destruction phase and hidden structure state; all seven browser checks and the production subpath smoke check pass. This is temporal groundwork for historical turret hit-bone attachment; structure impacts still use the documented fallback until the full pose path is implemented.


## Saved destruction knowledge

Schema 61 replaces each boolean `structureKnowledge` value with a nullable destruction tick. Null means known intact; an integer records the public destruction event, including tick zero. Damage publishes that timestamp to both teams under the existing public-destruction policy. Visible regrowth clears the observing team's record; hidden regrowth retains it. `knownStructureDestroyed` still returns the same boolean/null presentation result, and `knownStructureDeathTick` supplies the event timestamp appropriate to the observer.

The renderer now derives its destruction clock from this saved knowledge on every draw. A rebuilt or reloaded model no longer invents an elapsed destruction duration when the actual structure is alive but remembered as rubble. A second public destruction also restarts the correct source phase even if the rendered destroyed/intact flag never changed between events. Submesh selection, the source destruction/dead-idle sequence and terminal presentation remain on their existing policy.

Snapshot validation requires knowledge on structures only, rejects future timestamps, requires public knowledge to match a currently destroyed structure, and checks a remembered destruction against the observer's idle entry and actual regrowth entry. Both teams' hidden-regrowth unit scenarios verify retention, restoration and clearing on sight; malformed timestamp cases include the old boolean shape. All 712 unit tests pass.

The rebuilt-model regression first reproduced a different inferred destruction tick after hidden regrowth. Its updated check compares the rebuilt clock and dead-idle phase with the original. A separate browser scenario uses actual inhibitor regrowth, confirms that the enemy remains unseen and remembered as destroyed, then checks exact bone/phase restoration through a real browser checkpoint. It also verifies a second public destruction while the model's destroyed flag remains true. All eight structure browser checks and the production subpath smoke check pass.

This makes structure destruction timing reproducible from the saved observer state. Historical turret impact poses still need a common structure pose sampler and saved attachment placement; source event-graph reconstruction, native regrowth sequencing and missing-bone fallback remain incomplete.


## Shared structure-pose selection

`structurePose` now selects intact idle, static destroyed pose, animated destruction and the optional dead-idle loop from explicit timestamps and a rig profile. The caller supplies actual or observer-known state; the selector does not query visibility. The renderer uses this same pure selection and seeks a single paused action per draw. Submesh visibility still follows known intact/destroyed state. This provides a reusable pose description for historical attachment sampling without borrowing the live renderer's mixer state.

`export-structure-animation-profiles.mjs` verifies the recorded size and SHA-256 of all six structure GLBs, then exports exact clip input endpoints and the converter's existing playback metadata. `src/content/structure-animation-profiles.json` supplies the runtime profiles; `docs/reference/structure-animation-profiles.json` records the source hashes and profiles. The flags describe the current converter/adapter policy, not independently recovered native event-graph behavior. For example, the turret's exported destroyed state still holds the first frame of its `respawn` clip; the new selector does not play that clip through.

Three pure-selector tests check idle interpolation, pre-entry clamping, the precise destruction/dead-idle boundary, looping, endpoint holds, terminal time, static rubble, zero-duration clips and missing data. All 715 unit tests pass. The full-Rift idle browser check now also compares every exported duration and playback flag against the actual loaded models. All eight structure browser checks and the production subpath smoke check pass.

```sh
node tools/assets/export-structure-animation-profiles.mjs
```

This consolidation does not change saved fields or certify native animation graph parity. Historical turret impact state/placement, a structure attachment sampler, native regrowth sequencing and structure effects remain unfinished.


Structure-target impact history now records the shared pose and authored map transform. Lux turret attachments use those saved poses and the same map-matrix conversion as live structures; inhibitors/Nexuses preserve explicit missing-bone fallback. See [the impact implementation and remaining fidelity limitations](LUX-ATTACK-IMPACT.md#structure-impact-poses-and-turret-attachments).

Lux impact geometry occlusion is now corrected by preserving the authored `miscRenderFlags` depth setting. Both turret screenshots show the bone-attached rings over the structure geometry; fog visibility remains independently enforced. See [source depth evidence and GPU validation](LUX-ATTACK-IMPACT.md#source-depth-flags). Native draw ordering and structure-specific effect dispatch remain unverified.

## Stable terminal interpolation

At victory the simulation stops producing new intervals, but the frame loop can continue cycling its accumulator fraction. The renderer previously combined that fraction with a frozen world tick and an advancing terminal age. This repeatedly revisited the final simulation interval, jittering last-step unit/camera placement and particle phases beneath the victory presentation.

`GameView.render` now fixes simulation interpolation at the completed tick whenever a winner exists. Terminal age still advances destruction poses and the migrated Lux particle families. Normal-match interpolation is unchanged. The correction is at the shared rendering boundary, so paused views, the regular frame loop and diagnostic renders all use the same terminal endpoint.

A browser regression creates a lethal Nexus projectile while the hero is moving, holds presentation age constant and varies the supplied interpolation fraction across five values. Before the fix, exact pose/particle comparisons failed. Afterward, Nexus bone matrices, hero placement, camera transform, impact rings/sparks and flight hoops/crescents match the completed-tick render exactly. The saved match is unchanged. Four existing terminal particle scenarios also pass, along with all 718 unit tests. This verifies stable interpolation rather than native victory cinematic parity.

```sh
npx playwright test e2e/terminal-interpolation.spec.ts e2e/lux-flight-terminal.spec.ts e2e/lux-impact-terminal.spec.ts
```
