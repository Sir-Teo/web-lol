# Leona implementation

Target: standard PC Summoner's Rift 26.18, frozen Riot build 16.18.8175716.
The canonical source package, payload calculations and a non-player development
simulation fixture for melee attacks, Q, Sunlight, W, E and R are implemented. Leona's complete
playable kit, player selection, bot policy, source spell effects/audio and native
presentation matching remain required work. The [source rig integration](LEONA-RIG.md)
now renders non-player development fixtures and their saved body poses. The
[Sunlight source presentation](LEONA-SUNLIGHT-VFX.md) now adds all nine mark and
detonation emitters, with saved poses and audiences.
[Daybreak source presentation](LEONA-Q-VFX.md) now adds six shield families and
seven enabled contact families; two source impact emitters remain disabled as authored.
This partial fixture does not establish native behavior or roster acceptance.

The [isolated original Metal rim harness](LEONA-METAL-RIM-HARNESS.md) now verifies
150 explicit synthetic VS1/PS9/PS24 draws against WebGL and scalar RGBA8 output
on the recorded M1. Native gameplay dispatch and frames remain open. The
[R weapon-frame search](LEONA-R-WEAPON-FRAME.md) checks17 retained BIN identities
and all16 skin0 links but recovers no invocation frame for the two weapon quads;
their offsets remain authored and those draws remain excluded.
The later [reflective harness](LEONA-METAL-REFLECTION-HARNESS.md) adds111 original
VS33/PS54 comparisons plus a fresh150-case rim regression, all byte-exact in the
recorded synthetic cases. Native selection/resource/frame limits still apply.
The [controlled depth harness](LEONA-METAL-DEPTH-HARNESS.md) subsequently passes
267 cases, including six original-shader depth-push/plane-order comparisons.
The [fresh SCB cache-selection reading](LEONA-NATIVE-SCB-CACHE-SELECTION.md)
also resolves the earlier resource-cache attempt for its stated fresh/default
source state; reuse, intervening mutation and live dispatch remain open.

The [development defensive Eclipse planner](LEONA-W-BOT-DEFENSE.md) now queues
ordinary paid W casts against visible committed attacks, including during an
accepted Zenith windup. Q/E/R tactics and complete support/player behavior remain
open; this local policy is not recovered native AI.

The [attached-skin input correction](LEONA-ATTACHED-SKIN-INPUTS.md) now maps all
four W skin rim controls through the checked native CPU transformation. Separate
raw/mapped tables and pixel controls cover both W phases; native dispatch and
resource selection remain open.

## Retained source and reproducibility

`reference/leona/character.bin` retains all 24,399 source bytes. The manifest,
archive, bundle ranges and hashes are in `reference/leona/character.json`, along
with the complete 51-record decode. `names.json` is the original naming export;
`ddragon-16.18.1.json` is the original versioned client response. Existing research
cache files remain untouched. A complete offline BIN decode compares every
record, number, list and field; names may align only at matching lowercase FNV
hashes. Numeric dictionary keys use their JSON string representation.

Rebuild or verify the exports using Python's standard library:

```sh
python3 tools/assets/export-leona-kit.py
python3 tools/assets/export-leona-kit.py --check
```

The first command writes `src/content/leona-progression.ts`,
`src/content/leona-spells.ts` and `reference/leona/declared-values.json`. The second
checks identical bytes without writing. Both reject changed frozen input hashes,
rank indexing, formula shapes or the known source disagreements. CDTB is needed
only for the independent BIN decode. In the existing asset-tool environment:

```sh
PYTHONPATH=.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/verify-leona-character.py
```

That command performs no network access. Append `--archive-output` and a fresh,
nonexistent output directory to repeat extraction through the pinned Riot
manifest and compare its bytes and provenance too. Asset dependencies remain in
`tools/assets/requirements.txt`; the recorded CDTB checkout is
`ba981db2a2c814a0d78e55f6483e0636b527850f`.

## Value selection

Cooldown and named-value arrays use source indices 1 through the learned rank
count. Mana arrays start at index 0. Thus R rank three costs 100 mana; the zero
after that is not its rank-three cost. Q/W/E have five ranks and R has three.
Unlearned ranks must be handled by command validation; the payload functions
reject rank zero, fractional ranks, nonfinite ranks and extended-mode ranks.

