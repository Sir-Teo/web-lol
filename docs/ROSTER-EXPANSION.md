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

## Garen melee simulation and scene integration

Garen can now be spawned as a non-player champion in controlled scenarios with `world.spawn('champion', team, point, 'garen')`. His verified base/growth stats, regeneration, melee range and zero missile speed feed the shared simulation. Basic attacks resolve through the ordinary on-hit path at release, including ordinary critical damage, rather than generating Ashe arrows or Frost/Focus. Cancelling a windup prevents its damage. This is the existing local melee timing/cancellation policy; native Garen attack-speed/windup scaling, range-loss edge cases and atomic-animation contact calibration remain open.

The renderer loads `garen-base`, selects `idle1_base` and `run_base`, uses his own attack/crit/death clips and the source recall clip for the current recall adapter. Both duration exporters now verify his GLB and include all 36 clips. Lux target pose sampling can use Garen's skeleton. The scoreboard displays his pinned 16.18.1 portrait and correct accessible name. The eager shared model loader currently adds his approximately 2.76 MB model to startup; selected roster packs remain delivery work.

Garen has his own stat registry entry, but remains excluded from player selection and the default lane roster. His unfinished spell ranks/casts are explicitly blocked rather than inheriting Ashe implementations. Snapshot version 67 accepts his ordinary combat/pose state and rejects player substitution, foreign spell state and unfinished learned ranks. These restrictions are temporary integration boundaries, not the final roster scope.

Four new simulation cases cover melee release without missiles, crits and cancellation, level-18 stats/regeneration, deterministic continuation of a pending attack, and incompatible spell/player state rejection. All 828 tests across 180 files pass. A browser scenario verifies his source attack animation, direct damage, Lux impact attachment and scoreboard portrait. Production build and nested static smoke pass with the added model request. Q empowerment, passive, W/E/R, native effects/audio and complete role AI remain required before exposing Garen as a playable champion.

## Garen basic attack windup scaling

The level-up path now uses the pinned basic-attack offset and its 0.5 scaling coefficient through `src/simulation/garen-attack-timing.ts`. The adapter computes an unrounded base windup from `(0.3 + offset) / baseAttackSpeed`, interpolates halfway toward the fully speed-scaled windup, and rounds the final duration to 60 Hz ticks. This replaces the previous full-rate scaling of an already rounded 17-tick base. At level 18, ordinary Garen attacks now use a 14-tick windup and retain their 59-tick attack period; level-one windup remains 17 ticks. AI arrival estimates read the same stored windup as attack dispatch.

The coefficient and offset are verified source values in `reference/garen-character.json`; the interpolation formula is an explicit adapter interpretation, not evidence of native execution. Public research did not provide an authoritative native timing trace. Garen's separate Q attack-time override is not routed through this helper. Attack-speed items, temporary Garen speed buffs, native cancellation buffers and animation contact calibration remain separate integration work.

Levelling during a pending attack changes subsequent attacks without moving that attack's release or cooldown deadlines. A regression checks damage before/at release, the next attack's shorter duration, and identical continuation after save/restore. All 829 tests pass. The browser scenario also levels Garen to 18, observes the 14/59-tick deadlines, and verifies direct damage at release with his source model loaded.

Production build and the nested static-hosting smoke pass, including real Hawkshot/Light Binding casts and all 17 audio recordings. The updated browser field screenshot was visually reviewed. The existing bundle-size warning remains.

## Decisive Strike first gameplay integration

