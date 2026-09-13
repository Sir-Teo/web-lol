# Lux Lucent Singularity: evidence and implementation contract

E remains unimplemented. This audit establishes its source profile and identifies the systems required to implement the entire spell. It does not unlock a partial spell or claim native conformance.

## Frozen evidence

[reference/lux-e.json](reference/lux-e.json) retains the complete ability, root spell, slow/end buff records and recast spell from the hashed [CommunityDragon 16.18 export](https://raw.communitydragon.org/16.18/game/data/characters/lux/lux.bin.json). It also retains the complete E entry and original response hash from [Data Dragon 16.18.1](https://ddragon.leagueoflegends.com/cdn/16.18.1/data/en_US/champion/Lux.json). Standard parent values are used; the `cherry` mode override is excluded.

| Property | Supported source value | Interpretation |
|---|---|---|
| Damage | 65/115/165/215/265 + 0.8 AP | Named root damage and tooltip formula agree with Data Dragon and official 13.17 notes |
| Mana | 70/80/90/100/110 | Root mana array begins at rank one; no leading rank-zero slot |
| Cooldown | 10/9.5/9/8.5/8 seconds | Rank-one index is one in the root cooldown array |
| Cast | 0.25 seconds, Spell3 | Root cast duration and source animation name |
| Slow | 25/30/35/40/45 percent | Named root values; five-second zone duration |
| Post-detonation slow | 1 second | Named linger value plus explicit official 10.11 behavior |
| Cast range | 1100 | Root and Data Dragon agree |
| Missile motion | Fixed speed 1200, no target tracking | Explicit movement component; legacy root missileSpeed is 1300 |
| Vision | Named VisionRadius 650 | Missile perception bubble 750 is a different field and must not automatically become granted vision |
| Geometry | castRadius 295; unnamed fourth effect 310 | Data Dragon also carries 310; collision role and center/edge treatment need measurement |

[Patch 13.17](https://www.leagueoflegends.com/en-gb/news/game-updates/patch-13-17-notes/) independently corroborates the root damage formula. The recast record's legacy effect damage and 0.6 coefficient disagree with it; that record delegates its tooltip to the root and carries `Trait_FreeRecast`. It must not define a second damage formula. [Patch 10.11](https://www.leagueoflegends.com/en-us/news/game-updates/patch-10-11-notes/) explicitly establishes one additional second of slow after E2 damage. It does not establish an identical timer after simply walking out of an undetonated zone.

The 26.17 radius change to 350 and E-during-R change previously found are in **League Classic**. They are not standard-mode overrides for this pinned ruleset.

`python3 tools/assets/export-lux-e.py --check --verify-sources` verifies all retained records against their hashed cached responses and checks the generated [source profile](../src/content/lux-e.ts). Without `--verify-sources`, the command runs from committed records alone. Omit `--check` to regenerate. The exporter checks the child graph, delegated tooltip, root damage formula, movement type, and cross-source rank arrays. Unresolved geometry remains under distinct field names rather than being silently selected as gameplay truth.

## Official visual example

The [official champion page](https://www.leagueoflegends.com/en-us/champions/lux/) links the [E video](https://lol.dyn.riotcdn.net/x/videos/champion-abilities/0099/ability_0099_E1.mp4). Its retained hash and metadata identify a 1056×720, 30 FPS, 218-frame clip. The local original is `.cache/lux-e-reference.mp4`; analysis sheets are `artifacts/lux-e-reference-sheet.png`, `artifacts/lux-e-arrival-sheet.png` and `artifacts/lux-e-detonation-sheet.png`.

Frame inspection shows the orb visibly separating around frames 15–18, gradual ground-ring appearance around 34–38, a ring at frame 169, and an explosion at 170. These are presentation observations. The camera moves during flight; no world coordinates, gameplay build or input log are supplied. The clip cannot distinguish manual detonation from automatic expiry, establish a units-per-second speed, choose between radius fields, or prove which callback starts the five-second lifetime. Do not calibrate simulation deadlines from the visible ring onset alone.

The cached base-skin resolver identifies `Lux_Base_E_mis`, `Lux_Base_E_tar_aoe_green`, `Lux_Base_E_tar_aoe_red`, `Lux_Base_E_tar_aoe_sound`, `Lux_Base_E_tar_hit` and `Lux_Base_E_tar_nova` under `Characters/Lux/Skins/Skin0/Particles/`. These are the next presentation extraction targets. Ally/enemy ring choice, sustained sound, explosion and target hit effects must have distinct lifetimes; one generic projectile mesh is insufficient.

## Required simulation work

1. Add a saved, caster-owned E instance with explicit windup, flight, active-zone and retirement states. Capture aim, rank/AP damage, slow strength, source/team, launch and arrival ticks, lifetime deadline and a requested-detonation flag. Stable IDs must participate in snapshot identity validation. At most one active E instance belongs to a caster.
2. Clamp initial aim to the supported cast range and allow a zero-distance cast. Use the explicit movement component as the initial motion adapter, documenting that 1200 remains unmeasured. Other units must not consume the projectile as if it were Q. Decide and document the five-second timer anchor separately; the current evidence does not resolve it.
3. Make recast a distinct command path: no second mana spend or second damage formula, no accidental Hawkshot charge handling, and no cooldown rejection of the active spell's free recast. Determine flight buffering, windup buffering, minimum recast delay, permitted CC states, interaction with R/recall, and cooldown start from controlled evidence or explicit provisional policies. Do not inherit all initial-cast guards blindly.
4. The shared independent slow contribution system is now implemented; use `World.applySlow` with the `lucent` effect identity for persistent zone contributions. Legacy diagnostic `slowUntil`/`slowMultiplier` fields still exist, but E must not repeatedly overwrite them. Compute the strongest currently active slow, retain weaker effects until their own expiry, and combine with existing movement-speed caps. Test overlap with critical Frost Shot and independently owned zones.
5. Supply team-filtered zone vision independently of damage and presentation. Resolve obstruction, brush, flight sight and post-detonation sight duration explicitly; `mPerceptionBubbleRadius` alone is not authority for any of them. Bot observations must use the same team view.
6. Detonate exactly once on a permitted recast or timeout, using current enemy positions, excluding structures and allies, applying separately mitigated area magic damage, Illumination and supported post-hit slow. Determine circle-versus-target-radius semantics. A detonation and expiry on the same tick must not double-hit. Committed flight/zone death behavior and damage AP capture timing need explicit policies.
7. Integrate source Spell3, visible flight, team-appropriate zone perimeter, sustained sound, detonation/hit particles, cleanup and saved visual phase. Finish E input/HUD and tactical AI alongside the existing Lux selection work. Preserve the default Ashe path until champion selection is implemented.

## Acceptance scenarios

Test every rank's resources and damage; range clamp and self cast; early, late and repeated recasts; expiry-versus-recast ordering; free recast at zero mana and while initial cooldown is active; leaving/re-entering the field; entering after it is created; overlap and weaker-slow restoration; shield absorption; Illumination; caster and target death; hidden enemies and brush; R interaction; saved windup, flight, armed zone and detonation request. Repeated full matches must retire every zone, particle and audio voice. Source-data agreement and local regression tests must remain distinct from native timing and geometry evidence.

The next implementation is the complete E lifecycle and supporting slow state, followed by source effects and native comparison. The broader full-match design and production gates remain unchanged.