| Ability | Exported damage by rank | AP ratio | Other declared values |
| --- | --- | --- | --- |
| Q, Shield of Daybreak | 10 / 35 / 60 / 85 / 110 bonus magic | 0.3 | Attack reset tag; one-second stun |
| W, Eclipse | 55 / 85 / 115 / 145 / 175 magic | 0.4 | 8 / 12 / 16 / 20 / 24 flat reduction; 50% cap; three-second resistance duration |
| E, Zenith Blade | 50 / 90 / 130 / 170 / 210 magic | 0.4 | Half-second root; cannot cast while rooted |
| R, Solar Flare | 150 / 225 / 300 magic | 0.8 | 80% slow; 1.75-second crowd control; 1,200 cast range |

The generated constants retain source float32 precision. The rounded ratios in
this table describe the intended coefficient, without changing exported bytes.
`simulation/leona-spell-values.ts` computes magic payloads and resources. Q's
bonus magic damage remains separate from the basic physical hit. W adds
20 / 27.5 / 35 / 42.5 / 50 armor and magic resist, plus 20% of the corresponding
bonus resistance supplied by its caller. That input must exclude Eclipse's own
bonus. Its formula references `ArmorBaseBonus` for both resistance calculations;
the two named base arrays are equal and remain retained separately in the audit.
The helpers do not schedule casts, apply shields/reduction or select targets.

## Melee and Q development simulation

`World.spawn('champion', team, point, 'leona')` is permitted only on the
development practice battlefield. It creates Leona's own stats, mana and an
unlearned kit. Constructor/player selection and ordinary Rift spawning still
reject this incomplete fixture. Development browser saves now restore NPCs with
their own source rig; `?scene=fixture&npc=leona` creates a level-six NPC with each
spell learned. Missing clips fail explicitly. Human Leona selection remains gated. All four spells
have development command adapters; this does not certify a complete player kit.

After learning Q, a World cast command validates mana, cooldown, silence and
stun. Activation costs mana, starts a haste-adjusted cooldown, cancels recall and
resets the ordinary attack timer. Existing roots and slows remain. The next
valid attack captures its Q rank and activation tick. It deals the ordinary
physical hit, then Q's separate magic payload and a one-second stun. Critical
damage affects the physical portion only. Dead targets cannot take a second
payload; structures/wards cannot be stunned. Shields, shared Courage tenacity,
kill credit and target loss use the existing combat paths.

An already committed Q can finish through movement orders, a later stun or
empowerment expiry. Target loss cancels the attack and retains an unexpired
empowerment. Death/victory clear the state. Q's release clears the ordinary
attack cooldown: a fresh explicit attack order can start the next swing, while
automatic attacks wait through recovery. A movement order queued during windup
resumes after contact. Flash retains the committed swing through the shared
order path; native displacement/contact behavior still needs comparison.

The source attack child now exports its explicit 0.25-second cast and the
uncancellable/disabled-release declarations separately from its legacy timing.
`leona-combat-policy.ts` makes the remaining **provisional local policies**
visible: a six-second empowerment, +50 attack range, the conventional basic
windup calculation, fixed fifteen-tick Q windup and a 53-tick automatic cycle.
The cycle is a local recovery adapter; no native recovery, input reset timing or
attack-speed equivalence is certified. These policies require native comparison
before player/production acceptance. They must not be mistaken for additional
fields recovered from the character BIN.

Schema 116 introduced the empowerment and captured activation/rank/release clocks.
It rejects foreign ownership, missing tuple members, changed durations,
unlearned ranks, inconsistent release/cooldown clocks and invalid battlefield or
player use. Tests compare restored futures before/after contact and across
expiry, stun and recovery cancellation. No gameplay random sample is added by Q;
ordinary critical rolls keep their existing place in the attack pipeline.

Sunlight application/consumption is implemented below. Ward-specific empowered
hit behavior, exact structure effects and native timing remain open. The fixture
does not certify complete Q/passive behavior.

## Sunlight development simulation

Q's accepted magic hit applies/refreshes Sunlight on a living enemy. The shared
application helper also serves W/E/R.
Sunlight lasts the pinned 2.5 seconds and expires before new commands at its
deadline. Leona's own damage cannot consume it. Positive allied champion-owned
damage consumes it once, including shield absorption, and applies the source's
32–151 magic payload at her current level. Consumption retires the mark before
nested damage. No application entity, projectile or RNG roll is allocated; the
bonus damage uses the existing damage-event ID path.