Garen's Q can now be learned and cast by a non-player champion. The pinned named values drive rank damage, movement duration, speed bonus, attack window, silence duration and cooldown. Riot's [16.18.1 Data Dragon champion record](https://ddragon.leagueoflegends.com/cdn/16.18.1/data/en_US/champion/Garen.json) also describes slow removal and the next attack's silence/damage. The downloaded description agrees with the retained character data's intended behavior; it does not specify all execution details.

Activation costs no mana, cancels recall, clears both legacy and independent slow contributions (including critical Frost), resets the basic attack timer and retains the current movement/attack order. It leaves roots intact and grants no immunity to later slows. A separate `garenQ` record captures activation tick, rank, speed deadline, attack deadline and consumption. Speed bonuses from Q and Heal add in the existing movement adapter before slows. The attack captures Q's rank when its windup begins, so learning another rank or the 4.5-second buff expiring does not rewrite an already committed hit. The first valid melee hit adds the named Q damage to the normal attack, consumes the empowerment and applies 1.5 seconds of silence; consuming the hit does not remove the remaining speed bonus. Dead or invalid targets do not consume an unlanded hit. Death clears the owner buff.

Movement orders cannot cancel a committed Q windup. A stun prevents new attacks/movement but permits that pending strike to resolve, following the pinned attack flags. The existing target-validity policy still cancels when the victim becomes invalid; range/visibility and untargetability exceptions require native verification. Structures receive damage through the ordinary attack path and cannot be silenced.

Bots learn the available Q ranks and use it against a visible champion within a conservative chase distance, or for escape while retreating/outnumbered. The decision preserves their current movement decision instead of pausing until the next AI update. They use existing vision and tower-safety checks and do not react to hidden champions. Melee champions no longer inherit the ranged AI's automatic 180-unit backstep during recovery. Full Garen role logic, farming damage prediction with Q, jungle/objectives and team coordination remain unfinished.

The renderer selects Garen's source `spell1` clip for a captured Q attack. Visual review confirms it loads but also exposes that the local damage deadline is not yet calibrated to sword contact. This increment deliberately retains basic-attack windup/cadence rather than claiming to have decoded the separate `mOverrideAttackTime` calculation. Cooldown currently begins at activation; the authored delayed-cooldown flag still requires execution verification. Only the ordinary attack portion uses the existing critical multiplier; Q's special critical scaling remains unmapped. Lunge/range extension, speed caps, Q-specific running/weapon effects, source audio and native animation timing remain required. These limitations keep Garen excluded from player selection and the default lane roster; passive/W/E/R are also unfinished.

Snapshot version 68 adds Q's independent buff record and optional captured attack rank. The decoder checks owner identity, live ownership, learned rank, exact source-duration deadlines and incompatible attack ownership. It permits an already captured strike to complete after its buff expires. Ten Q simulation cases cover activation/expiry, reset/damage/consumption, interruption/expiry/save continuation, silence, invalid targets, malformed saves, ranked values, death, slow contributions and visible/hidden AI decisions. The browser scenario checks Q's source clip, the hit's silence, checkpoint restoration and rejection of actual player W input. See `artifacts/browser-garen-q-windup.png` and `artifacts/browser-garen-q-hit.png` for the reviewed controlled-fixture captures.

Validation: all 839 tests across 181 files pass. Three focused browser scenarios pass (Garen Q, Garen base melee and silence input). Production build and nested static-hosting smoke pass with 17 source recordings and real Ashe/Lux casts; the existing large-bundle warning remains. The model loader now requires Garen’s `spell1` clip as well as his basic-combat clips.

A final terminal-state regression covers an already stunned Q destroying the Nexus after the speed buff has expired. It verifies that consumption removes the expired buff, later units do not take another turn, attack poses clear and the resulting checkpoint remains valid and frozen on restoration.

## Garen Q override and animation contact marker

The Q timing exporter now reads the complete `mOverrideAttackTime` calculation rather than reusing basic-attack timing. The pinned expression is approximately `(1.7 - 0.2 × total attack speed)` seconds, with a 0.2 cast fraction. The adapter evaluates the original floats using unrounded base-plus-level attack speed, then rounds total and windup separately to local ticks. Level one produces 95 total ticks and 19 windup ticks; level 18 produces 90 and 18. These replace the temporary basic-attack values only for captured Q attacks. AI arrival estimates use the same Q windup while the buff is armed. Q-aware farming damage estimates were added in the farming increment below; attack-speed items/buffs remain unfinished.

The stat mapping required a historical comparison. The [calcrev calculation research](https://github.com/moonshadow565/calcrev/blob/40f21c06e5cfc10750bb44b39d1f2d4e3567a6dc/calc.py) maps its 2021 stat ID 3 to attack speed, ID 4 to windup time, and formula 2 to total. Its [historical Garen record](https://github.com/moonshadow565/calcrev/blob/40f21c06e5cfc10750bb44b39d1f2d4e3567a6dc/json/champs/garen.bin.json) has the same Q override with stat 3. After normalizing the previously unresolved total-time field and this stat ID, that record equals our current stat-4 override exactly. This was initially used to interpret current Q's stat 4 as total attack speed; the Courage review below disputes the formula label, so this is now provisional. copying the old enum globally would be incorrect. `reference/garen-q-timing-audit.json` retains URLs, hashes, both expressions and the comparison. The exporter requires that audit to match the pinned current source.

The source Q animation declares `castFrame: 10`. Its verified compressed ANM header records 30 FPS, decoded using LeagueToolkit's header layout. The exporter verifies the animation's pinned hash before exposing these values. The renderer maps frame 10 (one third of a second into `spell1`) to the captured release tick and plays the remaining clip over the recovery period. This removes the reviewed airborne damage pose: the updated browser capture places Garen in the descending sword-strike pose at damage. The contact-marker policy and piecewise playback rates are still a local interpretation, not a matched native capture.

Snapshot version 69 stores the Q release in its attack cycle. Timing remains fixed if Garen levels during the windup, and decoding rejects missing/mismatched release data, impossible timing pairs or a cycle that disagrees with the attack cooldown. The new regression checks level-one and level-18 timing, mid-swing level-up/save continuation, exact source contact time and malformed checkpoints. Existing Q interruption, death, terminal-match, AI and silence checks remain in place. Native override precedence, critical scaling, lunge, effects/audio and exact client-frame parity remain open.

Validation: all 840 tests across 181 files pass. Garen melee and Q browser scenarios pass; Q was rechecked with its attack cycle retained in the restored checkpoint. The updated impact screenshot was visually reviewed. Production build and nested static-hosting smoke pass with the existing 17 audio recordings and real Ashe/Lux casts. The pre-existing bundle-size warning remains.

## Perseverance integration

Garen now gains his pinned level-scaled maximum-health regeneration after an independent eight-second interruption window. Champion/turret damage and supported hostile ability contacts refresh the timer; lane minions do not. Base regeneration continues while interrupted. Snapshot version 70 preserves the timer and rejects incompatible owners/deadlines. See [GAREN-PASSIVE.md](GAREN-PASSIVE.md) for source evidence, exact rate units, tests and remaining native-event/VFX limitations. Player selection and the default roster still exclude Garen until his remaining kit is integrated.

## Courage source review and Q audit correction

Courage's root-mode rank values now have a strict exporter and [source contract](GAREN-W.md), including Riot-confirmed bonus-health shield scaling and independent defense windows. W remains unavailable pending integration. Comparing its historical and current formulas exposed contradictory evidence in the old calculation decoder used for Q. The Q audit now records that conflict and withdraws the claim that total attack speed is verified. Current timing remains explicitly provisional until Q-specific stat units and native behavior can be established.

## Garen empowered last-hit decisions

The farm planner now includes an armed, unconsumed Q's bonus damage using the
same helper as melee release and the rank captured when Q was activated. This
lets Garen prioritize a farther valuable minion that his ordinary attack cannot
kill. It does not assume a critical hit or automatically cast Q for farming.
Consumed/expired Q cannot create false opportunities. A strike started just
before expiration retains its captured empowerment through release, matching
the existing combat behavior. Armor, sight, melee range, safety checks and
incoming allied-missile exclusions remain in the common target-selection path.

Validation: all 853 tests across 183 files pass. Five new simulation cases cover
both teams, actual kills and CS, save continuation, consumed/expired Q, visibility,
armor, range, and expiration during a committed strike. Both Garen Q browser
scenarios pass, including the new AI-driven minion kill with the source sword
animation and no page errors. The fixture screenshot was reviewed at
`artifacts/browser-garen-q-farming.png`. No new champion-selection option is
exposed; Garen's remaining kit and Ahri's gameplay integration are still open.

## Courage active integration

Garen NPCs can learn and cast W, gaining its independent short shield/tenacity and
longer damage-reduction windows. The shield uses bonus health, and W preserves an
ongoing Q strike. Snapshot version 71 retains the defenses. See [GAREN-W.md](GAREN-W.md)
for the supported behavior, explicit local policies and remaining passive/native/
presentation work. All 862 tests across 184 files pass; the three Q/W browser
scenarios pass and the new binding-contact capture was visually reviewed.

## Courage defensive AI

Garen now responds to visible champion/turret windups and launched basic-attack
missiles forecast to arrive inside W's short shield window. It preserves ordinary
movement/attack decisions, rejects hidden intent and unavailable casts, and does
not spend W simply because a champion is nearby. The follow-up tenacity correction
also synchronizes Ashe's legacy slow clocks, with an actual Volley regression.
All 867 tests pass; production build and nested static-hosting smoke pass. See
[GAREN-W.md](GAREN-W.md) for the forecast's current limits and remaining kit work.

## Courage passive integration

Garen has a separate, capped counter for credited champion and lane-minion kills.
The initial increment banked kills before W was learned; the source-backed
October 21 correction below removes that policy. New kills add only the new
earned amount. Death and respawn preserve the counter and resistance
stats. Snapshot version 72 validates ownership and range without double-applying
stats on restore. The old completion multiplier is excluded based on Riot's
25.11 removal. See [GAREN-W.md](GAREN-W.md) for sources and explicit lifecycle
policies still awaiting native comparison. All 872 simulation tests pass.

## Demacian Justice source preparation

The R exporter pins three ranked damage/cooldown values, the one-second reveal,
client-reported 400 range and separate timing fields. Current damage is confirmed
by Riot patch 26.14. The existing cached Data Dragon response is explicitly marked
as cached after a fresh request returned HTTP 403. The exporter also resolves
`Spell4` to its base/idle sequence and verifies the source animation hash and
30 FPS header. Its cast marker differs from the authored cast time; no native
precedence is asserted. [GAREN-R.md](GAREN-R.md) describes the targeting, reveal,
cast-state, AI and presentation work that must follow. R remains unavailable.
The exporter and TypeScript check pass; no runtime behavior changes in this step.

## Demacian Justice first gameplay integration

Garen NPCs can now learn and cast R on an explicitly captured enemy champion.
The initial runtime includes release-time missing-health true damage, shared shield/
reward processing, isolated one-second target sight, source `spell4_base` playback,
visible execute decisions and snapshot version 73. [GAREN-R.md](GAREN-R.md) records
the exact supported rules and provisional timing/cancellation/range policies.
All 886 simulation checks, TypeScript, four focused Q/W/R browser scenarios, the
production build and nested static-host smoke pass. The contact capture was visually
reviewed. R effects/audio, native calibration, E and player input/HUD remain open;
Garen is still excluded from player selection and the default lane roster.

## Judgment first gameplay integration and Courage correction

Garen NPC E now supports moving periodic area damage, current ranked/critical
formulas, a nearest-enemy bonus, source-owned armor reduction, full post-spin
cooldowns, recast and kit/control interactions. Source spin playback and visible
champion/grouped-minion AI accompany schema-74 continuation. [GAREN-E.md](GAREN-E.md)
records verified values separately from unmeasured cadence, cancellation and
presentation policies. All four abilities have simulation foundations; player
input/HUD, complete effects/audio, role AI and native calibration remain open.

The same review confirms Riot's 25.23 fix for Courage stacking before W is learned.
Runtime and save validation now require learned W; earlier kills are not banked.
The current 904 simulation tests, TypeScript, five focused browser cases and
production/nested-host smoke pass. The spin/armor screenshot was visually reviewed.
Fresh Data Dragon retrieval through the correct `champion/` URL also verifies the
existing full-response hash and updates R's previously cached provenance.

## Garen human-control fixture

`/?scene=fixture&champion=garen` now opens a development-only Garen player scenario.
Instant Q/W/E, explicit mouse-selected R identity, range guidance, source icons,
rank/resource-free tooltips, Q/W/E activity, Perseverance/Courage status and
save/restart flows are integrated. Schema 75 allows that player only on the
development battlefield; Rift construction/import and ordinary roster selection
still exclude him. [GAREN-PLAYER.md](GAREN-PLAYER.md) records setup and boundaries.
All 911 source/simulation tests, TypeScript and 21 focused browser cases pass;
wide/small HUD captures were visually reviewed. Production/nested-host smoke
checks that diagnostic flags do not change the ordinary player/roster. Effects,
source audio, native calibration, directional spin and full role AI remain open.

## Judgment source mesh and trails

[GAREN-SPIN.md](GAREN-SPIN.md) covers all six inline E emitters with the
frozen Riot mesh, lossless source textures, authored appearance curves and
deterministic particle sampling. Schema 76 preserves active and stopped visual
intervals, including tails after recast, R, natural completion and death. Both glow
layers use pinned reader defaults and lifetime lookup; native composition remains
open. This increment keeps Garen's
production selection gate in place.

[Judgment source audio](GAREN-E-AUDIO.md) follows with 13 unnormalized float
recordings mapped through all six E play/stop events. Source gains, attenuation,
voice caps and distinct 800/125 ms fades feed a local dispatch adapter. Files load
only when Garen is present; cast/active/ending phases restore from schema-77
presentation history, and recipient hit cues retain fixed audience. Other Garen
audio, native timing/mix and the production roster gate remain open.


## Demacian Justice source-particle packaging — October 21, 2026

[R source-particle assets](GAREN-R-PARTICLES.md) now pin the complete cast, sword
and impact definitions to two frozen linked multi-skin BINs. Four exact source
meshes and all 21 texture dependencies are converted and available for inspection.
The frame-10 caster particle event is distinct from the damage animation marker;
sword/impact dispatch timing and attachment remain unverified. Runtime effects,
persisted release history and native comparison are still required. Garen remains
a development-only player choice.

## Demacian Justice live source-particle adapter — October 21, 2026

The [R particle adapter](GAREN-R-PARTICLES.md) now renders 16 source layers in
player/NPC fixtures, with a persisted valid release point and independent
cancellation history in schema 78. Killed recipients, later caster death, normal
orders and save/reload retain impact tails. Source caster attachment, falling
mesh motion, lookup/multiplier paths, random rock atlas and fog/disposal are
exercised in Chrome. The seventeenth emitter requires scene distortion, and
native dispatch/motion/material comparison plus R source audio remain open.
Garen stays excluded from production selection.

## Demacian Justice source audio — October 21, 2026

[R audio](GAREN-R-AUDIO.md) now uses the three frozen SFX event containers and
seven unchanged float masters for cast, hit and a lethal-result cue. The stereo
kill recording is linked from `Garen_R_Champ_Kill`; it is not treated as a passive
notification merely from its event suffix. Schema 79 stores the actual R kill
outcome and retains sound history for 303 ticks. All 956 checks and 43 focused
Chrome cases pass with the verification conditions recorded in PROGRESS. Ordinary
startup remains 17 recordings, with R code/data/assets loaded on Garen presence.
Native spatialization/dispatch/listening, kill-particle visuals, distortion and
Q/W/basic/voice audio remain open before production roster acceptance.


## Demacian Justice lethal-result particles — October 21, 2026

[R kill particles](GAREN-R-PARTICLES.md#lethal-result-particle-adapter--october-21-2026)
now reconstruct the source shockwave, three camera-facing ray particles and
flash from schema 79's recorded R kill result. R has 19 selected layers; two
scene-distortion emitters remain deferred. Two new PNGs load only on Garen
presence; frozen primary/audio pins are unchanged. All 958 source/simulation
checks, TypeScript, 22 focused Chrome cases and production/nested-path smoke pass.
Save/death/fog/resource lifecycles and six independent GPU samples are covered.
Native timing/attachment/composition and Q/W/basic/voice presentation remain open;
Garen's production roster gate stays in place.


## Courage source audio — October 21, 2026

[Courage audio](GAREN-W-AUDIO.md) now retains three cast variants, two authored
intro/loop masters and three ending variants, with the active stop fade and
sound-level cast gain. Schema 80 persists the independent start/stop/reason
history through shield loss, defense expiry, death and match end. All 966 source/
simulation checks, 44 focused Chrome cases and production/nested-host smoke pass;
PROGRESS records deadline overrides and the repaired transfer timestamp check.
The eight unchanged float WAVs load only on Garen presence. Source W particles,
Q/basic/voice audio and native audiovisual calibration remain open before
production roster acceptance.


## Courage source-particle closure — October 21, 2026

[Courage's full particle source set](GAREN-W-PARTICLES.md) now includes all seven
systems and twenty emitter records, eighteen lossless textures and two exact
GLB outputs. The legacy shared arrow paths are byte-identical and retain both
aliases; their attached-mesh declaration is not treated as a live arrow effect.
All 970 source/simulation checks, thirteen focused Chrome cases, model/map
validators and production/nested-host smoke pass. Twenty-four converted/pin
outputs reproduce byte-for-byte. Live material overrides, attached-skin slicing,
dispatch/attachment and native comparison remain open; gameplay/schema 80 and
the production roster gate are unchanged.

## Courage live cast and sustained particles — October 21, 2026

[Courage's live adapter](GAREN-W-PARTICLES.md#live-cast-and-sustained-adapter--october-21-2026)
now reconstructs seven source emitter definitions from the existing schema-80
start/stop history. The cast follows the rig center; sustained effects follow
terrain position. Those attachment and stopped-particle linger policies remain
local choices pending native comparison. Thirteen definitions remain deferred,
including shoulders, deflection, body material/attached-skin operations and four
minimal declarations. The shared arrow reference is not rendered as a character
surface. Gameplay and schema are unchanged.

All 976 checks, TypeScript, 36 focused Chrome scenarios and production/nested-host
smoke pass; PROGRESS records the verification scope and sequential trace-cleanup
rerun. Four independent W GPU samples, saved/death/fog/terminal continuation,
practice recasts and late loading are covered. Both generated profile/audit files
reproduce byte-for-byte. One shield mesh and ten PNGs load on Garen presence;
ordinary startup retains 17 recordings and no W graphics requests. Native
calibration, the remaining W operations and full production roster acceptance
remain open.

## Courage posed shoulder layers — October 21, 2026

[Courage](GAREN-W-PARTICLES.md#live-cast-and-sustained-adapter--october-21-2026)
now selects eleven source emitter definitions, adding separate left/right streak
bursts and hoop/glint layers. These retain source curves, random size tables,
rates and natural one-second lives, following the current posed shoulder joints
with normalized orientation. Activation dispatch, bone selection and full joint
inheritance remain explicit local policies awaiting native comparison. Existing
schema-80 history supports death/stop tails and checkpoint reconstruction.

All 978 checks, TypeScript and eight focused W Chrome cases pass, including
independent joint-frame checks, camera independence, case-insensitive lookup,
replacement rigs and seven GPU texel products. Both generated profile/audit files
reproduce byte-for-byte. Another 29 existing Garen/match-file browser cases and
production/nested-host smoke pass. PROGRESS records the full verification scope.
Four already prepared PNGs add 55,550 selected bytes; ordinary startup still
makes no W graphics requests and retains 17 recordings. Deflection,
character-surface operations, minimal buff declarations and native/production
acceptance remain open.

## Courage damage reactions — October 21, 2026

[Courage](GAREN-W-PARTICLES.md#damage-reaction-adapter--october-21-2026) now selects
twelve source emitter definitions. A separate rotating shield uses accepted
damage clocks with the source natural life and appearance, sharing existing
geometry/textures. Schema 81 retains bounded ordered reactions independently of
later W casts, defense expiry and death. The local trigger accepts positive
physical/magic hits actually reduced by W and coalesces same-tick hits; native
dispatch remains unverified. Gameplay mitigation is unchanged.

All 986 checks and TypeScript pass. Eleven focused W browser scenarios cover
real shielded contact, stable save/reload poses, fog, disposal, late loading,
terminal time and eight GPU samples. Three generated outputs reproduce exactly
while preserving modification times. PROGRESS records fixture/exporter corrections
and the complete verification scope. Another 29 existing Garen/match-file browser
cases pass, for 40 focused Chrome scenarios in total. Production/nested-host
smoke passes with 17 ordinary recordings and the Garen roster gate retained.
The eight body/minimal declarations and native/production acceptance remain open.

## Decisive Strike audio source pack — October 21, 2026

[Q audio](GAREN-Q-AUDIO.md) now pins all five declared Q/QAttack events, including
both attack play actions and their authored 230 ms separation. Thirteen unchanged
mono float WAVs preserve source headroom. Active masters retain their one-shot
authoring and separate 250 ms stop fade; their lengths do not redefine Q buffs.
The development audition page exposes explicit variants and source scheduling.

All 988 tests and TypeScript pass. Three new Chrome cases check every decoded
sample, real Web Audio scheduling/gains/stop fade and absence of Q requests from
current startup. Another ten Q/player/match-file browser cases pass. Sixteen Q
outputs reproduce byte-for-byte and eight existing W/E/R/shared pins stay
identical. Production/nested-host smoke passes with 17 ordinary recordings and
unchanged ordinary game-entry size. PROGRESS records complete verification. This source-preparation
increment leaves live Q audio/history integration, W body rendering, native
calibration and production roster acceptance open. Gameplay and schema 81 stay
unchanged.

## Decisive Strike live source audio — October 21, 2026

[Q audio](GAREN-Q-AUDIO.md#live-audio-adapter--october-21-2026) now uses all five
source action profiles from saved activation/stop/commitment history. Both attack
layers retain the exact bank delay; active playback is nonlooping and uses the
authored stop fade. Schema 82 keeps earlier practice casts and accepted swings
through target loss, death and reload. Local dispatch follows the armed interval,
with consumption/expiry ending cues; native script and cancellation behavior
remain unverified. Gameplay damage, attack timing, speed and cooldown are unchanged.

All 999 checks and TypeScript pass. Ten focused Q Chrome cases cover source PCM,
on-presence loading, real audio scheduling, fade/reload, fog, fallback and finite
terminal tails. Seventeen source outputs reproduce byte-for-byte with unchanged
modification times. Source-ready Q casts/attacks bypass generic cues; late source
readiness cannot double synthesized keys. PROGRESS records the full verification
scope. Native calibration, source Q particles, W body operations and production
roster acceptance remain open.

The surrounding 31 Garen/match-file browser cases also pass, for 41 focused
Chrome scenarios across sequential runs. After requiring a matching history pair
for ongoing Q cycles, all 999 tests and seventeen Q/player/save browser cases pass
again. Production/nested-host smoke passes with 17 ordinary recordings and the
Garen roster gate retained. PROGRESS records bundle sizes and verification scope.

## Decisive Strike particle source closure — October 21, 2026

[Q particle sources](GAREN-Q-PARTICLES.md) now pin every base Q resource key:
eleven linked systems, 31 emitter records, 29 TEX dependencies and four SCB
meshes. Six frozen BINs supply the definitions. The extraction records all 39
source files and their archive/chunk/file hashes. The buff definition's absent
emitter array stays absent. The weapon trail retains its authored 500-triangle
mesh, rather than acquiring a procedural ribbon from its name.

Four exact GLBs preserve UVs/face RGB and float32 positions at 0.01 source scale,
with pivot, bounds, materials and trailing bytes retained as metadata. Six
existing PNGs pass exact pixel comparison; 23 new PNGs add 1,119,506 bytes. Four
GLBs add 50,208 bytes. Four Spell1 particle events retain optional frame/bone/kill
fields exactly. No missing frame is relabeled an authored zero. A development
inspector exposes all meshes, textures and definitions, including the absent
buff emitter array. This changes no gameplay, schema or runtime loader.

The full 1,003-test suite across 204 files and TypeScript pass. All 36 model GLBs
and the map validate with zero errors/warnings. Repeated frozen extraction and
conversion reproduce all 39 source/audit/PNG/GLB/sidecar outputs byte-for-byte.
Live target/animation dispatch requires confirmed impact and cancellation
history beyond the current audio commitment clocks. Native timing/materials,
Q playback, W body effects and full production/match acceptance remain open.

All 21 unique focused Chrome scenarios pass across sequential runs: the two new
source-inspection/startup cases, Q source/live audio and PCM, Q mechanics,
Garen player controls and match-file continuation. The inspector also shows all
four animation bindings. Visual review found that Three r186's nonindexed
wireframe builder uses the entire interleaved position array length, generating
out-of-range indices and WebGL INVALID_OPERATION. A sequential inspection-only
index fixes the draw without changing any exported GLB. The final browser check
requires a rendered line frame, visible canvas pixels and zero WebGL error;
raw/wireframe captures were visually reviewed. The initial copied W bounds
threshold was also replaced with comparison against each Q mesh's measured bounds.
Production build/nested-host smoke passes with 17 ordinary recordings, real
Ashe/Lux input and the Garen gate retained. The ordinary game entry remains
579.60 KB (159.49 KB gzip); the existing large-bundle warning remains.

## Decisive Strike weapon trail and attack outcomes — October 21, 2026

The first [live Q particle layer](GAREN-Q-PARTICLES.md#live-weapon-trail-adapter--october-21-2026)
uses the authored 500-triangle weapon mesh and its explicit frame-8 center-bone
binding. Two source particles retain their 0.25-second life, authored scale,
rotation, scrolling UVs and lifetime lookup. The renderer uses the bone's current
world position plus captured heading; native parent orientation and frame timing
remain provisional. One mesh/two textures and the renderer/profile load only on
Garen presence. Ordinary startup adds none of these Q-specific graphics.

Schema 83 extends Q history with target identity, captured origin/heading and
attack period, confirmed contact point/heading and separate presentation stops.
Contact is captured before lethal damage can clear attack state or finish a
match. Target loss, caster death, practice recasts and terminal matches cannot
manufacture a future frame event or hit. Post-contact orders/actions/movement
hard-stop this bone-bound visual while retaining contact and cadence. Natural
completion uses the captured period. Audio deliberately retains its original
accepted one-shots and independent buff/stop clocks. Gameplay damage, timing,
movement and cooldown values are unchanged; older snapshots remain incompatible
under the existing same-build policy.

The exporter accounts for one selected emitter, thirty deferred emitters and
the empty buff system. All four source SCBs contain zero face-RGB bytes; these
remain metadata because reader presence alone does not establish their native
material use. Native dispatch, hard-stop/linger behavior, exact heading/bone
inheritance, other Q layers, distortion, W body operations, and production/full-
match acceptance remain open. This is the first Q visual integration, not full
Decisive Strike presentation or Garen roster acceptance.

All 1,012 tests across 206 files and TypeScript pass. The new checks cover source
profile/default pins, frame-8 births, two-particle counts, scroll/lookup/lifetime,
pre/post-birth stops, partial-loader cleanup/reuse, lethal contact, target loss,
recast/death/match-end stops, natural completion, chasing after contact and
malformed outcome saves. All 36 GLBs and the map validate without errors or
warnings. Repeated frozen extraction/conversion/profile export produces 41
byte-identical Q outputs, with all original source/asset bytes unchanged.

All 27 focused Chrome scenarios pass across Q source/live audio and PCM,
particle/inspector/startup, Q mechanics, Garen player controls, W/E/R and saved
matches. After avoiding history allocation/scans for ordinary attacks and
movement, the full 1,012-test suite and seven Q particle/inspector/mechanics
scenarios pass again. The real trail restores exact transforms/material clocks
from a checkpoint, disposes owned materials while retaining shared geometry,
obeys actual unit fog, and suppresses future graphics after target loss. The
source gold-trail gameplay capture was visually reviewed at 1440×900.

Production build and nested static-host smoke pass with the ordinary seventeen
recordings, real Ashe/Lux input and the Garen fixture/roster gate retained. The
new Garen-only particle chunk is 3.65 KB (1.86 KB gzip); the ordinary game entry
is 582.87 KB (160.28 KB gzip), including the expanded history/validation and lazy
wrapper. The existing large-bundle warning remains. No source PNG, GLB, WAV or
pinned BIN bytes changed.

## Decisive Strike activation and armed particles — October 21, 2026

All eight cast/sword emitters now join the existing
[Q weapon trail](GAREN-Q-PARTICLES.md#activation-and-armed-layers--october-21-2026),
bringing the live Q selection to nine of 31 emitter records. The activation
bubbles/dark bubble/flash use an accepted one-shot clock; sword flare, rising
glow, spinning source mesh and activation quad follow the saved armed interval.
Source bursts, rates, life/size/rotation distributions, appearance curves, passes,
depth flags and UV scrolling are preserved. The local caster-root/yaw policy is
explicit; the trail retains its separate source frame/bone binding. Twenty-two
emitters and native dispatch/composition remain open.

The adapter resolves two source edge cases against pinned reconstruction code:
mode 2 darkens destination RGB with one-minus-source-color and uses a separate
alpha factor; the sword mesh's multiplier-scroll block has no named texture, so
it adds no invented second sample. Four authored flare frames retain the reader's
absent-grid default of 1×1. Type-0 stopping uses an absolute emitter-age wait and
caps total particle life, rephasing curves against that cap. The mesh's one-second
wait is not restarted at each buff stop. Export derives a conservative 122-tick
post-stop bound, covered by the existing 200-tick history. Schema 83, gameplay
values and source asset bytes are unchanged. Eight reference files/hashes are
pinned separately from native-client evidence.

All 1,018 tests across 207 files and TypeScript pass. Six new source/sampler/
material checks cover complete profile accounting, bursts/cadence, absolute stop
settlement and rephasing, activation/armed separation, deterministic finite
replay, retention and absent multiplier behavior. Partial-loader checks cover
two meshes and eleven textures, disposal of completed partial ownership and a
shared cached retry. Source replay consumes no simulation RNG.

All 32 focused Chrome scenarios pass across the full Garen fixture and saved
matches, including four new cast cases and sixteen independent GPU product/blend
comparisons. Early bursts and consumed tails restore exact transforms/material
clocks through real save/reload. Camera/root placement, global mesh orientation,
actual fog, recast overlap, death/match-end retirement and material ownership are
covered. The repeated-save helper now checks whether the restored pause menu is
already open; blindly pressing Escape had closed it and resumed the test. This
was a test correction, with no runtime menu change. Close-up activation and
post-consumption gameplay captures were visually reviewed at 1440×900.

All 36 model GLBs and the map validate without errors or warnings. Repeated
extraction/conversion/profile export reproduces all 43 Q source/audit/profile/
PNG/GLB/sidecar outputs byte-for-byte. The 37 static Q files copied into
the production build match the verified public files. Production build/nested-
host smoke passes with seventeen ordinary recordings, real Ashe/Lux casts and
the Garen fixture/roster gate retained. The Q particle chunk is 21.79 KB (4.94 KB
gzip), loaded on Garen presence; the ordinary game entry is 582.88 KB (160.28 KB
gzip). The existing large-bundle warning remains. Ordinary startup adds no Q
mesh/texture requests. All source/native calibration, remaining Q layers, W body
operations and production/full-match acceptance remain in scope.

## Decisive Strike impact particles — October 21, 2026

Seven target-impact color emitters now start from saved confirmed contacts: two
source mesh layers, flash, slash, ray and two directed spark emitters. Sixteen
of Q's 31 emitter records now render; target distortion and fourteen other records
remain deferred. The local contact-ground/heading policy keeps effects independent
of later caster/target movement, death and pose stops. Native recipient attachment
and following remain unverified. Source spawn rotation, speed stretch, atlas
absences, appearance and blend factors use separately pinned reconstruction
evidence. No schema, combat, silence, sound or binary assets changed.

All 1,023 tests, 35 focused Chrome cases, thirty GPU product/blend comparisons,
model/map validation and 45-output byte-identical reproduction pass. Chrome
checks exact save/reload, independent contact coordinates/ray direction, actual
fog with a hidden caster, lethal contact and finite match-end tails, and disposal
of owned materials/ray geometry. Shared loading now uses three meshes and fifteen
texture paths; ordinary startup requests none of the new Q graphics. The contact
capture was visually reviewed. Production build/nested-path smoke passes with
seventeen recordings, real Ashe/Lux input and the Garen gate retained.
See [Q particle details](GAREN-Q-PARTICLES.md#confirmed-contact-impact-layers--october-21-2026)
and [current validation](PROGRESS.md#decisive-strike-impact-particles--october-21-2026).
Native calibration and complete Garen/full-match acceptance remain open.

## Decisive Strike jump and landing particles — October 21, 2026

Five more source emitters now add Jump's mesh and Land's dirt, waves, smoke and
delayed decal, bringing Q to twenty-one of 31 emitter records. Schema 84 captures
the frame-9 event's ground point/heading independently of later caster movement.
The missing jump start frame remains absent and uses an explicit local commitment
policy. Accepted bursts finish naturally through pose stops, death and reload.
Source stepped drag, composed legacy rotations, draw-time world acceleration,
atlas/scroll and locked alpha are retained. The existing armed sword mesh now
uses its declared locked-alpha path too. Combat/silence/audio rules are unchanged.

All 1,030 tests, 38 focused Chrome cases, forty independent GPU product/blend
comparisons, model/map validation and 47-output byte-identical reproduction pass.
Production build/nested-path smoke passes with seventeen recordings, real Ashe/Lux
input and the Garen gate retained.
New checks cover exact event anchors, real checkpoints, independently verified
placement/direction, target loss, actual fog, death/terminal tails and material
ownership. All four meshes/nineteen texture paths load on Garen presence with
partial-failure cleanup. Ordinary startup adds no new Q graphics. The close-up
captures were reviewed; visible quad boundaries in the landing composite and
native material/attachment calibration remain open. See [Q ground events](GAREN-Q-PARTICLES.md#jump-and-landing-ground-events--october-21-2026)
and [current validation](PROGRESS.md#decisive-strike-jump-and-landing-particles--october-21-2026).
Ten emitters and full Garen/production/full-match acceptance remain unfinished.

## Decisive Strike recipient silence — October 21, 2026

Q's recipient icon now uses a saved accepted-control deadline, including Courage
tenacity, independently of generic silence. Schema 85 adds the nullable deadline
to each captured attack. Rejected/lethal/structure hits remain null. Source
ten-second appearance, cell-zero atlas, blend/pass/depth and white lookup are
retained; overlapping Q applications coalesce one icon with original clocks.
Recipient visibility/death/match end gates the icon independently of its caster.
Combat and silence rules are unchanged.

All 1,038 checks, 41 focused Chrome cases, forty-two GPU product/blend comparisons,
model/map validation and 48-output byte-identical reproduction pass. Production
build/nested-path smoke passes with seventeen recordings, real Ashe/Lux input and
the Garen gate intact. New status checks cover tenacity/generic separation, late
armed expiry, multiple sources and
checkpoints, target/caster death, respawn, actual fog and overlap handoff. The
reviewed capture uses a provisional health-bar-plus-source-offset anchor; native
Flex sizing/attachment and label clearance remain open. Twenty-two emitters now
draw locally, loading four meshes/twenty-one textures only on Garen presence.
See [silence details](GAREN-Q-PARTICLES.md#recipient-silence-and-accepted-control-history--october-21-2026)
and [current validation](PROGRESS.md#decisive-strike-recipient-silence--october-21-2026).
Nine emitter records and full Garen/native/production/full-match acceptance remain
unfinished.

## Decisive Strike recipient label clearance — October 21, 2026

The local Q icon now clears its recipient's full measured info bar by four CSS
pixels, including multiline names and minion health bars. Projection/unprojection
preserves source world scale, projected X/depth and appearance/control clocks;
each frame derives placement from the original provisional anchor. Four geometry
checks and two Chrome cases cover peak/settled size, three recipient kinds,
three viewports, three zooms and 1×/2× display density. The before/after capture
was reviewed. Native Flex sizing/attachment and broader composition remain open.
See [placement details](GAREN-Q-PARTICLES.md#recipient-label-clearance--october-21-2026)
and [current validation](PROGRESS.md#q-silence-label-clearance--october-21-2026).


## Basic/critical attack source audio and ordinary slots — October 23, 2026

The Garen development fixture now selects both equal-weight ordinary source
slots and retains their choice with accepted swing/contact history. Six SFX
events map all eight actions and four material branches into seventeen profiles;
34 unique float masters keep source gain, pitch, attenuation and leaf voice caps.
Twenty-nine current skin records provide material values, including asymmetric
blue/red siege and super bodies. Q remains independent. Schema 113 validates
clocks, contacts, cancellation, ownership, rig/material and creation audiences;
no gameplay IDs or World RNG are added.

All 1,422 unit tests, TypeScript, 50 focused Chrome cases and production validation
pass. Chrome checks every decoded float, both actual normal animations, all
materials, independent critical layers/pitch, real save/reload, missing-file retry,
source/fallback suppression, hidden creation and known lethal contacts without
remaining local vision. The source-swing capture was reviewed. Production stays
Ashe/Lux. Native attack particles/voice, native script/timing/mix comparisons and
full Garen/match acceptance remain open. See [attack audio](GAREN-AA-AUDIO.md).
