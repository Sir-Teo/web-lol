# Neutral faction and controlled Gromp encounter

The simulation now has a real neutral faction and a playable controlled Gromp
encounter. Blue and red can attack it, receive retaliation, clear it, and retain
the encounter through saved continuation. This is a foundation for live jungle
camps. Standard-mode camp scheduling, level scaling, jungle roles, buffs/Smite,
complete monster presentation and full-match certification remain unfinished.

## Running the encounter

Start the development server and open
`/?scene=fixture&encounter=gromp`. Ashe starts beside a single Gromp in the existing
practice terrain. Right-click Gromp to attack. Pause → Save match retains the
fight; Restart practice creates the encounter again. A cleared save stays
cleared after the corpse is removed and the page is reloaded. The query does
not activate in production. Ordinary Rift entry and lane matches do not spawn
this encounter.

The separate source review remains at `/tools/qa/jungle-characters.html`.
The controlled placement is a local diagnostic, not a replacement for either
authored Rift Gromp position or a verified standard-mode camp roster.

## Faction, targeting and sight

`Team` remains blue/red. `Faction` additionally includes neutral. Unit records
discriminate neutral monsters from team-owned units, and snapshot validation
requires that correspondence. Monsters cannot masquerade as champions, inherit
structure knowledge, receive a lane assignment or run champion bot AI.

Neutral units provide no blue/red vision and no pooled neutral vision. Gromp
tests its own target distance and terrain/brush line of sight. Damage and attack
events retain the existing blue/red sight-filtered audience. The minimap shows
a gold dot only while the unit is actually visible; it adds no global camp
knowledge or inferred spawn timer. The overhead name/health bar uses a neutral
gold color under the existing local HUD policy.

Human champions can issue direct attacks and acquire Gromp through attack-move.
Lane minions, turrets and lane bots do not automatically pull it. Champion bots
may follow an explicit attack order, which supplies a future jungle planner
entry point. Player command processing cannot override the monster controller.
Champion shields and allied Heal do not treat neutral monsters as teammates.

## Source scalars and local policies

`tools/assets/export-gromp.py` derives `src/content/gromp.json` from the pinned
[character sources](JUNGLE-CHARACTERS.md) and converted model manifest. It retains
Root health 2050, damage 70, armor/MR 42, range 150, movement 330 and attack speed
0.42500001192092896. Gameplay collision radius 120 stays distinct from source
pathfinding radius 40. The source ranged basic attack supplies missile speed
1800 and castFrame 12.

The encounter uses the following **local policies**, pending native evidence:

- Attack period is the source attack speed's reciprocal rounded to fixed ticks.
  Windup maps the authored frame 12 at 30 fps to 24 ticks. The source attack clip
  reaches that contact time at release, then stretches its remaining recovery to
  the period. Native attack selection, timing and geometry remain unverified.
- Gromp is initially idle and retaliates after positive health loss. The latest
  team-owned aggressor becomes its target; it does not share targets with other
  monsters. Existing committed projectiles remain independent of later reset.
- Its local sight radius is 1000. A missing/dead/unseen target, or either target
  or Gromp moving more than 700 units from home, starts return/reset.
- Returning cancels unreleased attacks, clears movement controls, heals 20% of
  maximum health per second and follows neutral navigation without a team base
  gate. Damage is rejected during return. Full health within three units of home
  returns it to idle. This is not certified native patience/reset behavior.
- A champion last hit awards the raw Root gold 80, XP 120 and minion score 4.
  There is no proximity XP sharing, champion kill or first blood for killing it.
  Native level/role/jungle-item/clear bonuses and final reward rules remain open.
  Neutral champion executions use the existing recent-champion-credit path.
- No respawn is scheduled. Corpse retention covers the full source death clip
  and the reconstructed five-second death shadow, with birth/interpolation
  margin (302 ticks). A future camp scheduler must supply verified clear/respawn
  rules.

The profile JSON participates in the ruleset fingerprint and development server
restart detection, so scalar/clip changes cannot retain a stale save identity.

## Presentation and saved state

The existing Gromp base GLB loads only when a match contains a monster. Idle,
run, ranged-attack-file and death aliases retain original converted clip names
and durations in the source profile. Gromp's authored hidden mini/spawn meshes
stay hidden. Shared animation timelines and target-pose sampling support the
rig, including its use as a Lux impact target. Existing gameplay collision,
damage, slows, roots and shield checks remain authoritative.

The live rig is confirmed to contribute GPU pixels. The combat capture shows
its source mesh, neutral bar and slow feedback. The sampled death pose has no
visible main-body geometry. The [legacy effect adapter](GROMP-EFFECTS.md) now
reconstructs all eight source death-pop emitters from the saved death clock and
original ground bone. Native timing/composition, spores, miniature/submesh
dispatch and source audio remain incomplete/unverified. The
[four source missile emitters](GROMP-ATTACK.md) replace the generic attack mesh
and reconstruct from saved flight paths. Native root/gravity/height and close
actor overlap remain unresolved; hit effects/audio retain the generic combat
path. Native shader/effect composition and broader champion-versus-monster kit
interactions remain unfinished.

Schema **87** retains encounter identity, neutral home, phase, target, attack,
projectiles, bounded released-attack paths, animation and independent clocks. It rejects crossed faction,
unsupported species, missing/inconsistent aggressors, champion/AI/structure
metadata, respawn state and homes outside the battlefield. The saved encounter
identity outlives its corpse, preventing an implicit respawn on reload. Earlier
schemas use the existing incompatible-save path; retained previous saves are not
silently rewritten.

## Verification

The initial encounter increment passed 1,067 checks across 214 files and
TypeScript. Sixteen new source and
simulation cases cover Root/clip provenance, both factions, private neutral
sight, automatic lane exclusion, Lux Binding, reset, exact continuation, invalid
snapshots, rewards and cleared encounter identity.

A separate real-Rift diagnostic moves and resets Gromp from both raw authored
character-object positions on the frozen navigation grid, using its 40-unit
pathfinding radius. Both engagements round-trip saved state exactly. These
explicit diagnostics do not infer standard-mode camp membership or scheduling.

Two new Chrome cases pass real right-click combat, GPU visibility, hidden
submeshes, retaliation, neutral UI, exact save/reload, death-clip dispatch,
cleared continuation without a model request and restart. Ten existing Chrome
cases pass for Lux input, full-Rift/practice checkpoint handling and fogged
structure knowledge. This is focused regression coverage; the entire browser
suite was not repeated.

Commands and captured hashes are retained in
`reference/neutral-gromp-verification.json`. Production smoke verifies that the
development query cannot activate Gromp, with ordinary source recording and
roster/development gates retained. No binary assets changed in that encounter
increment. Follow-up death-effect source, runtime and verification are recorded
in [GROMP-EFFECTS.md](GROMP-EFFECTS.md).