Riot's [13.21 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-13-21-notes/)
specify separate damage ownership and ally kill credit. Leona owns Sunlight's
damage effects, including the implemented Doran's Blade healing path, while the
triggering ally receives kill/gold/CS/buff rewards. Leona remains a damage
contributor for assists. A delegated `creditSourceId` on the ordered contribution
record also preserves the ally's credit for a later execution. Subsequent
ordinary Leona damage replaces that delegation. Invalid/foreign delegation is
rejected before damage; ordinary damage calls retain their existing behavior.

**Local policies needing native comparison:** one target mark, refreshed or
replaced by the latest caster; current-level damage sampled at consumption;
continued eligibility after caster death; all positive champion-owned damage
categories except cleanup can trigger, including proc/summoner/companion calls
whose World source is the champion. Non-champion unit damage cannot trigger.
Fully absorbed damage counts, and consumption precedes Scorchclaw processing.
Minions and neutral monsters are eligible; wards and structures are excluded.
These choices make the executable adapter explicit; they do not establish all
native pet, proc, immunity, multi-Leona or ordering interactions.

Target death, monster reset, owner removal, expiry and victory retire marks.
Caster death retains an unexpired mark. Schema 117 saves a nullable target mark
with source/start/end and the optional delegated damage credit. Validation
checks caster identity/team, exact duration, live target/eligible kind, reset/
terminal state and allied distinct credit ownership. Tests cover real attack
projectiles, shield absorption, level changes, caster death, kills, farming,
buff transfer, saved execution credit and restored futures. The browser fixture
gate also preserves a save containing an active mark and delegated contribution.

Posthumous damage cannot select a corpse as a neutral monster's attacker.
Sunlight can use its living triggering ally when Leona is dead; other damage
preserves existing aggro. An idle ordinary camp with no living damage source
returns and recovers. Returning state clears its target and keeps a home-bound
move order, including externally initiated recovery. Scuttler retains its
special patrol/recovery behavior and records posthumous damage on its recovery
clock. These paths have explicit saved-future regression checks; native aggro
ordering still needs comparison.

Garen's observed-attack forecast now respects committed Daybreak through stun
and empowerment expiry, matching its implemented release semantics. It still
requires a visible attacker; this does not certify native threat timing.

Sunlight's playable-level damage is 32 through 151, in increments of seven.
The 31-entry source table has a dummy level-zero entry of 25 and extended-level
entries after level 18. Riot's [14.15 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-14-15-notes/)
corroborate the 32–151 endpoints and current W damage. Its frozen mark duration
is 2.5 seconds, corroborated by Riot's [25.09 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-25-09-notes/).
The versioned Data Dragon description still says 1.5 seconds. It is preserved
as conflicting text rather than used as the duration.

Leona's BIN declares 3 AD growth, while the frozen Data Dragon response says 0.
The progression export uses the BIN value and retains the disagreement. The
other 17 compared stats agree within float32 tolerance after unit conversion.
Attack-speed growth is converted once from 2.9 percent to a fraction. Health
and mana regeneration remain per second; Data Dragon reports per five seconds.
The basic attack has a cast-offset declaration, but omits Garen's explicit
attack-speed timing coefficient. No coefficient or release tick is invented.

## Eclipse development simulation

W now accepts a learned World command with Leona's own mana and hasted cooldown.
Its explicit local activation is instant, preserves orders and ordinary/committed
Q windups, and cancels recall. Stun, silence, death, unlearned rank, insufficient
mana and cooldown reject the cast; root alone does not. No other champion's
spell, animation or projectile is dispatched.

Stored armor/MR exclude Eclipse. Effective resistance queries add the captured
rank's flat bonus plus 20% of other positive bonus resistance, recalculated at
use. The base subtraction mirrors the simulation's per-level rounding: an
unrounded aggregate had invented a one-millionth-point bonus at high levels.
Equipment purchases/upgrades/sales and level growth cannot compound Eclipse or
leave residue after expiry. Garen's armor reduction applies after the temporary
armor bonus; companion scaling uses the total before that reduction. The shared
HUD MR query and visible spell damage forecasts use the same effective defenses.

**Explicit local policies requiring native comparison:** incoming amplification
precedes the flat reduction; each non-true damage instance loses the smaller of
its captured-rank flat amount and 50% of that instance, then passes through
resistance/percentage mitigation and shields. True damage bypasses Eclipse.
After 180 ticks, one burst resolves before commands from Leona's current position,
sampling current AP but retaining cast rank. Collision uses the display radius
450 plus each victim's radius, inclusively. The raw authored cast radius 500 is
retained separately, not silently reinterpreted. No vision or line-of-sight test
is required. Living, vulnerable enemies including minions/neutral monsters are
eligible; structures, wards and returning/protected monsters are excluded.

One or more eligible hits, including shielded or lethal hits, extends both the
resistances and flat reduction by another 180 ticks. A miss retires the buff.
Only one explosion is possible; surviving victims receive Sunlight. The pinned
tooltip explicitly describes the resistance extension, while the exact affected
bonuses, collision, immunity and tick/input ordering remain native audit items.
Later crowd control does not cancel an armed burst. Flash before its deadline
moves the origin; a same-deadline Flash executes after the burst. Death cancels
an unburst W, and victory/respawn clear its state. Ordinary accepted damage uses
the existing event IDs; no extra W projectile or random sample is introduced.

Schema 118 saves nullable Eclipse start/rank/detonation/end/phase. It rejects
foreign/dead/unlearned/terminal ownership, changed durations, premature or
expired phase transitions and inconsistent extension clocks. Tests restore
before and after detonation, expiry, Flash and neutral retaliation. The browser
fixture gate now preserves a save containing active W as well as Sunlight and
delegated credit. W remains a headless development simulation without source
presentation, support bot integration or native acceptance. See the
[Eclipse verification ledger](reference/leona/eclipse-verification.json).

## Zenith Blade development simulation

E now uses World commands, Leona's own resources, a captured fifteen-tick
windup, and the shared projectile system. The export separately retains the
root's explicit 0.25-second cast and uncancellable-windup flag. The child
missile supplies fixed speed 2,000 and projected range 900; the display 875 and
legacy speed/width remain separate source evidence. Payload rank/AP are captured
at cast. Initial stun, silence, root, mana/cooldown and a zero direction reject
the cast. An already committed Q cannot be replaced by E. Q/W can arm during an
E windup, and Flash/Heal retain their shared rules. Recall cannot start during
the windup or dash. Headless E state does not substitute a foreign animation.

**Explicit local policies requiring native comparison:** the windup holds
movement but accepts buffered orders; later control does not cancel release.
Flash during windup changes the launch origin while preserving the cast's
captured direction. The missile starts moving on its release tick. Width 70 is
used as a collision radius. Swept contacts are inclusive, ordered by distance
within each segment with identity ties, and each target can be damaged once.
No visibility/line-of-sight requirement is imposed; allies, structures, wards,
returning and protected monsters are excluded. Accepted hits use area magic
damage and mark survivors with Sunlight. The missile keeps traveling through
champions and minions to its full range.

At flight completion, only the last champion struck is rooted for the source
half-second through shared tenacity. A dead last champion prevents pursuit;
there is no fallback to an earlier survivor. A launched missile can still deal
damage/mark/root after source death, but cannot start a posthumous dash. A rooted
or stunned living source also cannot start the dash. These death/ordering rules
are executable local policies, not native measurements.

The local homing dash moves at an explicitly provisional 2,000 units/second,
unaffected by slows or silence, across terrain toward the target's current
position. It stops at near-side body contact and resolves its landing through
`reachable`. Root/stun interrupt and resolve a reachable stopping point; Flash
cancels the dash through the existing reachable Flash path. Target death/removal
ends pursuit. The initial dash issues an attack order; subsequent orders buffer
through travel and resume after arrival. Ordinary attack windups are cancelled
at dash startup, while an already captured Daybreak can complete through it.
Its attack-only advancement cannot add ordinary walking to the dash step.
No turret-retaliation identity or attack clock is reset by the dash. Native
homing, landing, displacement, interrupt, input-buffer and aggro behavior remain
required comparisons. No dash speed was recovered from the missile's speed.

Schema 119 saves nullable E windup and dash ownership plus Zenith flight
cast/rank/hit/last-champion metadata. Validation checks phase separation,
identity/team/rank, exact release/flight/dash-start clocks, unit direction,
current/previous positions, remaining range, hit uniqueness, known invalid IDs
and last-champion consistency. Source death can retain a launched flight;
death/victory/respawn clear incompatible owned phases. Tests compare restored
futures during windup, flight, dash and interruption, including a real NavGrid
wall and retained turret retaliation. Browser loading still preserves and
rejects the incomplete Leona fixture, now with an active E windup in its save.
See the [Zenith verification ledger](reference/leona/zenith-verification.json).

## Solar Flare development simulation

R now uses a captured ground point, damage/rank/AP, mana and hasted cooldown.
Targets beyond the source 1,200 range clamp from the cast origin; a self-centered
point is valid. Fresh stun/silence, unlearned rank, insufficient mana and cooldown
reject activation. Root alone permits it. Ordinary pending attacks are cancelled;
a captured Daybreak cannot be replaced. Q/W can arm during the R windup, while E
and recall wait for release. R can start during a released E flight or dash, and
homing motion continues. R cannot replace E's own committed windup.

The root's uncancellable-windup declaration is exported separately from its
legacy 0.25-second timing; it has no explicit authored `mCastTime`. **Provisional
local clocks:** fifteen ticks of normal-movement lock and impact 38 ticks after
activation (0.625 seconds rounded upward to the fixed step). Neither the legacy
cast field nor unrelated animation/particle timing certifies native impact.
Later control does not cancel the committed windup. Flash changes the caster's
position while the original ground point stays fixed. Death before release
cancels R; death on/after the release boundary retains the committed impact,
independently of which owner is advanced first. Released state can outlive the
caster and is retired before damage callbacks; victory cancels all pending R.

**Provisional collision/order policy:** one pre-command impact samples current
victim positions and resolves participants in identity order. Inclusive body
overlap uses authored inner radius 120 and outer radius 300. Center hits apply
a 1.75-second stun; outer hits apply the 80% slow for 1.75 seconds. Both use the
shared control-duration path, including Courage tenacity. Damage passes through
magic resistance and shields; fully shielded surviving targets still receive
control and Sunlight. Dead victims receive no retained mark/control. Slows are
independent by caster, refresh through the existing slow path and expire before
commands on their own deadlines.

The impact does not require visibility/line of sight. Living vulnerable enemies,
including minions and neutral monsters, are eligible; allies, structures, wards,
returning and protected camps are excluded. A monster that cannot see its
attacker can enter ordinary recovery on that same tick; a visible attacker keeps
retaliation. R does not add a separate vision area in this adapter. The source's
`mSpellRevealsChampion=false` does not establish all native area/hit reveal rules;
those still require implementation or correction from native evidence. Spell
shield/immunity interactions, exact boundaries, timing and input/CC/death order
remain open. No legacy Incandescence/on-hit stacks, range or damage is enabled.
No R projectile, extra application entity or gameplay random sample is created;
ordinary cast/damage events retain their existing identity allocation.

Schema 120 saves nullable origin/point, rank/damage, start/release/impact clocks
and released phase, plus the independent Solar Flare slow kind. It rejects
foreign/unlearned/terminal ownership, invalid clocks/phases/range, dead windups
and incompatible pending actions. A dead released caster remains valid. Solar
slows validate source identity/rank, fixed strength and bounded duration; strict
saved futures cover both R phases, E overlap, Flash, posthumous control, neutral
retaliation and separate slow deadlines. The browser fixture gate now preserves
active R alongside the earlier development states before rejecting presentation.
See the [Solar Flare verification ledger](reference/leona/solar-verification.json).

## Geometry, legacy data and mode boundaries

| Source declarations | Treatment |
| --- | --- |
| W display range 450; raw cast radius 500 | Both retained distinctly. Actual explosion collision boundary remains to be established. |
| E root display range 875, legacy speed 1,200 and line width 80 | Retained in the source audit. These do not override the child missile declaration. |
| E child missile fixed speed 2,000, width 70, cast range 900; projects to cast range | Exported together as authored missile values. Whether width denotes collision radius and endpoint inclusivity remain behavior questions. |
| R primary radius 120 and secondary radius 300 | Used with an explicit inclusive-body-overlap policy in the development adapter; native collision and impact timing remain open. |
| Q root cast range 100 | A self-cast declaration, not evidence of an empowered attack-range increase. |
| Q attack child old damage/AP fields | Retained in full source; current root named damage/calculation drives the Q payload. |
| R on-hit damage/stacks/duration/range fields | Retained in source and audit, excluded from payload exports. The current frozen client tooltip describes the explosion and crowd control only. Active behavior must be established before adding any such effect. |
| R `cherry` AP override 1.0 | Retained in the audit; standard Rift payload uses 0.8. |

Cast-frame, explicit cast-time, legacy cast-time and animation fields remain
separate audit entries, including omitted values as null. R's impact delay and
E's dash speed are explicit local policies, not recovered values. W's instant
local cast and burst geometry are also explicit policies above.
Q's provisional lifetime/range/recovery adapter is identified separately above.
R's `mSpellRevealsChampion=false` does not by itself
settle area vision or hit-reveal rules.

## Remaining executable acceptance

Every row below still has required work, including the partially implemented Q.

| System | Required implementation and evidence |
| --- | --- |
| Basic attacks and Q | Melee profile, source release timing and attack selection; reset and empowered window; range; separate physical/magic damage; stun/CC precedence; cancellation, target loss and consumption. |
| W | Development command, dynamic defenses, burst/extension and saved futures are implemented. Native cast/expiry order, actual radius, reduction/extension semantics, immunity interactions and full presentation remain required. |
| E | Development windup, shared swept flight, last-champion root, homing dash, control/Flash handling, wall traversal and saved futures are implemented. Native collision/timing/dash/input/aggro interactions and source presentation remain required. |
| R | Development windup/delayed impact, cast clamp, differentiated control, overlap/death handling and saved futures are implemented. Native timing/geometry/reveal, spell shields/immunity, full interruption matrix and source presentation remain required. |
| Sunlight | Native verification of refresh/multiple owners, proc/pet/blocked-hit eligibility, ordering, caster death, farming and attribution. The shared core and saved futures are implemented. |
| Integration | Shared player/bot command validation; support-role decisions; HUD and input; strict saved states and restored futures; victory and respawn cleanup. |
| Presentation | Prepared rig/animation import, conservative animated bounds, source effects/audio, visibility and ownership, load/dispose/context recovery, native comparison and full-match performance. |

The browser/player integration must exercise these through World commands and
strict saved states, including failures and timing boundaries. Production selection and the
complete six-character milestone cannot pass from payload-only tests.

The complete [Eclipse source dependency set](LEONA-W-SOURCE.md) now retains all
five standard-game systems, fifty emitter records, 36 textures and six custom
meshes. W playback, attached-skin materials and source audio still require integration.

The [Eclipse attached-skin material](LEONA-W-SKIN-MATERIAL.md) now has compiled
shader arithmetic evidence and a posed source-rig diagnostic. Match-owned W
playback remains unfinished.

[Eclipse playback](LEONA-W-PLAYBACK.md) now adds strict saved W histories, a
sampler for all thirty enabled emitters, and actual drawing of the four
attached-character material descriptions. The remaining twenty-six enabled
layers, source sound dispatch and native comparison remain unfinished. Player
selection, support integration and the full kit gates remain open.

The [Eclipse surface increment](LEONA-W-SURFACES.md) now draws the remaining
26 enabled families, including retained SCB geometry, vertex-alpha, split UVs,
soft depth and distortion. All thirty enabled descriptions have renderer paths.
Native bindings/dispatch/culling/attachment/frame acceptance and source audio
remain open, along with the rest of Leona and the full match gates.

[Eclipse source audio](LEONA-W-AUDIO.md) now plays all five finite SFX roles
from eighteen unchanged float masters, including the authored onset and delayed
stops. Saved phases, fog, readiness/fallback and terminal retirement are covered;
native script/attachment/shuffle/listener/bus and listening acceptance remain open.


[Zenith source preparation](LEONA-E-SOURCE.md) now retains all five E systems,
thirty-three emitter records, forty-two textures and four SCBs, including the
hashed dash override texture and disabled dependencies. The cone shares existing
Eclipse bytes. Gameplay E histories, trails/materials, audio and native comparison
remain required; this source package does not enable production Leona selection.


[Zenith saved presentation histories](LEONA-E-HISTORY.md) now retain accepted
casts, actual launch origins, ordered swept contacts, bounded posed target tails,
homing dash anchors/stop causes, successful arrivals and independent owner-life
endpoints through respawn. Schema 125 validates their phase/geometry/ownership
consistency. Four browser phase saves/reloads preserve exact futures; source E
materials/trails/skins/audio and native comparison remain required. This increment
does not enable production Leona selection or complete the kit.

Later Zenith increments now draw 18 visible families and play the six source SFX
roles from saved phases. The reflection sword still needs explicit native inputs;
native dispatch/bindings/frame acceptance remain open.

[Solar Flare source assets](LEONA-R-SOURCE.md) retain all six systems and 44 enabled
records. The [explicit decal arithmetic](LEONA-R-DECALS.md) is verified separately
from native terrain/CPU binding. [Saved R histories](LEONA-R-HISTORY.md) now retain
accepted/released/impact and posed source/contact facts under schema 126, including
posthumous impact and fixed-area visibility. Source R drawing/audio, player/support
integration, native acceptance and the full six-character match gates remain open.

[Solar Flare source SFX](LEONA-R-AUDIO.md) now adds all three finite roles from
nine unchanged float masters. Saved accepted/area/impact facts, fog, reload,
mute, fallback and terminal retirement are covered; native callsites, timing,
shuffle/listener/bus and listening acceptance remain open. R source visual
compilation/drawing is the next independent prerequisite.

[Solar Flare source sampling](LEONA-R-KERNELS.md) now compiles all 44 enabled
families, preserves nine disabled definitions, and provides seekable source
attributes with explicit orbital placement/direction helpers. Cylinder, type-1
linger, lookup/multiplier streams and externally zero noise are covered. Source
GameView drawing, projection/attachment/distortion routing and native acceptance
remain separate work.

Later Solar Flare increments now draw41 of44 enabled families across both area
alternatives, including the private posed skin, clipped terrain projections and
early/late distortion. The [native sampler reading](LEONA-R-NATIVE-SAMPLERS.md)
now supplies a bounded generic CPU/Metal address contract for the planar path.
Two weapon quads still need their attachment frame. The
[unnamed-base Activate audit](LEONA-R-ACTIVATE.md) and
[matching native client](LEONA-NATIVE-MATCHING.md) are retained; actual Leona
dispatch, source-loader defaults, native frames and the complete player/support
and six-character match gates remain open.

[Native emitter registration and defaults](LEONA-NATIVE-EMITTER-DEFAULTS.md)
now identify constructor CameraQuad/empty-base/alphaRef-five defaults and the
distortion scalar/normal-name offsets. Absent-field loading and actual Leona
dispatch were separate gaps; the later [generic BIN loader](LEONA-NATIVE-BIN-LOADER.md)
now traces omitted-field preservation through the identified reader's return.
Actual Leona dispatch remains unobserved; local R coverage stays41/44.

[Native generic SCB normals](LEONA-NATIVE-SCB-NORMALS.md) now provide a byte-
checked normal-generation and vertex-binding prerequisite for the Zenith sword.
Derived source streams remain separate from authored mesh inputs. The
[native reflection-input reading](LEONA-NATIVE-REFLECTION-INPUTS.md) now ties
sword2's two authored fields to constructor defaults, CPU uniform packing and a
retained rim-only mesh shader path. Source fresnel maps to exponent
`.8350000381469727`; its zero color alpha is not read by those uploads. Actual
resource lifecycle/E dispatch, local integration and native frames remain open.

An [explicit rim-only mesh material](LEONA-E-RIM-MATERIAL.md) now implements the
retained no-cube shader pair and passes local GPU arithmetic/recovery checks.
The source sword diagnostic uses derived normals and explicit probe resources;
it is not yet imported by GameView. E coverage remains18/20.

The later [Zenith sword source presentation](LEONA-E-SWORD.md) now connects the
separate derived normal stream, mapped fresnel, strict alpha gate and conditional
blend-zero tint packing to saved E surfaces. All19 authored visible E families
draw locally; the twentieth enabled record is a sound carrier. The
[native SCB material reading](LEONA-NATIVE-SCB-MATERIAL.md) distinguishes packed
face colors, authored vertex-color selection and the exact kColorFactor input.
Actual native dispatch/frames, complete playable Leona, player/support and the
full six-character match remain open.

[Development bot setup](LEONA-BOT-SETUP.md) now gives AI-controlled Leona fixtures
their own legal skill order and defensive component/upgrade route. It preserves
the existing player/Rift gates and exact saved futures. The local W defense now
reacts to observed committed attacks; Q/E/R tactics, engage/peel safety and full
support-role match validation remain required.
