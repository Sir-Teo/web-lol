# Development status

Last updated: October 22, 2026 (America/New_York).

**Goal remains active:** continuously develop the highest-quality, visually authentic League-like browser game, without an application backend, through small commits. The required final state is a verified production-level full match experience. This file describes progress toward that goal; it does not reduce its scope.

## Current authoritative state

The application opens on the imported source Rift. The separate `?scene=fixture` development scene is a controlled low-poly test map. Current validation includes 1,239 source/simulation/geometry checks, the focused Rift camp and existing lane/neutral browser checks described below, and earlier Gromp combat/death/missile and input/save/fog regressions. The latest complete Chrome audit ran 453 scenarios: 451 passed and two findings were repaired and verified in 18 focused checks; it was not repeated as a single green full run. The preceding all-green full audit passed 221 scenarios at commit `8098f1f`. Scope and repairs are recorded in [BROWSER-REGRESSION.md](BROWSER-REGRESSION.md), with current production validation below. These results do not certify full-match completion or native visual parity. Historical counts do not certify later changes.

- TypeScript/Vite/Three.js application with a fixed-step simulation, wall-aware navigation, swept skillshots, ranged attack windups, death, recall, respawn and local saved matches. No application backend is used.
- Pinned patch 16.18 source terrain, navigation, elevation, vegetation, structures, animated minions and Ashe/Lux rigs. Both bases have inhibitors, Nexus objects and source turret placements with structural progression and rubble.
- Ashe Q/W/E/R and Lux passive/Q/W/E/R have runtime foundations and targeted interaction checks. Lux has a local combat and purchase policy. Human selection and HUD now support Ashe and Lux; neither champion is certified complete in native effects, audio, timing or all interactions.
- Shared team vision, brush and terrain occlusion, shields, independently owned slows, roots, AP, ability haste and timed mana restoration. The item catalog includes basic AD/defense components and mage recipes through Lost Chapter and Deathcap; complete builds, runes and advanced item effects remain unfinished.
- DOM HUD, aiming/input, minimap, shop, scoreboard, menus, practice controls, local storage and source/synthesized audio paths. Browser tests cover these integration surfaces, including failure/recovery scenarios.
- Ten-champion lane diagnostics are available with all Ashe or eight Ashe/two Lux. These fixtures have two top, one mid and two bottom champions per team. They do not implement jungle roles, complete objective play or final role AI. The default entry remains practice, with **Pause → New match** offering a human Ashe or Lux plus nine lane bots. This is an interim lane mode, not the completed production 5v5 role system.
- A controlled development Gromp encounter now exercises the neutral faction, local retaliation/leash/reset policies, source-rig playback, all eight reconstructed death-pop emitters, four source missile emitters, Root-scalar last-hit rewards and schema-100 continuation. The interim lane match now also schedules both source-linked Rift Gromp camps, with independent death-based respawns, protected source emergence and schema-100 clocks. Two Blue Sentinel camps now add the normal-skin rig, melee combat and species-specific calendars, making four camps in the interim lane match. Red Brambleback now adds two more,
  for six independent calendars and a third source monster rig. Two three-member
  wolf camps add six monsters and two raptor packs add twelve. Two Krug camps now bring the lane match to twelve calendars, ten source monster rigs and 28 initial neutral monsters, with delayed Krug offspring after parent deaths. A separate shared river controller now adds both initial Scuttlers at 2:55 and one selected later spawn, bringing the match to eleven monster rigs and 30 initial monsters. Native activation/scaling, epic objectives, effects/audio and jungle-role matches remain unfinished.
- Visual and performance acceptance remains open. Source assets and green behavioral tests do not establish pixel-authentic rendering. Earlier callback-delivery measurements do not establish missed frames; corrected cadence/GPU measurements are recorded below. Source texture transfer/storage targets remain exceeded, and full-match performance certification remains open.

The game is **not production complete**. The full match, roster, native comparison, delivery/offline and performance requirements in the design and fidelity plan remain in scope. Detailed milestones below distinguish pinned source values from provisional runtime policies and record validation at each revision.

[Final companion passive adapters](OWNED-COMPANIONS.md#final-passive-adapters)
now activate on earned full growth in the controlled encounter. Mosstomper uses
one persistent, refreshing shield with a ten-second combat deadline; Gustwalker
uses actual battlefield brush membership and saved linear exit/kill decay;
Scorchclaw uses saved Ember phases, independent per-owner burns and decaying slows.
Smite and periodic procs cannot trigger Scorchclaw. Source values and published
rules remain separate from explicit delivery policies, including the unresolved
three-second slow and area-burn dispatch. Schema 100 captures these states and
marked shields. The HUD exposes each passive, and the player's scoreboard icon
tracks evolved Smite without exposing enemy cooldowns.

A new posthumous-kill test exposed earlier companion recovery restoring health
to a dead owner. Health/mana recovery now requires a living owner while earned
XP, feeds and evolution persist. All 1,239 checks across 237 files and TypeScript
pass, including 21 new passive cases and one navigation case. Extended source
integrity assertions then pass separately. Thirteen distinct Chrome cases pass
across the initial and final focused runs, plus a repeated Scorchclaw case that
checks the tooltip at 1280x720. The initial Moss setup correctly observed pet
follow-ups extending combat; it now waits for quiescence before checking the
recovery deadline. Real missile absorption, brush movement, attack/Smite input
and exact passive checkpoints are covered; feeding, health/stun setup and timer
stepping remain diagnostic. All seven captures were visually reviewed.

The generated profile repeats byte-identically, and all GLBs/map validate with
zero errors/warnings. Production build and `/nested/rift/` smoke pass, retaining
17 recordings and zero companion requests in ordinary matches. The existing
bundle warning remains (684.91 KB game, 659.92 KB Three). Exact evidence is in
[the passive ledger](reference/companion-passives-verification.json). Companion
purchases, role binding/modifiers, native effects/timing/visual comparison and
complete jungle-role matches remain unfinished. The full project goal stays active.

[The ownership foundation](OWNED-COMPANIONS.md) established player following
and assistance against monsters in the controlled development Gromp encounter. All three variants use
their source rigs and selected spawn/movement/attack/heal/Smite/transform clips.
Feeding through large-monster last hits earns 15/35-feed Smite evolution,
champion damage/slow and final monster-area damage. Schema 99 stores separate
owned actors, movement and attack commitments, feeding/bonus clocks, evolution
ticks and independent Smite slows. Four upgrade icons are decoded from the
original frozen DATA archive with their own source pin. Ordinary production
matches still used base Smite; at that schema-99 milestone, purchases, final
passives, role assignment and jungle bots remained unfinished.

Controller scalar values and DPS/HPS calculation parts remain separate from
explicit local following, strike timing, area, recovery and bonus-clock policies.
The source breakpoint 20 versus published first-evolution 15 discrepancy and
metadata-only callback boundary remain visible. The runtime does not insert the
companion CharacterRecord into the neutral monster catalog. Native animation
dispatch, materials, scale, effects/audio, role modifiers and complete seeded
matches remain open. Exact milestone evidence belongs in
[the owned-companion ledger](reference/owned-companions-verification.json).

At the schema-99 ownership milestone, all 1,217 checks across 236 files and
TypeScript passed, including twelve new mechanics and two source cases. The focused Chrome run passed thirteen cases
and exposed a test movement/setup issue; the corrected combat case then passed
separately, covering fourteen distinct cases. The new four cover real movement,
attack/Smite input, all three source rigs/forms and exact windup/growth/slow/death
reloads. Repeated feed targets, stun/health preparation and isolated release
stepping remain diagnostic. All seven captures were visually reviewed. Icons,
provenance and generated inputs repeat byte-identically; all GLBs/map validate
with zero errors/warnings. Production build and nested-path smoke pass with
17 recordings, no development hook, no companion status and zero companion
requests even with the fixture query. The existing bundle warning remains
(675.00 KB game, 659.92 KB Three). These checks do not certify native behavior,
complete jungle play or full-match performance; the full goal stays active.

[The historical companion source milestone](JUNGLE-COMPANIONS.md) retained all three source
skins with Adult/Baby meshes and diffuse assignments. Seventy original Map11
members and twelve original Scripts members pin 84 atomic graph states across
three rigs. The development review now exposes fourteen entries, supports manual
source form switching and retains retry/cache/late-load guards. Native following,
growth and animation dispatch are not implied by this review.

The item/controller pin preserves prices, Smite requirements, ownership groups,
pet DPS/HPS inputs, treat intervals, bonus gold/XP and monster damage modifiers.
A counter discrepancy remains explicit: standard items contain 35 total and a
20 breakpoint; extended strings label that breakpoint as treats fed, while the
published 26.1 change says first evolution takes 15 kills. The twelve retrieved
scripts contain only metadata/RETURN, including one static FX-override table.
Their 84 instructions do not expose the native counter callbacks needed to
resolve the direction and bonus-treat lifecycle. No incomplete companion item is
advertised in the live shop.

All 1,203 checks across 234 files and TypeScript pass. Six new cases protect source
provenance, all atomic state aliases, both source forms, scales, item/counter
conflicts, absent values and metadata-only callback boundaries. Source extraction
matches on repeat; all three converted rigs/manifests repeat byte-identically.
The existing default Scuttler conversion also remains byte-identical after the
converter's optional companion skin selection was added. All GLBs/map validate
with zero errors/warnings. All four focused Chrome review cases pass after
restoring the ordinary-rig status label. All six companion captures were visually
reviewed. Production build and nested-path smoke pass with zero companion requests
in ordinary matches, the existing 17 recordings and no development hook. The
existing bundle warning remains (658.31 KB game, 659.92 KB Three). Exact results
and capture hashes are recorded in [the ledger](reference/jungle-companions-verification.json).
At that source-only milestone, schema 98, the fingerprint and eleven-monster
match roster were unchanged. The later controlled owned-companion runtime is
recorded above; production role binding and complete jungle-role matches remain
required work. The full goal stays active.

[Base Smite and summoner loadouts](SMITE.md) now let players select two distinct
Flash/Heal/Smite spells for D/F in both match modes. The chosen identities reach
input, HUD, tooltips, scoreboard, defensive bot slot lookup, saves and restarts.
Duplicate choices swap slots. The match setup also now describes the live jungle
camps and Scuttlers instead of claiming they are unavailable.

The standard 16.18 source pins 600/1,000/1,400 damage, two maximum charges,
15-second cast cooldown, 90-second recharge and 500 bounding-box range. Base
Smite deals 600 immediate true damage to source-tagged large/medium monsters or
enemy lane minions; small monsters and champions are excluded. Existing last-hit
rewards and camp calendars handle kills. A sequential charge clock is independent
of cast lockout and ordinary ability haste, continues through death and is saved
in schema 98. The local startup grants one charge and schedules another after
90 seconds; native first-charge timing remains unverified. No champion-level
upgrade replaces the missing companion quest.

All 1,197 checks across 233 files and TypeScript pass, including eleven mechanics
and four source cases. Eight existing focused Chrome regressions passed; the new
Smite test initially stopped because its diagnostic setup remained paused. After
correcting that setup, all four Smite/match-selection cases pass together. Real
D input deals 600 damage, spends charges and kills Gromp for normal rewards.
Queued/checkpoint reloads, recharge, both-mode selection, restart, scoreboard and
swapped Heal are covered. The 1280×720 setup and 1440×900 gameplay captures were
visually reviewed. Setup, health preparation and calendar jumps remain diagnostic.
Source extraction repeats against the pin and the generated profile reproduces
byte-identically. All GLBs/map validate with zero errors/warnings. Production
build and nested-path smoke pass with selected Smite retained through restart,
17 recordings, all eleven monster rigs, no preview requests and no development
hook. The existing bundle-size warning remains; exact hashes and sizes are in
[the ledger](reference/summoner-smite-verification.json).

Companion items, pets, quest evolution, role binding, jungle modifiers, native
startup/range/latency/effects/audio, jungle-role AI and epic objectives remain
unfinished. This is a base-summoner dependency for the full match. Native visual,
full browser/performance and production acceptance remain open; the full goal
stays active.

[Rift Scuttler](SCUTTLER.md) now joins the lane match through a shared river
controller. Both initial rivers emerge at 2:55, patrol all five source waypoints
and flee attackers without inventing an attack. The first death waits for the
other initial Scuttler; later clears schedule one selected river after 150 seconds.
Selection consumes saved RNG on every death, retaining the legacy 50 and streak
25/75 thresholds. Schema 97 stores ownership, hidden/emergence clocks, movement,
regeneration, pending death-based deadlines, shrines and speed linger.

The source's 2.2-second lead-up, Root 1.5-second protection and ~1.6-second clip
remain distinct. A local 42-tick buried phase precedes 90 protected emergence
ticks, with seven final presentation ticks after readiness. The held hide pose
also supplies the local corpse presentation; the source has no attack/death clip.
Both source rivers retain their boundaries and projected source navigation homes.
A local shrine grants team vision and a 30% speed bonus with two-second linger;
the 90-second duration and bonus/linger are provisional bindings of retained
source candidates. The area ring and minimap marker are local aids. Native
radius, combat gating, dash/taunt behavior, later forms, scaling, shrine
particles/audio and visual comparison remain open.

All 1,182 checks across 231 files and TypeScript pass, including eleven Scuttler
cases. All eight focused jungle Chrome cases passed together. Final hidden
visibility and crowd-control deadline repairs then passed the Scuttler and Gromp
emergence cases again. The Scuttler browser case uses real Lux attack/Binding
input, checks source-rig and shrine GPU contributions, exact hidden/flee/shrine/
corpse-free pending reloads, rewards and a fresh single-river respawn. Setup,
lethal finishes and calendar jumps remain diagnostic. Three captures were visually
reviewed. All GLBs/map validate with zero errors/warnings. Production build and
`/nested/rift/` smoke pass with 17 recordings, all eleven rigs, no preview
requests and no development hook. The existing bundle-size warning remains
(652.20 KB game and 659.92 KB Three). Exact results are recorded in
[the live ledger](reference/scuttler-verification.json); this is not a full browser
audit or native/full-match certification.

[The source preparation](SCUTTLER-SOURCE.md) and
[its historical ledger](reference/scuttler-source-verification.json) retain the
separate extraction and rig review milestone: seventeen atomic clips, both river
paths/borders, eighteen scripts and recursive closure inventories. The development
character review exposes all eleven imported ordinary rigs and explains the
below-ground hide pose. Those historical schema-96 results do not certify the
new live controller. The full project goal stays active.

[Krug camps](KRUG-CAMPS.md) now add both Ancient/medium pairs and delayed
four-/two-mini split waves. All three base rigs and their 17/16/16 atomic clips
are pinned; 35 Map11 members and six script files retain construction, named
locators and the lack of an active death callback in the script stubs/metadata.
Extraction matches, and all three rigs/manifests/export reproduce byte-identically.
The published 67-second first-ready, one-second split and four-CS baselines are
kept separate from frozen Root values and explicit local adapters.

Schema 96 stores eight ordered slots per Krug camp plus captured pending,
spawned or cancelled wave metadata. Both parents can die without starting an
early respawn while descendants are pending. Partial and empty-pending saves
resume exactly; final removal starts the next calendar. Offspring inherit a
valid captured champion target, use reachable local radial homes and own marked
cleanup clocks after leader death. Unclaimed medium cleanup cancels new offspring
and grants no rewards. A Root-only full clear pays four CS, 109 gold and 121 XP.
Native spawning/aggro/cleanup order, respawn anchor, scaling, attack-speed and
reward modifiers, percentage-health damage, launch effects/audio and complete
patience remain unverified.

All 1,167 checks across 229 files and TypeScript pass, including eight new Krug
cases. All seven focused Chrome camp cases pass together. The Krug case uses
real Lux attack/Binding/Singularity input, verifies initial and descendant GPU
contributions, exact fighting/pending/partial/cleared reloads, 2.75 internal CS
with a whole-number HUD, and fresh two-parent respawn. Setup, final kills and
calendar jumps remain diagnostic. Both captures were visually reviewed; combat
text clutter and native visual calibration remain open. All GLBs and the map
validate with zero errors/warnings. Current production results and hashes are in
[the Krug ledger](reference/krug-camps-verification.json). Full-match and native
visual/performance certification remain open; the goal stays active.
Production build and `/nested/rift/` smoke pass with 17 recordings, all ten
monster rigs, no jungle preview requests and no development hook. The existing
bundle-size warning remains (635.99 KB game and 659.92 KB Three chunks).

[Raptor camps](RAPTOR-CAMPS.md) now add both six-member groups, with twelve
source-linked locators and both base rigs. The new pin retains 58 archive members
and 23/25 atomic clips. Extraction matches, and both rigs/manifests/export repeat
byte-identically. The source assigns distinct north-side emergence clips and
asymmetric 60/40-tick lead-ups. An initial Chrome failure exposed blocked legacy
Order locators and a six-point approach assumption inherited from wolves. Local
placement now projects blocked homes through the imported navigation grid,
preserving original locators in content. Both packs can complete a reset.
Native spawn/collision calibration remains open.

Schema 95 retains six-member ownership, side-specific pose/lead-up clocks and
canonical fractional CS in champion and fog-observed records. Small raptors add
0.4 internally; HUD and scoreboard display whole-number totals. A full pack pays
exactly four CS, 75 gold and 70 XP under the Root-only local reward policy.
Native scaling, percentage-health damage, ranged attack dispatch, reward
modifiers, full patience/soft resets and effects/audio remain unfinished.
Eight new raptor tests and the revised fractional fog-observation regression pass;
all 1,159 checks across 228 files and TypeScript pass. Current browser/production
results and limits are recorded in [the raptor ledger](reference/raptor-camps-verification.json).
The initial six-case Chrome run passed four cases and exposed the raptor
placement/approach issue plus a stale Red calendar-count assertion. After repair,
all six focused camp cases pass together. A final raptor rerun also passes after
adding its content JSON to the saved-ruleset identity and selecting each pack's
own leash profile. Both final raptor captures were visually reviewed. All GLBs
and the map validate with no errors/warnings. Dense combat text, native pose/
placement and visual/performance comparison remain open. Production build and
`/nested/rift/` smoke pass with 17 recordings, all seven monster rigs, no jungle
preview requests and no development hook. The existing bundle-size warning
remains (626.33 KB game and 659.92 KB Three chunks). The full-match goal remains
active.

[Wolf camps](WOLF-CAMPS.md) now add both source-linked three-member packs.
The source pin retains 51 archive members, both base rigs and legacy group/
locator windows. Both GLBs, manifests and the camp export repeat byte-identically.
The script reverses small-wolf spawn variants across the two sides. Small-wolf
Root damage and CS remain absent in the pin; local 20 damage/1 CS are explicitly
provisional. Native scaling, percentage-health on-hit damage, complete patience/
soft resets, effects/audio and jungle roles remain unfinished.

Schema 94 replaces each camp's single unit ID with ordered nullable member slots
and individual marked-cleanup deadlines. Shared retaliation alerts its own pack;
nearby members share resets while the leader lives. After leader death each
survivor needs ten consecutive seconds outside qualifying champion combat before
local cleanup, which grants no last-hit rewards. Partial and complete corpse-free
saves preserve ownership and respawn deadlines. Member spawn aliases retain
independent source pose clocks. A Chrome boot failure exposed in-place clip
renaming when two mini spawn aliases share one source; aliases now clone clips
without consuming the shared original.

All 1,151 checks across 227 files and TypeScript pass, including eight wolf cases
and a shared-animation alias regression. The confirmed alias boot error caused
an interrupted run; after repair, all five focused Chrome camp cases pass.
The wolf case verifies actual attacks/Binding, three source rig contributions,
exact fight/partial reloads and a fresh complete group. A final label refinement
shows small-wolf names on hover/selection, reducing melee clutter; its focused
Chrome rerun passes. Both final captures were visually reviewed. All GLBs and
the map validate with no errors/warnings. Production build and `/nested/rift/`
smoke pass with 17 recordings, five monster rigs and no inspector requests or
development hook. The existing bundle warning remains. Commands, hashes and
limits are in [the wolf ledger](reference/wolf-camps-verification.json).
Full-match, full browser-suite and native visual/performance certification remain
open.

[Crest of Cinders](CREST-OF-CINDERS.md) now rewards Red clears with a saved,
refreshing two-minute buff. Basic attacks add true-damage burn and independent
slows; health regeneration pauses after champion/turret damage. Published 26.1
values drive healing/slow tiers and burn endpoints; the linear damage mapping,
pulse schedule, lockout and overlap rules remain explicit provisional policies.
The source pin retains two metadata scripts, frozen formula-placeholder tooltips
and the original 64px icon. Both crests can coexist in the human HUD. Visible
burning targets show a status; native particles/audio and cumulative burn-number
presentation remain open. Schema 93 preserves burn phase and ownership, healing
lockout and both buff clocks, including transfers and posthumous kills.

All 1,142 checks across 225 files and TypeScript pass, including 14 new source/
simulation cases. The initial four-case Chrome run passed Blue and two Garen
cases; the Red extension exposed a diagnostic enemy placement that terrain
projection overlapped with the player. The fixture now uses the cleared camp
home and asserts separation/visibility. Its focused rerun passes real Cinders
input, both icons, status, exact burning reload and the next saved damage pulse.
The new capture was visually reviewed. Source extraction repeats identically.
Production build and `/nested/rift/` smoke pass with 17 recordings, all three
monster rigs and no development hook or inspector requests. The existing bundle
warning remains. Commands, hashes and limits are in [the Cinders ledger](reference/crest-of-cinders-verification.json).
Native comparison, a single full browser-suite run and full-match certification
remain open.

[Red Brambleback](RED-BRAMBLEBACK.md) now joins the live Rift jungle with both
source-linked camps, its normal base rig and 15 source clips. Root supplies a
200-unit range, distinct from Blue's missing range, and cast frame 16 gives a
32-tick melee contact. The new source pin retains 22 map-archive members, the
character script stub, legacy camp windows and the conflicting placed Skin3
Baron variant. The existing character/map/script pins remain unchanged. Normal
skin 0 is selected locally pending native activation checks.

Red uses the published 55-second first-ready baseline. A 100-tick protected
lead-up, 1000-unit leash and 300-second respawn adopt explicit provisional
legacy policies. Its four-second source spawn clip continues beyond readiness;
its death clip has separate corpse retention. Schema 92 validates six calendars,
source homes and species clocks, with a catalog-derived calendar limit. Red
now pays Root gold/XP/CS and grants [Crest of Cinders](CREST-OF-CINDERS.md). Native
scaling, complete effects/audio and jungle-role bots remain unfinished.

All 1,128 checks across 224 files and TypeScript pass, including seven new Red
cases. Three focused Chrome cases pass for Red, Blue/buff and Gromp camps; Red
uses real Lux attack/Binding input, exact fighting reload and a distinct saved
respawn calendar. Final kills and time jumps remain diagnostic. Both Red
captures were visually reviewed. Repeated source extraction matches, and repeated
rig conversion/export is byte-identical. All GLBs and the map validate without
errors or warnings. Production build and `/nested/rift/` smoke pass with 17
recordings, all three monster rigs across lane start/restart, no inspector
requests and no development hook. The existing bundle warning remains. Exact
commands, hashes and remaining limits are in [the Red ledger](reference/red-brambleback-verification.json).
The full browser suite, seeded full-role match and native comparison remain open.

[Crest of Insight](CREST-OF-INSIGHT.md) now rewards Blue Sentinel last hits with
one refreshing two-minute champion buff. The official 10/15/20 haste tiers at
levels 1/6/11 add to item haste, including Hawkshot recharge and Judgment's
captured cooldown. A pinned frozen RST describes duration and transfer; its
regeneration parameters remain placeholders. The runtime's 25 flat +5% maximum
mana per five seconds and half-second pulse cadence are explicitly provisional.
Champion kill credit transfers/refreshes the buff; uncredited non-epic jungle
executions retain the original deadline. Dead owners bank no mana pulses.
Schema 91 preserves each owner's expiry and exact pulse phase. The human HUD
uses the script-selected 64px source icon, countdown and remaining-duration bar.
Native formula/timing, wisps, Smite sharing and buff VFX/audio remain open.

All 1,121 checks across 223 files and TypeScript pass, including 13 new source/
simulation cases. Three focused Chrome cases pass for Blue camp combat/buff HUD,
champion casting and independent bot purchases. The 64px source icon, 1:54
countdown, exact buff reload and later expiry are checked in the real HUD; the
final clear and calendar jumps remain diagnostic. The new gameplay capture was
visually reviewed. Repeated source extraction matches the committed pin.
Production build and `/nested/rift/` smoke pass with 17 recordings, both camp
rigs and no development hook or inspector requests. The existing bundle warning
remains. Commands and hashes are retained in [the Crest ledger](reference/crest-of-insight-verification.json).
The full browser suite and complete native match remain uncertified.

[Blue Sentinel](BLUE-SENTINEL.md) now joins Gromp in the lane match. Both Blue
camps use exact legacy-script-linked locators, existing normal-skin clips,
physical melee retaliation, private reset controllers and independent saved
calendars. The first-ready baseline is 55 seconds; 1.1-second protection,
300-second respawn and a 175-unit melee range are explicit provisional policies.
Root omits range, which remains null in source metadata. Skin4 is a Baron/Voidborn
variant despite its placed-object references; normal skin 0 is selected locally
in light of the official removal of Baron corruption, pending native validation.
[Crest of Insight](CREST-OF-INSIGHT.md) now grants haste, provisional mana
regeneration and transfers, with a source-icon HUD timer and saved pulse phase.
Elemental-terrain sharing and native calibration remain unfinished.

The species/camp catalogs now provide rig identity, clips, combat/navigation
values, corpse retention, rewards and deadlines. Schema 90 validates all four
calendars and species-specific ownership/clocks. Gromp's dedicated effects remain
Gromp-only. Both rigs preload for lane matches; ordinary practice requests neither.
A centered single-line monster name fixes Blue Sentinel wrapping without
resizing health bars. No model binary changed.

All 1,108 checks across 222 files and TypeScript pass. Seven new Blue cases cover
source/clip identity, absent range, exact melee release, private controllers,
Root rewards, four-camp continuation and invalid species ownership. The new
Chrome case passes real Lux attacks, Binding/impact effects, Blue pixels, fight
reload and a corpse-free new-ID respawn. The initial five-case run passed four;
the remaining Gromp assertion still counted every camp model as Gromp. It now
filters its species, and the focused Blue/Gromp rerun passes both cases. Source
extraction/export repeats identically, including the unchanged older script pin.
Production build and `/nested/rift/` smoke pass with 17 source recordings,
34 scheduled Gromp requests and two normal Blue rig requests across lane start/
restart; no inspector requests or development hook appears. The existing bundle
warning remains. Both final Blue captures were visually reviewed. Source/capture
hashes and exact commands are in [the Blue ledger](reference/blue-sentinel-verification.json).
Full-match and native visual/role certification remain open.

[Gromp emergence](GROMP-SPAWN.md) now uses the existing 4.5-second source clip
and a separate, provisional 3.2-second protected lead-up. It preserves the
67-second first-ready and death +135-second respawn deadlines. The source spawn
submesh appears only during that clip; the mini mesh stays hidden. Playback
continues after readiness until positive damage or clip completion, with direct
spawn transitions supported by the graph's zero blend values. Schema 89 retains
protected and ready-tail checkpoints, including exact sampled pose continuation.

A new source pin retains 22 original timer instructions, the atomic animation
record, source event frame, model clip and graph spawn blends. Repeated static
extraction/export matches. Nine new unit cases cover clock/provenance boundaries,
control immunity, exact-ready input, interpolation, saves, resets and lethal
interruption. The protected Binding test exposed collision/control dispatch
that still consumed a hit slot despite rejected damage. Collision and root/
silence now honor vulnerability; Binding and Volley reach valid units behind
the emergence. All 1,101 source/simulation/geometry checks and TypeScript pass.
Five focused Chrome cases pass for source emergence/mesh GPU contribution,
protected pose reload, normal camp combat/respawn, controlled neutral combat/death
and two-target Binding. Both new Rift captures were visually reviewed. Production
build and `/nested/rift/` smoke pass with 17 source recordings, 34 scheduled Gromp
requests across lane start/restart, no source-inspector requests and no development
hook. The existing bundle-size warning remains. Source/capture hashes and exact
commands are retained in [the spawn ledger](reference/gromp-spawn-verification.json).
Current native timer/visibility dispatch, ready-flash/spawn audio, level scaling,
other camps and full jungle-role match certification remain open.

The [Rift Gromp camp increment](JUNGLE-CAMPS.md) adds two live lane-match camps
at exact script-linked map locators. It uses the published 67-second first-spawn
baseline and an explicitly provisional 135-second respawn policy. Death schedules
only its own camp; resets leave the calendar unchanged, and corpse-free saves
retain their pending deadlines. Schema 88 validates ownership, source homes and
calendar relationships. Lane matches preload the existing rig/effects before
simulation resumes; ordinary practice still requests no Gromp assets.

Nine original Lua 5.1 scripts now have reproducible extraction and ten bytecode
evidence windows. A static reader matches stock Lua 5.1.5 on 103 prototypes and
10,252 opcode names. Repeated extraction/export is identical; five synthetic
format checks pass. Legacy Lua gives a conflicting 99-second first spawn and
conditionally exports native dictionaries. Current mutator/feature-flag values
remain unknown; this is documented evidence, not certified native activation.
The source-linked Chaos locator differs from its placed character and anchor.

All 1,092 source/simulation/geometry checks and TypeScript pass. Four existing
Chrome lane/neutral cases pass; the new real-menu spawn/fog/clear/reload/respawn
case also verifies a mouse attack and retaliation, and passes after correcting its selector to distinguish the hidden opposite
camp bar. Both Rift captures were visually reviewed. Production build and
`/nested/rift/` smoke pass with 17 source recordings, no development hook or
source-inspector requests, and Gromp rig/effect loading for lane start/restart
(34 requests across both loads). The existing bundle-size warning remains.
Full-match and native visual parity remain open. Source hashes, ruleset fingerprint
and validation details are retained in [the camp verification ledger](reference/rift-gromp-camps-verification.json).

Earlier roster increment: Garen NPC R now has explicit champion targeting, captured
rank/timing, release-time missing-health true damage, isolated target sight, source
cast playback, execute decisions and validated checkpoint continuation. All 886
simulation tests, TypeScript, four focused Q/W/R browser cases and the nested-path
production smoke pass. [GAREN-R.md](GAREN-R.md) records supported behavior and
unverified native timing/cancellation policies.

Judgment's first runtime integration follows in [GAREN-E.md](GAREN-E.md): moving
area damage, per-target armor reduction, source spin playback, kit/control
interactions, tactical decisions and schema-74 continuation. All 904 simulation
checks and five focused browser scenarios pass. A source-backed Courage correction
also prevents stacks before W is learned. Full player presentation and native
calibration remain required before exposing Garen in champion selection.

The development-only [Garen player fixture](GAREN-PLAYER.md) now exercises real
Q/W/E keys, mouse-targeted R, resource-free HUD/tooltips, active-state displays,
source spell icons, passive recovery, and schema-75 save/restart flows. All 911
simulation/source checks and 21 focused player/HUD/import browser cases pass.
Production continues to reject the fixture flags and Garen roster selection;
complete presentation, native calibration and full role integration remain open.

[Judgment's source-particle adapter](GAREN-SPIN.md) now renders two source mesh
layers and two rotating trail quads, using frozen Riot assets and authored
appearance curves. Active particles and stopped tails survive schema-76
checkpoints; hidden enemy effects are suppressed and expired materials are
disposed. The two ground-glow emitters and native composition remain open.
All 918 source/simulation tests and 29 focused Garen/Ashe/Lux/input/import browser
scenarios pass. Production build/nested-host smoke and all model/map validators
pass. The validation entry point also now reads the shared conversion ledger for
the three existing Lux target meshes. The source spin capture was visually
reviewed. Garen remains excluded from production selection; complete effects,
audio, native calibration and full-match work remain in scope.

The two previously deferred Judgment ground glows now use pinned reader defaults
and the source lifetime color ramp, bringing the inline spin record to six
rendered emitters. Missing scale stays at one source unit; the other glow retains
its authored 150-unit half-extents. Shared RGBA-product rendering preserves base
UV scrolling independently of lookup coordinates. All 920 source/simulation
tests and 11 focused browser cases pass, including sixteen GPU texel probes,
Garen controls/tails, Lux Illumination and shared particle playback. Gameplay and
lookup captures were visually reviewed. Production/nested-host smoke and all
model/map validators pass. Full native composition, other Garen effects/audio and
the production roster gate remain open. See [GAREN-SPIN.md](GAREN-SPIN.md).

[Judgment source audio](GAREN-E-AUDIO.md) now integrates 13 float recordings for
cast, active, ending and recipient hits. All six source play/stop events retain
their policy, including gains, attenuation, global caps and independent 800/125 ms
fades. On-presence loading preserves the ordinary 17-recording startup. Schema 77
retains sound tails after particles end. All 928 source/simulation tests and 23
focused audio/Garen browser cases pass; Chrome preserves every source float
sample. Repeated extraction/mapping/decode/export yields identical pins. The
production build/nested-host smoke passes. An existing Hawkshot browser check
now advances descriptor expiry explicitly instead of comparing simulation and
audio clocks under CPU load. Native dispatch/listening/bus mix, other Garen
effects/audio and production/full-match certification remain open.

[Demacian Justice particle assets](GAREN-R-PARTICLES.md) now pin all 17 emitters
in the main cast/sword/impact systems to two frozen linked BINs. Four exact mesh
conversions and 21 lossless texture dependencies are available in a development
inspection page; live R particle dispatch remains open. Repeated extraction and
conversion yields 31 byte-identical outputs. All 931 source/simulation checks
and TypeScript pass. Chrome loads every inspection mesh and texture, exercises
selection/wireframe controls and reports no errors after fixing a missing
favicon request; the sword/texture capture was visually reviewed. All 30 GLBs
and the map validate without errors or warnings. Production build and nested
static-hosting smoke pass with the ordinary 17 recordings and the Garen roster
gate intact. The existing large-bundle warning remains. Runtime release history,
particle timing/attachment, materials and native comparison are the next R
presentation work; this increment changes no gameplay or snapshot schema.

[Demacian Justice's live adapter](GAREN-R-PARTICLES.md) now reconstructs 16
source layers: caster flash/glow, three sword layers and eleven impact layers.
Schema 78 records release/cancellation separately from cast poses and target
reveals, preserving killed-target impacts through later caster death, orders and
reload. A pre-release failure or match end cannot manufacture an impact. Four
source meshes and 19 used textures load on Garen presence; ordinary startup adds
no R-specific resource requests. Scene distortion remains the explicit deferred
seventeenth layer. Local dispatch, motion and attachment policies are documented
without claiming native timing or composition.

All 947 source/simulation tests and TypeScript pass. Twenty-four focused Chrome
scenarios cover the complete current Garen kit/player/save surface, Judgment
audio and shared particle tools. The R cases observe every implemented layer,
compare saved particles by stable identity, exercise fog/material disposal and
late NPC loading, and capture caster flash, sword descent and impact for visual
review. Three new GPU probes match all RGBA channels within one byte against
independent source PNG texels for sword multiplication and the rock atlas.
Playback export reproduces both generated files byte-for-byte. All 30 models
and the map validate cleanly. Production build/nested-host smoke passes with
17 ordinary recordings and the production Garen gate intact. R now occupies a
separate on-presence 35.14 KB chunk (5.88 KB gzip); the ordinary game entry is
569.16 KB instead of the first static integration's 602.12 KB. The existing
large-bundle warning remains. Full production/match and native acceptance stay
open.

[Demacian Justice source audio](GAREN-R-AUDIO.md) now integrates seven untouched
float recordings for cast, recipient hit and a lethal R result. The kill master
retains both stereo channels. Its `buffactivate` name resolves through the frozen
`Champ_Kill` particle's sound binding, distinct from the passive notification.
Schema 79 captures whether R damage was lethal and retains shared presentation
history for 303 ticks, so sound can finish after source particles disappear.
Later caster/recipient death cannot invent a kill cue; release sounds retain the
participating teams' audience after lethal loss of sight. Source-ready casts
bypass synthesis, and a late-loading fallback cannot double that cast.

All 956 source/simulation checks and TypeScript pass with four workers and a
30-second per-test deadline. Concurrent host load tripped the default five-second
wall limit in existing long full-Rift/determinism cases; bounded verification
retained every assertion and simulated duration without changing test defaults.
All 43 focused Chrome cases pass across Garen, new R audio, Judgment, Hawkshot
and Lux audio. Every decoded float in all seven R WAVs, including stereo/headroom,
matches the master. Runtime checks cover natural completion without replay,
pause/mute, saved offsets, death, visibility, presence-based loading, failure and
late-load suppression. Repeating the R source-link/map/decode/export yields
12 identical outputs; the shared helper refactor also preserves all original
Judgment pins/profile/masters byte-for-byte. All 30 models and the map validate
cleanly. Production/nested-host smoke passes with the ordinary 17 recordings and
Garen gate intact. R audio code/data occupies a separate on-presence 6.72 KB
chunk; its seven WAVs add 5,328,644 bytes only for Garen presence. Native
position/orientation panning, dispatch/listening/bus mix, optional kill-particle
layers, scene distortion and full production/match acceptance remain open.

[Demacian Justice kill particles](GAREN-R-PARTICLES.md#lethal-result-particle-adapter--october-21-2026)
now add the frozen Champ_Kill shockwave, three ray particles and flash, taking R
to 19 selected source layers. The existing schema-79 lethal-result flag gates
all six kill draws; nonfatal release, later unrelated death and cancellation
cannot invent them. Seven texture dependencies are pinned to the same frozen
Garen archive; two new PNGs add 64,691 bytes only on Garen presence. Existing
primary BIN/particle and audio pins remain unchanged. Both scene-distortion
layers remain deferred, and native dispatch/attachment/composition is unverified.

All 958 source/simulation checks and TypeScript pass with four workers and the
existing 30-second bounded verification override. Twenty-two focused Chrome
cases pass across Garen kit/player/particles/R audio and the shared ray primitive.
The final R checks also cover kill-ray fog disposal/recreation, saved lethal
tails after caster death, camera-facing geometry with stable buffers, loading
only on presence and all 23 inspection textures. All six independent R GPU
samples agree within one byte per RGBA channel. The gameplay impact capture was
visually reviewed. Re-extraction/export reproduces ten pins/profiles/texture
outputs byte-for-byte. Production build/nested-host smoke passes with 17 ordinary
recordings and Garen excluded from production selection. The on-presence R
particle chunk is 42.38 KB (6.46 KB gzip); the ordinary game entry is 570.71 KB.
The existing large-bundle warning remains. Native calibration, Q/W/basic/voice
presentation and full production/match acceptance remain open.

[Courage source audio](GAREN-W-AUDIO.md) now integrates all four frozen W
play/stop events and eight unchanged mono float masters. Two active recordings
retain their authored intro/loop regions and the declared 250 ms stop fade;
the cast child's extra −0.2 dB gain is applied separately. Schema 80 adds a
validated start/stop/reason history that survives shield loss, natural defense
expiry and caster death, retaining 189 ticks for finite sound tails. Source-ready
casts bypass synthesis; delayed loading preserves a single fallback cast while
allowing the sustained phase. Code/data and recordings load only on Garen presence.

All 966 source/simulation checks and TypeScript pass with four workers and a
30-second per-test verification deadline. Forty-four focused Chrome cases pass
across W audio/PCM integrity, existing Garen player/particles/E/R audio, browser
checkpoints, file transfer and interruption/graphics recovery. The save/transfer
reruns use a 60-second test deadline without changing committed defaults. A
transfer test's fixed `0:30` preview expectation was repaired to derive the exact
timestamp from the exported checkpoint, since startup can advance before pause.
Eight new W browser cases verify every decoded float, Web Audio loop bounds,
pause/mute, saved offsets/partial fade, natural completion without frozen-clock
replay, death/match end, fog/distance, loading/failure and late-load suppression.
The result menu retains the existing shared-context pause behavior; terminal
sound tails finish when that context resumes or release on mute/page teardown.

Repeating map/decode/export reproduces all twelve graph/provenance/profile/WAV
outputs byte-for-byte. The eight WAVs add 4,184,580 bytes only for Garen presence.
Production build/nested-host smoke passes with 17 ordinary recordings and Garen
still excluded from production selection. The W-only chunk is 8.10 KB (3.38 KB
gzip); the ordinary game entry is 573.17 KB. The existing large-bundle warning
remains. Source W particles, Q/basic/voice audio, native script/spatialization/
listening and full production/match acceptance remain open.

[Courage particle sources](GAREN-W-PARTICLES.md) now pin all seven base W
systems and twenty emitter records, including the two inline Avatar systems.
Three frozen BINs close every named dependency: eighteen TEX files and three
SCB paths. Two exact GLBs preserve the 1,264-triangle shield and the byte-identical
124-triangle attached-mesh reference aliases. The new decoder handles their
separate 3.2/2.2 layouts without losing face RGB, pivots, real bounds or tails.
Thirteen new lossless PNGs add 908,324 bytes; five existing images are reused
after exact pixel comparison. Both mesh outputs add 104,008 bytes.

All 970 source/simulation checks and TypeScript pass with four workers and a
30-second per-test deadline. Thirteen focused Chrome scenarios pass with a
60-second browser deadline, covering all source systems/textures/meshes and
inspection controls, no automatic W graphics requests, existing W audio/PCM/
defense behavior and shared R source/GPU inspection. The shield/texture capture
was visually reviewed. Re-extraction/conversion reproduces twenty-four output
pins/ledgers/PNGs/GLBs/sidecars byte-for-byte. All 32 models and the map validate
without errors or warnings. Production build/nested-host smoke passes with
17 ordinary recordings, unchanged entry bundles and Garen excluded from production.

This increment prepares complete W source assets; it does not render them live
or change gameplay/snapshot schema 80. Character material overrides, attached-skin
slice rendering, native script dispatch/bones/deflection/cleanup and matching
client comparison remain open. The shared arrow reference is not substituted
for a posed character surface. Four minimal buff declarations and unresolved
shape data remain unexpanded. Source particle lives of 2.25/6/7 seconds do not
by themselves establish the modern gameplay or rendering timeline. Full
production/match acceptance remains open.

[Courage's live cast and sustained adapter](GAREN-W-PARTICLES.md#live-cast-and-sustained-adapter--october-21-2026)
now selects seven of the twenty source emitter definitions: shield, cast ground
glow, rising energy, flash, sustained ground glow, symbol and waves. Deterministic
particles reconstruct from the existing schema-80 W history, including saved
active/death intervals, practice recasts, visibility and terminal presentation.
The cast uses the rig's center bone; sustained layers follow interpolated terrain
position. This attachment choice and the existing total-age linger cap are local
adapter policies pending native comparison. Gameplay and snapshot schema stay
unchanged. Thirteen other emitter definitions remain deferred, including shoulders,
deflection, character material/attached-skin work and four minimal declarations.

All 976 tests across 199 files and TypeScript pass with four workers and a
30-second test deadline. Thirty-six focused Chrome scenarios pass across player,
W mechanics/audio/source/live particles, Judgment, R visuals/audio and match-file
coverage, with a 60-second browser deadline. An overlapping browser invocation
caused a Judgment trace-cleanup error; the sequential rerun passes Judgment and
all four live Courage cases. Four independent W GPU texel probes agree within
one byte per channel. Cast and sustained captures were visually reviewed. Both
generated profile/audit outputs reproduce byte-for-byte; source binaries and
converted assets are unchanged.

Production build and nested-host smoke pass. The W graphics chunk is 14.90 KB
(3.97 KB gzip); the ordinary game entry is 573.99 KB (158.43 KB gzip), retaining
the existing large-bundle warning. W presence requests one shield GLB and ten
PNGs, with five PNGs shared with E/R; ordinary startup still has no W graphics
requests and retains 17 audio recordings. Late Garen loading, partial-failure
disposal/retry and borrowed-resource ownership are covered. Garen remains excluded
from production selection. Native dispatch/attachment/material composition,
remaining W layers, Q/basic/voice presentation and full production/match
acceptance remain open.

[Courage shoulder layers](GAREN-W-PARTICLES.md#live-cast-and-sustained-adapter--october-21-2026)
now bring W to eleven selected source emitter definitions, with nine explicitly
deferred. Left/right streak bursts retain ten independently sized particles and
different scale curves; the left hoop and right glint retain their separate
one/four birth budgets. Both systems start on the accepted W cast and follow the
posed `L_Shoulder`/`R_Shoulder` joints. Case-insensitive joint selection, full
joint-frame orientation for the declared local particles and root fallback are
documented local policies pending native comparison. Decomposed joint quaternions
are normalized before composing source rotations. The existing schema-80 history
preserves natural one-second shoulder tails through early death and reload;
gameplay and snapshot schema are unchanged.

All 978 tests across 199 files and TypeScript pass with four workers and a
30-second test deadline. Eight focused W Chrome scenarios pass with a 60-second
browser deadline, covering all eleven layers, independently checked joint
positions/rotations, camera independence, replacement-rig/fallback behavior,
save/death/fog/terminal cleanup, late loading and the selected resource boundary.
Seven independent W GPU texel probes agree within one byte per RGBA channel.
The shoulder capture was visually reviewed. Both generated profile/audit files
reproduce byte-for-byte. Four already prepared PNGs add 55,550 bytes to W's selected
set: fourteen PNGs total 406,436 bytes, plus the existing shield mesh. No source
binaries or converted assets change. A separate sequential run passes 29 existing
player/W mechanics/audio/PCM/Judgment/R/match-file cases: 37 focused Chrome
scenarios in total. Production build and nested-host smoke pass, retaining
17 ordinary recordings and rejecting Garen production fixture flags. The W
graphics chunk is 20.31 KB (4.35 KB gzip); the ordinary game entry remains
573.99 KB (158.43 KB gzip), with the existing large-bundle warning. Ordinary
startup adds no W graphics requests. Deflection, body material/attached-skin
operations, four minimal declarations, native calibration and full
production/match acceptance remain open.

[Courage's damage-reaction adapter](GAREN-W-PARTICLES.md#damage-reaction-adapter--october-21-2026)
now brings W to twelve selected source emitter definitions. The rotating shield
retains its source float32 life, expansion, alpha, lookup and world-axis spin.
It reuses the existing shield mesh/textures; no graphics assets or requests are
added. Native dispatch remains unknown: the documented local policy accepts
positive physical/magic hits actually reduced by W, including fully shielded
and lethal hits, and coalesces qualifying hits per recipient/simulation tick.
True/zero/negative damage, hits after defense expiry and post-match calls create
no reaction. Gameplay damage and shield calculations are unchanged.

Schema 81 adds independent `{ tick, castTick }` reaction history, retained for
51 ticks using a generated source-life/first-birth/interpolation bound. Dense
same-tick hits remain bounded; practice recasts preserve earlier clocks. The
decoder rejects missing, foreign, unordered, duplicate, future, inconsistent and
expired histories. Pure sampled particles preserve accepted identity through
buff expiry, death and reload without consuming simulation RNG. Enemy draws
obey caster sight, owned materials retire without disposing shared assets, late
Garen loading reconstructs accepted reactions, and match-end presentation time
finishes particles while simulation history stays frozen.

All 986 tests across 200 files and TypeScript pass with four workers and a
30-second per-test deadline. Eleven focused W Chrome scenarios pass across
sequential runs with a 60-second browser deadline. The real attack case checks
fully shielded contact, rotating geometry, recast survival, exact saved dead-caster
poses and disposal. The first fixture used an unsupported `attackDamage` field;
using the actual `damage` stat fixes checkpoint rejection. An exporter reproduction
rewrote the watched timing file and restarted Vite during a separate loading
check; that case passes sequentially. The exporter now preserves unchanged file
modification times, verified along with byte-identical profiles/timing/audit.
Eight independent W GPU probes pass within one byte per channel, and the damage
reaction capture was visually reviewed. Eight declarations remain deferred:
body material/attached-skin operations and four minimal buff records. Native
trigger/composition and full production/match acceptance remain open.

A separate sequential run passes all 29 existing Garen player/W mechanics/audio/
PCM/Judgment/R/match-file browser cases, bringing focused Chrome coverage to
40 scenarios. Production build and nested-host smoke pass with 17 ordinary
recordings, real Ashe/Lux input and Garen fixture flags rejected in production.
The W graphics chunk is 21.86 KB (4.54 KB gzip); the game entry is 574.78 KB
(158.63 KB gzip). The existing large-bundle warning remains. Source binaries and
converted assets are unchanged, and the production roster gate stays in place.

[Decisive Strike source audio](GAREN-Q-AUDIO.md) now closes all five declared
Q/QAttack events with six actions, thirty-two hierarchy nodes and thirteen
unaltered float masters. QAttack's two independent play actions retain the second
layer's authored 230 ms delay. The active masters are nonlooping, with a separate
250 ms linear stop action; their 7.71068/7.85-second source lengths do not change
Q's gameplay windows. Container and sound-level gains, shuffle policy, global
caps, priorities, attenuation and the unresolved output bus remain explicit.

The thirteen WAVs total 7,630,148 bytes and retain all 8,092 samples outside ±1.
The development audition page supports explicit variants, individual actions,
dual-action scheduling, monitor gain and the active stop fade. Chrome compares
every decoded sample and observes actual Web Audio start/gain/stop calls. Explicit
accessible variant labels fix the first inspection test's ambiguous select name.
The page capture was visually reviewed. All 988 tests across 201 files and
TypeScript pass with four workers and a 30-second per-test deadline; all three
new source-audio browser cases pass with a 60-second browser deadline.

Re-extraction, mapping, decoding and export reproduce all sixteen Q graph/decode/
profile/WAV outputs byte-for-byte. Re-mapping and decoding W/E/R preserve all six
existing spell pins plus the shared extraction and inventory pins. Ten existing
Q/player/match-file browser cases pass, for thirteen focused Chrome scenarios in
total. The source pack remains separate from gameplay activation and schema 81.
Production build and nested-host smoke pass with 17 ordinary recordings, real
Ashe/Lux input and the production Garen gate retained. The ordinary game entry
remains 574.78 KB (158.63 KB gzip), and no Q audio/controller chunk is added to
startup. The existing large-bundle warning remains.

This increment prepares source audio and audition tooling. It adds no Q playback
to current gameplay, requests no Q WAVs during ordinary or Garen startup, and
does not change schema 81 or Q mechanics. Accepted Q cast/buff/attack histories,
live audio dispatch/fallback/save continuation, source Q particles, W body
material/attached-skin operations and native/full production acceptance remain open.
The W body definitions require material-transition and posed-mesh slice
operations; their shader/dispatch contracts remain unresolved. No `llvm-dis`
executable was found on PATH or in the checked repository/Homebrew/bundled tool
locations; that bounded search does not establish its absence elsewhere.

[Decisive Strike live source audio](GAREN-Q-AUDIO.md#live-audio-adapter--october-21-2026)
now uses the thirteen prepared masters for activation, one-shot active, ending
and both committed-swing actions. The bank's delayed action is scheduled exactly
230 ms after the immediate action from one AudioContext time sample; later seeks
retain the proper offset. Source-ready activation and Q attack release bypass
their generic tones. Late-loading fallback marks both attack keys and the cast
key, so readiness cannot double already synthesized cues. Failed assets do not
produce repeated frame-driven fetches.

Schema 82 adds ordered `garenQVisuals` intervals with captured rank, stop/reason
and accepted swing start/planned-release pairs. Local dispatch follows the armed
Q interval, independently of movement speed: consumption/expiry add ending audio,
while death/match-end/recast only stop the active. Committed attack one-shots
survive target loss and death without inventing a hit. Practice recasts retain
earlier clocks. Generated 200-tick post-stop retention covers all source tails.
The decoder checks ownership, live Q correspondence, chronology, bounded history,
exact expiry/recast/consumption/terminal relationships and accepted local windups.
Earlier saves are incompatible under the existing same-build policy. Damage,
speed, attack timing and cooldown mechanics are unchanged.

All 999 tests across 203 files and TypeScript pass with four workers and a
30-second test deadline. Ten focused Q Chrome scenarios pass across the source
inspector/PCM/startup checks and seven live audio cases, with a 60-second browser
deadline. Live checks cover exact dual-action scheduling, source gain/envelope
separation, mute/partial-fade reload, target loss/death, late loading/fallback,
fog, and natural completion without replay at a frozen terminal tick. The first
browser fade checks read AudioParam values before the audio thread applied their
scheduled value; recording actual automation calls resolves that timing-sensitive
observation without changing fade behavior. Seventeen source graph/decode/profile/
timing/WAV outputs reproduce byte-for-byte with unchanged modification times;
the original graph/media pins and all thirteen WAV bytes are unchanged.

All 31 surrounding Garen player/Q/W mechanics/audio/PCM/Judgment/R/match-file
browser cases pass, for 41 unique focused Chrome scenarios across sequential
runs. Final decoder review additionally requires an ongoing captured Q cycle to
retain its matching rank/start/release pair. The full 999-test suite and seventeen
Q/player/match-file browser scenarios pass again with that consistency check.
Production build and nested-host smoke pass with 17 ordinary recordings and
real Ashe/Lux input; Garen fixture flags remain rejected in production. The Q-only
chunk is 10.78 KB (4.19 KB gzip). The ordinary game entry is 579.60 KB (159.49 KB
gzip), including the new history/schema checks and lazy wrapper. The existing
large-bundle warning remains. No WAV/source graph bytes or gameplay mechanics
change, and Garen's production roster gate stays in place.

Q code/profiles/recordings load only on Garen presence. Ordinary startup retains
its seventeen recordings. Source shuffle, native script dispatch, pending-action
cancellation, listener/bus mix and listening comparison remain unverified. Source
Q particles, W character-surface operations, basic/voice audio and full production/
match acceptance remain open; Garen remains outside production selection.


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

Seven [target-impact emitters](GAREN-Q-PARTICLES.md#confirmed-contact-impact-layers--october-21-2026)
now join the Q trail and activation/armed layers, bringing the live selection to
sixteen of 31 records. Both source mesh layers, flash, slash, forward-impact ray and
two spark emitters start only from saved confirmed contacts. Planned release or
target loss cannot manufacture a hit. The local one-shot retains the contact
point, terrain height and heading independently of later pose stops, movement,
death, recasts and frozen match-end clocks. Source bind-weight declarations and
absences remain explicit; native recipient-bone attachment/following is still
unverified. Fifteen emitters, including the target distortion, remain open.

The generated profiles preserve the complete selected source fields, shared
birth distributions, legacy offset/velocity turn, source lifetimes and appearance,
atlas sheets, passes and blend factors. Spark speed stretches source Y size with
the pinned default minimum of one. The ray keeps authored +Z orientation despite
negative-Z travel and is excluded from direction stretch. The sparks' missing
frame count remains the reader default of one even on a 2×2 grid. Five additional
hash-pinned reconstruction files link to the prior eight-file reader evidence;
none is represented as native-client verification. The conservative 75-tick
contact tail fits within existing history. Schema 83, combat, silence and audio
behavior and every binary asset are unchanged.

All 1,023 tests across 208 files and TypeScript pass. Five new checks cover source
profiles/accounting, confirmed-contact gating, first-update budgets, shared spawn
motion/stretch, missing atlas fields, deterministic finite seeks and exact
continuation after lethal contact/caster death. The atomic loader now covers
three meshes and fifteen texture paths, including cleanup of three completed
geometries and fourteen images when one image fails, and a shared cached retry.

All 35 focused Chrome cases pass across Q particles/audio/gameplay, player controls,
W/E/R and saves. Three new impact cases cover all seven emitters, real save/reload,
later movement/death, actual fog with a hidden caster, target loss and frozen
match-end retirement. Independent coordinate/ray-axis assertions were added and
all three cases rerun. Each particle owns its material; the two ray particles own
their dynamic geometry. Fog and expiry dispose both without disposing shared
source geometry/textures. Seven new PNG samples bring Q GPU verification to
thirty product/blend comparisons, all four channels within one byte. The close-up
1440×900 hit capture was visually reviewed. The startup request expectation now
includes the selected spark texture, without changing ordinary startup behavior.

All 36 GLBs and the map validate with zero errors/warnings. Repeated extraction,
conversion and export reproduce all 45 source/audit/profile/PNG/GLB/sidecar outputs
byte-for-byte; all 37 static production Q files match the verified public bytes.
Production build and strict `/nested/rift/` smoke pass with seventeen ordinary
recordings, real Ashe/Lux input, and the Garen fixture/selection gate retained.
The Q particle chunk is 37.15 KB (6.98 KB gzip), loaded on Garen presence; the
ordinary game entry is 582.93 KB (160.28 KB gzip). The existing large-bundle
warning remains. Complete Q presentation, native calibration, W body operations
and production/full-match acceptance remain in scope.

## Decisive Strike jump and landing particles — October 21, 2026

Five [jump/landing emitters](GAREN-Q-PARTICLES.md#jump-and-landing-ground-events--october-21-2026)
now bring Q's live selection to twenty-one of 31 source records: the source jump
mesh, forty outward dirt particles, five waves, twenty smoke particles and three
delayed decals. Jump's missing start frame stays absent in the profile; local
commitment dispatch uses the saved attack origin/heading. Source frame-9 Land
dispatch captures its own event-time caster point/heading. Subsequent movement,
target loss, death or reload cannot relocate that anchor or manufacture a new
landing. The frame-to-release map and ground attachment remain local policy,
pending native calibration. Ten emitter records remain deferred.

Schema 84 adds the nullable landing anchor to each captured Q attack. Validation
requires the event after an uninterrupted frame boundary and rejects missing,
future, wrong-frame and malformed data. Same-tick stops may occur before dispatch
or afterward through an external action, so both states remain valid there. A
committed pre-expiry swing retains enough history: the new conservative 99-tick
ground tail plus the largest supported windup fits within the existing 200-tick
record retention. The existing version/ruleset policy retains incompatible older
checkpoints without loading them. Combat values, damage, silence and sound rules
are unchanged.

Source legacy shape turns compose in the retained order before rotating both
offset and velocity. Dirt uses stepped drag and interpolation, independently
verified against Euler steps; draw-time world acceleration adds `a * age * life`
instead of a ballistic half-acceleration term. Direction-oriented dirt aligns
its local Y to travel. Positive emission delays use the first eligible update:
waves at event +1, decal at +6. Accepted ground bursts finish naturally under an
explicit local policy; the source create/kill-event flag alone is not claimed to
prove parent-stop behavior.

UV mode 2 now samples RGB through its scroll/atlas coordinates and alpha through
raw untranslated UV for these selected records. The existing armed sword mesh
also declares mode 2 and now uses that correction. Two additional external shader
files are hash-pinned to the prior thirteen reader files. Separate PNG texels
with alpha 128 make the GPU tests sensitive to both coordinate selection and
nontrivial alpha blending. Twenty independent samples produce forty product/
framebuffer comparisons, all four channels within one byte. These establish the
adapter's arithmetic rather than native composition.

All 1,030 tests across 209 files and TypeScript pass. Seven new checks cover the
source bindings/absences, motion, birth counts/delays, composed shape turns,
deterministic finite seeks, capture/continuation, before/after-event target loss,
same-tick death and malformed snapshots. All 38 focused Chrome cases pass across
Q visuals/audio/gameplay, player controls, W/E/R and saves. Three new cases verify
the two jump and all 68 landing particles, real checkpoints, independent placement
and dirt direction, movement/death, actual point fog with a hidden caster,
delayed birth, material retirement and finite frozen-match tails. Source/graphics
cases were rerun after strengthening the alpha samples. Jump and landing captures
were reviewed at 1440×900. The close-up landing composite still has visible quad
boundaries; native sampling/material/pass/attachment calibration remains open.

Loading now uses all four Q GLBs and nineteen texture paths. Partial failure
disposes four completed geometries and eighteen images and shares a cached retry.
Ordinary startup requests none of the new Q graphics. Ground particles dispose
their materials while retaining shared geometry/textures. No binary assets
changed. All 36 GLBs and the map validate without errors/warnings. Repeated
extraction/conversion/export reproduces all 47 source/audit/profile/PNG/GLB/sidecar
outputs byte-for-byte, including the final separate-alpha GPU samples. All 37
production Q asset files match public bytes. Production build and strict nested-
path smoke pass with seventeen recordings, real Ashe/Lux input and the Garen
fixture/selection gate retained. The Q particle chunk is 51.25 KB
(8.79 KB gzip), loaded on Garen presence; the ordinary game entry is 583.44 KB
(160.41 KB gzip). The existing large-bundle warning remains. Full Q/Garen/native
comparison and production/full-match acceptance remain in scope.

## Decisive Strike recipient silence — October 21, 2026

The [recipient silence emitter](GAREN-Q-PARTICLES.md#recipient-silence-and-accepted-control-history--october-21-2026)
now brings Q to twenty-two locally rendered records. Schema 85 records
`silenceEndTick` on each Q attack only after control is accepted. The captured
90/36-tick deadline uses the actual Courage tenacity at contact, independently
of a longer generic silence. Planned/cancelled swings, lethal hits and structures
retain null. The decoder requires contact/acceptance consistency, supported
durations and an adequate current living-recipient deadline. It allows legitimate
same-tick death orderings and expired history after possible respawn. Combat,
damage, recall and silence rules are unchanged; this is captured presentation
state. Older checkpoints follow the existing incompatibility/retention policy.

One icon per recipient selects the oldest still-active Q contact, with source-ID
tie-breaking. Overlap handoff uses each original age/deadline. Generic silence
cannot create or prolong Q's icon. Caster death/recast preserves accepted control;
recipient death, actual recipient fog and match end remove it without respawn
replay. The source ten-second particle life and 0.1/0.2/0.3-second scale pop are
retained, rather than compressing its curves into the CC duration. The missing
atlas frame count remains the reader's one-frame default on the 2×2 grid. Source
alpha blend, pass one, disabled depth test and white lookup are retained. A
first-cell PNG sample brings Q GPU verification to forty-two product/framebuffer
comparisons with all channels within one byte.

The source Flex bound-size coefficient is preserved exactly and explicitly not
applied: the available schema establishes the field, not its computation or the
native bound metric. The adapter uses a provisional local health-bar-plus-source-
offset anchor; a shared helper preserves the existing HUD height policy. Native
recipient bone/Flex sizing, label clearance and script overlap/stop semantics
remain open. The reviewed 1440×900 capture places the source icon near the unit
name; this is not native visual acceptance. The prior landing quad boundaries,
all other material/attachment calibration and nine unimplemented emitter records
also remain open.

All 1,038 tests across 210 files and TypeScript pass. Eight new cases cover source
fields/absences and unresolved Flex state, source appearance/stops, deterministic
coalescing, accepted/rejected control, tenacity versus generic deadlines, caster/
victim death, practice recasts, malformed saves and a real checkpoint with two
Garen sources whose committed contact lands after the player's armed expiry.
All 41 focused Chrome cases pass across Q presentation/audio/mechanics, player
controls, W/E/R and saves. Three new cases independently verify local placement,
atlas/depth, camera/recipient following, exact save/reload, generic deadline
separation, caster/victim death, respawn, actual fog, overlap handoff and frozen
match end. Materials dispose while shared geometry/textures remain retained.

The loader now covers four meshes and twenty-one texture paths, disposing four
completed geometries and twenty images on an injected image failure and sharing
a cached retry. Sixteen prepared new Q PNGs/four Q GLBs are requested on Garen
presence; five image paths overlap W/E/R. Ordinary startup requests no new Q
graphics. All 36 GLBs and the map validate with zero errors/warnings. Repeated
extraction/conversion/export reproduces all 48 source/audit/profile/PNG/GLB/sidecar
outputs byte-for-byte. Every existing binary remains unchanged, and all 37 static
production Q files match public bytes. Production build and strict `/nested/rift/`
smoke pass with seventeen recordings, real Ashe/Lux input and the Garen gate
retained. The Q particle chunk is 54.14 KB (9.70 KB gzip), loaded on Garen presence;
the ordinary game entry is 584.01 KB (160.57 KB gzip). The existing large-bundle
warning remains. Full Q/Garen, native rendering and production/full-match
acceptance remain in scope.

## Q silence label clearance — October 21, 2026

The prior `503c1da` capture showed the recipient silence icon overlapping its own
name. The [local placement correction](GAREN-Q-PARTICLES.md#recipient-label-clearance--october-21-2026)
now measures the complete recipient DOM info bar after its current-frame update
and projects the source billboard's four corners into CSS pixels. A vertical
lift places its bottom at least four CSS pixels above that bar when they overlap
horizontally. This protects wrapped names and minion health bars while preserving
projected X/depth, world scale, geometry, material and source appearance clocks.
Every frame starts from the original provisional source-offset anchor, preventing
accumulation. No simulation, snapshot, combat, audio or source profile changed.
Schema 85 and twenty-two of 31 locally rendered emitter records remain current.

Four new geometry cases exercise perspective/orthographic cameras, multiple
zooms, offset canvases, exact clearance, idempotence, zero-size birth and invalid/
clipped inputs. Two Chrome cases independently compare transformed mesh corners
against real DOM rectangles: three recipient kinds × three viewports × three
zooms × two display densities give 54 peak-pop combinations, plus six settled-size
checks. The source scale/UV/material/geometry and simulation snapshot stay fixed
across layout changes. Existing exact checkpoint, control expiry, fog, overlap,
death/respawn and frozen-match checks pass with the new placement. All 1,042 tests
across 211 files and TypeScript pass; all 43 focused Chrome cases pass across Q
graphics/audio/mechanics, Garen player/W/E/R and saved matches.

Both 1440×900 captures were visually reviewed. The updated icon leaves the target
name and health bar clear. Local evidence is
`artifacts/browser-garen-q-silence-before-label-clearance.png` (prior placement)
and `artifacts/browser-garen-q-silence.png` (current placement). This establishes
readability in the local view, not native fidelity. Source Flex bound-size math
remains unapplied and native sizing/attachment/script behavior remains open.
Other-unit packing, screen-edge placement, prior landing quad boundaries and
broader native material/composition calibration are also unfinished.

All 48 existing source/profile/audit/asset SHA-256 values match the pre-change
record, and all 37 static production Q assets match public bytes. Source tooling
and binary assets were unchanged; the prior 36-GLB/map validation still applies
to those identical bytes. Production build and strict `/nested/rift/` smoke pass
with seventeen ordinary recordings, real Ashe/Lux input and the Garen fixture/
selection gate intact. The on-presence Q graphics chunk is 55.14 KB (10.09 KB
gzip); the ordinary game entry is 584.29 KB (160.66 KB gzip). The existing large-
bundle warning remains. Complete Garen/native and production/full-match acceptance
remain in scope.

## Opaque battlefield composition — October 21, 2026

Layer isolation identified the hard bright rectangle in the Q landing composite
as Land's darkening ground decal. The three authored draws correctly reduce RGB
and destination alpha. The game requested `alpha: false` from Three.js, but the
installed r186 renderer creates an alpha-enabled context and uses that option
for clearing. With framebuffer alpha zero, Chrome adds the page matte to the
remaining premultiplied RGB. At an outer texel, GPU `[84,121,104,0]` became page
pixel `[100,163,142]`, exactly adding the `#102a26` matte. This explains the local
rectangle without changing source texture pixels, curves, UVs or blend factors.

`GameView` now creates an opaque WebGL 2 context explicitly and supplies it to
Three. No extra rendering pass is added. Offscreen RGBA material/depth targets
keep their existing behavior, and a missing WebGL 2 context uses the existing
startup failure screen. Gameplay, snapshot schema 85 and Q's twenty-two rendered
records are unchanged. Native material/sampling/attachment and full-match fidelity
remain open. See [decal composition](GAREN-Q-PARTICLES.md#opaque-battlefield-and-ground-decal-composition--october-21-2026).

The new red/blue page-matte screenshot cases failed on the prior code at both
1× and 2× display density. They pass after the fix, alongside the startup-failure
case. All fifteen focused compositor, graphics recovery/failure and smoke/depth
cases pass. Recovery retains identical framebuffer bytes through repeated loss;
its assertion now also requires an opaque restored context. All 1,042 tests
across 211 files and TypeScript pass. All 48 existing Q source/profile/audit/asset
SHA-256 values remain unchanged.

The complete Chrome run executed all 453 scenarios with one worker and no retries
in 31.6 minutes: **451 passed and two failed**. All 794 sampled source/test/config
hashes remained unchanged during that audit. One failure was an outdated Lux
post-wisp assertion: its last beam mesh retires at 1.3 seconds, but the shared
record correctly retains 1.5-second scorch layers. The test now verifies both
endpoints, including final retirement of the record and both scorch draws.
The other failure found a real scoreboard accessibility regression: a renamed
player's portrait announced the nickname instead of the champion. The portrait
now uses the existing champion profile's canonical name. The ten-player check
now covers renamed Ashe, Lux and Garen, both image alt text and parent accessible
identity, visible nicknames and cached/rebuilt rows.

All six affected wisp/scoreboard cases passed three repetitions (18 checks).
The full 453-case suite was not rerun after these bounded repairs; the report
distinguishes the initial complete run from focused repair verification.
Fresh Q landing/silence captures were reviewed and no longer show the bright
rectangular page-matte patch. W and R captures were also reviewed. These are
local qualitative reviews, not registered native comparisons. Evidence is in
[the compositor verification record](reference/opaque-battlefield-verification.json)
and [the browser audit](BROWSER-REGRESSION.md).

Final TypeScript and all 1,042 checks pass after the repairs. Production build
and strict `/nested/rift/` smoke pass, including an actual opaque-context assertion,
seventeen ordinary recordings, real Ashe/Lux casts and the Garen production gate.
All 37 built Q assets match public bytes. The Q graphics chunk stays 55.14 KB
(10.09 KB gzip); the ordinary game entry is 584.49 KB (160.73 KB gzip). The existing
large-bundle warning remains. Binary assets and source tooling were unchanged;
the prior model/map validation applies to those identical bytes. Full native,
cross-browser, role-match, offline and performance acceptance remain unfinished.

## Jungle map source catalog and inspection — October 21, 2026

The [jungle foundation](JUNGLE-SOURCES.md) now pins the original Map11 definition
and material BINs directly from the frozen Riot archive: two files totaling
6,707,457 bytes, with nine compressed source chunks in the extraction ledger.
The public JSON mirror returned 403, so reproduction does not rely on it.
The material BIN matches the prior terrain pin. Exact repeated extraction and
export reproduce both the source pin and inspection catalog byte-for-byte.
The repeat path uses the pin and original naming seeds without discovery
dictionaries, retaining unknown hashes rather than promoting new literal names.

The catalog preserves eighteen camp anchors, 53 neutral character objects,
twenty camp identifiers and sixteen separate recommendation positions. Actual
anchor transforms, recommendation positions and minimap offsets remain distinct.
Index/Location differences, absent route fields, faelight pads, off-map dragon
templates and identifiers without separate anchors remain inspectable. Neither
template count nor a recommendation is treated as an executable spawn roster.
No supported first-spawn calendar is derived from these components; activation,
membership, neutral faction, combat, rewards, reset/respawn and jungle-role AI
still require implementation and further evidence. No simulation or schema
change is introduced by this source-preparation increment.

The development map page now offers an on-demand Jungle sources view. Gold rings
show raw camp anchors, cyan dots show neutral character objects and pink rings
show recommendations. Selection centers the actual source anchor and displays
raw components/identifier definitions. Layer/panel toggles reuse resources.
Chrome's failed-import cache made same-document retry ineffective; the tested
failure path now offers an explicit map reload. Production excludes this button,
module and catalog. Existing game/map bundle names and sizes remain unchanged.

All 1,046 checks across 212 files and TypeScript pass. Four new contracts cover
source provenance/mode links, exact anchor transforms versus recommendations,
neutral-object/identifier distinctions and preserved absent fields. All five
focused Chrome cases pass: the two new inspection/failed-load cases plus normal
DXT/WebP map loading and graphics restoration. Actual marker coordinates are
compared independently with raw source transforms, and material/geometry identity
survives toggles. The 1440×900 and 960×720 captures were reviewed at
`artifacts/jungle-map-blue-source.png` and `artifacts/jungle-map-source-small.png`.
These verify local annotations, not native camp presentation or live behavior.

Production build and strict `/nested/rift/` smoke pass, including absence of the
inspection button, seventeen recordings, real Ashe/Lux input and the existing
development/Garen gates. A production-JavaScript scan finds no inspection
module/data/button strings. The game chunk remains 584.49 KB (160.73 KB gzip)
and the map entry remains 3.77 KB (1.95 KB gzip); the existing large-bundle warning
remains. Binary assets were unchanged. The earlier full-browser audit was not
repeated for this bounded development-only increment. Legacy progression text
was also corrected to point to the already implemented champion-kill XP path.
Full role-match, native, offline and performance acceptance remain open.

## Jungle character definitions and base rigs — October 21, 2026

The [character-source increment](JUNGLE-CHARACTERS.md) retains eleven ordinary
monster BINs with all 35 CharacterRecord variants, spell records, and the complete
Blue/Gromp base skin and animation graphs. Original-archive extraction pins 64
files totaling 2,898,228 bytes against the same 16.18 manifest as the map. The
extractor reproduces exact records without the discovery dictionaries and
prevents newly resolved literal names from silently renaming hash keys/values.

The separate development review page exposes every Root/alternate record,
preserves absent fields, and loads two rigs on demand. Blue has 16 atomic clips,
8,354 triangles and 64 bones; Gromp has 25 clips, 6,640 triangles and 82 bones.
Their GLBs total 4,511,400 bytes. Source skinScale, diffuse assignments and
Gromp's comma-separated hidden submeshes are retained in the preview. Constant
idle/look poses remain static rather than receiving invented motion. Clip
choices include original filenames alongside unresolved state hashes.

The map objects reference Blue skin 4 and Gromp skin 0; the isolated base review
explicitly shows skin 0. No base Blue was substituted into map objects. Alternate
record health values and raw reward scalars do not select gameplay mode or final
rewards. Camp membership/calendar, neutral faction, scaling, leash/reset,
buffs/Smite, presentation/audio and role AI remain required work.

Validation:

- TypeScript and all 1,050 checks across 213 files pass. The new QA module also
  passes a separate strict TypeScript invocation because tools/qa is outside the
  ordinary application tsconfig.
- Both new Chrome cases pass: all 41 clip poses are finite; every nonconstant
  sampled clip moves; authored hidden submeshes, raw records, missing values,
  alternate selection, real playback/scrubbing, rewind after terminal pose,
  cached reuse, failed-request retry, late-load isolation and 800px layout pass.
- The existing two jungle map-inspection cases also passed during the initial
  combined run. The new pose test initially assumed more moving clips than the
  source contains; the corrected check names the constant source poses. A second
  test correction opens the collapsed raw-record details before reading them.
  Final filename labels also exposed a resize transition with an oversized inline
  canvas; CSS now caps its width and the check waits for the completed layout.
  The combined run was not repeated after these test corrections; the focused
  new cases were rerun successfully.
- Both rig captures were visually reviewed:
  `artifacts/jungle-sru_blue-base.png` and `artifacts/jungle-sru_gromp-base.png`.
  Preview materials/native appearance remain distinct.
- Repeated source extraction and both GLB/manifest conversions are byte-identical
  across the source pin and four exported files. All 38 GLBs and the map validate
  without errors or warnings.
- Production build and nested-host smoke pass with 17 ordinary recordings, real
  Ashe/Lux input, existing roster/development gates and zero jungle-review data
  or rig requests. Production JavaScript is byte-identical to the preceding
  build; the existing large-bundle warning remains.

`reference/jungle-character-verification.json` retains this scope and hashes.
No simulation, snapshot schema or playable roster changed. Full-match completion
and native visual certification remain unproven; the goal remains active.

## Neutral faction and controlled Gromp combat — October 21, 2026

The [neutral Gromp foundation](NEUTRAL-GROMP.md) now distinguishes neutral
monsters from blue/red units throughout targeting, events, vision, movement,
presentation and saved state. Monsters do not grant team vision or pooled
neutral vision. Lane minions, turrets and lane bots avoid automatic pulls;
human attacks and explicitly ordered champion attacks can engage them.

`?scene=fixture&encounter=gromp` creates a separate development encounter with
one Gromp and no lane waves. Its health/defenses/movement, gameplay/pathfinding
radii, attack speed, ranged-missile speed, cast frame and reward scalars come
from the pinned Root/spell records. Frame conversion, latest-aggressor
selection, 700-unit leash, reset recovery/immunity and last-hit reward policy
remain local decisions. No standard-mode camp activation, scaling, respawn,
role items, buffs or Smite is inferred. Those remain full-match requirements.

The existing base rig loads only when a match contains Gromp. Four aliases retain
original source clip identity/duration; shared animation and target-pose paths
support the monster. The neutral health bar and visible minimap dot remain
local HUD policies. GPU pixel comparison verifies that the live rig actually
renders. The clear combat capture was visually reviewed. In the sampled death
pose the main body is not visible; source death pop/spores, miniature/submesh
dispatch, particles/audio and native composition remain incomplete/unverified.
Generic combat projectile/audio presentation is not native Gromp certification.

Schema 86 retains neutral home, phase, private target, independent attack and
animation state, and durable encounter identity. A cleared save stays cleared
after its corpse leaves the simulation, and restart recreates the encounter.
Crossed faction, invalid species/aggressors, champion/AI/structure metadata,
respawn state, contradictory orders and out-of-map homes are rejected. Runtime
profile JSON also participates in the ruleset identity and server reload watch.

Validation:

- TypeScript and all 1,067 checks across 214 files pass. Sixteen new neutral
  source/simulation cases cover provenance, both teams, sight, lane exclusion,
  rewards, Lux Binding, reset, exact continuation and malformed snapshots.
- A further Rift diagnostic moves/resets Gromp at both original character-object
  positions, checks every movement segment with its separate 40-unit navigation
  radius, and round-trips each live engagement. This is explicit source-position
  testing, not a live camp roster or calendar.
- Two new Chrome cases pass real mouse attacks, GPU visibility, retaliation,
  hidden submeshes, neutral UI, exact save/reload, death dispatch, cleared
  continuation without a rig request and restart. Ten existing Lux-input,
  full-Rift/practice save and fogged-structure scenarios pass. The complete
  browser suite was not rerun.
- Initial full checks found two historical hard-coded schema-85 assertions;
  both now verify 86 and their detailed malformed-history tests still pass.
  Final review added and verified an explicit command guard so direct queued
  commands cannot bypass the monster controller.
- The small runtime profile reproduces byte-identically from its source/model
  pins. No binary assets changed; the preceding 38-GLB/map validation applies to
  those unchanged bytes.
- Production build/nested-host smoke passes with 17 ordinary recordings, real
  Ashe/Lux input, existing development/Garen gates and zero Gromp/inspection
  resource requests even when the diagnostic query is supplied. The existing
  large-bundle warning remains.

`reference/neutral-gromp-verification.json` retains scope, commands and hashes.
Native camp mechanics/presentation, the remaining monster set, role AI, complete
matches and release certification remain open. The goal remains active.

## Historical baseline verification

The table below records the earlier baseline. Subsequent milestones below contain later test counts and validation scope.

| Evidence                  | Result                                          | Scope                                                                                                                                                                                                                                                                                                                     |
| ------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`           | TypeScript check and 55 simulation tests pass   | Attack cancellation/release, collision, navigation, last-hit attribution, atomic purchase rejection, deterministic identical inputs, occlusion/brush, shared sight, attack reveal timing, event visibility, source-grid clearance/gates, full-map routes, wave cadence, and fountain recall                               |
| `npm run test:browser`    | 26 Chrome scenarios                             | Existing practice interactions, minion lifecycle, full terrain loading, original compressed mips, BC1 alpha, both gzip-hosting conventions, navigation overlay, WebP fallback, full-map pointer/elevation alignment, movement/attack, exact fog-mask/query agreement, tower transforms/rig sharing, and persistent rubble |
| `npm run assets:validate` | 0 errors, 0 warnings                            | Fifteen character/structure GLBs, full map glTF, 278 hashed map resources, navigation payload, gameplay layout, and minimap; not certification of pixel parity                                                                                                                                                            |
| `npm run build`           | Static build succeeds                           | Bundles the application and local assets; not deployment or backend work                                                                                                                                                                                                                                                  |
| Browser screenshots       | Inspected at multiple viewports up to 1920×1080 | Full terrain, live lane combat, river aim, fountain placement, character visibility, HUD and shop presentation                                                                                                                                                                                                            |
| Built-game smoke check    | No browser errors or failed requests            | Full Rift loads; real movement/aim input; development diagnostics absent                                                                                                                                                                                                                                                  |

Browser tests save additional screenshot evidence into the ignored local `artifacts/` folder. They intentionally use real pointer and keyboard interactions; the diagnostics hook supplies observations and world-to-screen coordinates.

A short performance observation used Apple M5 Pro, Mac17,8, 64 GiB RAM, headless Chrome 152, 1920×1080, device scale 1. The practice simulation was advanced to 30 seconds, then 180 rendered frames were sampled. Observed frame intervals: median 16.7 ms, p95 16.8 ms, p99 16.8 ms; 11 live/persisting unit records, 173 draw calls, 214,102 submitted triangles. This is a small-scene observation on capable hardware, **not** certification of the full 5v5 budget or low-end devices. Reproduce a larger match fixture before drawing performance conclusions.

After the visibility change, the same small 30-second practice setup at 1920×1080 was sampled for 180 frames: median 16.7 ms, p95 18.6 ms, p99 19.1 ms. The 23 sampled fog updates cost median 1.7 ms and p95 2.4 ms. There were 11 unit records and 157 draw calls. Local evidence: `artifacts/vision-benchmark.json`, `artifacts/vision-30-seconds.png`, and hidden/revealed brush screenshots. This remains a small-scene observation, not a full-match performance gate.

See [vision policy](VISION.md) for source evidence, event semantics, and explicit remaining fidelity limitations.

## Fidelity debt that must remain visible

| Area            | Current limitation                                                                                                                                                 | Required direction                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Match scope     | Three-lane practice on full terrain with one sparring opponent                                                                                                     | Jungle, nine role-aware bots, complete objectives and a verified full-match route to victory/defeat                                      |
| Champion art    | Archived base Ashe, not a validated 26.18 asset set                                                                                                                | Matched reference captures, scale/orientation/material validation, current or approved content pipeline                                  |
| Environment     | Full terrain, source towers, Nexus and inhibitors integrated; missing camps and complete effects                                                                   | Import remaining building/camp models; complete effects, lighting, shader calibration, and region streaming                              |
| Minion art      | Matching 16.18 models; four source clips per ordinary minion and six per super minion                                                                              | Validate active match skin selection, attack impact timing, variant selection, VFX, camera-scale match, and full-wave reference captures |
| Camera          | Provisional perspective and scale                                                                                                                                  | Fit against reference gameplay screenshots at matched viewport/zoom                                                                      |
| Abilities       | Practice approximations; all abilities unlocked                                                                                                                    | Complete passive and Q/W/E/R, rank rules, charges, cast locks, travel/impact behavior, exact timing, animation/VFX synchronization       |
| Q               | Attack-speed buff and Focus, no full flurry/crit interaction                                                                                                       | Implement complete attack replacement and modifier semantics                                                                             |
| E               | Immediate circular reveal and fixed cooldown                                                                                                                       | Traveling vision, ammunition/charge timing, brush/reveal rules                                                                           |
| R               | Fixed damage/stun; no full travel-distance/splash rules                                                                                                            | Reference-accurate hit and CC semantics                                                                                                  |
| Summoner spells | Simple heal and obstacle-projected blink                                                                                                                           | Exact targeting, ally effects, wall rules, timing, rank/patch values                                                                     |
| Combat systems  | Simplified stats, status effects, growth, and mitigation                                                                                                           | Full typed modifiers, patch reconciliation, CC capabilities, item/rune interaction rules                                                 |
| Vision          | Source-grid occlusion and brush; elevated terrain fog; provisional sight radii; known-building state implemented, exact hidden-regrowth behavior needs calibration | Reference sight checks, building-knowledge/global-announcement calibration, wards, stealth/true sight, projectile-specific reveal rules  |
| Navigation      | Source-grid A*, cached radius clearance, swept capsule validation and authored lane routing                                                                        | Dynamic overlays, local unit avoidance, exact steering calibration, camp behavior                                                        |
| Bots            | One tactical sparring policy                                                                                                                                       | Per-role perception, team strategy, objective conversion, decision uncertainty, complete match QA                                        |
| Shop            | Four direct purchases                                                                                                                                              | Recipes, sell/undo, full builds, role-specific capacity, passives/actives, runes                                                         |
| Audio           | Synthetic feedback tones                                                                                                                                           | Reference-aligned event timing, real impact/ambient/voice assets, perceptual hierarchy                                                   |
| Persistence     | Snapshot serialization only                                                                                                                                        | Validated restore/import, command replay, IndexedDB saves, cache lifecycle, offline reload                                               |
| QA              | Chrome practice, full-map, and inspector coverage                                                                                                                  | Firefox/Safari, larger stress fixtures, long-match soak, context restore, complete content and match gates                               |
| Distribution    | Riot reference assets have provenance, no distribution authorization                                                                                               | Resolve the final asset/content rights before a production release                                                                       |

## Next implementation priorities

1. Reconcile all lane minions’ base stats, timed upgrades, economy, attack timing, and wave cadence after the super-wave foundation. Import camps and extend the building dependency/result foundation into complete-match behavior.
2. Calibrate known-building state, implement wards/stealth and ability-specific reveal rules. Calibrate camera, fog, shaders, and scale against matched reference captures; reduce large-scene rendering cost.
3. Replace the ability approximations with a versioned ability timeline/state model and complete Ashe behavior, then implement a second full kit.
4. Extend the three-lane test harness toward role-aware match simulation, preserving the tested input/combat boundaries.

## Asset investigation notes

The CommunityDragon 16.18 directory supplied mesh/texture references but returned HTTP 404 for the referenced Ashe skeleton and `.anm` files. The archived `tengge1/lol-model-viewer` repository at commit `ef5635c5fbe0c315275c9bcccf83558cfe7ee436` supplied a complete matching mesh/animation/texture set. The converter reads that archived format and writes GLB, baking coordinates and validating normalized joints and animation transforms. It does not run legacy viewer code inside the app.

Rebuild this asset with `node tools/assets/convert-ashe.mjs`, then run `npm run assets:validate`. This is a local development command that fetches the explicitly pinned source. Hash validation prevents accidental output drift.

`lol2gltf` was also built locally under ignored `.tools/` using a local .NET SDK for future current-format/map investigations, but it was not used for the archived Ashe conversion and is not a runtime dependency. The initial ImageSharp dependency warnings were resolved by the 3.1.12 update described below.

## Matching minion asset milestone

[Asset pipeline](ASSETS.md) records the pinned release, extraction/conversion workflow, source graph mappings, and remaining calibration gaps. The extractor obtained 88 matching files using 3.10 MB of CDN archive chunks from the 2.49 GB map WAD. Rebuilds validate pinned source hashes; all seven GLBs pass with zero errors/warnings. The six minion assets add about 2.9 MiB of static files, with no runtime external requests.

Browser screenshots verify all six models facing both directions, their relative authored scales, and the corrected health-bar positions. The new browser scenarios verify independent mixers, full death playback through two seconds and subsequent removal, and immediate idle animation after a cancelled windup. Nineteen simulation tests, eleven Chrome scenarios, and the static build pass. This does not certify full minion combat or pixel parity.

The lol2gltf tool is now used for these matching minion sources. Its direct ImageSharp dependency was updated to 3.1.12 before rebuilding, removing the previous vulnerability warnings; the conversion still runs only during asset authoring.

A 96-minion rendering fixture (stationary units, AI disabled, vision active; Chrome 152, 1920×1080, Apple M5 Pro) sampled 180 frames after 45 warmup frames: median 16.7 ms, p95 24.1 ms, p99 24.8 ms, 229 draw calls and 427,572 submitted triangles. This exposes remaining large-scene performance work; it is not a full-match frame-budget pass. Per-unit skeleton textures are now explicitly disposed on removal, with a browser regression check preserving surviving models and shared geometry. Local evidence: `artifacts/minion-render-benchmark.json`.

## Full terrain asset milestone

[Map pipeline and audit](MAP-ASSETS.md) documents the explicit Base_SRX/default-layer selection, matching AIPath_SRX_3 grid, current-format converter patches, and 184 hash-pinned sources. The terrain artifact contains 645,491 triangles and 137 full-resolution textures. Native DXT loading preserves the original compression blocks and mip levels, requires 327.42 MiB of texture GPU storage, and avoids decoding every texture to RGBA. The standard lossless WebP fallback is also browser-tested.

The navigation exporter validates 87,320 cells and 350,463 height samples. Inspection screenshots show the navigation overlay aligning with base object cutouts, brush, river edges, and walls; the playable now uses this grid for movement and sight. The textured intermediate rebuild is byte-identical with the frozen minimal path table. All 19 simulation tests, 13 Chrome scenarios, asset validators, and the two-page static build pass.

An isolated terrain-only measurement at 1920×1080 on Chrome 152 / Apple M5 Pro sampled 180 frames after 45 warmup frames per viewpoint. Overview: median 16.7 ms, p95 17.7 ms, 198 draw calls, 645,491 triangles. Mid lane: median 16.7 ms, p95 17.3 ms, 78 draw calls, 174,365 triangles. Both retained 138 GPU textures. This has no combat simulation, units, or full-match effects and is not a match-performance certification. Evidence: `artifacts/map-render-benchmark.json`.

Remaining visible terrain gaps include missing map-placeable buildings and VFX, approximate dynamic shaders, provisional grass tint/camera calibration, omitted procedural Faelights indicators, and unimplemented terrain overlays. The full production objective remains active.

## Full-map gameplay integration milestone

The default page now loads the same terrain as the inspector and uses the frozen gameplay layout described in [MAP-ASSETS.md](MAP-ASSETS.md). Camera picking, unit feet, health bars, targeting, and ground indicators account for source elevation. All three lanes spawn both teams on the authored barracks cadence and follow the source routes. The old small scene is explicitly selected with `/?scene=fixture` in development so its regression scenarios remain reproducible.

The simulation retains deterministic A* queries and exact swept capsule checks against grid rectangles. Range filtering before expensive visibility queries avoids repeated full-map rays during target acquisition. Fog computes the union of observer-local samples, preserving exact agreement with the simulation at every sampled position while doubling its resolution from 128 to 256.

A 90-second three-lane run on Apple M5 Pro / Chrome 152 at 1920×1080 sampled 180 frames after 45 warmup frames. There were 101 live/persisting unit records, 260 draw calls, and 313,510 submitted triangles. Before optimization, simulation steps cost median 3.1 ms / p95 4.1 ms; after optimization they cost median 0.2 ms / p95 0.3 ms. Fog updates at the higher resolution cost median 6.2 ms / p95 7.1 ms. Frame intervals remained median 16.7 ms, p95 23.5 ms, p99 25.4 ms. This is **not a full-match performance pass**: frame tails still miss budget, and nine complete bots and final effects are absent. Local evidence: `artifacts/rift-before-vision-optimization.json`, `artifacts/rift-90s-benchmark.json`, and `artifacts/rift-90s-playable.png`.

Current validation: 31 simulation scenarios, 16 Chrome scenarios, zero asset validator errors/warnings, and a passing static production build. A separate preview smoke check loaded the built default game without browser errors or failed requests, exercised actual movement/aim input, and confirmed that the development hook is absent. The goal remains active; full kit, match, art, device, persistence, and performance gates remain outstanding.

## Tower presentation milestone

Both tower assets are imported from the matching frozen release, preserving separate intact, damaged, broken, and rubble parts. All 22 runtime placements retain their full authored matrices, including the source heights and rotations. The renderer uses one independent rig per tower, shares its rig among its submeshes, and keeps shared geometry/textures across units. Destroyed structures persist as inert rubble instead of disappearing with the minion cleanup window.

The complete suite now passes 32 simulation and 19 Chrome scenarios. All nine model GLBs and the terrain pass asset validation with zero errors/warnings; the static build succeeds. The new scenarios verify every placement matrix, initial part visibility, independent rigs, persistent rubble for both teams, dead health-bar hiding, and per-unit GPU cleanup. Intact and rubble screenshots were visually inspected in the full terrain. Full destruction/VFX sequencing, damage stages, attack attachment, respawn rules, and building memory remain unimplemented; this is not certification of tower gameplay parity.

The full-map performance observation is now reproducible with `node tools/qa/benchmark-rift.mjs` against a running development server. It records machine/browser details, advances the world to 90 seconds, runs 45 warmup frames, and samples 180 frames with live simulation. Run it without concurrent browser tests or other heavy tasks; outputs are `artifacts/rift-benchmark.json` and `.png`. This remains a three-lane practice fixture rather than a complete 5v5 gate.

With the source towers, the 90-second fixture on Chrome 152 / Apple M5 Pro / 64 GiB at 1920×1080 recorded 101 unit records, 224 draw calls, and 383,730 submitted triangles. Across 180 sampled frames: median 16.7 ms, p95 21.5 ms, p99 25.3 ms. Simulation steps cost median 0.2 ms / p95 0.3 ms; the 22 sampled fog updates cost median 4.3 ms / p95 4.5 ms. Frame tails still miss a consistent 60 FPS budget. These timings are observations on the stated machine, not a low-end or full-match certification.

## Base structures and progression milestone

[Structure policy and assets](STRUCTURES.md) records the source data, dependency rules, supported transitions, and remaining fidelity gaps. Both Nexus models and both inhibitor models are now integrated at all eight source transforms. Base statistics replace the generic tower values in the default Rift. Protected structures reject both target acquisition and damage; cleared lanes expose inhibitors and Nexus defenders, and a fallen Nexus produces a non-resumable local result. Inhibitors and Nexus turrets return in place on their configured deadlines.

The current suite passes 39 simulation and 23 Chrome scenarios, including real pointer-driven victory, bot-driven defeat, animation continuation behind the result dialog, and a clean restart. The final Nexus-killing melee attack also stops the remainder of its live simulation tick. A fresh built-game smoke check passed with no failed requests or browser errors and no development diagnostics exposed. Source models and terrain pass asset validation with zero errors/warnings, and the static build succeeds. Base, destroyed-inhibitor, and result screenshots were visually inspected; floating combat feedback is hidden over the result dialog.

This is a base progression foundation. Super waves, plates, structural gold distribution, siege/backdoor modifiers, regeneration thresholds, complete animation/VFX sequencing, static building memory, camps, and nine role-aware bots remain incomplete. No full-match production gate is claimed.

The base-structure run of the same 90-second benchmark recorded 109 unit records, 232 draw calls, and 406,116 triangles on Chrome 152 / Apple M5 Pro / 64 GiB at 1920×1080. Across 180 frames after 45 warmup frames: median 16.7 ms, p95 22.3 ms, p99 27.4 ms. Simulation steps cost median 0.2 ms / p95 0.3 ms; 22 fog updates cost median 5.4 ms / p95 5.8 ms. Frame tails remain above budget, and this fixture still lacks nine full bots, camps, and complete effects. Instrumentation excludes warmup; these measurements are observations, not a claim of improvement over earlier runs.

## Super-minion foundation milestone

[Minion source and rules audit](MINIONS.md) records the selected Summoner’s Rift CharacterRecords, source models, wave rules, and unfinished mechanics. Downed inhibitors now produce lane-specific super waves, including two supers per lane when all three are down. New waves sample inhibitor deadlines consistently; already queued units keep their composition. Super minions use their larger radius for spawn projection and navigation, their own base stats and melee attacks, and separate starting rewards. Negative resistance now amplifies damage through a finite branch.

The source death clips exceed the former four-second cleanup window. Clip durations are recorded by the converter and become a simulation retention floor so both super-minion death animations finish. The runtime keeps independent rigs and does not remove a surviving minion’s resources when another dies.

Current validation is 46 simulation scenarios, 25 Chrome scenarios, zero errors/warnings across fifteen model GLBs and the full map, and a passing static build. The browser scenarios inspect both team models, source clip catalogs, full death playback, and cleanup; intact and death screenshots were visually inspected. This is not a full-match or pixel-parity certification. Timed stat upgrades, complete economy, minion aura, regeneration, attack impact calibration, pre-regrowth super cutoff, and timed wave-interval overrides remain unfinished. The production goal stays active.

A fresh production preview smoke check also passes with real movement/aim input, no browser errors or failed requests, and no development diagnostics exposed. Both super-model outputs and the gameplay layout reproduce byte-identically.

## Timed lane cadence and rewards milestone

The default Rift now applies the documented 25-second and 20-second wave intervals after 14 and 30 minutes. The scheduler retains elapsed progress toward a wave across transitions and keeps explicit wave suppression intact. A tick-by-tick 31-minute clock scenario checks both boundaries; precise phase alignment still awaits reference capture.

Six ordinary minion Root records and their source hashes are frozen and verified against upstream. Both teams now receive 350 starting movement speed, the source timed movement increments for newly spawned minions, and distinct initial gold/XP rewards. Combat initialization, HP/damage growth, on-hit effects, and shared economy remain incomplete. The new reward checks also exposed and fixed a unit-creation bug where spreading a position object could overwrite identity/team/class with fields from another unit.

The simulation suite passes 51 scenarios. The work continues toward full minion reconstruction, static-building vision, and the larger complete-match gates; this milestone does not certify those unfinished systems.

The 25 Chrome regression scenarios, static build, asset validation, and built-game smoke check also pass. All six upstream minion files match their recorded hashes, and the generated layout/source snapshot rebuild byte-identically. Full minion combat and exact reference transition phases remain outstanding.

## Known buildings under fog milestone

Enemy buildings now remain visible under the same fog shading as terrain, filling the source terrain cutouts. The simulation retains separate per-team intact/destroyed knowledge; live sight still governs picking, health bars, targeting, and combat events. Known intact buildings appear on the minimap. Hidden regrowth keeps the remembered destroyed representation until the building is observed, then preserves its newly observed intact state after sight is lost. Snapshot version 4 retains that knowledge.

The shared fog shader computes world positions after skinning, so structure meshes and source matrices agree with terrain fog. Before/after full-base screenshots and hidden-regrowth screenshots were inspected in Chrome. Simulation checks now total 55 scenarios. Exact reference knowledge/announcement behavior and broader vision systems remain unfinished; the production goal stays active.

All 26 Chrome scenarios and the static build pass for this milestone. The 90-second full-Rift benchmark on Chrome 152 / Apple M5 Pro / 64 GiB at 1920×1080, with 45 warmup frames and 180 samples, records 109 unit records, 318 draw calls, and 554,586 triangles. Frame intervals: median 16.7 ms, p95 23.3 ms, p99 28.1 ms. Simulation steps cost median 0.2 ms / p95 0.4 ms; 22 fog updates cost median 6.3 ms / p95 7.8 ms. Retaining known enemy structures increases submitted geometry; this does not pass the full-match frame budget. Animation-aware building bounds and offscreen culling are a concrete next rendering task. These timings are a scoped observation, not a controlled comparison with older fixtures.

The fresh production preview smoke check passes with no browser errors or failed requests and no development diagnostics exposed.

## Building culling milestone

All six structure references now receive conservative bounds covering their imported animation tracks and ordinary blends. Cloned building meshes use native gameplay/shadow frustum culling. Unsupported rigs keep culling disabled. Knowledge under fog and offscreen simulation are unchanged. See [structure bounds and verification](STRUCTURES.md#animation-aware-rendering-bounds).

Validation passes 61 unit/scenario checks, 27 Chrome scenarios, and the static production build. The new browser check covers 10,231,059 sampled deformed vertices and 14 byte-identical frozen framebuffer comparisons with culling enabled/disabled. The production preview loads without errors or failed requests, exercises movement/aim input, and exposes no development hook. The benchmark screenshot was visually inspected.

The 90-second live fixture now submits 249 draw calls and 394,575 triangles on Chrome 152 / Apple M5 Pro / 64 GiB at 1920×1080. Across 180 frames after 45 warmup frames, median frame interval is 16.6 ms, p95 24.0 ms, p99 29.2 ms. Simulation p95 is 0.4 ms; 22 fog updates have p95 7.4 ms. Geometry submission is lower, but this run does not demonstrate an improvement in frame tails or meet the full-match performance gate. The controlled frozen-view test isolates the draw-call saving; comparisons with earlier live runs are subject to scheduling variation. Fog-update scheduling and the remaining complete-match systems still need work. The production goal remains active.

## Exact fog cache milestone

The renderer now reuses exact terrain-ray results for unchanged observers. Moving or expired sources are evicted; changed sight geometry invalidates results through an explicit battlefield revision. The union still samples the same 256×256 positions every eight ticks. No gameplay query reads the cache. See [fog reuse and invalidation](VISION.md#exact-fog-sample-reuse).

All 64 unit/scenario checks, 28 Chrome scenarios, the static build, and the fresh production preview smoke check pass. Eight full-map transition states produce identical cached/uncached RGBA masks, and the independent source-brush comparison still agrees with simulation visibility at all 65,536 samples. Tests cover terrain revision changes and mutable queries without a revision as well as movement, overlap, radius, death, and expiry.

The live 90-second fixture on Chrome 152 / Apple M5 Pro / 64 GiB at 1920×1080 records fog median 1.4 ms / p95 2.0 ms / p99 2.5 ms over 22 updates. Across 180 frames after 45 warmup frames, frame median is 16.7 ms, p95 18.9 ms, p99 23.9 ms; simulation p95 is 0.4 ms. There are 109 unit records, 247 draw calls, and 394,551 triangles. This is a scoped run, with scheduling variation relative to the previous run; the stationary-observer unit check independently proves repeated rays are eliminated. Frame p95 still exceeds the 16.7 ms target, and the complete roster, nine bots, camps, effects, and full-match gates remain unfinished. The goal stays active.

## Minion turret-attack damage milestone

Rift basic attacks now apply the published minion-to-turret multipliers: 60% for melee/caster/super and 84% for siege, followed by armor mitigation. The values are pinned in the explicit rule overrides and exported into the gameplay layout. One shared hit path handles melee release and ranged impact, preserving projectile release AD and attacks arriving after the source dies. Other victim types, champion attacks, and direct non-attack damage remain independent.

All 75 unit/scenario checks and 28 Chrome scenarios pass, as do the static build and fresh production preview smoke check. The layout, provenance snapshot, and minimap regenerate byte-identically. Eleven new combat scenarios verify both teams and all four types, resistance composition, single application, source death, post-release AD changes, and target/effect exclusions. This corrects a lane-pushing discrepancy; full minion stat initialization/scaling, Minion Slayer, turret defenses/aggro, and complete-match fidelity remain unfinished. No new performance claim is made for this change. The goal remains active.

## Melee health progression milestone

Melee minions now use their frozen 430 base HP and barracks health upgrades: +35 per completed 90-second period, with the source 1,120 bonus cap. Health is computed at creation and initializes both current and maximum HP. Existing living units retain their health across deadlines. The cap interpretation and precise spawn-time policy remain awaiting controlled reference capture; other minion stat families and on-hit effects are unfinished. See [melee health policy](MINIONS.md#melee-health-progression).

All 79 unit/scenario checks, 28 Chrome scenarios, the static build, and the fresh production preview smoke check pass. The six upstream ordinary-minion records match their frozen hashes. Layout and provenance regenerate byte-identically. Four new scenarios cover both teams, exact timer boundaries, the cap, living damaged minions, source-record immutability, and all 18 melee units of a real queued three-lane wave. The production goal remains active.

## Browser interruption and graphics recovery milestone

Graphics loss now enters a blocking recovery dialog instead of a toast with a resumable simulation. Lost/restoring/failed states reject menu bypasses and pause gameplay until assets and restored shaders are ready. Warmup cancellation and generation checks prevent a stale completion from clearing a newer loss. Focus loss, hidden-document events, and initially hidden pages also pause with cleared held input and queued commands. Resume remains explicit. Dialog focus prevents a Space key held across an interruption from activating restart or resume. See [recovery behavior and limits](RECOVERY.md).

Validation passes 79 unit/scenario checks, a full 34-scenario Chrome run, and the subsequently added initially-hidden startup scenario in isolation (35 current Chrome scenarios total). The final static build and production preview smoke check pass without errors or failed requests. Real WebGL extension loss/restoration, repeated loss, loading interruption, injected warmup failure/retry, and stale warmup completion are covered. A frozen full-Rift framebuffer is byte-identical after restoration, and snapshots remain unchanged until resume. Recovery/restored screenshots were inspected. Focus/visibility handler tests use controlled events and are not operating-system/browser-matrix certification. Reload-safe saves, persistence, broader reliability testing, and complete match/content fidelity remain unfinished; the goal stays active.

## Manual match checkpoint milestone

The pause menu now saves one local checkpoint per battlefield. Reloading a compatible build restores the simulation and remains paused; restart clears that checkpoint. Writes report success only after their IndexedDB transaction completes. Failed writes preserve the previous save, and incompatible saves are retained with a notice. Snapshot version 5 validates gameplay state and a ruleset fingerprint before restoration. See [checkpoint format and limits](SAVES.md).

Validation passes 92 unit/scenario checks and the production build. The full Chrome run passed 37 cases and exposed one outdated pause-menu focus expectation; the corrected focus case and all three checkpoint cases then passed together. The final three checkpoint cases passed again after error-message handling changes. The production save/reload smoke check passes without browser errors and without the development hook. The restored pause screen was visually inspected. Browser tests now own port 5198 and reject an existing server, preventing accidental attachment to another project's app.

These checks cover exact simulation continuation, an aborted storage transaction, incompatible-save retention, and explicit resume/restart. Autosaves, migrations, export/import, offline assets, and cross-browser replay guarantees remain unfinished, alongside the broader match and content fidelity work. The production goal remains active.

## Lane-minion current-health damage milestone

Ordinary minion attacks now add the pinned item ratios of the opposing lane minion's current HP: 2% melee, 3.5% caster, and 5% siege. Both teams' source inventories resolve through frozen 16.18 item definitions into the gameplay layout. Ranged attacks read current HP on contact while preserving release AD, including after source death. The combined physical hit resolves once. Physical composition and precise pre-hit sampling remain explicit policies awaiting matched reference capture; the primary data establishes the ratios and eligible victim class. See [source evidence and combat boundaries](MINIONS.md#minion-current-health-on-hit-damage).

All 103 unit/scenario checks, all 38 Chrome scenarios, the static production build, and the production preview smoke check pass. The six frozen item/tooltip records match upstream hashes and data. Layout, provenance, and minimap exports reproduce byte-identically. The production screenshot was inspected; no new rendering or performance claim is made. Eleven new combat scenarios cover both teams, all ordinary source types and lane-minion victim types, armor, impact-time health changes, source death, repeated attacks, exclusions, and one-time lethal resolution.

This closes a missing lane-combat contribution. Full minion initialization and scaling, turret-specific damage received, siege mid-lane attack speed, super-minion effects, complete champion/bot/objective systems, and pixel-level reference comparison remain unfinished. The production goal remains active.

## Siege mid-turret attack speed milestone

Siege minions now receive the source item's 30% attack-speed bonus when attacking a mid-lane turret. The exported pinned value drives both windup and repeated attack cadence without modifying baseline stats. Target switching samples the next attack's eligibility without rewriting the existing cooldown. Animation playback uses the same multiplier and rounded period, including the existing Ranger's Focus multiplier. See [timing policy and source evidence](MINIONS.md#siege-attacks-against-mid-lane-turrets).

All 107 unit/scenario checks, all 39 Chrome scenarios, the static build, and the production preview smoke check pass. The new browser scenario verifies both siege rigs against mid and top turrets, comparing actual animation duration to scheduled combat duration. Four simulation scenarios cover both teams, repeated release timestamps, lane/class/victim exclusions, target switching, and immutable baseline timing. Layout, provenance, and minimap reproduce byte-identically.

This corrects a missing siege-pushing modifier. Exact reference windup, complete minion stat initialization, future attack-speed stacking, turret-shot damage rules, full match systems, and pixel-level fidelity remain unfinished. No new performance claim is made. The production goal remains active.

## Turret damage against minions milestone

Turret basic attacks now replace ordinary AD with the pinned item-tooltip fraction for the minion victim and authored turret tier: melee 45%, caster 70%, super 7%, and siege 14/11/8% for outer/inner/base turrets. The exporter parses the frozen tooltip phrases and fails on changed source wording. The item reference now includes Super Mech Armor. Maximum-health sampling at impact and physical mitigation are explicit runtime policies awaiting matched reference capture; tooltip fractions alone do not prove server ordering or resistance treatment. See [damage table and boundaries](MINIONS.md#turret-attacks-against-lane-minions).

All 118 unit/scenario checks, all 39 Chrome scenarios, the static production build, and the production preview smoke check pass. Eight selected item/tooltip records match upstream data and file hashes. Layout, provenance, and minimap exports reproduce byte-identically. Eleven new combat scenarios cover both teams, all turret roles and minion classes, varying HP and armor, wounded targets, source death after release, ordinary damage-path exclusions, and one-time lethal resolution. Zero-armor last-hit windows leave melee minions at 10% after two shots and kill casters on the second shot.

Turret armor penetration, exact reference damage ordering, super-minion aura effects, complete minion initialization, the remaining champion/bot/objective systems, and pixel-level reference comparison remain unfinished. No new performance or full-match parity claim is made. The production goal remains active.

## Scheduled attack animation milestone

Attack cycles now retain their start and end ticks in simulation state and snapshot version 6. The renderer uses that scheduled duration and simulation phase, so an expired attack-speed effect cannot change playback speed after the attack has already started. A late first render or a fresh model restored after missile release resumes the active clip at its elapsed phase. Pause freezes attack phase. Cancelled orders, stuns, invalid windup targets, and death clear the active cycle. Other animation phases and crossfade weights remain presentation state; this does not promise a pixel-identical restored framebuffer. See [checkpoint scope](SAVES.md).

All 121 unit/scenario checks, all 40 Chrome scenarios, the static build, and the production preview smoke check pass. The attack-cycle browser case was then strengthened and passed again: it checks the actual imported Ashe skeleton, confirms the pose changes as simulation advances, and matches paused/restored pose components within 1e-7. The restore check creates a fresh model after release, rather than retaining the previous AnimationAction. Simulation tests cover fixed timing through buff expiry/stat changes, exact snapshot continuation, cancellation causes, and invalid cycle durations.

This corrects animation continuity and save restoration within the current combat model. Exact source hit-frame calibration, other animation phases/events, full champion kits, full-match systems, and pixel-level reference comparison remain unfinished. The production goal remains active.

## Mobile death animation continuity milestone

Mobile death clips now seek from the saved death tick instead of starting when first rendered. A late first view or fresh restored rig reconstructs the elapsed pose; normal pause freezes that phase. Corpse visibility uses the same age and existing playback margin. Terminal presentation finishes the remaining sequence without advancing gameplay, then hides the completed mobile corpse. Terminal presentation elapsed time, crossfade weights, and structure transition playback are not persisted. See [death continuity and limits](MINIONS.md#mobile-death-playback-continuity).

All 121 unit/scenario checks, all 42 Chrome scenarios, the static build, and the production preview smoke check pass. The two new browser scenarios also passed in an initial targeted run. The rig comparison covers Ashe and all eight imported lane-minion models, matching paused and freshly restored skeleton pose components within 1e-7 while retaining hidden health bars. The terminal case reaches the super-minion clip's final pose and hides the completed corpse while the match tick remains unchanged. Existing full death-duration, survivor independence, corpse cleanup, graphics recovery, and structure destruction checks pass.

This improves the current source animation playback; alternate animation selection, source event graphs, particles, structure restoration phases, the complete champion/bot/objective systems, and pixel-level reference certification remain unfinished. The production goal remains active.

## Structure destruction phase milestone

Animated structure destruction now seeks from the known death tick and enters the destroyed-idle loop at the corresponding phase. A late first render or fresh restore of a dead inhibitor no longer restarts its collapse. The renderer retains the remembered destruction clock across hidden live regrowth, preventing that unseen change from resetting the rubble pose. Observed regrowth returns to the living state. Static tower rubble keeps its authored pose, and terminal presentation still completes animated destruction. See [phase reconstruction and remaining restore limits](STRUCTURES.md#destruction-phase-reconstruction).

All 121 unit/scenario checks, all 43 Chrome scenarios, the static build, and the production preview smoke check pass. The new browser scenario compares both inhibitor rigs before and after fresh restoration at the same age, matching pose components within 1e-7, and checks the enemy's remembered clock and loop phase across controlled hidden regrowth. An initial test incorrectly treated an allied inhibitor as hidden; after restricting that setup to the enemy, the corrected targeted case and full suite pass. Existing base destruction, terminal outcomes, fog knowledge, and graphics recovery scenarios remain green.

A fresh view of remembered rubble after unseen regrowth lacks its original death timestamp and starts a completed destroyed-idle state. Terminal elapsed playback and other presentation state are not persisted. Source particle events, respawn transitions, full match/content systems, and pixel-level reference comparison remain unfinished. The production goal remains active.

## Movement distance and run-rate milestone

Movement now retains the remainder of each tick's distance across path waypoints, including zero-length segments and turns. Dense routes no longer artificially slow units, and unused distance cannot carry them past the reachable endpoint. One effective-speed function supplies the existing slow and Heal haste rules to both movement and run playback. Run clips scale relative to the configured unmodified movement speed. This improves relative consistency; absolute authored stride and foot contacts remain reference-capture work. See [movement behavior and boundaries](MOVEMENT.md).

All 125 unit/scenario checks, all 44 Chrome scenarios, the static build, and the production preview smoke check pass. Four new simulation cases cover sparse/dense equivalence, turns and repeated points, endpoint stopping, and exact slow/haste deadlines. The new browser scenario also passed in isolation and checks 36 combinations across Ashe and eight minion rigs, comparing actual travel distance with effective speed and source run playback rate. Existing full-map navigation, pointer controls, fog, attack/death playback, saves, and recovery checks remain green.

Additional reference speed caps and crowd-control rules, absolute gait calibration, complete champion/bot/objective systems, and full pixel-level comparison remain unfinished. No new performance claim is made. The production goal remains active.

## Source-backed Ashe progression milestone

Ashe now uses pinned CharacterRecord stats and the matching client global level-growth factors. Leveling applies fractional HP, mana, AD, armor, MR, attack-speed, and regeneration growth, replacing the previous flat HP/AD increments. The CharacterRecord's 3.5 AD growth agrees with Riot's 26.2 notes and resolves the earlier Data Dragon sample's zero-growth discrepancy. Multiple-level awards carry XP forward; level 18 stops accumulation and save validation enforces that cap. Item bonuses and missing resources are preserved. Dead heroes stay at zero HP, and already-scheduled attacks retain their timing. See [source records, totals, and scope](PROGRESSION.md).

All 130 unit/scenario checks, all 45 Chrome scenarios, the static build, and the production preview smoke check pass. Both pinned upstream records verify and the generated gameplay data reproduces byte-identically. Five new simulation scenarios cover thresholds/cap, source totals, items/resources, death safety, regeneration, snapshot continuation, invalid saved levels, and attack timing. The level-2/18 HUD browser case passes; after its initial screenshot caught the loading fade, the test was updated to wait for the overlay to detach and passed again. The unobstructed level-18 HUD was visually inspected.

Enemy leveling, XP sharing and eligibility, role modifiers and higher role-specific caps, ability ranks, complete stat/item interactions, and the remaining full-match and pixel-fidelity gates are unfinished. Exact source windup and attack-speed stacking also remain unresolved. The production goal remains active.

## Minion experience collection milestone

Rift minion XP now uses each victim team's pinned barracks radius of 1,500 units, matching Riot's published range change. The inclusive center-distance boundary replaces the hard-coded 1,400-unit check for Rift lane minions. Living players can collect proximity XP without sight or the last hit; dead players cannot collect that minion award. Gold and CS remain tied to the separate last-hit path. Champion-kill XP and the legacy unconfigured practice radius remain separate approximations. See [collection rules and limits](PROGRESSION.md#minion-experience-collection).

All 137 unit/scenario checks, all 45 Chrome scenarios, the static build, and the production preview smoke check pass. Layout, provenance, and minimap reproduce byte-identically. Seven new scenarios verify both source radii, all four minion classes inside/on/outside the boundary, sight and last-hit independence, dead-player and victim exclusions, distant last-hit gold/CS, and automatic leveling from proximity XP.

Experience sharing, full champion-kill and assist rewards, role modifiers, enemy progression, the remaining full-match systems, and pixel-level reference comparison remain unfinished. No new performance claim is made. The production goal remains active.

## Ambient gold milestone

Standard Rift passive income now starts after the 65-second boundary and accrues at 2.04 gold per second, replacing the immediate two-gold-per-second practice grant. The pinned map's CLASSIC mode link supplies the start, amount, and interval; the start agrees with the official 26.1 game-start change. Fractional balances survive purchases and checkpoints. HUD and shop show whole spendable gold, and an open shop refreshes as income arrives. Death permits income; pause and victory freeze it. See [economy evidence and cadence policy](ECONOMY.md).

All 142 unit/scenario checks and all 46 Chrome scenarios pass. After adding the open-shop refresh, the affected browser scenario, all unit checks, and static build passed again. The production preview smoke check also passes. Tests cover the exact start boundary, sustained rate, fractional saves/change, purchase affordability, death, victory, debug time jumps, and both balance displays. The exporter verifies the selected fields against the pinned map SHA.

Continuous per-tick credit is an explicit policy pending a matched reference capture of payout cadence. Role income, reward scaling/sharing, complete items, independent bot economies, full-match systems, and pixel-level reference comparisons remain unfinished. No new performance claim is made. The production goal remains active.

## Cannon and super bounty scaling milestone

Cannon and super minions now receive 50 starting gold plus one per 90 seconds of spawn time, capped at 90 total. Both team configurations come from the pinned barracks upgrade interval and maximum, reconciled with Riot's published initial reward and increment. The exporter verifies the hashed `GoldUpgrade` and `GoldMax` names; red super's omitted increment uses the explicit official rule. Existing units retain their spawn bounty, and checkpoint restoration and last-hit payout preserve it. See [minion gold evidence and interpretation](MINIONS.md#cannon-and-super-gold-growth).

All 149 unit/scenario checks, all 47 Chrome scenarios, the static build, and production smoke pass. Seven new unit scenarios cover both teams/kinds, upgrade and cap boundaries, surviving units, save restoration, last-hit ownership, duplicate lethal hits, and unchanged ordinary rewards. The full-Rift browser test spawns a 30-minute wave with five cannons and one inhibitor-driven super, verifies all six 70-gold bounties, and checks the super's payout and HUD balance. Its initial exact floating-point subtraction assertion was corrected to the defined six-decimal balance precision; the complete suite then passed.

Spawn-time versus live upgrade behavior, exact initialization boundaries, and maximum-field interpretation remain pending matched reference-client observation. Ordinary minion scaling, reward sharing, role systems, complete bot economies, full-match gameplay, and pixel-level fidelity remain unfinished. The production goal remains active.

## Super-minion health scaling milestone

Both super variants now receive their pinned barracks health growth: 100 HP per 90 seconds, capped at 6,000 bonus HP above the 1,500 base. The existing spawn-health system consumes the newly exported configuration, producing 3,500 HP at 30 minutes and a maximum of 7,500 at 90 minutes. Existing wounded units and restored checkpoints retain their original maximum and current health. Turret percentage-health attacks use the increased maximum. See [source values and timing policy](MINIONS.md#super-minion-health-growth).

All 153 unit/scenario checks, the three affected Chrome scenarios, the static build, and production smoke pass. The full browser suite was not repeated for this data-only runtime change. Four new unit scenarios cover both teams' upgrade/cap boundaries, wounded-unit/save preservation, and a real turret projectile. The full-Rift late-wave scenario additionally verifies the spawned super's 3,500 HP. The first turret test setup omitted initial structures; correcting its fixture initialization made the intended projectile check pass. Layout, provenance, and minimap reproduce byte-identically.

Exact upgrade phase and living-unit behavior still require reference-client observation. Super damage growth, aura, regeneration, complete match systems, and pixel-level fidelity remain unfinished. The production goal remains active.

## Super-aura source reconciliation

Inspected the selected super CharacterRecords, item 1512, matching shared buffs, and English string table before implementing the missing aura. Found conflicting descriptions in the same 16.18 source set: the carried cosmetic item describes 35 armor/MR, whereas the shared Minion Commander description claims 70 armor/MR plus 70% damage. Neither supplies radius, filtering, stacking, or application cadence. This changes the next action from importing tooltip values to obtaining behavioral evidence; no guessed aura was added.

Pinned three whole-source hashes and five selected records in `reference/super-aura.json`; `tools/assets/verify-super-aura.py` verifies all of them successfully. [SUPER-AURA.md](SUPER-AURA.md) distinguishes source facts from interpretation and specifies the comparison needed to resolve the effect. Runtime files are unchanged, so simulation/browser checks were not repeated. Independent full-match and presentation work remains available; the production goal remains active.

## Champion health-bar readability milestone

Replaced the fixed 16-pixel champion stripe pattern with health-based 100-HP divisions and stronger 1,000-HP marks. Spacing follows maximum health after levels and items; damage only changes the fill. CSS layers keep DOM size constant. The selected-target panel now rounds maximum health consistently with current health. See [presentation policy and remaining calibration](HEALTH-BARS.md).

All 153 simulation checks, the new division browser scenario, the existing progression HUD scenario, the static build, and production smoke pass. Starting, level-18, and post-item bar captures were visually inspected. The full browser suite was not repeated for this presentation-only change. Exact source styling, shield presentation, high-health density, full-match systems, and pixel-level comparison remain unfinished. The production goal remains active.

## Explicit A-click targeting milestone

A followed by an enemy click now issues a targeted attack using the same picked enemy as right-click. Previously the input handler discarded that target and issued ground attack-move, which could acquire a different nearby enemy or ignore a directly clicked dummy. Ground and ally clicks remain attack-move, and Escape cancels the armed input. README controls and [movement documentation](MOVEMENT.md#explicit-attack-clicks) describe the distinction.

All 153 simulation checks, four focused Chrome scenarios, the static build, and production smoke pass. The browser cases use actual keyboard/mouse input, verify explicit champion/caster/dummy damage despite a nearer enemy, and cover ground/ally clicks, cursor cleanup, and Escape. The initial test incorrectly stunned the player, causing commands to be rejected as designed; removing that fixture constraint exercised the intended behavior. The full browser suite was not repeated for this localized input change.

Configurable attack-move-on-cursor, champion-only targeting, exact input buffering/cancellation calibration, complete match systems, and pixel-level fidelity remain unfinished. The production goal remains active.

## Source-backed Heal self-cast milestone

The stun-command review found an explicit source exception: Summoner Heal is castable while disabled and does not break channels. Its pinned record now drives the supported self-cast values: 80–318 healing across levels 1–18, 240-second cooldown, and 30% movement speed for one second. Heal works during the implemented stun and preserves recall; it does not remove stun, permit movement during it, or revive dead players. Other spells and movement orders retain the existing stun filter. Movement buffering itself remains unverified and unchanged. See [Heal scope and remaining mechanics](SUMMONER-HEAL.md).

All 157 unit/scenario checks, three affected Chrome scenarios, the static build, and production smoke pass. New checks cover healing totals/clamping, stun permission and other-spell rejection, recall/cooldown behavior, checkpoint continuation, death, and victory. The browser presses F during stun and checks the cooldown and heal event; existing movement/run and attack-cycle cases remain green. Generated Heal data reproduces byte-identically. The full browser suite was not repeated.

Ally targeting/healing/haste, repeated-Heal reduction, healing modifiers, additional crowd-control types, complete champion kits, full-match systems, and pixel-level reference comparison remain unfinished. The production goal remains active.

## Repeated Heal reduction milestone

The pinned 0.5 multiplier and 30-second duration now apply to repeated Summoner Heal on a recipient. Reduction precedes missing-health clamping, refreshes on an accepted cast, and does not compound or reduce ordinary regeneration/haste. A recipient timestamp preserves the effect through saves; snapshot version 7 validates it. The practice cooldown reset leaves the reduction intact. See [source facts and runtime policies](SUMMONER-HEAL.md#repeated-heal-reduction).

All 160 simulation checks, four affected Chrome scenarios, the static build, and production smoke pass. New cases cover consecutive casts, exact expiry, clamping, regeneration, checkpoint continuation, and invalid saved deadlines. Browser coverage includes an actual practice cooldown reset and reduced F cast during stun, plus the three existing save scenarios. Generated data reproduces byte-identically. The full browser suite was not repeated.

Exact refresh/full-health/death-persistence semantics still require reference observation. Ally healing, bot spell inventories, healing modifiers, complete match systems, and pixel-level fidelity remain unfinished. The production goal remains active.

## Allied Heal milestone

Heal now affects the caster and one living allied champion within the pinned 900-unit range. F uses the hovered unit or cursor location, with the exported 200-unit tolerance; without a qualifying cursor target, the current policy chooses the lowest health percentage. The matching tooltip is now pinned and verified alongside the spell record. Each recipient independently receives healing, repeated-Heal reduction, and a one-second speed effect. Snapshot version 8 replaces the player-only haste timer with per-unit deadlines consumed by movement and run playback. See [selection rules and assumptions](SUMMONER-HEAL.md#allied-champion-selection-and-haste).

All 165 simulation checks, six affected Chrome scenarios, the static build, and production smoke pass. Five new simulation cases cover cursor preference, fallback, range/tolerance boundaries, exclusions, independent reductions, caster-level healing, expiry, and saved continuation. The new browser case hovers one ally and verifies that exactly the intended recipient gains healing and haste. Existing Heal, run-speed, and all three save cases pass. Generated data reproduces byte-identically. The full browser suite was not repeated.

Exact selection geometry, fallback interpretation, tie-breaking, additional healing modifiers, bot spell inventories, complete match systems, and pixel-level fidelity remain unfinished. The production goal remains active.

## Queued command snapshot milestone

Command queuing now captures only the fields belonging to each command. Previously a structurally valid coordinate argument could be an entire Unit; cloning it copied all entity fields into the point and made a pending command incompatible with strict snapshot validation. The HUD Heal button still exercises this caller shape. Cast, move, and attack-move destinations now contain only copied coordinates, with attack targets and other scalar command fields copied independently.

Three new regressions reproduced the oversized point payload before the fix; all 168 simulation checks now pass. Eight affected Chrome scenarios pass, including a new real HUD-click test that snapshots the pending Heal before execution and verifies identical restored continuation. Existing save and explicit attack-targeting cases remain green. Static build and production smoke pass. The full browser suite was not repeated. Complete match systems and pixel-level fidelity remain unfinished; the production goal remains active.

## Champion recovery and bot retreat milestone

Living allied and enemy champion prototypes now regenerate health and mana, with fountain restoration tied to each champion's own team. The old red-spawn bot healing increment was removed. Bots below 22% health enter a persistent retreat state, replace unrelated movement orders with their own home, and wait until at least 85% health before resuming their tactical policy. Snapshot version 9 preserves that state. The thresholds are authored AI decisions; fountain radius/rates remain the existing provisional values. See [recovery scope and remaining bot work](CHAMPION-RECOVERY.md).

All 172 simulation checks, all 55 Chrome scenarios, the static build, and production smoke pass. Four new scenarios cover both teams' fountain recovery and restored continuation, redirection to the correct home, ordinary regeneration at an enemy fountain, and dead-champion exclusion. Existing damage and ally-Heal checks were updated to account for newly active non-player regeneration without obscuring the damage/heal amount being tested.

Role assignments, team strategy, safe retreats, recall and shopping decisions, mana-driven recovery, independent bot progression, source fountain calibration, full-match completion, and pixel-level fidelity remain unfinished. The production goal remains active.

## Team-correct champion respawn milestone

Champion respawns now use each unit's team spawn. This fixes non-player blue champions incorrectly returning to the red fountain. Structures and dummies retain their in-place behavior. Three new simulation cases verify both teams, exact timing, resources, cleared combat/navigation/retreat state, pre-respawn checkpoint continuation, and unchanged dummy placement. The blue case reproduced the placement failure before the fix.

All 175 simulation checks, four affected Chrome scenarios, the static build, and production smoke pass. The new full-Rift browser case verifies both authored fountains and live-vision/health-bar visibility after respawn; all three save cases remain green. The full browser suite was not repeated. Source death-timer scaling, fountain protection, complete bot strategy, full-match systems, and pixel-level fidelity remain unfinished. See [respawn scope](CHAMPION-RECOVERY.md#respawn-placement). The production goal remains active.

## Champion base death-time milestone

Replaced the fixed ten-second champion respawn delay with the 18-level base table selected by standard Rift's pinned 16.18 map record. The player now waits 52.5 seconds at level 18, with an integer-tick deadline and upward-rounded HUD countdown. Other champion prototypes remain level one until independent progression exists. The complete source record, including unapplied scaling fields, is pinned and the exporter verifies both the whole source hash and mode selection. Official patch 14.16 corroborates early-level values. See [death-time evidence and remaining research](CHAMPION-RECOVERY.md#base-death-duration-by-level).

All 178 simulation checks, three focused Chrome cases, the static build, and production smoke pass. New checks cover every base level, half-second timing, restored continuation, prototype level isolation, and visible countdown expiry. Export regeneration is byte-identical. The full browser suite was not repeated. Match-time scaling, role modifiers, fountain protection, complete match systems and pixel fidelity remain unfinished; the production goal remains active.

## Champion death-time scaling milestone

Champion respawn deadlines now incorporate the pinned record's time bands and multiplier cap. The implementation accumulates each band's contribution, counts started 30-second intervals, samples at death and rounds the final duration up to a simulation tick. Explicit scaling points take precedence over legacy scalar fields. These evaluation choices are documented in CHAMPION-RECOVERY.md as policies pending reference capture; the source establishes numeric fields, not complete runtime semantics. At the cap, level 18 waits 78.75 seconds. Both teams receive scaling; structures and dummies retain separate rules.

All 181 simulation checks, six focused Chrome cases (respawn and saves), static build and production smoke pass. New coverage includes band boundaries, cap, saved death spanning a scaling boundary, prototype teams, and the late-game HUD countdown. Export regeneration is byte-identical. The full browser suite was not repeated. Exact boundary calibration, role modifiers, fountain protection, full match systems and pixel fidelity remain unfinished. The production goal remains active.

## Focus cleanup on death milestone

Death immediately clears the player's Focus stacks, expiry and active Q deadline. An arrow already in flight still damages its target after its source dies, but no longer grants posthumous Focus. Cooldowns and inventory remain intact. This closes a lifecycle/HUD state leak in the prototype; complete Ashe Q reference behavior remains unfinished.

All 183 simulation checks, four focused Chrome cases, static build and production smoke pass. New cases cover cleanup, saved continuation through respawn, retained cooldowns/inventory, in-flight damage without Focus, and disappearance of charged pips and the active-Q HUD indicator. The full browser suite was not repeated. Full kit fidelity, match systems and pixel accuracy remain unfinished; the production goal remains active.

## Source-backed Ashe Q duration milestone

Ranger's Focus now remains active for six seconds instead of four. The duration comes from the pinned 16.18 Ashe spell record and is corroborated by Riot's patch 13.5 notes. The tooltip shares the generated value. The complete Q record is retained for future rank, stacking and arrow-flurry work; this change does not claim those systems are complete. See ASHE-Q.md.

All 184 simulation checks, three focused Chrome cases, static build and production smoke pass. New tests verify activation, persistence beyond the former four-second deadline, exact six-second expiry, HUD state and saved continuation. Existing attack-cycle and death-cleanup browser cases remain green. Export regeneration is byte-identical. The full browser suite was not repeated. Complete champion, full-match and pixel fidelity remain unfinished; the production goal remains active.

## Individual Focus decay milestone

Focus now loses one stack after four seconds of inactivity, then one per second, using pinned spell timing values and retained tooltip corroboration. New eligible impacts refresh the full window. Active Q prevents Focus accumulation, and casting clears the stack deadline. The existing deadline field persists intermediate decay through saves. Exact boundary ordering and impact-based generation remain documented limitations; full Q parity is not claimed.

All 187 simulation checks, three focused Chrome cases, static build and production smoke pass. New tests cover individual decay and saved continuation, impact refresh, active-window damage without Focus, and visible pip falloff. Export regeneration is byte-identical. The full browser suite was not repeated. Full champion behavior, match systems and pixel fidelity remain unfinished; the production goal remains active.

## Focus attack-release milestone

Focus now increments on a successfully released attack rather than projectile impact. The fourth arrow can unlock Q while still traveling; impact does not duplicate or refresh the stack. Canceled, stunned or invalidated windups grant nothing. This removes travel distance from Q readiness. The source tooltip describes attacks granting Focus, while exact callback mapping remains a documented implementation interpretation pending reference capture.

All 190 simulation checks, four focused Chrome cases, static build and production smoke pass. New regressions cover pre-impact readiness, saved arrows, canceled windups, no duplicate impact stacks and visible pips before damage. The full browser suite was not repeated. Full Q ranks/flurry, specialized attack outcomes, match systems and pixel fidelity remain unfinished; the production goal remains active.

## Additive Ashe Q attack-speed milestone

Q now adds rank-one ratio-scaled attack speed instead of multiplying the whole baseline by 1.4. The exporter pins and verifies Ashe's 0.658 attack-speed ratio and exports the five normal-rank bonus values. Rank one adds 0.1316 attacks/second at early and late levels. HUD and simulation share the calculation. Skill-point allocation, baseline stat quantization/caps, attack reset and complete flurry damage remain unfinished.

All 191 simulation checks, four focused Chrome cases, static build and production smoke pass. New coverage checks level-one/18 absolute bonuses and scheduled periods, while existing saved-duration and animation tests use corrected timing. The HUD shows 0.79 during rank-one Q and returns to 0.66 on expiry. Export regeneration is byte-identical. The full browser suite was not repeated. Full champion, match and pixel fidelity remain unfinished; the production goal remains active.

## Ashe Q aggregate damage milestone

Rank-one Q now captures 110% AD at attack release, using the pinned spell coefficient. In-flight damage remains stable through Q expiry, AD changes, source death and checkpoint restoration; an ordinary arrow is not retroactively empowered by activating Q after release. This remains a single aggregate hit. Five-arrow sequencing, presentation, individual hit interactions and Frost Shot amplification are still required for full parity.

All 194 simulation checks, five focused Chrome cases, static build and production smoke pass. New tests cover normal/empowered armor mitigation, saved in-flight damage, expiry and activation boundaries. The full browser suite was not repeated. Full champion, match and pixel fidelity remain unfinished; the production goal remains active.

## Source-backed Ashe attack projectile speed milestone

Ordinary and empowered attack arrows now travel at 2,500 units/second instead of 2,000. Four pinned spell records agree on fixed-speed movement; their complete records are retained and verified by the new exporter. Champion prototypes currently all use Ashe's stat profile, so the shared champion default receives the correction. Q inter-arrow timing is not exposed in these selected specifications; five-arrow sequencing, effect binding and individual hit behavior remain unfinished.

All 195 simulation checks, all 63 Chrome scenarios, static build and production smoke pass. The new simulation case checks first-tick displacement, expected impact timing and saved continuation for ordinary/empowered arrows. Export regeneration is byte-identical. Full champion, full-match and pixel fidelity remain unfinished; the production goal remains active.

## Frost Shot level-scaled basic slow milestone

Basic attack slows now interpolate from 20% at level one to 30% at level 18 for two seconds, from the pinned standard Ashe passive. Snapshot version 10 stores each victim's applied slow multiplier so later attacker leveling cannot change an existing effect. Movement and animation use the shared speed helper. Non-player prototypes remain level one. Volley/ultimate slow tuning, multiple-effect priority, critical slows, movement caps and passive damage remain unfinished.

All 198 simulation checks, five affected Chrome cases, static build and production smoke pass. The new browser case initially divided by a stationary dummy's zero speed; its fixture now supplies 325 speed, and both simulation and browser checks verify actual speed changes and expiry. Four existing save/run-speed cases passed in the initial run; the corrected Frost Shot case passed on rerun. Export regeneration is byte-identical. The full browser suite was not repeated. Full champion, match and pixel fidelity remain unfinished; the production goal remains active.

## Crystal arrow acceleration milestone

Enchanted Crystal Arrow now starts at 1,500 units/second, accelerates by 200 units/second² and caps at 2,100, using the pinned standard spell movement record. Step integration accounts for acceleration and partial-step arrival at the cap; the existing projectile speed field preserves flight through saves. The complete source record is retained for further stun, splash and vision work. Distance-based stun remains unfinished because the selected record does not expose the required distance threshold.

All 200 simulation checks, four focused Chrome cases, static build and production smoke pass. New cases check integrated distance, speed cap, range expiry, saved continuation and browser presentation updates. Export regeneration is byte-identical. The full browser suite was not repeated. Full champion, match and pixel fidelity remain unfinished; the production goal remains active.

## Crystal arrow moving vision milestone

Crystal Arrow now contributes its source-backed 750-unit sight radius at its current position to the casting team's shared vision sources. The radius follows saved projectile state, persists through caster death, and disappears on removal. Ordinary/Volley projectiles are excluded. Default terrain/brush occlusion and no lingering reveal remain explicit policies pending reference verification.

All 203 simulation checks, three focused Chrome cases, static build and production smoke pass. New checks cover both teams, radius boundaries, movement/removal, saved dead-caster continuation, occlusion and distant-enemy visibility in the browser. Existing structure-vision behavior remains green. Export regeneration is byte-identical. The full browser suite was not repeated. Full champion, match and pixel fidelity remain unfinished; the production goal remains active.

## Crystal arrow splash milestone

Crystal Arrow now damages and applies basic Frost Shot slow to surrounding living enemy non-structure units. The source radius is 400 and area coefficient 1.0; the direct target is excluded from the splash loop and alone receives the primary stun. Lethal direct hits still splash minions. Center-distance geometry and shared damage/slow radius are documented interpretations pending reference calibration. Explosion audiovisual effects, slow priority, distance-scaled stun and full rank/AP behavior remain unfinished.

All 205 simulation checks, three focused Chrome cases, static build and production smoke pass. New cases cover radius/exclusions, mitigation, primary non-duplication, lethal-hit minion splash, saved continuation and browser damage/stun separation. Export regeneration is byte-identical. The full browser suite was not repeated. Full champion, match and pixel fidelity remain unfinished; the production goal remains active.

## Crystal arrow cross-map range milestone

Crystal Arrow now uses its pinned 25,000-unit cast/travel range instead of 10,000. Long-range shots reach targets beyond the former cutoff and retain their remaining range through saves. A terminal-step test exposed a floating-point remainder that extended projectile lifetime by one tick; cleanup now ignores at most 1e-8 world units of residual range while preserving the collision travel bound.

All 206 simulation checks, four focused Chrome cases, static build and production smoke pass. Coverage includes source acceleration through full range, exact terminal removal and saved/browser hits at 15,000 units. Export regeneration is byte-identical. The full browser suite was not repeated. Distance-scaled stun, full champion, match and pixel fidelity remain unfinished; the production goal remains active.

## Crystal arrow distance-stun milestone

Direct-hit stun now follows distance × 0.00125 seconds clamped to the source-backed 1–3.5-second bounds. The coefficient comes from a first-hand technical analysis with calibrated map comparison, separately attributed in the source pin and ASHE-R.md. Consumed range and fractional sweep contact supply traveled distance, so caster movement cannot change it. Our exact 60 Hz expiry does not reproduce the report's coarse live buff expiry; observed lifetime parity remains unverified.

All 208 simulation checks, seven focused Chrome cases, static build and production smoke pass. New checks cover curve breakpoints/cap, caster movement, saved flight and exact expiry; the long-range browser test verifies 210 ticks at impact. Export regeneration is byte-identical. The full browser suite was not repeated. Full champion, match and pixel fidelity remain unfinished; the production goal remains active.

## Spellbook-selected Volley milestone

Volley now uses the main spell selected by Ashe's character root: seven rank-one arrows, 60 + 100% bonus AD damage and 1,500-unit/second projectile speed. This replaces provisional nine-arrow, total-AD scaling and 1,800-speed behavior. Root selection and complete main/missile records are pinned and verified, avoiding unused older rank records. Spread geometry, hit width, casting windup, enhanced slow and rank allocation remain unfinished.

All 210 simulation checks, two focused Chrome cases, static build and production smoke pass. New coverage checks level/base-AD separation, item bonus scaling, arrow count/speed, saved cast damage and one hit per target. Export regeneration is byte-identical. The full browser suite was not repeated. Full champion, match and pixel fidelity remain unfinished; the production goal remains active.

## Volley enhanced-slow milestone

Volley champion hits now apply source-backed 40–60% enhanced slow strength, easing to ordinary Frost over a one-second policy window. A separate component prevents a subsequent basic attack from erasing the enhanced decay. Non-champion Volley hits use ordinary level-scaled Frost. Snapshot version 11 validates and preserves the component; respawn clears it. Source tooltips support the enhancement/decay behavior, while exact linear timing remains pending reference capture.

All 213 simulation checks, five focused Chrome cases, static build and production smoke pass. New checks cover level endpoints, decay/tail/expiry, saved continuation, subsequent basic hits and malformed component bounds. Export regeneration is byte-identical. General slow priority, critical basic attacks, movement caps and full champion/match/pixel fidelity remain unfinished; the production goal remains active.


## Hawkshot ammunition milestone

Hawkshot now stores two charges with a five-second cast delay and serial 90-second rank-one recharge, replacing its provisional 45-second single cooldown. Spending the second charge does not restart recharge; death and respawn preserve it. Snapshot version 12 validates and saves charge count/deadline. The HUD displays ammunition, recharge progress and actual cast availability; practice reset restores both charges. Complete selected spell/tooltip records are pinned, and the verified exporter excludes nonstandard rank entries. [Hawkshot evidence and remaining scope](ASHE-E.md).

All 218 simulation checks, all 71 Chrome scenarios, static build and production smoke pass. Five new simulation cases cover serial recharge, boundary ordering, rejection, recall, death/respawn, save continuation and malformed state. Browser coverage exercises actual keyboard casts, charge/countdown display, accessible feedback and practice reset; charge-state screenshots were visually inspected. Export regeneration is byte-identical. These are local checks, not reference timing or pixel-parity certification.

Hawkshot still needs travel, range enforcement, complete vision geometry/persistence, cast windup and audiovisual fidelity. Starting charges and recharge event ordering remain documented policies pending reference capture. Passive research also confirmed that the pinned zero-crit calculation does not justify adding an old flat Frost Shot amplification; crit-stat support remains missing. Full champion, match and pixel fidelity remain unfinished; the production goal remains active.


## Hawkshot flight milestone

Hawkshot now travels at the source-backed 1400 units/second toward a target clamped to 25000 units, grants moving team sight and creates a separate five-second destination reveal on arrival. It passes through units and terrain without damage. Multiple flights/reveals coexist and survive caster death and saved continuation. Typed scouting areas remain visible to queries that intentionally exclude attack-reveal feedback. Snapshot version 13 preserves the new projectile and area kinds.

All 222 simulation checks, nine focused Chrome cases, static build and production smoke pass. New cases cover flight distance, endpoint/range/expiry boundaries, collision exclusion, team sight, multiple scouts, death and saved continuation. Browser checks confirm visible flight, frozen wing pose while paused, distant enemy reveal and re-hide, model cleanup and existing charge feedback. Screenshots were inspected; the final silhouette uses indexed triangles without adding a polygon triangulation dependency. Export regeneration is byte-identical. The full Chrome suite was not repeated for this milestone.

The bird is an authored temporary proxy, and sight retains the earlier provisional 650 radius. Lingering trail vision, source cast windup, reference geometry, minimap targeting and original audiovisual effects remain unfinished, as detailed in [ASHE-E.md](ASHE-E.md). Full champion, match and pixel fidelity remain unfinished; the production goal remains active.


## Minimap targeting milestone

E and R now aim and cast from minimap world coordinates without moving the camera, using their verified source flags. A shared conversion keeps map navigation and casting aligned. Pointer transitions no longer retain stale battlefield aim over HUD panels; unsupported minimap spells submit no cast. Right-click minimap movement and Escape cancel held targeting. Heal only picks a hovered unit on the battlefield canvas. The controls panel documents minimap spell use.

All 222 simulation checks, 16 focused Chrome scenarios, static build and production smoke pass. Four new browser scenarios cover full-Rift E/R direction and endpoint, laptop geometry, unchanged camera, surface transitions, unsupported spells and cancellation; existing controls and ally Heal remain passing. Both source exports regenerate byte-identically. Full Chrome coverage was not repeated. Alternate cast modes, broader champion systems and full match/pixel fidelity remain unfinished; the production goal remains active.


## Effective movement-speed readout milestone

The HUD now displays the same effective speed used by movement and run playback, including active slows, enhanced decay and Heal haste. Whole-number display uses six-decimal normalization before rounding, preventing a binary-noise error at the 227.5 midpoint. Stored speed and movement calculations are unchanged.

All 222 simulation checks, three focused Chrome scenarios, static build and production smoke pass. Browser checks cover a real attack slow, Heal composition, expiry and the enhanced-slow midpoint; existing run-playback coverage remains passing. Full Chrome coverage was not repeated. Movement soft caps, exact reference rounding, full champion/match systems and pixel fidelity remain unfinished; the production goal remains active.


## Hawkshot original-effect source recovery

Recovered the three base Hawkshot effect definitions directly from the pinned Ashe archive after their linked JSON URLs proved unavailable. The flight effect explicitly uses an animated hawk mesh in three material/trail layers, alongside glow, wind, dust and smoke; this provides a concrete replacement path for the current procedural bird. Complete decoded records and 21 required files are pinned with archive/chunk/file provenance. The reproducible extractor checks the base skin's resource selection, linked binaries, records and asset closure using minimal pinned name tables.

All 21 source files re-extract and verify: 907,219 output bytes from 468,831 compressed patch bytes. The generalized archive reader also revalidated all 40 existing base-structure files through its default Map11 path. No runtime files changed, so gameplay/browser tests were not repeated. Conversion, layered rendering, original animation/effects and reference visual comparison remain outstanding; the production goal remains active.

## Hawkshot source-body milestone

Replaced the procedural two-wing proxy with the pinned Owl1 mesh, texture, five-bone rig and original 1.333333-second flight animation. The reproducible converter verifies all 21 recovered source files and emits a 73,856-byte, 642-triangle GLB plus provenance manifest. Each scout has its own skeleton and mixer while sharing geometry/material/texture. Snapshot version 14 requires a launch tick so separate casts, pause and restored flights retain the correct local animation phase. Removal releases private skeleton GPU resources without destroying shared assets.

All 223 simulation checks, all 79 Chrome scenarios, static build and production smoke pass. All 16 model GLBs and the map validate with zero errors or warnings. GLB and manifest regeneration are byte-identical. New browser coverage checks independent phases, shared resources, pause, restored pose, resumed motion and disposal; simulation coverage rejects malformed launch ticks. Flight screenshots were inspected: the body is faint and can be occluded by scenery.

This implements only the original body layer. Normal alpha blending and transform interpretation remain provisional; reflection, mesh trails, glow, wind, dust, smoke, arrival/linger effects and audio are unfinished. Exact reference appearance, full champion/match systems and performance targets remain outstanding; the production goal remains active. See [Hawkshot evidence and scope](ASHE-E.md).

## Hawkshot blend-state milestone

The Owl1 body now uses alpha-weighted additive blending instead of the previous normal-alpha approximation. Its source mode 4 is retained in GLB material extras and restored explicitly by the runtime. This follows DAKA's pinned engine dictionary factor table; the older guide's conflicting shorthand and a texture census that cannot establish pipeline state are documented separately. Independent 16.18 GPU capture remains absent. The screenshot shows a brighter, more legible bird, but missing particle layers and exact visual calibration remain unresolved.

All 223 simulation checks, four focused Chrome cases, asset validation, static build and production smoke pass. The new GPU readback case verifies additive color over two backgrounds and the black-source identity within byte quantization, using the loaded material's blend state. GLB and manifest regeneration are byte-identical; the additional material metadata brings the GLB to 73,888 bytes. The full browser suite was not repeated after the previous milestone's 79 passing scenarios. Full champion/match systems, complete effects and pixel fidelity remain unfinished; the production goal remains active.

## Hawkshot Fresnel-layer milestone

Added the source Owl2 Fresnel rim alongside Owl1, using its black birth color, color-hold texture, 0.05 exponent and authored rim RGB. The shader follows a pinned published transcription of Riot's reflective mesh shader: compute the rim at vertices from camera direction and transformed normals, then add its alpha-weighted contribution before blending. This is attributed evidence, not our own bytecode or reference-pixel verification. No cubemap behavior was inferred from the reflection-definition name.

The converter retains normals and the source constant texture, emits two primitives sharing source attributes, and produces an 80,440-byte GLB. Ordinary unlit pruning removed necessary normals; the GPU test also exposed Three's default transparent back-face normal inversion, resolved by the source's single-pass culling-disabled behavior. Existing per-cast animation, shared resources and private skeleton disposal remain intact.

All 223 simulation checks, six focused Chrome cases, asset validation, static build and production smoke pass. New checks cover both layers' source normals and synchronized poses, numerical camera/object/alpha-dependent Fresnel output, and exact framebuffer restoration after graphics loss with a hawk in flight. GLB and manifest regeneration are byte-identical. Flight and recovery screenshots were inspected; the combined bird is substantially brighter, with final tone/orientation still pending reference calibration. The full Chrome suite was not repeated. Remaining particle layers, full champion/match systems and pixel fidelity remain unfinished; the production goal remains active.

## Hawkshot wind asset milestone

Prepared the source WindTunnel mesh, color texture and erosion texture for particle playback. The exact source SCB has 96 vertices, 124 triangles and eight vertex-alpha values; the exported GLB expands face corners to preserve UV seams and retains source topology, color bytes and centimeter scaling. Complete source emitter parameters and provenance accompany the assets. The main GLB is 41,400 bytes; the external erosion PNG is 150,143 bytes.

All 17 model GLBs and the map validate with no errors or warnings. Lossless decoded-texture checks, GLB roundtrip geometry/color/texture checks and byte-identical regeneration pass. An isolated Chrome preview rendered the original curved mesh and fading texture without errors, verified all vertex-alpha values and vertex-color activation, and was visually inspected. Auxiliary erosion hash/size verification is now part of asset validation. Gameplay code did not change, so simulation and full browser suites were not repeated.

This completes asset preparation only. Wind emission, random sampling, motion/drag, erosion and post-arrival particle lifetimes still require implementation; current gameplay still shows Owl1 and Owl2. Full effects, champion/match systems and pixel fidelity remain unfinished; the production goal remains active.

## Hawkshot wind playback milestone

Integrated the source WindTunnel as a single instanced draw with deterministic emission, independent birth sampling, rotation/scale, vertex-alpha envelope, analytic drag and green-channel erosion. The shader uses the pinned class defaults and published two-ramp interpretation. Snapshot version 15 requires the flight origin and retains launch/arrival trajectory data on scouting areas, allowing particles to survive the bird's arrival and reconstruct after a save. Natural lifetime and shutdown cap limit tails; the reusable allocation submits zero instances once they expire.

All 225 simulation/source-state checks, 11 focused Chrome cases, asset validation, static build and production smoke pass. Coverage includes bounded deterministic sampling, arrival/expiry, saved trajectory validation, frozen instance transforms, restored tail state, graphics-loss pixel equality, and a GPU readback of the linear-green erosion ramp. Wind assets, manifest and generated parameters rebuild byte-identically. Flight/tail screenshots were inspected on an open lane. The full Chrome suite was not repeated.

The wind remains subtle and reference visual calibration is still needed. Exact RNG, emission phase, drag integration, placement/height and shutdown semantics are explicitly attributed or local policies in ASHE-E.md; passing tests prove our reconstruction is consistent, not complete League parity. Remaining Hawkshot layers, champion/match systems and pixel fidelity remain unfinished; the production goal remains active.


## Pinned base Ashe milestone

Replaced the archived champion GLB with the base skin mesh, rig, texture and complete atomic clip set from the pinned 16.18 Ashe archive. The reproducible extractor verifies 27 files, both binary definition records and all 25 atomic mappings. The new GLB is 3,953,864 bytes, with 7,406 triangles, 85 bones and 25 clips. Source skin scale 1.1 is now applied consistently; zero-weight joint slots are canonicalized without changing contributing weights. The retired runtime asset is removed and its provenance retained under docs/reference.

The comparison establishes identical topology counts and texture dimensions, differing decoded texture bytes, a scale/X-reflection difference between converters, and a source attack duration of 2.100000 seconds versus the archive's 2.133333 seconds. These findings do not independently establish reference-pixel orientation or lighting parity. Existing animation state selection remains in use; graph transitions, events, Recall sequencing and gait selection are unfinished.

All 225 simulation checks, all 85 Chrome scenarios, asset validation, production build and production smoke pass. The loading-recovery test now intercepts the new asset name and explicitly proves its request was blocked; that corrected case also passed separately. All 17 model GLBs and the map validate without errors or warnings. GLB and manifest regeneration are byte-identical. Practice and production Rift screenshots were inspected. The earlier page-creation timeout did not recur in the completed suite.

This replaces the archived source dependency; full champion/match systems, remaining effects, lighting/capture calibration and performance targets remain outstanding. The production goal remains active. See [the Ashe asset pipeline](ASSETS.md#pinned-base-ashe).


## Ashe recall sequence milestone

Replaced the looping Channel approximation with the source Recall sequence, Idle5 followed by Idle2 at their original clip durations. Rendering seeks from the simulation recall deadline, so late frames, pause and restored rigs retain the same phase. Cancellation, restart, completion, damage and death release or reset the recall pose correctly. Simulation and rendering share the existing eight-second duration; gameplay timing and snapshot schema are unchanged.

All 226 simulation/source checks, six distinct focused Chrome scenarios, production build and production smoke pass. Tests verify the sequence against the binary-verified graph, both stages and exact paused/restored bone transforms, plus attack/death/run regressions. Both recall stage screenshots were inspected. The full browser suite and asset validation were not repeated; assets did not change.

Native transition blending, recall VFX/audio and reference-pixel calibration remain unfinished. The complete production goal remains active. See [recall evidence and playback scope](ASHE-RECALL.md).


## Ashe empowered attack animation milestone

Q attack cycles now select the source Spell1 clip instead of ordinary Attack1. The exporter verifies the spell's animation field against the existing pinned source and base graph. Cycle creation captures animation empowerment once; later buff changes do not switch a running clip. Snapshot version 16 preserves that flag and rejects missing/non-boolean flags or empowered minion rigs. Existing cycle-based playback timing, cancellation and death behavior remain intact.

All 229 simulation/source checks, 14 distinct focused Chrome scenarios, production build and production smoke pass. Browser coverage checks normal and empowered phases, pause, exact restored bone transforms after expiry, Q behavior, recall, death, cancellation and checkpoint compatibility. Both attack screenshots were inspected after correcting the capture's loading-overlay wait. Q parameter regeneration is byte-identical. The full browser suite and unchanged asset validation were not repeated.

The Q flurry still uses aggregate projectile damage. Five-arrow sequencing, source release-frame alignment, activation/reset behavior, complete spell cast timing and pixel calibration remain outstanding. This milestone does not complete the production goal. See [Q evidence and scope](ASHE-Q.md#source-empowered-attack-animation).


## Q attack-reset milestone

Successful Q activation now resets the attack timer, supported by the pinned spell tag and Riot's patch 9.19 notes. It replaces an unreleased windup or recovery while retaining the current order/path and preserving already released arrows. The next eligible attack starts empowered on the activation tick. Idle/movement and rejected casts do not acquire unintended attacks or reset valid cycles.

All 233 simulation checks, nine focused Chrome scenarios, production build and production smoke pass. Coverage includes both reset phases, preserved projectile damage, exact saved continuation, rejected casts, movement, idle and the source animation restart. The reset screenshot was inspected and Q parameter regeneration is byte-identical. The full browser suite and unchanged asset validation were not repeated.

Same-tick ordering and precise native release-frame alignment still need reference calibration. Q activation animation, five-arrow flurry and complete spell cast timing remain unfinished; the production goal remains active. See [the reset evidence and semantics](ASHE-Q.md#q-attack-reset).


## Ashe cast-timing source audit

Added a reproducible join of the four spellbook-selected source records, base animation graph and shipped GLB. The checked profile preserves absent fields and distinguishes declared cast time, animator-frame selection, cast frame, cancellation flags and full clip duration. It exposes E's different frame value/absent animator flag and Q's special reset/flags despite the shared declared 0.25-second value. These findings prevent a generic delay or full-clip movement lock from being mistaken for verified native timing.

The audit verifies all source/definition/model hashes and all four graph mappings, and regenerates byte-identically. Runtime files and assets did not change, so gameplay, browser and asset suites were not repeated. W/E/R still launch immediately; pending cast state, release epochs, deferred orders, interruption semantics and reference capture checks are specified in [the casting implementation requirements](ASHE-CASTING.md). This is a research milestone, not completed cast playback; the full production goal remains active.


## Volley windup milestone

Volley now stores a pending cast and releases its seven arrows after the source's 0.25-second/15-tick windup. Mana/cooldown and damage are captured once at acceptance. Movement and attack advancement wait until release; retained orders resume afterward. An unreleased attack is cancelled, stun preserves an accepted cast, and death/match completion clear it. The source Spell2 pose seeks from simulation timing and survives pause and a fresh saved rig. Snapshot version 17 validates the pending deadline, ability and living/active state.

All 237 simulation checks, all 90 Chrome scenarios, production build and production smoke pass. Existing Volley tests now measure first travel from release while retaining damage, speed and remaining-distance assertions. New tests cover deferred movement, single spending/release, interrupted attacks, stun/death, restricted spell input, invalid snapshots and exact restored pose. The windup screenshot was inspected. W parameter generation is byte-identical; unchanged asset validation was not repeated.

This first windup implementation covers W only. During windup Heal remains available; other abilities and recall are rejected rather than buffered. Those interaction policies, cast-start damage/cooldown sampling, refunds and precise native frame alignment remain capture-calibration work. Full post-release animation recovery and E/R windups remain outstanding. The production goal remains active. See [casting evidence and implementation](ASHE-CASTING.md#volley-windup-implementation).


## Enchanted Crystal Arrow windup milestone

R now uses the saved pending-cast path, spending resources once and releasing after its verified 0.25-second windup. Rendering seeks the source Spell4 pose. Snapshot version 18 supports both W and R with source-selected duration validation. Existing movement/attack deferral, stun/death and restricted spell-input policies apply to both.

All 241 simulation checks, 15 focused Chrome scenarios, production build and production smoke pass. Shared windup coverage now exercises both spells, including no early missile, one release, saved continuation, frozen/restored bones and interruption rules. R flight fixtures use actual release as their epoch while retaining acceleration, range, splash, collision, sight and stun assertions. Minimap aiming/release passes. The source-pose screenshot was inspected and R parameter regeneration is byte-identical. The full browser suite and unchanged asset validation were not repeated after the prior 90-case full pass.

Hawkshot windup, full post-release animation, general spell buffering/Flash interactions and exact native frame calibration remain unfinished. R damage still uses the prior 200 baseline pending rank/AP work. The production goal remains active. See [R windup evidence and scope](ASHE-CASTING.md#enchanted-crystal-arrow-windup).


## Hawkshot windup milestone

E now uses the saved 15-tick pending-cast path and source Spell3 pose. Charges/cooldown/recharge are committed at acceptance; the scout is created only at release, giving flight animation, moving vision and wind particles their actual launch epoch. A shared source-profile lookup serves simulation, rendering and snapshot validation. Snapshot version 19 supports all W/E/R pending casts. Death before release cancels the scout without refunding its charge.

All 245 simulation checks, 18 focused Chrome scenarios, production build and production smoke pass. Shared tests cover E movement/attack lock, retained orders, stun/death, pending restoration and single charge spending. Existing flight, charge, vision, independent-rig, graphics-recovery, erosion and tail assertions pass after shifting fixtures to actual release. Tail expiry is measured relative to arrival. The source windup screenshot was inspected and E parameter generation is byte-identical. The full browser suite and unchanged asset validation were not repeated.

E uses its declared cast time; its distinct source castFrame and absent animator flag remain documented rather than collapsed into a universal timing formula. Exact native animation scaling, post-release recovery, complete spell buffering/Flash interactions, refund policy and pixel parity remain unfinished. The production goal remains active. See [Hawkshot windup and flight epoch](ASHE-CASTING.md#hawkshot-windup-and-flight-epoch).

## Spell recovery animation milestone

W/E/R now retain a saved animation epoch after their projectile releases. An idle Ashe finishes the selected source clip instead of snapping back to idle at 0.25 seconds. Movement and attacks resume at the existing deadline; subsequent orders, stun, death, recall, Q/Flash and replacement spells cancel recovery permanently. Heal preserves it. Snapshot version 20 validates presentation identity against any pending cast and restores its phase independently of renderer history.

All 249 simulation checks, 18 focused Chrome scenarios, production build and production smoke pass. The production screenshot was inspected. Browser assertions cover release, 0.6-second recovery, pause, fresh-rig saved restoration and eventual idle for all three spells. Adjacent attack, Q reset, recall, manual-save and graphics-recovery scenarios pass. The full browser suite and unchanged asset validation were not repeated. Native blend-graph transitions, E animation-speed/release-frame calibration and complete spell-input semantics remain unfinished; this milestone does not establish pixel parity. The production goal remains active. See [recovery behavior and limits](ASHE-CASTING.md#post-release-animation-recovery).

## Hawkshot background glow milestone

The scout now includes the two original background-glow emitters with the pinned source texture, colors, offsets, delays and pass values. A reproducible TEX export records original emitter data and source/output/pixel hashes. One shared 23,194-byte PNG serves both layers; geometry and materials survive individual scout disposal. Flight age drives delayed visibility across pause and saved restoration.

All 250 source/simulation checks, eight focused Chrome scenarios, production build and production smoke pass. New browser checks cover timing, restored layer state, shared resources and each layer's GPU pixel contribution; adjacent Hawkshot rig, Fresnel, wind and context-loss checks pass. The flight screenshot was inspected and asset generation is byte-identical. No GLBs changed, so their validation and the full browser suite were not repeated.

This adds source artwork with explicitly documented rendering interpretations; it does not establish native pixel parity. Quad orientation, uniform scaling, atlas defaults and culling still need capture calibration. Owl3, dust/smoke, endpoint VFX, sound and the broader production scope remain incomplete. See [source glow evidence and limits](ASHE-E.md#source-background-glow-layers).

## Hawkshot Owl3 particle milestone

The scout now emits the pinned Owl3 mesh particles: 10 per second, approximately 0.3-second lifetime, downward motion, independently animated poses and a fading blue Fresnel rim. The exporter verifies exact asset-field agreement with the shipped Owl2 layer, so this adds no model or texture downloads. Full binding follows the scout horizontally and holds at its destination while existing particles expire. At most four reusable rig/material slots per flight prevent per-birth GPU allocations; private resources are released after the tail.

All 253 source/simulation checks, nine focused Chrome scenarios, production build and production smoke pass. New coverage checks bound motion, source identity, lifetime, stateless pose restoration, independent animation, pooling, disposal and arrival cleanup. Existing Hawkshot graphics-loss pixel checks and neighboring glow/wind/Fresnel scenarios pass. The screenshot was inspected and source parameter regeneration is byte-identical. The full browser suite and unchanged GLB validation were not repeated.

Native emission phase, particle animation phase, binding/shutdown semantics and exact pixel calibration remain unresolved. Dust, smoke, endpoint effects, audio and the broader production scope remain unfinished. The production goal remains active. See [Owl3 source values and adapter policies](ASHE-E.md#owl3-bound-mesh-particles).

## Hawkshot dust/smoke source preparation milestone

Prepared the original four-cell dust and smoke atlases and the red-channel smoke erosion texture. The exporter verifies archive-source hashes, preserves decoded RGBA exactly, records individual atlas-cell pixel hashes and retains missing source fields as null. The three PNGs total 106,414 bytes; no renderer requests or visual behavior change yet.

All 254 source/simulation checks and the production build pass. The three images were inspected; source export is byte-identical, and the built static files match the verified outputs. Browser gameplay and unchanged GLB checks were not repeated for this asset-only step.

Playback requirements now explicitly include instanced atlas quads, dust orbital/box-space calibration, source erosion UV/default semantics, smoke depth intersection fading and saved deterministic particle reconstruction. These emitters remain unimplemented; this preparation is not a claim of completed effects or native pixel parity. The full production goal remains active. See [sprite preparation and required playback](ASHE-E.md#dust-and-smoke-sprite-preparation).

## Hawkshot Dust playback milestone

The original four-cell dust atlas now renders through one reusable instanced draw. Source-selected rate, randomized lifetimes, size/growth, rotation, color, velocity, drag and orbital ranges feed deterministic birth reconstruction. Camera-facing quads carry independent frame and alpha attributes without shared texture-offset mutation. Existing saved flight trajectories also reconstruct dust after arrival and let its tail expire. The atlas adds 10,401 requested bytes; smoke assets remain unused.

All 257 source/simulation checks, nine focused Chrome scenarios, production build and production smoke pass. Tests cover stable source sampling, motion covariance, saved instance equality, tail cleanup, draw reuse and actual GPU pixels for four distinct cells and alpha fading. Adjacent Hawkshot graphics-loss, Fresnel, body, wind and Owl3 scenarios pass. The screenshot was inspected and parameter export is byte-identical. The full browser suite and unchanged GLB validation were not repeated.

The implementation retains explicit provisional policies for half-extents, orbital units/order, unbound motion, birth phase, local randomness and fixed-step integration. These require native capture calibration before pixel/motion parity can be claimed. Smoke erosion/intersection fading, endpoint VFX, audio and the broader production goal remain incomplete. See [dust playback and evidence](ASHE-E.md#dust-atlas-playback).

## Hawkshot smoke and depth-fade milestone

Smoke_Trail now renders its original four-cell texture with randomized source lifetimes/scales, fade-in/out alpha, red-channel erosion and soft geometry intersections. A scene-depth pass runs only while smoke is active, preserves depth-writing material behavior and refreshes animated skeletons before capture. The latter fixes a first-frame stale-depth mismatch without relaxing exact pixel assertions. Depth targets resize, survive reconstruction and release after the tail or graphics loss. Existing flight trajectory state supplies saved continuation without a snapshot change.

All 259 source/simulation checks, 13 focused Chrome scenarios and the production build pass. GPU tests verify red erosion, smoothstep fade at controlled depth gaps, resize and target disposal. Existing Hawkshot and general recovery scenarios pass, including exact post-context-loss pixels. A production-only real-input Hawkshot cast consumed its charge and produced no console/request errors; fixture and production screenshots were inspected. Parameter regeneration is byte-identical. The full browser suite and unchanged GLB validation were not repeated.

All eight pinned flight emitters now have rendering adapters. This is not complete native visual parity: omitted defaults, RNG/phase/motion, source color interpretation, endpoint VFX and sound remain calibration/implementation gaps. The extra full-scene depth draw while smoke is active is a material performance cost and requires optimization against the production target. The full goal remains active. See [smoke and soft-intersection evidence](ASHE-E.md#smoke-trail-and-soft-intersections).

## Offscreen smoke depth-cost milestone

Smoke now tests conservative bounds for its complete instance quads before capturing scene depth. Fully offscreen effects skip both their draw and the additional scene pass. Initial offscreen rendering allocates no depth target; camera re-entry reuses an existing target while particles remain alive. Partial quads at the viewport edge are retained, and normal expiry/graphics-loss disposal remains intact.

All 259 source/simulation checks, eight focused Chrome scenarios, production build and a production real-input Hawkshot cast pass. New browser evidence confirms zero depth captures while offscreen, target reuse, exact camera-away/back pixel equality and correct partial-edge visibility. Existing soft-fade/erosion, resize, tail and context-loss pixel checks pass. The full browser suite and unchanged asset validation were not repeated.

Visible smoke still requires an additional full-resolution scene pass. Aggregate conservative bounds can retain a capture when separate offscreen groups straddle the viewport, so this is not the final depth optimization. Native visual calibration, endpoint effects, sound and the broader production scope remain unfinished. The goal remains active. See [offscreen culling behavior](ASHE-E.md#offscreen-smoke-depth-culling).

## Cropped smoke depth rasterization milestone

Visible smoke now captures depth only within conservative projected instance bounds, with outward rounding and a two-pixel margin. Near-plane crossings retain a full-frame fallback, and empty projected regions skip capture. Render-target scissor coordinates are physical pixels, preserving high-density display behavior. Texture resolution and effect shading remain unchanged.

All 261 source/simulation checks, nine focused Chrome scenarios, production build and a production real-input Hawkshot cast pass. The new browser comparison proves exact cropped/full final pixels at device pixel ratios 1 and 2 while the fixture capture covers less than one quarter of the framebuffer. Edge/fallback unit checks and neighboring smoke/graphics-loss scenarios pass. This saves rasterized area but does not reduce geometry submission or full-resolution target memory; those remain optimization opportunities. The full browser suite and unchanged asset validation were not repeated.

Native visual calibration, endpoint effects, audio and the broader production scope remain unfinished. The goal remains active. See [cropped depth behavior and evidence](ASHE-E.md#cropped-smoke-depth-capture).

## First Hawkshot endpoint Aurora milestone

Hawkshot now starts the pinned endpoint Aurora at its saved arrival tick. The original 128×128 texture adds 7,562 bytes; authored dimensions, emitter rotation, birth/color alpha, randomized short lifetime and upward velocity/drag feed a deterministic saved-age adapter. The burst fades independently of the five-second scouting reveal. Shared geometry/texture survive burst expiry; private opacity materials are released.

All 263 source/simulation checks, six focused Chrome scenarios, production build and a production real-input Hawkshot cast pass. New coverage checks arrival-only birth, pause, fresh restoration, lifetime cleanup, ongoing scouting and actual pixels. Visual inspection caught an unsupported incoming-flight yaw making the arbitrary quad edge-on; world-axis endpoint placement now retains only the authored emitter rotation. The inspected capture and byte-identical export are recorded in the effect documentation. The full browser suite and unchanged GLB validation were not repeated.

This is the first of five explosion emitters. Remaining explosion layers, all lingering layers, audio and native placement/phase/drag/RNG calibration remain unfinished, along with the broader production goal. See [endpoint Aurora evidence and limits](ASHE-E.md#first-endpoint-aurora-layer).

## Endpoint glow color-ramp preparation milestone

Verified the two endpoint glow emitters and decoded their shared 64×64 color-ramp texture. The 277-byte PNG preserves all RGBA pixels; its identical rows are also recorded as 64 exact samples. The source evidence shows opaque alpha throughout and a black-to-bright-to-black RGB ramp, separate from each emitter's authored alpha fade. Both glows reuse the existing base texture but have different uniform X scales (540/140 units).

All 264 source/simulation checks and the production build pass. The ramp was inspected, regeneration is byte-identical, and the built file matches the verified output. Browser and GLB checks were not repeated because runtime behavior is unchanged. The new ramp is not loaded by the renderer yet.

Emission phase, missing-primitive orientation and native ramp sampling/color space remain documented calibration questions. These two glow layers remain unimplemented, as do other endpoint/lingering effects, sound and substantial broader gameplay work. The goal remains active. See [glow ramp evidence](ASHE-E.md#endpoint-glow-ramp-preparation).

## Endpoint glow playback milestone

Both source endpoint glow layers now render with their distinct 540/140-unit uniform scales, exact RGB-ramp samples and independent alpha fade. They reuse the cached glow texture and geometry, derive deterministic variation and age from the saved flight, and release private materials on removal or expiry. No new texture request, gameplay rule or snapshot field is needed.

All 265 source/simulation checks, four focused Chrome scenarios, production build and a real-input production Hawkshot cast pass. Tests verify generated-source agreement, birth timing, paused/restored state, each layer's independent pixel contribution, expiry and material disposal. Profile regeneration is byte-identical; fixture and production screenshots were inspected. The full browser suite and unchanged GLB validation were not repeated.

Three of five explosion emitters now have rendering adapters. Rate-accumulator birth phase, camera-facing default orientation, full source rotation semantics, random distribution and native color interpretation remain explicit playback assumptions pending reference captures. DarknessFollow, radial smoke, all four linger emitters, sound and the broader production match remain unfinished. The full goal remains active. See [endpoint glow playback evidence](ASHE-E.md#endpoint-glow-playback).

## Endpoint DarknessFollow milestone

Hawkshot now renders its delayed single wispy endpoint particle with the source lifetime probability kink, randomized drift/scale/frame, birth alpha, lifetime fade and blue-channel erosion. It reuses the smoke atlas and WindTunnel's distinct erosion pack without new texture downloads. Source evidence and generated parameters are pinned, and private particle materials are released on removal or expiry.

All 267 source/simulation checks, four focused Chrome scenarios, production build and a real-input production Hawkshot smoke test pass. The new browser scenarios were repeated after adding an isolated capture. Controlled GPU coverage confirms blue-channel selection and full/half/zero erosion; state tests cover delay, pause, fresh restore and cleanup. Both generated files reproduce byte-identically. Combined and glow-hidden screenshots were inspected; the wispy particle is visible but subtle under the bright burst. The full browser suite and unchanged GLB validation were not repeated.

Four of five explosion emitters now have adapters. Radial smoke, four lingering layers, sound, native orientation/timing/shader calibration and the broader full-match objective remain incomplete. The goal stays active. See [DarknessFollow evidence and policies](ASHE-E.md#endpoint-darknessfollow-layer).

## Endpoint radial smoke milestone

The final explosion emitter now plays through one instanced smoke batch. It preserves the rising source rate, animated alpha rather than the distinct constant field, lifetime/velocity ranges, source scale growth, random atlas cells and horizontal drag. The adapter derives 50 births from the integrated rate curve, and saved arrival time restores every particle's phase. Existing smoke textures are reused; no image transfer or snapshot format change is needed.

All 269 source/simulation checks, five focused Chrome scenarios, production build and a real-input production Hawkshot smoke test pass. Tests cover source agreement, emission schedule, motion, alpha, pause/fresh restoration, actual pixels, expiry and batch reuse. Both generated files reproduce byte-identically and the fixture screenshot was inspected. The full browser suite and unchanged GLB validation were not repeated.

All five explosion emitters now have adapters. Normalized spawn curves, analytic integration, inclusive final birth, radial velocity coupling, orientation/default pass policies and native visual matching remain explicitly unverified. Four lingering layers, audio and the broader production match remain incomplete. The goal remains active. See [radial smoke evidence and assumptions](ASHE-E.md#endpoint-radial-smoke).

## Lingering effect source and dependency milestone

Prepared the complete four-emitter lingering effect and both missing textures. Lossless multiplication-band and sparkle PNGs total 3,501 bytes. Source/output/pixel hashes are pinned, and the skin-named erosion dependency is verified byte-identical to the existing base pack. Profiles retain missing fields explicitly, including Aurora's absent constant lifetime and the snow layers' different scale/orientation policies.

All 271 source/simulation checks and the production build pass. Both images were inspected, regeneration is byte-identical, and built images match the verified outputs. Browser and GLB checks were not repeated because runtime behavior and models are unchanged. The new textures are not requested by the renderer yet.

The audit identified a concrete playback dependency: the current scouting record expires at five seconds, while authored snow emission and active particle lifetimes permit tails beyond that point. The next implementation must preserve visual descriptors independently of vision expiry, with save/restore and no extra gameplay sight. Native shutdown behavior, texture-multiply semantics and orbital/cylinder defaults remain unresolved. Four lingering layers, sound and the full production objective remain unfinished. See [source evidence and lifecycle boundary](ASHE-E.md#lingering-effect-preparation-and-lifecycle-boundary).

## Independent saved scout visual lifetime milestone

Hawkshot arrival now records a presentation-only descriptor independently of its gameplay vision area. Emission stop uses the five-second reveal deadline; descriptor retirement allows one additional second for the maximum sustained-particle life. Sight, target validation and bot perception continue using the original vision sources. Snapshot version 21 preserves these descriptors and strictly validates identity, timing and expiry; version 20 is intentionally incompatible.

All 274 source/simulation checks, eight focused Chrome scenarios across endpoint rendering and checkpoint storage, production build and a real-input production Hawkshot smoke test pass. New tests cross the exact vision deadline, reject attacking a now-hidden target while the descriptor survives, restore during the tail and compare state through retirement. The browser saves/reloads the tail through IndexedDB without restoring expired vision. Existing save failure/incompatibility behavior still passes. The full browser suite and unchanged GLB validation were not repeated.

This supplies lifecycle state for the next rendering step; it does not yet display the four lingering layers. Capping source emission at the scouting deadline is a documented local policy pending native comparison. Sound, native effect semantics and the broader production match remain unfinished. The full goal stays active. See [saved presentation lifetime](ASHE-E.md#saved-presentation-lifetime).

## First sustained Sparkle playback milestone

Sparkle now renders from the independent saved visual descriptor, using its prepared full-image sprite, source uniform X size, triangular size curve, independent alpha fade, randomized spawn offsets and downward drift. The final particles finish after sight expires. Geometry/texture are shared; private materials are disposed when particles expire or become excluded by visibility. The new runtime image request is 3,128 bytes; snapshot version remains 21.

All 276 source/simulation checks, five focused browser scenarios, production build and a real-input production Hawkshot smoke test pass. Tests cover birth/growth/shrink, final emission, tail restoration, actual rendered pixels with expired vision, material disposal and checkpoint behavior. The new browser test was repeated while refining its diagnostic capture camera. Standard framing and a close-up raised to particle height were inspected; the latter shows the small blue cross without altering source particle size. Profile regeneration is byte-identical. The full browser suite and unchanged GLB validation were not repeated.

This implements one of four lingering layers. Aurora, Snow01, Snow02, source sound, native emission/orientation/color calibration and the full production match remain unfinished. The goal remains active. See [Sparkle playback](ASHE-E.md#lingering-sparkle-playback).

## Both sustained snow layers milestone

Snow01 and Snow02 now render through separate instanced batches sharing the existing shard atlas. Their distinct rates, heights, force/orbit parameters, nonuniform versus uniform scaling, direction orientation versus spin, frame selection and fade come from separate pinned profiles. Saved visual descriptors preserve their tails after sight expiry, with no new texture request or snapshot field.

All 278 source/simulation checks, four focused Chrome scenarios, production build and a real-input production Hawkshot smoke test pass. Browser evidence verifies each layer's independent pixels after reveal expiry, exact paused/restored buffers and empty batches after tail completion. Existing Dust atlas behavior passes. The source-scale fixture screenshot was inspected and both profiles regenerate byte-identically. The full browser suite and unchanged GLB validation were not repeated.

Three of four lingering layers have playback adapters. Force/orbit integration, native defaults, emission phase and visual parity remain unverified as documented. Linger Aurora, source sound and the broader full-match goal remain unfinished. The goal stays active. See [snow evidence](ASHE-E.md#lingering-snow01-and-snow02-playback).

## Lingering Aurora shader milestone

The remaining linger Aurora now renders its single drifting arbitrary quad with source lifetime, scale, alpha curve and blue erosion. A separately scrolling RGBA multiplication band adds 373 image bytes; the primary atlas and erosion pack are shared. Independent uniforms/materials restore from saved age and are released on expiry or removal.

All 280 source/simulation checks, four focused browser scenarios, production build and a real-input production Hawkshot smoke test pass. The Aurora browser scenarios were repeated after adding GPU scrolling/wrapping coverage. Tests verify source parameters, lifetime/drift/fade, pause/fresh restore, material cleanup, actual pixels, blue erosion, both RGB and alpha multiplication and repeat scrolling. The composite screenshot was inspected and profile regeneration is byte-identical. The full browser suite and unchanged GLB validation were not repeated.

All eight flight, five explosion and four lingering source emitters now have adapters. This establishes source-record coverage only. Native placement/defaults, probability/phase, color/UV semantics and rendered parity remain unverified; source sound and the broader production match remain incomplete. The goal stays active. See [lingering Aurora shader evidence](ASHE-E.md#lingering-aurora-playback).

## Complete browser regression and source-audio inventory

All 112 current Chrome browser scenarios pass in the full suite, including graphics recovery, checkpoint storage, combat, fog, structures and every implemented Hawkshot layer. This supersedes the earlier partial-browser coverage reports for the current runtime. The suite completed in approximately four minutes; it is not a full-match performance benchmark or native comparison. No runtime code changed in this step.

Extracted and pinned Ashe's two base SFX banks: 622,364 source bytes from 742,371 compressed patch bytes, retained only in the source cache. Archive resolution corrected legacy `wwise` names to the actual `wwise2016` entries. A pinned wwiser revision successfully parses bank format 145 and inventories 44 embedded media entries, 41 events and their sound/action/container counts. Extraction and inspection are reproducible scripts with pinned provenance. No audio media has been decoded, composed, listened to or added to browser playback yet.

The existing 280 source/simulation checks and production build were not repeated because this step changes only tools, source manifests and documentation. Native visual/audio calibration, source sound playback and the broader full-match production goal remain unfinished. See [source audio investigation](ASHE-AUDIO.md).

## Hawkshot source-audio event mapping

Resolved six named Hawkshot events to bank IDs, eight play/stop actions, two three-entry shuffle containers and nine distinct encoded media files. The reproducible mapper preserves selected parameter paths, inherited mixers and attenuation, and reports the missing shared output bus explicitly. It extracts 218,831 encoded media bytes to cache with bank-hash, binary index, parser-index, bounds and RIFF checks. Neither browser assets nor runtime code changed.

The source establishes a delayed cast, separate launch variant/loop layers and explicit stop transitions, including a 1.25-second linger sound fade. That fade exceeds the current visual tail and requires independent audio lifetime in the eventual runtime adapter. Regeneration of the graph/media is byte-identical. Decoding, listening, shared mixing and exact native dispatch remain unfinished; existing runtime checks/build were not repeated for this source-tool-only step. See [Hawkshot audio graph](ASHE-AUDIO.md#hawkshot-event-graph-and-encoded-media).

## Hawkshot float audio masters

Built pinned vgmstream and decoded all nine Hawkshot media files to cache-only float WAV masters. The reproducible decode manifest captures full frame/rate/channel metadata, source/PCM hashes, peaks, RMS, endpoint deltas and exact codec-library hashes. All files are mono 44.1 kHz with no embedded loop markers; source bank loop requests remain separate. Five recordings contain 22 samples above unit magnitude before gain, so float masters preserve headroom that a direct integer conversion would clip.

Repeat decoding produced identical hashes. A real Chrome 152 Web Audio decode check verified every float sample for all nine recordings, including values above 1. The approximately 5.32 MB masters are not runtime requests. No gameplay/render code changed; source/simulation checks, production build and the full browser gameplay suite were not repeated. Runtime source playback, listening comparison, shared mixing and native scheduling remain unfinished. See [decoded audio evidence](ASHE-AUDIO.md#decoded-source-masters-and-browser-verification).

## First source cast audio playback

Hawkshot now plays its three source cast variants with the mapped 150 ms delay and −12 dB authored gain. Source WAVs retain float headroom. Event-age scheduling handles batched simulation delivery, and a local shuffle bag avoids consuming gameplay randomness. The optional source preload falls back to synthesized feedback on failure.

Audio pause now suspends context time with the match; mute stops/disconnects voices immediately, ended nodes release connections, and checkpoint history is primed so old one-shots do not replay. All 281 source/simulation checks, seven focused Chrome audio/save scenarios, production build and real-input production Hawkshot smoke pass. Source profile regeneration is byte-identical. The full browser suite and full-match benchmark were not repeated.

This is source playback for the cast cue only. Launch/arrival/linger audio, spatial attenuation, shared-bus/native mixing, listening comparison and full-match production work remain unfinished. See [runtime audio scope](ASHE-AUDIO.md#first-runtime-source-playback-cast).

## Source arrival audio playback

Hawkshot now emits a single audience-frozen arrival event at the actual endpoint/tick and plays its verified 7.208-second source recording with authored −9 dB gain. The audio node survives visual retirement, seeks appropriately for delayed event delivery, suppresses already-finished cues, and uses the existing pause/mute/cleanup path. Source arrival loading is independent of cast loading and fails without blocking the match.

All 284 source/simulation checks, five focused Chrome audio scenarios, production build and a real-input production Hawkshot smoke test pass. Tests cover exact landing/single emission, hidden enemy information boundaries, checkpoint non-replay, full recording length/gain, late seeking and real node lifetime beyond visual expiry. Source export is byte-identical. Full gameplay browser regression and full-match benchmarking were not repeated.

Launch and persistent linger audio, spatial/shared-bus mixing, listening/native comparison and the broader complete production match remain unfinished. See [arrival audio evidence](ASHE-AUDIO.md#arrival-source-playback).

## Persistent source linger audio and version 22 saves

Hawkshot's endpoint now loops the source recording, seeks from saved simulation age, and schedules its authored 1.25-second stop transition. Reinspection corrected the earlier prose from Linear to the bank's actual Exp1 curve. Playback uses a documented polynomial amplitude interpretation pending native comparison. Pause freezes the loop; mute/visibility removal cleans up immediately; eligible re-entry resumes at the current phase. Completed identities prevent accidental tail restarts.

The saved presentation descriptor now includes the full 6.25-second visual/audio window. Snapshot version 22 rejects version 21; sight still expires at five seconds and particles retain their original lifetimes. Tests restore during the final audio-only quarter-second with no renewed vision.

All 286 source/simulation checks, ten focused Chrome audio/checkpoint scenarios, production build and real-input production Hawkshot smoke pass. Source export is byte-identical. Launch audio, shared/spatial/native mixing, listening comparison and the full production match remain unfinished. Full browser regression and full-match performance were not repeated. See [persistent linger evidence](ASHE-AUDIO.md#persistent-linger-playback-and-saved-fade).

## Both source flight audio layers

Hawkshot now plays a launch variant and separate persistent loop with source −8/−26 dB gain and paired 150 ms linear stop fades. Saved projectile state predicts exact arrival; endpoint state preserves the fade after arrival. Per-flight/layer voices seek correctly on restore or eligible re-entry, release on removal/mute/visibility loss, and remember natural completion to prevent tail restarts. Deterministic variant choice is a documented approximation of native shuffle behavior.

All 289 source/simulation checks, eight distinct Chrome audio scenarios across the initial and focused runs, production build and real-input production Hawkshot smoke pass. New checks cover source hashes/gains/stop curves, short/long-flight deadline prediction, restore consistency, loop versus one-shot phase, natural variant ending, exact stop scheduling and cleanup. Source export is byte-identical. Full gameplay browser regression and full-match performance were not repeated.

All nine prepared Hawkshot recordings now have runtime adapters. Native audio parity remains unverified: shared/spatial mixing, shuffle state, stop/fade dispatch, loop seams and listening comparison still need work. The larger full-match production goal remains unfinished. See [flight audio evidence](ASHE-AUDIO.md#flight-launch-variants-and-persistent-loop).

## Source attenuation interpretation and boundary evidence

Recovered the inherited six-point attenuation curve and positioning flags, generated a source profile and standalone evaluator, and sampled the pinned parser at 86 distances. Three focused tests compare source/profile identity and the independent parser outputs, including knots, interpolation and near-floor behavior; TypeScript checking passes and export is byte-identical.

The stored values are normalized, not literal dB: source distances 2,000 and 2,300 map to approximately −12 and −24 dB in the parser. Its special −1 floor introduces a tiny-amplitude boundary discontinuity that needs native validation. No listener coordinate policy or live attenuation was invented in this step; runtime playback remains unchanged. Existing hosting work was preserved separately. See [source attenuation](ASHE-ATTENUATION.md).

## Nested static-host regression coverage

The hosting change exposed four audio integrity-test path failures: relative asset URLs were concatenated into `publicassets/...`. The tests now resolve them beneath `public/` correctly. The map inspector also linked back to the domain root; its Practice game link now stays within the deployment directory.

Added `npm run test:production`, a reproducible production-build smoke test with a strict static server beneath `/nested/rift/` and no root fallback. It verifies map load/navigation, map-to-practice navigation, all nine source audio requests, no development hook, real keyboard/mouse aim and Hawkshot charge consumption, and zero console/request errors or requests outside the deployment prefix. Its game screenshot was inspected and confirms terrain, champion, HUD and effect rendering. The helper uses an ephemeral local port and closes its browser/server.

All 292 source/simulation checks and the production build/smoke pass. The existing lightweight deployment workflow remains unchanged. This verifies local production subdirectory behavior, not the current remote deployment or a full-match/browser-performance certification. Native reference calibration and the broader production match remain unfinished.

## Sparring bot attack commitment and recovery movement

Corrected a close-range decision bug that made a ready bot retreat instead of attacking. Bots now reserve close-range movement for attack recovery and retain valid committed windups when another target becomes nearer. Target visibility and low-health escape still take priority where appropriate. Coincident opponents use a fountain-directed escape instead of a zero vector.

All 298 source/simulation checks, the focused Chrome pursuit/pause scenario, and the nested-path production build/smoke pass. The initial three regression scenarios failed before the correction. Additional cases protect hidden-target cancellation, emergency retreat, checkpoint determinism and overlapping-unit escape. The browser capture was repeated after adding an explicit loading-screen wait and inspected. Full browser regression and full-match performance were not repeated.

Bot spellcasting remains disabled by single-human ability-state ownership. The required ownership separation and remaining 5v5 gaps are recorded in [bot combat notes](BOTS.md); this change improves the sparring bot without claiming native AI or complete matches.

## Independent champion state ownership

Added `ChampionState` records for every spawned champion while preserving `World.player` as the human HUD/input view. Each record owns its own mutable cooldowns, Focus, ammunition, cast state, progression and inventory. Charge regeneration and Focus expiry now advance per owner at their original before-command/after-combat phases, including recharge while dead. No bot spell command is enabled yet; execution and attribution still require owner-aware integration.

Snapshot version 23 persists other champion records alongside the human record, requires exactly one owner per champion, and applies cast/animation chronology checks to every owner. Version 22 is intentionally incompatible. Restore rebuilds independent records and discards presentation-event history.

All 303 source/simulation checks, six focused Chrome champion/save/bot scenarios and the nested-path production build/smoke pass. Tests verify no shared mutable state, distinct resource deadlines, exact restored continuation, ownership rejection and real IndexedDB reload with the human HUD still bound correctly. Full browser regression and full-match performance were not repeated. See [bot ownership scope](BOTS.md) and [save ownership](SAVES.md#champion-ownership).

## Champion combat ownership

Attack release now builds the attacking champion's Focus; Q attack speed, empowered animation-cycle flag and captured arrow damage read that owner's timer. Frost Shot, natural regeneration and respawn timing use the respective champion's level. Orders/movement/attacks/stuns clear the relevant cast animation; damage cancels the victim's recall. Death resets the victim's cast/Focus/recall and increments its death count while retaining cooldowns and E recharge. Victory clears every pending cast. State lookup avoids scanning units for ordinary nonchampion IDs.

Four new simulation regressions fail on the preceding commit and pass after this change, covering enemy attack Focus plus exact checkpoint continuation, independent Q timing/damage, enemy level scaling and death cleanup/recharge. All 307 source/simulation checks pass, along with seven focused Chrome scenarios (Q, bot kiting, ownership checkpoint/HUD and Frost Shot). The production build and strict nested-host smoke pass with all nine recordings, map navigation, a real Hawkshot cast and no development hook. Full browser-suite and performance runs were not repeated.

This extends the shared combat machinery, not the bot decision policy. Bot Q is verified using seeded state; actual nonhuman cast execution remains disabled. Progression/rewards, cast execution/presentation and the broader complete-match work remain outstanding. Snapshot shape remains version 23, with the changed simulation fingerprint protecting incompatible checkpoints.

## Shared champion spell execution

Champions now submit Q/W/E/R/Flash/Heal through the same command path with their own Focus, charges, mana, cooldowns, cast animation and pending windup. Release resolves each owner's pending spell. Cooldown queries accept an optional champion ID while preserving the human HUD default. Cast rejection and recall feedback use the caster's team audience. Recall channels and source animation use the owning record and return to the appropriate fountain. The renderer no longer substitutes the human cast/recall timeline for other champions.

Seven new simulation scenarios cover enemy W/E/R spending and exact checkpoint continuation through release, private cooldown rejection, Q activation/reset, red recall destination and Heal during a pending spell. All 314 checks pass. Eight focused Chrome scenarios pass, including enemy cast/recall source clips and damage interruption, existing human W/E/Heal and recall animation regressions. The production build and nested-host smoke pass. Full browser/performance suites were not repeated; snapshot shape remains version 23 with a new simulation fingerprint.

Bot decision logic still submits movement/attacks only. The next work is tactical spell decisions using permitted team observations and independent progression/rewards. This is shared local spell execution, not a complete AI policy or native-client parity.

## Independent champion rewards and source minion sharing

Champions now earn ambient gold and last-hit bounty/CS/kill credit independently, with team-private reward feedback. `gainExperience` accepts a champion ID and updates that owner's source growth stats. Nearby living champions on either team now receive minion XP using the pinned standard-mode `mPlayerMinionSplitXp` table, corroborated by Riot's 26.1 notes. The map hash/mode link/original float table are checked by the new exporter. Three-way sharing preserves the authored 0.433 value.

Nine new source/simulation cases cover the exported table, one through five enemy recipients, last-hit exclusivity, dead/distant/capped recipients, independent growth and saved continuation, and ambient income through death. An existing super-minion fixture includes two nearby allies; its XP assertion now checks 48.75 per recipient instead of incorrectly expecting a solo 75. All 323 checks pass. Four focused Chrome scenarios pass (progression/HUD, economy/shop, bot kiting, ownership checkpoint), as does the production nested-host smoke. No full-browser or performance sweep was repeated.

Champion-kill XP is still the prior human-only approximation. Its standard-mode curve has been located for follow-up, but kill participation, assist sharing, role penalties and catch-up rules need work before a parity claim. Minion sharing counts capped living recipients and clamps artificial populations above six to the final table entry; those are explicit local eligibility/fallback policies. Bot buying and spell decision policy remain outstanding.

## Autonomous Ranger’s Focus

The sparring bot now queues Q during attack recovery against a visible, vulnerable champion in attack range when its own Focus, mana and cooldown permit it. Existing 18-tick thinking cadence is preserved; a valid committed windup and low-health retreat take precedence. The queued cast goes through normal next-tick validation and attack-reset execution, including rejection if a stun arrives after the decision. This is a local policy, not native AI behavior.

Four new deterministic cases verify queued activation with independent state and exact saved continuation, visibility/range/resource/retreat exclusions, committed windup preservation and intervening stun. The browser pursuit scenario now advances ten simulated seconds from zero Focus, observes autonomous Q and empowered attacks, and still verifies kiting, damage and paused-state invariance. All 327 source/simulation checks, six focused Chrome scenarios and the production nested-host smoke pass. The inspected `artifacts/browser-bot-kiting.png` still shows overlapping champions in the fixture; unit collision remains outstanding. Full browser/performance suites were not repeated.

Other bot spells, coordinated decisions, tower safety, champion-kill XP and purchases remain incomplete. Q still follows the existing rank-one local spell mechanics and aggregated damage representation; this step does not establish full champion or match parity.

## Autonomous Volley pursuit

The sparring bot now queues Volley against a visible champion beyond basic-attack range when its own mana/cooldown permit it, preserving attack windups, retreat priority and the existing thinking cadence. The ordinary queued cast path handles windup, resources and release. Aim is copied from the observed target position and does not track hidden movement after decision. Q remains the in-range recovery action.

Four simulation cases verify owned release with exact checkpoint continuation and hit/slow, exclusion conditions, aim retention through vision loss and rejection after intervening stun. The test pathfinding stub initially copied entire units into path points; narrowing it to x/y fixed its strict checkpoint rejection. All 331 source/simulation checks, five focused Chrome scenarios and the production nested-host smoke pass. The new browser case observes autonomous Volley animation, damage, critical slow and separate cooldowns. Full browser/performance sweeps were not repeated.

This local pursuit policy does not predict dodges, estimate arrow obstruction, reserve mana or choose lane-clear opportunities. E/R/Flash/Heal decisions, team strategy, purchases, champion-kill XP and unit collision remain outstanding.

## Full browser regression and refreshed Rift observation

At runtime commit `d361405`, all 124 Chrome scenarios pass in the full browser suite (4.4 minutes). This supersedes the recent focused-only coverage for champion ownership, autonomous Q/W, reward sharing and audio integration. Coverage includes saves, source model/particle timelines, graphics recovery, fog/picking, structures, input and HUD; it does not establish native-client or complete-match parity. No runtime changes were needed for this verification.

A separate, sequential full-Rift benchmark on Chrome 152.0.7977.83 / Apple M5 Pro / 64 GiB at 1920×1080 advanced to 90 seconds, warmed up 45 frames and sampled 180 frames. The scene held 103 unit records, 231 draw calls and 379,519 submitted triangles. Frame median/p95/p99 were 16.6/18.3/22.6 ms. Simulation step median/p95/p99 were 0.2/0.3/0.4 ms; 22 fog updates measured 1.0/1.5/1.6 ms. The machine-readable results and tested revision are retained in `docs/reference/runtime-verification.json`. The capture `artifacts/rift-benchmark.png` was inspected and shows the source Rift lane and active minion combat.

Frame p95 remains above the 16.7 ms target. Different live unit counts and a short sample prevent a controlled improvement claim against prior runs. This is a development-build observation without a full 5v5 roster, camps or spell stress scene. It indicates that ordinary simulation cost is small in this fixture; rendering/frame tails and representative stress coverage still require work. The benchmark's time jump also leaves the wall-clock welcome announcement visible at 1:33 in the capture, a presentation timing issue to investigate. The production goal remains incomplete.

## Welcome announcement follows match time

The Rift benchmark exposed the welcome banner still playing at simulated 1:33 because its CSS animation used wall time. The HUD now seeks a paused CSS animation from the current simulation tick. Pause freezes its presentation; advancing beyond its existing eight-second duration leaves it hidden immediately. The reduced-motion one-second duration is retained, and checkpoint loads still suppress the welcome banner. Tick updates are cached and clamped to the endpoint so a completed announcement does not cause recurring style changes. These durations are existing local presentation choices, not a claim about native announcement timing.

All 331 source/simulation checks pass. Six focused Chrome cases pass (two new timing/reduced-motion tests plus four save scenarios); the two timing cases were rerun after caching the endpoint. The production build and nested-host smoke also pass. The prior complete 124-case run predates this small HUD change; a full rerun/performance measurement was not repeated. The new browser checks verify initial/visible/fading/finished states, pause, a 90-second jump and reduced motion.

## Scoreboard champion ownership

The held scoreboard now renders one row per actual champion, grouped by team, using that owner's kills, deaths and CS. It no longer derives the opponent's score by reversing the human record. The top team score sums credited champion kills while the personal K/D display remains bound to the human. The open panel refreshes when its data changes, with a signature cache avoiding unnecessary DOM replacement. Names are inserted as text. The panel has a bounded scroll area for larger rosters.

All 331 source/simulation checks pass. Eleven existing game browser checks and the new scoreboard ownership scenario pass. The first new-test attempt kept gameplay paused, where Tab is intentionally disabled; resuming the fixture before the real Tab key fixed the test setup. The scenario uses actual minion-caused and champion-caused deaths, verifies four distinct rows and team/personal totals, checks literal name rendering, and observes CS updates while held. `artifacts/scoreboard-ownership.png` was inspected. Production build and nested-host smoke pass; the full browser suite was not repeated after this change.

Assists remain the existing zero placeholder until participation tracking exists. The scoreboard does not yet provide the full native inventory/level/timer/team layout. This corrects attribution and roster rendering, not complete scoreboard parity.

## Shared purchasing and bot fountain plan

`buy` now accepts a champion ID, resolves its team fountain and applies gold/inventory/stat changes to that owner. The default remains the human shop API. Buying a health item while dead no longer adds current HP, preventing accidental revival while retaining maximum-health growth for respawn. Bots at their own shop radius, after retreat handling, attempt one item per decision from the finite local Blade → Boots → Pickaxe → Long Sword plan. They save toward the next missing item and stop when the plan is owned.

Five new simulation cases cover independent changes, rejection rules, dead purchases/respawn for both owners, deterministic automatic purchase continuation and saving/fountain restrictions. All 336 source/simulation checks pass. Thirteen focused Chrome scenarios pass, including automatic enemy purchase/checkpoint identity with unchanged human inventory/balance, economy/shop and existing gameplay. The production build and nested-host smoke pass. Full browser/performance suites were not repeated.

The four-item catalog and fixed purchase plan remain practice approximations; recipes, complete itemization, selling and adaptive builds are unfinished. This enables spending independently earned bot gold without claiming a native shop or build policy.

## Defensive bot Heal

Bots below 22% health outside their own shop radius now queue available Heal when an enemy champion is visible within 1,150 units. The normal command path owns effects, ally selection, cooldown and next-tick validation; retreat continues. Defensive planning runs before stun/pending-cast handling so Heal can be chosen while disabled or winding up. AI deadlines advance on the existing 18-tick cadence in those states, while offensive/movement decisions remain gated.

Four new simulation scenarios cover retreat Heal and saved continuation, stunned activation without movement, preservation of pending Volley, and eligibility exclusions. The Volley retreat assertion now checks absence of W specifically because defensive F is allowed. All 340 source/simulation checks, five focused browser scenarios and the production nested-host smoke pass. The new Chrome case observes actual Heal, independent cooldown, haste deadline and unchanged stunned position. Full browser/performance suites were not repeated.

The health/threat distances are local bot policy; incoming damage estimates, coordinated healing, R/E/Flash decisions and complete native behavior remain unfinished.

## Champion-kill XP source audit

Preserved and verified the complete standard-mode experience curve `{c6f6a84c}`, its map hash/link, the 1,600-unit XP proximity constant and the ten-second credit-after-death constant. The first ten base rewards match Riot's 13.4 release notes; the full supported curve ranges from 42 XP at level 1 to 990 at level 18. The current flat 180 award and 1,400-unit human-only collection are therefore known deviations. Original sharing and level-difference arrays are retained without inventing absent defaults.

`docs/CHAMPION-KILL-XP.md` specifies the remaining contributor/death-transaction boundary and validation cases. The source record alone does not settle shared coefficient indexing, capped recipient eligibility, assist windows or negative-level modifier semantics. In particular, credit-after-death duration must not be reused as an assist window. `python3 tools/assets/verify-champion-kill-xp.py` passes, checking full record identity plus independently published base values. No runtime code changed, so gameplay/browser suites were not repeated. This is evidence for the next implementation, not completed champion reward parity.

## Persistent damage contributions

Champion state now retains one latest positive-damage tick per opposing champion contributor. Refreshing an attacker updates its existing entry; lethal damage is included. Death retains history, and respawn clears it for the new life. Zero/friendly/nonchampion damage is excluded. Version 24 checkpoints require the new field and validate unique opposing champion identities and timestamp/death chronology. Version 23 is incompatible; history is not fabricated during migration.

Four new simulation cases cover refresh/ownership, exclusions, lethal retention plus exact checkpoint/respawn continuation, and malformed histories. All 344 source/simulation checks and seven focused browser scenarios pass. The new Chrome case writes and reloads the real manual checkpoint, verifies contribution identity and paused restoration, and confirms no combat events replay. Production build and nested-host smoke pass. Full browser/performance sweeps were not repeated.

This is provenance for the pending death-reward transaction. It does not award assists, resolve executions, choose an assist lifetime, track support/CC-only contribution or replace the legacy champion-kill XP approximation. Those remain explicit fidelity work.

## Source-window damage assists

The pinned standard-mode `Configs` link resolves `{4fd6b68d}` with `AssistDurationOverride = 15`, distinct from ten-second post-death XP credit. The full record/hash/link are retained and verified by `tools/assets/export-assist-window.py`. Direct champion kills now increment other recent damage contributors' independent assist counters. Repeated hits do not duplicate assists; the killer is excluded. HUD personal score and held scoreboard display those counters. Version 25 adds the counters and rejects version 24 saves.

Four new simulation scenarios cover direct-kill attribution, the inclusive 900-tick boundary, dead/distant contributors through checkpoint continuation and red-team ownership/nonchampion final-blow exclusion. All 348 source/simulation checks, seven focused Chrome cases and production nested-host smoke pass. The new Chrome scenario observes a real damage assist in both score displays. Full browser/performance suites were not repeated.

Boundary inclusivity is the local fixed-tick convention; support/reveal assists, execution attribution, assist gold and champion-kill XP still require work. The source configuration also contains hashed bounty fields, which remain uninterpreted rather than guessed.

## Hawkshot reveal assists

Hawkshot now records unseen-to-visible champion transitions separately from damage contributions, using the ten-second assist rule documented in Riot's 9.1 notes. Landed scout areas retain their caster ID, so an enemy walking into the lingering vision can grant credit. Ordinary allied sight takes precedence, continuous visibility does not refresh the contribution, and damage/reveal IDs deduplicate on a direct champion kill. Respawn clears reveal history. Version 26 stores reveal contributions and scout ownership and rejects version 25 checkpoints.

Six new simulation cases cover damage/reveal deduplication, already-visible exclusion, ten-second boundary with saved continuation, landed-area entry, invalid saved owners/timestamps and both team orientations. The initial ownership-validation fixture sampled before the hawk had landed; advancing to tick 120 corrected that fixture. All 354 source/simulation checks, eight focused Chrome scenarios and production nested-host smoke pass. The new browser case verifies an occluded reveal, checkpoint continuation, subsequent ally kill and HUD assist count. Full browser/performance suites were not repeated.

Scout radius remains provisional, simultaneous ordinary sight wins locally, and overlapping Hawkshots use current iteration order rather than measured native tie-breaking. These policies and conditional transition-scan costs are documented in ASHE-E.md. Heal support assists, execution credit, assist gold and champion-kill XP remain unfinished.

## Preserve latest damage contributor order

Execution research found inconsistent 13/15-second community descriptions without a separately identified pinned execution constant. No reward window was guessed from the assist override. Inspection did expose a prerequisite defect: refreshing a contributor in place preserved its first insertion order, losing the latest hitter when multiple attackers damaged a victim in one tick. Refreshes now move the source to the end, retaining exact local processing order. Checkpoint validation rejects decreasing damage ticks and preserves equal-tick order. Format remains 26 with a new simulation fingerprint.

Two new cases cover same-tick repeated-attacker order through checkpoint continuation and rejection of reversed chronology. The existing timestamp test now expects latest-hit order. All 356 source/simulation checks, three focused contribution/assist browser scenarios and the production nested-host smoke pass. Full browser/performance sweeps were not repeated. Execution reward eligibility is still unfinished; this change preserves evidence needed to resolve it correctly.


## Champion base kill gold by victim level

Replaced flat 300 champion base gold with the pinned standard-mode level table: 300 at levels 1–6, then 310–420 at levels 7–18. Official 25.09 bounty tuning independently corroborates the progression. The exporter checks the full cached map hash, mode/config link and retained configuration before producing the runtime table. Rewards use the victim level before XP distribution and belong to the opposing champion source, including posthumous sources; explicit practice overrides remain supported.

All 361 source/simulation checks, two focused Chrome scenarios and the nested-path production smoke pass. Coverage includes all 18 victim levels on both teams, different killer levels, duplicate death protection, saved continuation, posthumous rewards, overrides, nonchampion final blows and the HUD balance. The full browser suite and performance benchmark were not rerun. First blood, positive/negative bounties, assist gold, execution attribution and champion-death XP remain incomplete. See [economy evidence](ECONOMY.md#champion-base-kill-gold).


## First-blood gold and persisted claim

Implemented the pinned +100 first-blood bonus, corroborated by official 26.1 notes. The first credited opposing champion kill adds the bonus to its gold event and marks a match-wide claim before processing subsequent deaths. Both teams and posthumous killers are supported; assistants receive no bonus. Nonchampion targets, same-team debug kills and uncredited deaths do not claim it. Snapshot 27 stores the required boolean and restores without replaying rewards.

All 366 source/simulation checks, six focused Chrome cases (reward display, assists and save flows), and the nested-path production smoke pass. New scenarios cover same-tick trades in both team orders, assistant exclusion, nonqualifying deaths and checkpoint continuation before/after the claim. The full browser suite and performance sweep were not repeated. Native simultaneous-kill ordering, execution attribution, remaining bounty rules and announcement presentation remain unfinished; the full production objective remains active.


## Full browser verification after champion reward changes

Ran the complete Chrome suite against unchanged runtime `1b279b6`: all 133 scenarios passed in 4.6 minutes, including combat ownership, bots, assists, first-blood gold, snapshot 27, graphics recovery, structures and presentation. This replaces reliance on the older 124-case run for current integration coverage.

Refreshed the 90-second full-Rift practice benchmark on Chrome 152 / Apple M5 Pro / 64 GiB at 1920×1080, after 45 warmup frames with 180 samples. The scene contains 103 unit records and submits 231 draw calls / 379,519 triangles. Frame median/p95/p99: 16.6/18.9/23.0 ms. Simulation: 0.2/0.3/0.4 ms. Fog updates (22 samples): 1.3/1.7/1.9 ms. The screenshot was visually inspected; the expired welcome overlay is absent and terrain, lane units, fog and HUD render. The dedicated development server was stopped after measurement.

Updated [runtime evidence](reference/runtime-verification.json), retaining the previous record separately. This short development-build observation does not establish a performance regression or improvement, native pixel parity, full 5v5 performance, or cross-browser certification. Frame p95 remains above 16.7 ms. Complete camps, nine role bots and heavy spell stress remain absent, and the production objective remains active.


## Assist-gold source and mode audit

Compared full standard-mode bounty records from 15.24 and 16.18 and retained hashed source files/configuration records with every matching mode link. Two unnamed candidate timing fields changed from 90/210 to 55/175 in standard mode; 16.18 URF, Swiftplay and Ultimate Spellbook still retain 90/210. Three adjacent fractional fields remain 0.25/0.5/1. The checked CommunityDragon field-name dictionary does not resolve these five hashes.

Added an executable verifier for both map hashes, complete records, mode links, expected cross-version differences and dictionary coverage. It passes; documentation diff checks pass. The [assist-gold audit](ASSIST-GOLD.md) separates those verified values from speculative formula meanings, records official bounty/first-blood dependencies, and specifies controlled timing and reward experiments. No runtime payout was changed and no browser rerun was needed. A simple half-of-final-kill-gold formula would mix first-blood/positive bonuses with the assist pool and ignore unresolved time/devaluation rules. Assist gold remains unfinished; the full production objective remains active.


## Owned-item selling

Added `sell(slot, championId)` and owned-item sale buttons in the shop. Each transaction validates owner, slot, shop access and match state, removes one inventory copy, credits its pinned sell amount, and removes its flat stats. Both team fountains and dead owners are supported; selling health cannot revive a dead champion or reset its respawn deadline. The shop refreshes owned rows and balance after purchases and sales.

Pinned and verified Data Dragon 16.18.1 values: Blade 180, Boots 210, Long Sword 245, Pickaxe 613. All 370 source/simulation checks, two focused browser scenarios, the subsequent screenshot capture run and the nested-path production smoke pass. Inspected the shop capture with an owned Long Sword; text, prices and action remain readable. Full-suite/performance checks were not repeated. Living health removal uses an explicitly documented local policy; native inventory slot retention, undo, recipes, Doran's passive and complete shop fidelity remain unfinished. See [selling rules and source](ECONOMY.md#selling-owned-items).


## Inventory slots remain stable after selling

Sales now clear an inventory position instead of shifting later items. Purchases fill the first empty position before appending. The six-slot limit counts available positions correctly even when the stored array has interior gaps. Shop sale rows retain original slot indices, and the HUD already renders each position independently. Snapshot 28 permits null empty positions while retaining item-ID validation and the six-entry limit; only trailing empties are omitted.

All 373 source/simulation checks, six focused Chrome cases (sales/HUD slot placement and saves) and the nested-path production smoke pass. New tests cover both teams, multiple gaps in full inventories, rejected repeat sales, buy placement after restore and invalid snapshot slots. Browser input verifies that selling slot 1 leaves Boots in slot 2 and a subsequent Pickaxe purchase fills slot 1. Full-suite/performance checks were not repeated. Drag/reorder, item actives, undo, recipes and complete native shop presentation remain unfinished; the production objective remains active.


## Drag-and-drop inventory ordering

Added champion-owned `moveItem` swaps and moves into empty slots, available away from the fountain and while dead without changing stats or gold. The HUD supports native mouse dragging between its six positions, checks source identity at drop, ignores external drag payloads and blocks modal/paused drops. Occupied slots show a grab cursor; source images do not initiate independent image drags. Saved null positions preserve reordered inventories and subsequent sale slot labels.

All 375 source/simulation checks, three focused Chrome cases and the nested-path production smoke pass. The initial real-mouse test exposed inherited HUD pointer transparency; enabling inventory-grid pointer handling fixed the intercepted drag, and the rerun passed. Browser coverage swaps occupied slots, moves to slot 6 and verifies unchanged stats/gold plus the shop's updated sale label. Unit coverage includes enemy/dead ownership, invalid operations and saved restoration. Full-suite/performance checks were not repeated. Item actives, keyboard reordering, undo, recipes and native presentation calibration remain unfinished; the full production objective remains active.


## Component purchases and first health recipe

Added Ruby Crystal and Giant's Belt with pinned stats, prices, sell values and local source icons. Buying Belt consumes one owned Crystal and charges 500 remaining gold; direct purchase costs 900. Purchase planning uses distinct component slots and validates the complete transaction before mutation. Full inventories can upgrade through a consumed slot, duplicate components remain independent, and only net flat stats are added. Shop price labels use the same plan and refresh after purchases/sales.

All 379 source/simulation checks, four focused browser scenarios, both source verifiers and the nested-path production smoke pass. Inspected the expanded shop capture: both new icons, stat descriptions, balance, owned item and sale value are readable. Tests cover both teams, full inventory upgrades, insufficient funds, duplicate components, checkpoint restoration and dead owners. Full-suite/performance tests were not repeated. Recursive recipes, native slot-selection/health calibration, undo, broader item effects and full-match systems remain unfinished; the production objective remains active.


## Live shop purchase feedback

Extracted a read-only `purchaseError` query shared by the purchase transaction and shop feedback. Open shop cards now update quoted recipe cost, accessible unavailable state, reason title and muted icon/price styling as funds, inventory and fountain access change. Validation continues at purchase time. Capacity checks account for component consumption, so a full inventory can still upgrade its Ruby Crystal.

All 380 source/simulation checks, 13 Chrome scenarios and the nested-path production smoke pass. The new browser scenario covers an open shop transitioning through unaffordable, full-inventory recipe, out-of-fountain and available states. A fractional-funds scenario checks read-only validation and atomic rejection. Inspected the captured shop after a purchase: unavailable catalog icons/prices are muted while the owned item remains distinct. Full-suite/performance checks were not repeated. Native shop layout, persistent reason panels, recursive recipes, undo and the full production scope remain unfinished.


## Doran's Blade omnivamp

Implemented the pinned 2.5% omnivamp and one-Doran-item ownership group. The shop description now includes the effect. Damage processing differentiates direct hits from area spells so current Volley and Crystal Arrow area damage against minions heals at the official 26.1 33% effectiveness, while attacks and champion damage use full effectiveness. Healing follows current inventory ownership, does not revive dead sources and stops after sale.

All 384 source/simulation checks, three focused Chrome scenarios and the nested-path production smoke pass; the item/group source verifier also passes. Tests cover both teams, mitigated damage, minion direct/area differences, selling, duplicate ownership, missing-health cap, posthumous sources, save continuation and visible HUD healing. Full-suite/performance checks were not repeated. Overkill treatment, event timing and unsupported dummy targets are explicit local policies; shields, heal modifiers, damage-over-time/pet systems and native comparison remain unfinished. The full production objective remains active.


## Omnivamp through projectile collision and saved casts

Added integration scenarios that queue real W/R casts, save after projectile release, and run collisions against a champion and nearby minion. Identical control worlds retain flat stats and regeneration while omitting only Doran ownership, isolating the healing effect. Both spells apply full champion healing and reduced minion area healing, with byte-identical saved continuation. A separate in-flight Volley scenario sells Doran before impact and verifies that damage still lands without healing.

All 387 source/simulation checks pass. A deliberate local fault injection changed the two spell damage classifications to direct: both new W/R cases failed, confirming that the tests detect missing minion area scaling. The original runtime was restored in a finally block and the final diff contains no runtime edits. Browser and production checks were not rerun for this test-only change. Native overkill/event timing, complete healing modifiers and the overall production objective remain unfinished.


## Cloth Armor and Chain Vest

Added source-pinned Cloth Armor and Chain Vest, their local icons, sell values and component recipe. Item transactions now add/remove flat armor and apply only the net armor difference when consuming a component. Existing damage mitigation consumes the updated armor; selling retains champion level growth. Both teams and saved continuation are covered.

All 390 source/simulation checks, three focused Chrome scenarios, armor/sell source verifiers and the nested-path production smoke pass. Browser input verifies the armor HUD through purchase, upgrade and sale. Inspected the expanded shop capture: new icons and prices render, but the growing catalog scrolls the header out of view, leaving a known layout improvement for the full shop design. Full-suite/performance checks were not repeated. Adaptive bot builds, broader defensive effects and complete native shop/match fidelity remain unfinished; the production objective remains active.

## Shop scrolling and persistent controls

Split the shop into independently scrolling catalog and owned-item panels. Gold, section labels, transaction feedback and the close control remain outside those scrolling regions. Desktop uses side-by-side panels; narrow windows stack them within the viewport. Existing buy/sell and component-cost behavior remains connected to the same controls.

All 390 source/simulation checks, eight focused Chrome scenarios and the nested-path production smoke pass. New layout scenarios fill all six slots, scroll to the final catalog and owned entries, sell, and close at 1440×900, 1366×768 and 600×700. They check stationary controls, fully visible labels/feedback and no horizontal dialog overflow. Inspected laptop and narrow-window captures. Full-suite/performance checks were not repeated. This resolves the observed growing-catalog overflow; native shop parity, comprehensive items and the full production objective remain unfinished.

## Live owned items and keyboard selling

The open shop now reconciles owned controls when the actual inventory changes, retaining unchanged buttons instead of rebuilding the list after every transaction. Selling a focused item transfers focus to the next occupied slot, the previous remaining slot, or the close control when empty. Sale clicks validate the displayed item against the current slot before transacting, preventing a stale control from selling a replacement item.

All 390 source/simulation checks, seven focused Chrome scenarios and the nested-path production smoke pass. New browser cases cover an external purchase while a sale control is focused, keyboard-only sequential sales through closing the empty shop, and an inventory swap immediately before a stale click. Existing sale and three viewport layout scenarios pass. Full-suite/performance checks were not repeated; native shop fidelity and the full production objective remain unfinished.

## Null-Magic Mantle and Negatron Cloak

Added pinned magic-resistance components, their source icons and the Mantle-to-Cloak recipe. Purchases apply net resistance after consuming components; sales preserve unrelated stats and champion level growth. This adds a defensive response to magic damage alongside the existing armor purchases.

All 393 source/simulation checks, five focused Chrome scenarios, resistance/sell source verifiers and the nested-path production smoke pass. Both teams cover mitigation, true damage, sale and saved continuation; browser input covers buying, upgrading and selling, and the larger catalog retains the three viewport layout checks. Inspected the new icon/description/owned-item screenshot. Full-suite/performance checks were not repeated. The compact HUD still needs a magic-resistance readout; adaptive builds, full item effects and native match fidelity remain unfinished.

## Magic resistance in the combat HUD

Added current rounded magic resistance beside armor in the compact stat column. The column retains its width, permits native title tooltips, and distinguishes the MR abbreviation from neighboring symbols. Extended the real shop scenario to assert the visible 33→53→78→33 resistance sequence through purchase, upgrade and sale, then verify all five stats are in the viewport after closing the shop.

All 393 source/simulation checks, the focused Chrome scenario and nested-path production smoke pass. Inspected the captured combat HUD: the fifth row fits inside the existing panel. Full-suite/performance checks were not repeated. The MR abbreviation is a local presentation choice; authentic stat icon assets, full stat details and overall production fidelity remain unfinished.

## Source League stat artwork

Replaced the five compact HUD placeholder glyphs, including the MR abbreviation, with the pinned League stat atlas regions. Kept the original atlas intact and used CSS backgrounds with verified coordinates. The existing stat column dimensions and live values remain in place; each row has an accessible stat name and native title.

All 393 source/simulation checks, the focused shop/HUD browser case, stat-atlas verification and nested-path production smoke pass. Inspected development and production screenshots: all five colored stat symbols render beside their values. Full-suite/performance checks were not repeated. The added atlas is 164,668 bytes; exact native HUD icon selection, sizing, type and placement still require visual calibration. Overall production fidelity remains unfinished.

## Source League interface typography

Replaced approximate DOM interface fonts with local Beaufort for LOL and Spiegel faces from the pinned game assets. Added font provenance and a verifier for the definitions and binary files; removed the unused font packages. Existing layout and text sizes are retained for this step.

All 393 source/simulation checks, four focused Chrome HUD/shop scenarios, font-source verification and nested-path production smoke pass. Inspected HUD, narrow shop and production screenshots with the new font metrics. The five source files total 560,480 bytes before transfer compression. Full-suite/performance checks were not repeated. Native typography size/weight/spacing calibration, renderer text and localization coverage remain unfinished; the full production goal remains active.

## Font readiness before play

Startup now explicitly loads all five shipped interface font faces alongside other assets before removing the loading screen. This includes the medium heading face first used by menus. Failed font loads are handled as cosmetic failures and allow fallback text instead of interrupting the match.

All 393 source/simulation checks, two focused Chrome scenarios and nested-path production smoke pass. Browser cases hold a font response during cold boot, confirm loading remains active, then verify all five faces are available after release; a separate case aborts every font download and verifies that the match and shop still open. Full-suite/performance checks were not repeated. Pending font requests follow the browser's network lifecycle; no separate font timeout is introduced. Native typography calibration and full production fidelity remain unfinished.

## Full browser regression after item and typography changes

Ran all 148 current Chrome scenarios against commit `4844626`, with one worker and no retries. All passed in 5.0 minutes. The durable record in `reference/browser-regression.json` identifies the exact tested commit, complete scenario list and original output digest. No runtime edits were made during this run.

Coverage includes combat and animation timing, bot interactions, items and recipes, drag/reorder and keyboard selling, three shop viewport layouts, font readiness/failure fallback, saves, graphics loss/restoration, vision and map behavior, structures, summoner healing and announcements. This broadens evidence beyond the earlier focused runs. Performance was not rerun: the prior p95 frame result remains above target. Current-suite success does not establish full 5v5 behavior, native visual parity, complete roster/items or production completion.

## Stop hidden shop work during combat

HUD updates now skip the shop subtree unless the shop is open. Closing the modal retains its DOM, which previously caused all ten catalog purchase validations, recipe quotes and inventory reconciliation checks to continue during normal play. Reopening still reconstructs current inventory and gold and resumes live availability updates.

The new browser regression failed before the fix with 1,000 purchase validations across 100 closed-shop HUD updates, then passed with zero afterward. It also verifies externally purchased inventory and discounted recipe cost on reopening. All 393 source/simulation checks, four focused Chrome cases and nested-path production smoke pass. This proves removal of unnecessary calls, not a measured FPS improvement; the prior frame-time target remains unmet and no new frame benchmark was run. Full production fidelity remains unfinished.

## Current Rift timing with HUD instrumentation

Extended the scoped benchmark to open/close the shop before measurement and time HUD updates and render calls separately. Instrumented methods are restored afterward; missing samples fail the run. Retained the previous record and recorded the new measurement and exact harness digest in `reference/runtime-verification.json`.

On the recorded Chrome/Apple M5 Pro setup at 1920×1080, 180 samples of the 103-unit Rift scene show frame median/p95/p99 of 16.7/18.8/22.2 ms. HUD update p95 is 0.3 ms (51 samples), simulation step p95 0.3 ms, render-call p95 5.2 ms and fog p95 1.7 ms. Render timing includes nested fog work and is CPU wall time, not GPU execution. Inspected the battlefield capture. The p95 frame target remains unmet; this directs further profiling toward rendering/browser/GPU costs, without claiming a controlled improvement over earlier records. No runtime changes or new full-suite run were made. The benchmark remains too narrow to certify a complete 5v5 match.

## Cache static Rift transforms

After attaching and placing the terrain root, compute its local/world matrices once and disable automatic recomposition on that static subtree. Animated units, materials and fog remain live. The optimization relies on terrain transforms remaining fixed; future terrain transform animation must explicitly opt back into updates.

All 393 source/simulation checks, five focused Chrome scenarios and nested-path production smoke pass. The new full-Rift case toggles automatic updates at the same paused state and compares exact canvas pixels: they match, while the cached path performs zero local matrix recompositions. Existing elevation, picking and fog cases pass. A fresh scoped sample records frame median/p95/p99 16.8/18.5/22.0 ms and render-call p95 5.1 ms, with unchanged 231 draw calls and 379,519 triangles. These single-run differences do not establish an FPS improvement. The modified runtime source hash and measurement are retained in `reference/terrain-transform-profile.json`. The frame target and full production objective remain unfinished.

## Avoid unchanged world-label mutations

Health bars now retain their child element references and update hidden/protection/status DOM state only when it changes. Each visible label queries vulnerability once instead of twice. Child references use a WeakMap so removed labels do not remain retained by the cache. Position and resource widths continue to follow live simulation values.

The stationary browser regression recorded 40 mutations across 20 renders before the change and zero afterward, then verified that half health and a new stun still update the label. All 393 source/simulation checks, seven focused Chrome cases and nested-path production smoke pass, including full-map visibility transitions and Volley slow feedback. No FPS gain is claimed from mutation counts; the frame-time benchmark was not rerun for this step. Native visual calibration, performance target and complete production gameplay remain unfinished.

## Ability tooltip clarity and keyboard access

Expanded current rank-one Q feedback with its pinned attack-speed bonus, empowered damage multiplier and attack reset. Heal now describes its level-scaled healing, allied target, speed duration and repeated-heal reduction. Tooltip metadata distinguishes no cost and no cooldown. Tooltips also open on ability-button focus, expose a tooltip role and associate the active control with its description.

All 393 source/simulation checks, the focused tooltip browser case and nested-path production smoke pass. Inspected the Heal tooltip capture. An initial tooltip ownership attribute collided with the ability-button selector; log inspection caught the runtime error, the attribute was renamed and the final test explicitly exercises a live HUD update and checks page errors. Full-suite/performance checks were not repeated. Tooltips still need complete damage/rank scaling details and native layout calibration; full production fidelity remains unfinished.

## Volley tooltip shares combat damage calculation

Consolidated the existing rank-one Volley damage formula into a World query consumed by cast snapshots, fallback projectile construction and the tooltip. Volley now reports its seven arrows and current raw physical damage before armor. Visible tooltip descriptions refresh when stats change, without rewriting unchanged text.

All 393 source/simulation checks, four focused Chrome scenarios and nested-path production smoke pass. The new browser case keeps the tooltip open through a Pickaxe purchase and level-18 growth, observes 60→85 damage, and confirms all seven released arrows carry the same 85 damage. Existing saved-cast and bonus-AD-only tests pass. Inspected the updated tooltip screenshot. Full-suite/performance checks were not repeated. Spell rank progression and complete native tooltip styling/details remain unfinished.

## Heal tooltip shares cast calculation

Extracted the existing level-scaled Summoner Heal amount into a shared query, including optional per-recipient recent-Heal reduction. Casts still cap healing to each recipient's missing health. The open tooltip now displays the caster's current base amount and explicitly reports reduced self-healing while the recent-Heal penalty is active.

All 393 source/simulation checks, four focused Chrome scenarios and nested-path production smoke pass. Browser coverage follows 80→318 healing through level growth, checks the actual 318-point cast event, then observes the 159-point reduced amount and its removal exactly at expiry. Existing recipient selection/reduction tests remain passing. Inspected the reduced-healing tooltip screenshot. Full-suite/performance checks were not repeated. Broader healing modifiers and exact native tooltip presentation remain unfinished.

## Keep live tooltips inside resized windows

Tooltip placement now measures the rendered panel and clamps its position within viewport margins. Repositioning occurs on opening, viewport resize and changed live description text; tooltip width and height are bounded to the viewport. This replaces the fixed-width, opening-only bottom offset.

All 393 source/simulation checks, four focused Chrome tooltip cases and nested-path production smoke pass. The new scenario opens Heal at desktop size, resizes to 600×420, then adds the longer recent-Heal text and verifies the full panel remains visible. Inspected the small-window capture: the tooltip is readable above the ability controls. Full-suite/performance checks were not repeated. Complete mobile interaction and exact native tooltip geometry remain unfinished.

## Spell-rank source audit and resource tables

Pinned and normalized Q/W/E/R mana/cooldown tables against both game and client exports, and connected existing rank-one ability definitions to the generated values. The audit found different array indexing for game mana versus cooldown fields; the client coefficients confirm the normalized result. Client `maxLevel: 0` is explicitly not treated as a valid learning cap.

All 393 source/simulation checks, dual-source export verification and nested-path production smoke pass. Added `SPELL-RANKS.md` with the concrete state, command, cast snapshot, recharge, bot, UI and save integration requirements. No skill allocation behavior is claimed: standard-match unlearned spells and verified level restrictions remain unfinished. This establishes validated data and integration scope for actual progression, not completion of that feature.

## Verify rank counts and source skill recommendations

The spell-rank exporter now derives its table lengths from the selected game spell's level-up tooltip record: five ranks for Q/W/E and three for R. Pinned those complete records and the source recommendation list. Map-11 bottom/utility recommendations are R/W/Q/E priority with W/Q/E/W early choices; map 12 has a different opening and must not be substituted.

All 393 source/simulation checks and the expanded dual-source exporter pass. Runtime learning behavior is unchanged. This audit resolves the rank-count evidence gap left by unusable client `maxLevel: 0`, but recommendations and tooltip counts do not establish champion-level learning permissions. Standard unlock thresholds, allocation controls/state and actual rank-driven gameplay remain unfinished. Browser/production tests were not repeated for metadata generation with unchanged active values.

## Source Crystal Arrow damage ranks

Extended R's exporter to verify its damage formula and retain 200/400/600 normal-rank base damage plus the 1.2 AP ratio. Replaced both runtime 200 literals with the source rank-one entry and expanded tooltip feedback to cover damage, splash and distance-based stun bounds.

All 393 source/simulation checks, five focused tooltip Chrome scenarios, R export verification and nested-path production smoke pass. The new browser case verifies the displayed 200 damage and 1–3.5 second stun range against a real released R projectile; the tooltip screenshot was inspected. Full-suite/performance checks were not repeated. Higher-rank allocation and AP scaling are not implemented by this data change; full production fidelity remains unfinished.

## Amplifying Tome and Crystal Arrow AP scaling

Added source-pinned Amplifying Tome and its icon, flat item AP ownership, and R's verified 1.2 AP scaling. R's tooltip and cast use the same damage query. Item AP is derived from inventory, so no redundant snapshot field is introduced. Already-started casts retain their captured damage through sale and saved continuation.

All 396 source/simulation checks, six focused Chrome scenarios, Tome/sell verifiers and nested-path production smoke pass. Tests cover both teams, stacking, independent inventories, unchanged Volley damage, sale during R windup and restored projectile damage. Browser input verifies 200→224→200 tooltip damage through purchase and sale; inspected the screenshot. Full-suite/performance checks were not repeated. Broader AP modifiers, AP stat display, actual rank allocation and full production fidelity remain unfinished.

## Ability power in the combat HUD

Added the live ability-power readout beside attack damage, using the pinned `scaleap` icon region from the already-shipped source atlas. Tightened vertical stat spacing so six values fit within the existing stat column without increasing panel width. Extended atlas verification to the sixth region.

All 396 source/simulation checks, the AP purchase/sale browser case, six-icon atlas verification and nested-path production smoke pass. The browser case checks 0→20→0 AP and all six stats inside a 1366×768 viewport. Inspected the laptop capture: icons and values remain distinct and fit the panel. Full-suite/performance checks were not repeated. Native stat-panel geometry, broader AP modifiers and full production fidelity remain unfinished.

## Verify AP-scaled Crystal Arrow through impact

Added both-team integration coverage for a real R cast with two Amplifying Tomes, selling both during flight, and restoring the pre-impact checkpoint. Tests check actual health loss: captured 248 damage becomes 124 against the primary champion's 100 MR and 248/1.5 against a splash minion's 50 MR. The champion assertion accounts for the same-tick regeneration that follows impact. A minion beyond splash range remains unharmed, the projectile is consumed, and restored state matches uninterrupted execution.

All 398 source/simulation checks pass. No runtime behavior changed; browser and production smoke were not repeated for this test-only addition. This verifies the current captured-damage policy, not independent evidence of native cast-snapshot timing. Rank allocation, broader AP modifiers and production fidelity remain unfinished.

## Preserve tooltip ownership across pointer and keyboard input

Ability tooltips now track focus and hover separately. Leaving a focused ability keeps its description visible; hovering another ability temporarily shows that description and restores the focused ability when the pointer leaves. Moving focus away from a still-hovered ability also preserves its tooltip. Opening a dialog clears tooltip ownership and `aria-describedby` together, preventing a hidden tooltip from remaining attached to an ability control.

All 398 source/simulation checks, six focused Chrome tooltip scenarios and nested-path production smoke pass. The new browser scenario exercises real mouse movement, keyboard focus, shop opening/closing and resumed tooltip use, with no page errors. Tooltip layout/content is unchanged. This is browser interaction polish; exact native input behavior and the broader production clone remain unfinished.

## Shared spell-rank calculations

Added shared normal-rank queries combining each spell's resource requirements with Q bonuses, W damage/arrow count, E recharge and R damage. W/R world queries now delegate to these calculations and support explicit rank previews with current owned stats. Invalid and unlearned ranks throw instead of accidentally reading extra exported entries. Current casts retain rank-one behavior until champion rank ownership is connected.

All 401 source/simulation checks, seven focused Chrome scenarios, all five spell/resource source exporters and nested-path production smoke pass. Tests cover every normal rank, invalid numeric ranks, separate E timers and read-only higher-rank previews after item purchases and level growth. Standard-match learning, saved rank state, allocation controls and bots remain required; this commit establishes their shared calculations and does not claim progression is implemented.

## Champion-owned ranks drive combat and HUD

Added per-champion Q/W/E/R ranks, saved pending-cast ranks and retained E recharge durations under snapshot version 29. Actual mana costs, cooldowns, Q attack speed/damage, W arrow count/damage, R damage and E recharge now consume owned ranks. Bot resource checks and live HUD costs/descriptions use the same ownership. Rank-zero spells cannot cast or generate Q Focus. Saved-state validation rejects invalid rank caps, incompatible active states and invalid recharge durations.

All 407 source/simulation checks, eight focused Chrome scenarios and nested-path production smoke pass. New integration coverage exercises both teams, captured W/R casts during rank changes, rank-five Q attack output, E upgrades during recharge and saved continuation. Browser coverage checks all four spells, live resource metadata changes and an unlearned tooltip without page errors. Existing initialization still grants rank one to every spell; point accounting, learning commands/controls and bot allocation are the next required integration, not completed here. The preserved cast/recharge upgrade timing remains a documented simulation policy pending native verification. Full production fidelity remains unfinished.

## Skill-point allocation and upgrade controls

Added saved unspent skill points, XP point grants, validated learning commands, ability upgrade buttons, rank markers and Ctrl+Q/W/E/R shortcuts. Successful learning spends one point and adds one rank without casting or interrupting an order. Commands work while dead or stunned. Normal basic and ultimate level gates are implemented as documented conventional rules; their extraction from game constants remains unverified. Snapshot version is now 30.

All 411 source/simulation checks, eight focused Chrome scenarios and nested-path production smoke pass. Tests cover both teams, first learning, every gate boundary, point conservation through level 18, invalid upgrades and queued saved continuation. Real browser input upgrades W by click and Q by shortcut without generating casts. Visual inspection caught title overlap; reserved an upgrade row, added a non-overlap assertion, reran the learning browser test and production smoke, and inspected the corrected screenshot. Current practice initialization still grants four rank-one spells; standard unlearned initialization, strict standard point-budget save validation and bot allocation remain unfinished. CSS upgrade art is not yet native asset fidelity.

## Source-recommended bot skill allocation

Exported the pinned map-11 default skill recommendation into runtime data and connected bot point spending to the shared learning validator. Bots use W/Q/E/W early choices, then R/W/Q/E priority among legal upgrades; they retain points when no upgrade is legal. Allocation also runs while dead or stunned, and human points remain untouched.

All 415 source/simulation checks, three focused bot Chrome scenarios, source export verification and nested-path production smoke pass. New tests cover both teams through all 18 levels, human independence, accumulated points during death with saved continuation, and a real XP-upgraded Volley releasing eight rank-two arrows. Default matches still use the existing four-rank practice grant; standard unlearned initialization and stricter standard point-budget validation remain next. This source recommendation does not establish exact native bot decision timing or complete bot fidelity.

## Standard spell startup on the full Rift

Full-Rift champions now start with four unlearned spells, one skill point and no Hawkshot charges. First learning E grants its two charges. Only the explicit practice fixture retains its four free rank-one spells. Snapshot 31 enforces full-Rift rank totals plus unspent points equal champion level, rank-level gates and zero E charges before learning.

All 416 source/simulation checks, 13 focused Chrome scenarios and nested-path production smoke pass. The new default-map browser case verifies the starting points, three available basic upgrades, unavailable R, unlearned tooltip and a real Hawkshot launched after clicking its upgrade. Minimap E/R tests now learn their spells first; production smoke learns E via Ctrl+E. Full-Rift checkpoint/reload tests pass, and the resulting full-map screenshot was inspected. The full browser suite was not repeated. Native gate extraction, exact upgrade timing, champion exceptions and broader production fidelity remain unfinished.

## Full browser regression after spell progression

Ran the complete configured Chrome suite against `87e57a4` without runtime changes during execution: all 161 scenarios passed in 5.5 minutes, with one worker and zero retries. Updated `reference/browser-regression.json` with the exact tested commit, all scenario results and the captured output hash. Coverage includes combat, spell learning, bot behavior, source effects, full-Rift rendering, shop layouts, recovery and saved continuation.

This replaces the older 148-scenario browser baseline. No runtime code changed in this verification commit. Existing production smoke and 416 source/simulation results remain recorded above; performance was not remeasured. A passing regression suite does not establish complete native visual parity, full 5v5 behavior or production completion.

## Inspect spells before learning

Unlearned tooltips now display explicitly labeled rank-one mechanics and actual rank-one resource requirements instead of hiding the description and showing zero costs. W/R previews include the champion's current owned stats. The instruction line shows the learning shortcut or the current validation reason, updating while open when a point is spent elsewhere.

All 416 source/simulation checks, nine focused Chrome scenarios and nested-path production smoke pass. New full-Rift browser coverage verifies R's preview and level requirement, W's damage/mana/cooldown and shortcut, then the live no-points reason after learning E. Inspected the preview screenshot. The full suite was not repeated for this tooltip change. Native tooltip typography/layout and broader clone fidelity remain unfinished.

## Practice reset respects learned spells

Fixed a full-Rift save regression: Reset cooldowns had granted Focus stacks and E charges to unlearned abilities. It now fills these resources only for learned Q/E, leaves skill choices and points intact, and uses Q's source four-second stack lifetime. Updated the practice panel's obsolete all-spells-unlocked claim and reset feedback.

All 416 source/simulation checks, the two existing Hawkshot scenarios and two new full-Rift reset/save/reload scenarios pass, as does nested-path production smoke. The new cases compare the entire restored checkpoint after waiting for save confirmation, covering both unlearned and learned Q/E. Their first draft reloaded before asynchronous save completion; that test race was corrected and both cases rerun successfully. Full-suite and performance checks were not repeated; broader production fidelity remains unfinished.

## Source atlas artwork for skill-up controls

Replaced CSS plus signs with gold-chevron regions from the unmodified 16.18 `clarity_hudatlas.png`, including visually selected idle, hover/focus and pressed regions. Pinned the atlas bytes, measured 52×52 source regions and 20px display size. A verifier checks manifest provenance, atlas dimensions and CSS sampling coordinates. Adjusted the reserved row to fit square controls while preserving accessible button labels and keyboard focus outlines.

All 416 source/simulation checks, three focused learning Chrome scenarios, atlas verification and nested-path production smoke pass. Inspected the resulting control screenshot; buttons fit above their abilities and below the title. The source layout files were not recovered from the inspected Global archive, so semantic state assignment and display sizing are explicitly visual inferences, not verified native mappings. Full browser/performance suites were not repeated; exact native HUD geometry and broader fidelity remain unfinished.

## Champion XP payout for both teams

Replaced the human-only flat champion XP reward with the source victim-level bounty and a shared death transaction. It captures all awards before any recipient levels up, includes recorded damage/reveal contributors plus nearby opponents, and distinguishes unrestricted takedown death credit from the ten-second proximity-only window. Both teams now gain XP and skill points from champion kills. Shared bounty indexing was corrected to victim level after fuller reference retrieval; decimal-level arithmetic and level-cap sharing remain documented interpretations requiring native comparison.

All 426 source/simulation checks, seven focused Chrome scenarios, source verification and nested-path production smoke pass. Coverage includes all solo bounty levels, share bands, mixed levels, proximity and posthumous boundaries, distant/dead contributors, saved continuation and a real attack kill reaching level two with a new skill point. Updated the obsolete minion-suite assertions for the former 1,400-unit/180-XP champion path. Support-assist tracking, execution attribution and full native payout parity remain unfinished. Full browser/performance suites were not repeated.

## Champion credit after turret and minion final blows

Added recent-damage execution credit using the community reference's 15-second Summoner's Rift window, kept distinct from the assist constant. Direct champion final blows take precedence; otherwise the latest eligible damage contributor receives kill gold, first blood and the kill counter, and is excluded from assists. The actual finisher still owns the damage event. Untouched/expired executions preserve first blood and pay no champion kill gold.

All 433 source/simulation checks, four focused Chrome scenarios and nested-path production smoke pass. Tests exercise both teams, turret/minion finishers, actual same-tick hit order, the expiry boundary, dead contributors, direct-kill precedence and saved continuation. Browser coverage verifies credited gold and kill HUD values. Native constant extraction, debuff-only/special reveal attribution and full execution parity remain unfinished; the reference source and local inclusive-tick convention are documented. Full browser/performance suites were not repeated.

## Assist-gold evidence and capture design

Corroborated the pinned opening-timer shift against Riot's 26.1 Game Start Time notes without promoting unnamed fields to verified behavior. Added competing endpoint/duration predictions, discriminating capture times, required observation metadata and a reward interaction matrix to ASSIST-GOLD.md. Updated its stale XP/execution status and aligned the fidelity plan's historical performance figures with the saved d0d65a5 benchmark.

The existing cross-version source verifier passes; independently calculated hypothesis values, local document links and diff whitespace checks pass. This is a research/design change: no assist payout was added, no native capture was performed and no runtime/browser/performance suite was rerun. The full production goal remains unfinished.

## Heal support contribution rewards

Accepted allied Heal now records support contributions for assist counters and champion takedown XP. One deduplicated contributor set serves both rewards, including support of direct assistants, distant/dead supporters and credited executions. It excludes the killer from assists and does not expand support chains recursively. Snapshot 32 validates and retains entries; recipient respawn clears the prior life's support.

All 441 source/simulation checks, four focused Chrome scenarios and nested-path production smoke pass. New coverage includes both teams, saved continuation, expiry, mixed/repeated contributions, full-health haste, rejected casts, proximity-only exclusion, execution handling, malformed saves and respawn clearing. The browser uses real F input and verifies the assist HUD. The community support-assist description motivates the behavior; applying the source general 15-second window to support, full-health haste eligibility and one-hop timing remain explicit interpretations pending reference captures. Assist gold and broader production fidelity remain unfinished. Full browser/performance suites were not repeated.

## Prepared Ashe Q source projectile artwork

Recovered the active icearrow emitter's SCB mesh and TEX texture from the pinned Ashe archive, distinguished it from the disabled flat arrow emitter, and converted it to a 49,788-byte GLB. Pinned full effect data, extraction provenance and conversion checks. The artifact retains 244 triangles, source UVs, vertex transparency and the 256×256 texture, with emitter transforms left explicit for later integration.

Khronos validation reports zero errors/warnings, exact read-back checks pass, and the isolated one-draw Chrome preview was inspected. The renderer and simulation are unchanged; runtime/browser regressions and performance were not rerun. Source artwork preparation advances the Q flurry pipeline but does not complete its five-arrow schedule, on-hit behavior, effects or combat integration.

## Source Q arrow combat integration

Empowered arrows now use the prepared source ice-arrow model. Release captures projectile identity alongside damage, and snapshot 33 preserves it independently of later buff state. The model uses authored scale and an explicit forward-axis adaptation; native attachment offset and flight-height calibration remain open. Shared geometry/material/texture ownership prevents one removed projectile from disposing another's resources.

All 442 source/simulation checks, six focused Q Chrome scenarios and nested-path production smoke pass. Inspected the combat capture and verified source geometry, texture, vertex alpha, expiry persistence and shared-resource disposal behavior. Tests also preserve identity through source death/save restoration and reject invalid saved empowerment. Full browser/performance suites were not repeated. Five-arrow sequencing, individual impacts and the remaining source particle layers are still unfinished.

## Ordinary source attack arrows

Verified the ordinary attack resolver and active icearrow1 emitter against the cached source. It shares Q's mesh/texture but has its own authored width scale. Generalized the shared arrow renderer to display ordinary champion attacks using that scale, retaining captured normal/Q identity and source blue color for either team. Nonchampion projectile rendering is unchanged.

All 442 source/simulation checks and nested-path production smoke pass. Seven focused Chrome cases passed before a TypeScript tuple-spread correction; all three arrow cases were then rerun successfully on the corrected code. The source exporter passes and the red-team combat screenshot was inspected. Full browser/performance suites were not repeated. Complete surrounding particle effects, native attachment calibration and Q sequencing remain unfinished.

## Official Q flurry frame reference

Retrieved the Q demonstration embedded by Riot's champion page, pinned video/page hashes and metadata, and inspected ordinary-to-Q transition and flurry frames. The visible staggered, separated flight paths rule out simultaneous coincident arrows as a faithful visual implementation. Inspected animation records do not supply five launch events; differing cast-frame values do not establish a repeat schedule.

Added a reproducible provenance/metadata verifier and three ordered contact sheets. The verifier passes. This adds primary visual evidence without claiming the unspecified recording patch or attack-speed setup matches 26.18. Exact delays and individual-hit behavior remain unresolved; no runtime constants changed and runtime/browser suites were not rerun.

## Source attack-arrow glows

Added ordinary/Q Glow and Glow1 layers using verified source emitter records and the original texture. Saved attack launch ticks drive color-curve age; instances share geometry/texture and own only their changing glow materials. Native particle-plane adaptation and impact linger remain documented interpretations.

All 444 source/simulation checks and nested-path production smoke pass. Six related Chrome cases initially passed; the new Q check failed because its returned observation omitted three asserted fields. Corrected the observation and reran all three arrow cases successfully, including private-material disposal. Inspected the updated combat capture. Full browser/performance suites were not repeated; other particle layers and full flurry behavior remain unfinished.

## Full browser regression after attack-arrow effects

Ran all 170 configured Chrome scenarios against `34eed412090940b13a307e7da8764b5cdbc6513c` without code changes during execution. Every case passed once: zero failures, skips, flaky results or retries, one worker, 357.5 seconds. The JSON report's individual results and top-level error list were checked before replacing the 161-case historical baseline in `reference/browser-regression.json`.

Inspected fresh full-Rift fountain and river-aiming captures and recorded their hashes with the tested commit and report hash. This verification adds no runtime behavior and does not establish native visual parity, full 5v5 completeness or the still-open performance target. Source/simulation checks and production smoke were not rerun in this verification-only turn; their prior results remain above.

## Q flurry payload preparation

Exported verified shot count and primary/no-on-hit spell identities from the pinned records. Added a rank-aware helper preparing five equal arrow damage shares with only the first marked for on-hit dispatch. All 446 source/simulation checks and source export verification pass, including every rank's damage total and invalid inputs.

This is executable payload preparation, not live flurry integration. Equal division and callback assignment remain documented interpretations; the aggregate runtime attack has not changed, and no launch interval was invented. Browser/production/performance suites were not rerun. Sequencing, individual impact dispatch and native comparison remain open.

## Live staggered Q impacts

Connected five-arrow payloads to live ranged Q attacks. Separate saved pending/active queues retain captured damage and launch identity; every projectile applies its own physical impact. First-arrow-only on-hit/Frost handling avoids refreshing the slow from the four secondary arrows. Committed bursts survive source death and stop on target death. Snapshot 34 validates future pending launches and IDs.

All 451 source/simulation checks, nine focused Q Chrome scenarios and nested-path production smoke pass. After immediate pending-target cleanup was added, all four arrow Chrome cases were rerun successfully. Inspected the live flurry capture. Coverage includes both teams, per-impact mitigation, source/target death and exact saved continuation. Four-tick spacing, committed-burst semantics and fixed launch origins remain explicit approximations; native curved flight and timing calibration are unfinished. Full browser/performance suites were not repeated.

## Separated Q flight presentation

Added bounded lateral paths for secondary flurry arrows, with tangent facing and convergence at the existing collision boundary. Saved initial origins make the presentation reproducible after restoration. Authoritative homing, damage, visibility eligibility and pending launch scheduling retain their existing behavior. The spread and sine envelope are explicitly provisional; the pinned fixed-speed missile records do not supply native curve coefficients or resolve animated hand launch positions.

All 453 source/simulation checks, eight focused Q/arrow Chrome cases and nested-path production smoke pass. Inspected the updated `artifacts/ashe-q-live-flurry.png` showing separated live arrows. Tests check saved presentation equivalence, unmodified gameplay state, rotation, bounded spread and contact convergence. Full browser/performance suites and native-client comparisons were not repeated; complete Q parity and the full-match milestones remain open.

## Q flight continuity fixes

Reproduced two visual defects with failing regression cases: nonzero endpoint slope produced an approximately 17-degree facing discontinuity for the outer arrow, and moving targets were sampled at current simulation time while arrows were interpolated. The envelope now has zero endpoint slope, and target position uses the same interpolation phase as the projectile. This improves the provisional adapter without changing combat or claiming a native curve formula.

All 455 source/simulation checks, four arrow Chrome cases and nested-path production smoke pass. Inspected the updated live flurry capture. The two new regressions failed before the fix and pass afterward. Full-match performance and native trajectory calibration remain open.

## Bot retreat recalls

Retreating champions can now recall when safe and sufficiently far from their own fountain. They preserve a safe channel, cancel it for visible approaching threats, avoid visible incoming targeted missiles, and wait after recorded champion damage before retrying. Nearby hidden enemies do not alter the decision. Recall uses the same queued command and validation as human input, and saved channels continue identically on both teams.

All 461 source/simulation checks, six focused bot/recall Chrome scenarios and nested-path production smoke pass. One retry assertion initially checked before the next scheduled AI decision; it now accounts for the existing 18-tick cadence. This adds a recovery tactic, not a complete role/team planner. Travel-cost estimation, last-seen threat memory, economic recalls, nine-bot matches and full-match performance remain open; see BOTS.md for the policy's limits.

## Bot last-hit selection

Bots now prioritize an in-range, visible lane minion that the next attack impact can kill, considering armor, bounty and distance. Immediate champion threats retain priority and valid windups remain committed. Q estimates use the first arrow rather than the entire delayed burst. Shared damage arithmetic keeps the estimate consistent with current mitigation rules.

All 466 source/simulation checks, five focused bot Chrome scenarios and nested-path production smoke pass. New coverage includes both teams' actual kill/CS with exact saved continuation, visibility/range/armor exclusions, valuable targets, windup commitment, close threats and Q. The browser scenario verifies actual target selection, kill, CS/gold and preservation of the closer healthy minion. Incoming-damage prediction, wave management, role assignments and full 5v5 remain unfinished.

## Bot tower safety

Added visible-tower danger checks before combat commitment and target pursuit. Unsupported bots move out and hold outside danger instead of repeatedly re-entering; living minion cover permits tower pressure, while tower focus and protected champion aggression override it. New danger can cancel a windup. Hidden/destroyed towers do not affect the decision, and saved continuation remains deterministic.

All 472 source/simulation checks, six focused bot Chrome scenarios and nested-path production smoke pass. Coverage includes support loss, tower focus, newly visible protection, stable holding and pursuit rejection. The browser fixture isolates decisions by delaying tower shots. Whole-route danger avoidance, threat memory, alternate safe target selection and coordinated team play remain unfinished; the full-match completion gate remains open.

## Turret retaliation recovery

Reproduced stale out-of-range retaliation orders that prevented towers from defending the lane, plus delayed reacquisition after invalid targets. Turrets now clear unusable orders and reacquire visible targets in the same tick. The release/recovery case retains its original attack deadline and missile already in flight. Tests also cover in-range retaliation priority, target radius boundaries, hidden targets and exact saved continuation.

All 477 source/simulation checks and nested-path production smoke pass. Three related bot browser cases passed initially; the new browser fixture failed because it reused renderer IDs from a different world. Changed that fixture to exercise the running world, then passed the recovery case and all three existing source-turret rendering/destruction cases. The two initial simulation regressions failed before the fix. Native retarget timing and complete tower behavior remain unaudited.

## Full-Rift bot lane progression

Replaced the fixed full-Rift midpoint destination with assigned-lane waypoint progression. Bots move toward the opposing base in team-relative route order, preserve their waypoint while traveling, and rejoin the assigned lane after combat or base return. Assignment uses the existing saved unit fields; unassigned bots default to mid. The practice sparring destination remains specific to that fixture.

All 481 source/simulation checks, four focused bot Chrome scenarios and nested-path production smoke pass. Early route tests exposed waypoint oscillation, now corrected by retaining travel commitment. The combat-resumption fixture also postpones the defeated opponent's respawn so it measures one interruption rather than a second fight. Browser coverage confirms progression beyond the former midpoint on the actual Rift grid. Full role assignment, jungle/team planning and complete-match certification remain open.

## Safe alternatives during target selection

Moved tower safety into the champion bot's candidate searches. A protected opponent no longer masks a farther safe target or a covered minion last hit. When every visible candidate is unsafe, the bot retains its hold instead of advancing the lane. Existing non-bot target acquisition remains unfiltered by this tactical policy.

All 484 source/simulation checks and nested-path production smoke pass. Two new simulation regressions failed before the change; hidden safe candidates remain excluded. Four related browser cases initially passed; the alternative-target case failed with fixture occlusion. Made that case's visibility precondition explicit, asserted the alternative is visible, and reran both tower-safety browser cases successfully. The full browser/performance suites were not repeated. Route-wide danger evaluation, safe poke and complete team strategy remain open.

## Full browser regression after bot progression changes

Ran the complete configured Chrome suite against `504f43279f4c082fe8d11827ff48a19c39c418c9` with an unchanged worktree: all 177 scenarios passed once, with zero failures, skips, flaky results or retries, one worker, 393.7 seconds. Checked every individual result, retry/error list and top-level error list before updating `reference/browser-regression.json` with the tested commit, scenario timings and raw report hash.

Inspected the fresh full-Rift fountain, river-aiming and live Q-flurry captures and recorded their hashes after verifying their timestamps belong to this run. This verifies the integrated implemented scenarios; it does not certify native pixel parity, complete nine-bot matches or performance. Source/simulation checks and production smoke were not repeated in this verification-only step; the previous 484-check and production results remain above. Team strategy, roster, jungle/objectives and full-match certification remain unfinished.

## Healthy bot shopping returns

Healthy bots now queue safe recalls for an affordable unfinished purchase when banked gold reaches the local 900-gold trip threshold. Purchase planning and recall safety are shared with existing fountain/retreat behavior. Channels persist while safe, cancel for visible danger, and do not override committed attacks. No new save state is required.

All 489 source/simulation checks, five focused bot Chrome scenarios and nested-path production smoke pass. Coverage includes both teams' saved round trips, actual inventory/gold/stat changes, capacity/completed-plan/affordability exclusions, danger visibility and attack commitment. The full browser/performance suites were not repeated. Adaptive builds, wave/objective timing and complete team strategy remain unfinished.

## Bot finishing ultimates

Added a visible-target finishing tactic for R. Bots check current post-resistance damage, rank, resources, cooldown, range and visible blockers before queuing a fixed observed aim through normal cast validation. Prediction shares the existing projectile radius; hidden blockers remain unknown. Retreat, committed windups and tower danger retain priority.

All 494 source/simulation checks, five focused bot Chrome scenarios and nested-path production smoke pass. Coverage includes actual kills, both teams' ownership, queued save continuation, source cast animation, projectile release, visibility/blockers and intervening stun. Teamfight initiation, defensive ultimates, movement prediction, full kits/roster and complete 5v5 remain open. Full browser/performance suites were not repeated.

## Defensive bot ultimates

Retreating bots can now use R to interrupt a close visible attacker, based on an observed attack windup or incoming targeted attack projectile. The shared planner retains resource, blocker and tower checks, skips already stunned threats, and resumes fountain movement after casting. Retreat state and queued casts continue identically through saves.

All 497 source/simulation checks, six focused bot Chrome scenarios and nested-path production smoke pass. The new browser case observes source cast animation, a nonlethal stun and continued escape. An initial exclusion assertion incorrectly required walking even when the existing safe-recall policy was available; it now verifies the appropriate escape choice. Teammate protection, threat prediction, full team strategy and complete 5v5 remain open; full browser/performance suites were not repeated.

## Bot lane scouting

Full-Rift bots with learned E now scout unrevealed authored lane points ahead, without using hidden enemy coordinates. Both charges must be available, preserving one charge while the spent one recharges. Scouting queues the normal fixed-point cast and retains lane movement through the cast delay.

All 501 source/simulation checks, four focused lane/E Chrome cases and nested-path production smoke pass. Reran the real-Rift scouting case successfully after adding an explicit source-animation assertion. Tests cover both teams, exact saved continuation, actual reveal, charge retention and hidden-enemy independence. Broader scouting tactics, reserved-charge use, objective/team planning and complete 5v5 remain open. Full browser/performance suites were not repeated.

## Emergency bot Flash

Critically injured retreating bots now evaluate terrain-resolved escape endpoints against close visible champions and turret danger, then queue an ordinary Flash cast. The selected landing must materially increase clearance; nearby secondary enemies can rule it out. Normal cast validation and independent cooldown ownership remain shared, and retreat resumes after the teleport.

All 507 source/simulation checks, six focused bot Chrome scenarios and nested-path production smoke pass. Coverage includes both teams, exact saved continuation, actual browser teleport, exclusion conditions, a second enemy, tower danger and intervening stun. The thresholds and scoring are local tactical policy, not native AI evidence. Offensive Flash, skillshot prediction, route-wide safety, full team strategy and complete 5v5 remain open. Full browser/performance suites were not repeated.

## Full-team integration and chase checkpoint correction

Added a reproducible headless ten-Ashe diagnostic on the actual Rift, with 2/1/2 lane assignments per team and ordinary starting resources. Its first five-minute run exposed invalid chase checkpoints: navigation spread an entire target unit into its endpoint. Restricted the navigation result to coordinates, retaining strict save validation. Both new regressions failed before the fix; the browser case verifies exact save/reload continuation into an actual attack.

All 509 source/simulation checks, nine focused Rift/save Chrome scenarios and nested-path production smoke pass. The diagnostic then reached blue Nexus victory at 40:22 within a 60-minute horizon, with no detected position/resource violations and an exact terminal snapshot round trip. Evidence and scope are documented in `TEAM-SIMULATION.md` and `reference/team-simulation.json`. This single mirrored-lane scenario leaves roster, roles/jungle, repeated-match certification and visual/performance gates unfinished; the playable roster is unchanged.

## Source-dimension champion picking

Verified the pinned Ashe character bytes upstream and exported selection radius 120 and height 155. Replaced fixed-pixel champion picking with a camera-ray selection cylinder at the rendered model position, making its projected area follow zoom and elevation. Shared hover/click/attack-move selection retains living/team-visible exclusions. Other unit categories retain their existing picker.

All 512 source/simulation checks and six focused selection/attack-move/structure-visibility Chrome scenarios pass. Production nested-path smoke passes. The new selection scenario covers three zoom levels and an inside point missed by the old fixed circle; the hover capture was inspected. An added comparison initially assumed the outside point was accepted by the old picker; that assertion failed and was corrected to check its actual zoomed-in inside miss. The cylinder shape and overlap priority remain adapter assumptions, and combat-radius defaults, dynamic unit collision and native selection pixel comparison remain open. See `CHAMPION-SELECTION.md` for evidence and limits.

## Moving-target selection and stationary hover

Reproduced a wrong-target selection when overlapping champions were ranked from simulation positions despite their pick volumes following rendered interpolation. Both now use rendered positions. Hover refreshes after each frame, so moving targets, lost visibility and death update feedback beneath a stationary cursor; pointer exit/focus loss/modal overlays clear it.

All 512 source/simulation checks and production smoke pass. Four attack-move browser cases passed in the initial run; all three selection cases pass after correcting an overbroad paused-state hover exclusion. Pausing without a modal retains hover inspection. The movement regression failed before the correction and now covers three interpolation fractions and reversed unit order. Native overlap priority, full-match hover cost and broader fidelity gates remain unverified.

## Lux source rig preparation

Prepared the planned second champion's base rig from the pinned client archive. Verified 25 original files and exact binary skin/animation definitions, then converted all 22 atomic clips, 79 bones and 4,926 triangles with the source skin scale and texture intact. Added an interactive development preview with clip selection, scrubbing and camera orbit.

The Lux browser case checks every skinned vertex at three samples per clip, and the idle/ultimate captures were inspected. All 512 source/simulation checks, full model/map asset validation and production smoke pass. Fixed the asset validator's pre-existing static Ashe-arrow manifest lookup so it could finish the complete catalog. Lux's kit, effects/audio, runtime champion identity and native lighting/transition calibration remain unfinished; this does not add a selectable or playable Lux. See `LUX-ASSETS.md` for reproducible commands and the full scope boundary.

## Lux binding audit and shared root support

Pinned Lux Q and Flash records, preserving conflicting child/parent range and cooldown metadata rather than treating all fields as final gameplay values. Added a root deadline distinct from stun: walking/Flash are blocked, attacks and non-movement spells remain possible, and expiry resumes retained movement. Flash rejects newly rooted queued casts without consuming cooldown. Snapshot 35 preserves the deadline and respawn clears it; health bars show ROOTED.

All 517 source/simulation checks, seven focused root/Flash/save Chrome scenarios and production smoke pass. Lux's actual two-target projectile, champion identity, damage/passive effects, full kit and CC exceptions remain unfinished. This is shared combat groundwork; no existing playable spell applies root yet. See `LUX-BINDING.md` for source fields and limits.

## Light Binding projectile resolution

Added a fixed-direction two-contact projectile primitive with swept travel-order hits, once-only magic damage/root, caster-death continuation and saved first-hit history. Allies/structures do not consume contacts; lane minions do. Snapshot 36 validates participants and retained hit history. Source child range/width interpretations remain provisional.

All 522 source/simulation checks, three focused binding/root/ultimate Chrome scenarios and production smoke pass. Initial test corrections isolated an otherwise active turret and respected rounded combat-text values. Lux input, resource/windup handling, passive application and native missile effects remain unfinished; the release method is a combat integration primitive, not a selectable Lux or a completed Q cast. Full match and performance suites were not repeated.

## Lux champion identity and queued Q

Added saved Ashe/Lux identity, Lux's pinned stats and growth/regen/selection dimensions, runtime source rig and recall sequence, and a normal resource-consuming Q windup that releases the two-contact binding. Ashe Focus and Frost Shot now apply only to Ashe. Lux's unfinished W/E/R remain unavailable. Snapshot 37 preserves and validates champion-owned cast state.

All 526 source/simulation checks, five focused Chrome scenarios (Lux, binding and selection), and nested-path production smoke pass. Inspected the in-match Lux recall capture. The default human remains Ashe; this does not complete Lux's passive, full kit, AI or native effects. The additional runtime rig costs 3.86 MB in initial model loading. Full browser, full-match and performance suites were not repeated; production fidelity gates remain open.

## Lux Illumination through Q and basic attacks

Pinned the complete passive records and verified the six-second standard-mode duration, 0.35 AP ratio and level-indexed 30–200 base damage. Q now applies/refreshes saved owner-specific marks. Lux attacks consume their mark once for separately mitigated bonus magic damage; expiry precedes combat, target death clears marks and caster death preserves them. Snapshot 38 validates owners and deadlines. Visible unit bars show ILLUMINATED after higher-priority statuses end.

All 533 source/simulation checks, three focused Lux/binding Chrome scenarios and production smoke pass. Native passive particles/attack presentation, R/E interactions and wider kit/AI work remain unfinished. See `LUX-ILLUMINATION.md` for the distinction between pinned values and adapter behaviors awaiting native comparison. Full browser, match and performance suites were not repeated.

## Lux Final Spark cast, impact and Flash exception

Audited R records and an official 30 FPS demonstration; pinned conflicting timing/geometry metadata instead of treating input range or visual-missile fields as damage geometry. Added champion-owned R resources/windup, all-target beam damage, Illumination trigger/refresh and source spell4 animation. Flash during R preserves its original beam, as Riot's 10.4 notes specify. Snapshot 39 preserves windup geometry and short-lived beam presentation; the Ashe tactical R planner excludes Lux.

All 538 source/simulation checks, three focused Lux Chrome scenarios and production smoke pass. Inspected the beam capture; its procedural ribbon remains an interim effect. Native particles/audio/vision, exact collision geometry, near-expiry passive extension and Lux R AI remain unfinished. Full browser, full-match and performance suites were not repeated. See `LUX-R.md` for evidence and limitations.

## Native Lux warning and beam texture layers

Resolved the base skin's shared particle binary directly from the pinned Riot archive after public shared-JSON paths failed. Verified six complete emitters and six original textures, then replaced the temporary canvas ribbon with native warning, rainbow core, flash and glow layers. Source emission delay is exactly one second. Animation follows saved simulation time, including authored scale/tint/UV curves and projected beam offsets.

All 538 source/simulation checks, two focused Lux Chrome scenarios and production smoke pass. The exporter verifies original hashes and decoded RGBA pixels; exported textures total 55,341 bytes. Inspected the composite and verified matching geometry/tint/primary UVs after save restoration. Six of 45 beam emitters are integrated; full particle, audio, UV/width/height calibration and wider performance gates remain unfinished. See `LUX-BEAM-LAYERS.md`.

## Saved shields and Prismatic Barrier source audit

Pinned W parent/child records and separated standard data from a recent League Classic change. Added independent allied champion shield grants, resistance-before-shield absorption, overflow health damage, expiry/death cleanup and snapshot 40 validation. Fully absorbed damage preserves recall while maintaining combat contribution; shield absorption contributes to the existing omnivamp calculation. Overhead bars show white shield capacity and bot finish estimates include active shields.

All 545 source/simulation checks, five focused Chrome scenarios and production smoke pass. Inspected the shield bar. W's actual cast/outgoing-return flight, two-application/stacking rules, native shield particles, support credit and broader shield exceptions remain unfinished; W stays unavailable. Native comparison of absorption ordering, recall/omnivamp interaction and bar scaling remains open. See `SHIELDS.md` for evidence and limitations.

## Lux Prismatic Barrier cast and two-pass shields

Connected queued W to source rank/AP resources, a 15-tick windup and Spell2 animation, accelerating/decelerating outbound/return flight, moving-caster tracking, and per-pass allied champion shielding. Same-cast return adds remaining capacity and refreshes duration; separate casts remain independent. Caster death before release cancels W, while a committed wand returns to the retained corpse point and continues shielding allies. Shield applications enter the existing support-contribution path. Snapshot 41 preserves and validates cast payloads, pass histories and linked shield grants. Ashe's offensive W planner no longer applies to Lux.

All 551 source/simulation checks, four focused Chrome scenarios and nested-path production smoke pass. Inspected the W shield-bar diagnostic capture. Source Spell2 is used, but W projectile/shield effects and audio are unfinished. Self-shield callback timing, refresh, collision width, corpse-return semantics and turn cadence remain documented approximations pending native comparison. Lux E, complete kit AI, full-match systems and production fidelity gates remain open. See [LUX-W.md](LUX-W.md).

## Lux E source audit and lifecycle contract

Pinned all five E ability/spell records, the Data Dragon E entry and hashed official video. Added a reproducible source-profile exporter that checks the original hashes, child graph, root formula and cross-source rank arrays. The audit rejects legacy recast damage as the governing formula, separates 1200 movement-component speed from legacy 1300, and retains radius candidates 295/310 and vision/perception 650/750 without conflating their meanings. Official 13.17 damage and 10.11 post-detonation slow corroborate the root values.

Inspected overview, flight/arrival and explosion frame sheets. The promotional clip lacks input/build/coordinate evidence, so it does not establish automatic lifetime or collision geometry. Documented the complete E lifecycle, recast/vision/save requirements and the shared slow-state limitation that must be fixed before an overlapping persistent field can work correctly. E remains unavailable; this commit adds evidence and a generated source profile, not a partial runtime spell. Export regeneration and source verification pass; TypeScript compilation passes. No browser/performance rerun was needed for this source-only change. See [LUX-E.md](LUX-E.md).

## Independent overlapping slow effects

Added source/effect-owned slow contributions with independent expiry and linear decay. Ashe basic/Volley/R applications now retain these contributions, fixing a lower-level Ashe hit erasing another Ashe's stronger slow. The movement resolver chooses the strongest current contribution, and the overhead SLOWED status uses that resolver. Same-source/effect refresh does not erase another source or effect; weaker contributions remain available after stronger ones end. Target death/respawn clears them while committed source death does not. Snapshot 42 validates the new state. Legacy diagnostic slow fields remain available and participate in the minimum-speed selection; Lucent field integration will use the new API.

All 557 checks pass, including six new overlap, interpolation, source refresh/death, actual two-Ashe Volley and invalid-state scenarios. Four focused Chrome cases pass for movement readouts, independent-effect expiry/status and run animation speed. Nested-path production smoke passes. No full-match, full-browser or performance rerun; movement caps, slow resistance, tenacity and native reapplication/decay calibration remain outstanding. See [SLOWS.md](SLOWS.md).

## Lux E queued cast, persistent zone and free recast

Integrated E rank mana/cooldown/AP damage, source Spell3, clamped/self aim, fixed-speed noncolliding flight, saved five-second zone, independent slow refresh, unobstructed team vision, buffered free recast and single detonation with magic area damage, Illumination and one-second slow. Committed flight/zone survives source death; windup does not. Snapshot 43 validates lifecycle and transit state. Lux charges stay separate from Hawkshot, and champion-tagged cast events prevent E playing Ashe's source sample.

All 566 checks, four focused Lux browser scenarios, eight audio scenarios and production smoke pass. Inspected the diagnostic zone screenshot. Native E effects/audio, Lux input/HUD selection and tactical AI remain unfinished. Lifetime anchor, collision radius, exit linger, recast exceptions and vision policies remain explicit approximations awaiting native comparison. Full-match, full-browser and performance gates were not rerun. See [LUX-E.md](LUX-E.md).

## Lux combat decisions and mixed Rift diagnostic

Added a Lux-specific queued combat policy: shield threatened injured allies/self, recast an armed E on visible champions, finish with R using magic resistance and shields, bind through at most one visible blocker, otherwise place E. Retreat uses shield/peel decisions; positions are captured into normal commands. E-first skill allocation and the available tome/boots purchases replace Ashe's recommendation and AD purchases for Lux. These are local bot policies, not reconstructed native AI or complete role/build logic.

All 573 checks pass, including seven new targeting, visibility, shielding, recast/save, R estimate, retreat and learning/purchase cases. Three focused Chrome cases pass: Lux ignores brush-hidden opponents before engaging with W/Q/E, and existing Ashe Volley/R behavior remains intact. Production smoke passes; inspected the encounter capture.

Extended the headless Rift diagnostic with an optional mixed roster and champion-tagged cast counts. Ten simulated minutes with eight Ashe/two Lux completed with no finite/resource violations and exact checkpoint restoration. Lux cast E 33, Q 30, W 13 and R 2 times; both reached levels 6–7. This is not full-match or rendered-performance certification. Both accumulated gold after tome/boots, exposing the remaining mage-item/build gap. Reproducible source hashes and compact evidence are in [reference/lux-bot-verification.json](reference/lux-bot-verification.json). See [LUX-BOTS.md](LUX-BOTS.md).

## Mage AP components and Deathcap recipe

Added pinned Blasting Wand (45 AP/850 gold), Needlessly Large Rod (65 AP/1200), and Rabadon's Deathcap (130 AP/3500 total, two Rods plus 1100). Deathcap's source APAmp=0.3 amplifies all current flat inventory AP, is applied once, and disappears when sold. Source item groups enforce one owned Deathcap, including save validation. Imported three hashed Data Dragon icons. Lux bot buying progresses through Rods/Deathcap/Wand; recall shopping uses remaining recipe cost and recognizes space freed by components.

All 579 checks and two focused shop browser cases pass; source exporter/hash checks and production smoke pass. Inspected the shop capture. The twenty-minute eight-Ashe/two-Lux Rift diagnostic had no finite/resource violations and exact checkpoint restoration; both Lux bots completed Deathcap and Wand. It did not finish the match or measure rendering. Complete mage builds, mana/haste systems, advanced item effects and remaining production gates are still open. See [MAGE-ITEMS.md](MAGE-ITEMS.md) and the pinned compact verification report.

## Sapphire Crystal and item mana

Added Sapphire Crystal with dual-source 300 mana, 300 gold and 210 sell value, full pinned records and a hashed source icon. Shared purchases apply net mana after component consumption; sales remove one copy. Living transactions use an explicitly provisional missing-mana policy with zero clamping, while dead purchases do not refill resources. Existing growth, recall, respawn and checkpoint behavior preserve the equipped pool. Native transaction semantics still need direct calibration; mana upgrades and Lux mana-build decisions remain unfinished.

All 584 checks, four focused Chrome shop cases, source regeneration and nested-path production smoke pass. Inspected the mana-shop capture. Full-browser, full-match and performance gates were not rerun. See [MAGE-ITEMS.md](MAGE-ITEMS.md).

## Ability haste, Glowing Mote and Fiendish Codex

Added source-pinned Mote (5 haste/250 gold) and Codex (25 AP, 10 haste/850 total, Tome + Mote + 200), two hashed icons, and additive item haste. Champion spell cooldowns use the 100/(100+haste) multiplier; summoner cooldowns and cast windups remain separate. Hawkshot captures hasted recharge per sequential cycle, and tooltips show effective cooldown/recharge with bounded decimal formatting. Snapshot 44 validates captured recharge durations reachable from the catalog, including equipment sold after the timer began. Native rounding, purchase-time rescaling and E inter-cast behavior remain calibration targets.

All 589 checks, seven focused Chrome tooltip/shop scenarios, source regeneration and nested-path production smoke pass. Inspected the haste-tooltip capture. The new browser case initially raced lazy icon loading; it now scrolls and waits for decoded dimensions. Complete mana/haste upgrade items, bot builds, full-match systems and production fidelity gates remain open. See [ABILITY-HASTE.md](ABILITY-HASTE.md).

## Lost Chapter, timed mana restoration and Lux build progression

Added source-backed Chapter stats (40 AP/300 mana/10 haste), Tome/Sapphire/Mote plus 250 recipe, unique ownership and a hashed icon. Enlighten captures 20% maximum mana after level growth and restores it over the next 180 ticks, with explicit refresh/sale/death policies awaiting native calibration. Snapshot 45 preserves and validates the effect. Lux now builds Chapter before Rods/Deathcap/Wand and does not rebuy the consumed Tome.

All 595 checks, three focused Chrome scenarios, source regeneration and production smoke pass; inspected the HUD capture. A twenty-minute mixed Rift diagnostic had no resource violations and exact saved-state restoration. Both Lux bots bought Chapter; blue completed Deathcap/Wand while red held two Rods and insufficient completion gold. No winner was reached. Full-match completion, native passive behavior, full-browser regressions and rendered performance remain unproven. See [LOST-CHAPTER.md](LOST-CHAPTER.md) and its pinned verification report.

## Complete browser audit and shield-label mutation repair

Ran all 201 Chrome scenarios after mage-item integration. The initial run passed 199 and exposed two failures: shield labels produced 120 unnecessary attribute mutations over 20 unchanged frames, and the Sapphire shop test read an offscreen lazy icon before decoding. Shield hidden/title attributes now change only when needed; the expanded regression verifies zero repeated mutations with and without a shield and correct appearance/removal. The icon test scrolls and waits for decoded width. Three.js now receives the PCF shadow mode it previously selected through an obsolete-mode fallback.

All 201 scenarios pass in the complete verification run, with one worker and no retries. The 595 simulation checks, three focused repair/shield cases and production smoke pass. Inspected source-base, laptop and shield captures; no new missing assets or layout obstruction were observed. Corrected this document's stale opening summary. This audit does not certify a full match, native pixel fidelity, cross-browser parity, offline delivery or frame budgets. See [BROWSER-REGRESSION.md](BROWSER-REGRESSION.md) and its hashed verification record.

## Ten-champion rendered encounter benchmark

Extended the rendering diagnostic to restore an exact ten-champion checkpoint through browser storage, choose a visible-threat camera subject and sample 1800 frames after 120 warmup frames. Added optional Chrome CPU profiling and a reproducible function-attribution summarizer with recursive-frame deduplication. The old practice mode still runs.

The twenty-minute mixed checkpoint rendered a bottom-lane Lux encounter with up to nine visible champions. The non-profiled run measured callback-delivery p95 19.6 ms/p99 21.2 ms (originally mislabeled frame cadence; corrected below); simulation p95 0.5 ms, render p95 7.2 ms and fog p95 3.7 ms. A separate CPU sample identified material animation/matrix work. Both checkpoint/profile runs and the practice-mode smoke completed without page errors; exact starting-state restoration and profile aggregation were checked. Inspected the encounter capture. No runtime optimization or FPS improvement is claimed; full-match frame budgets, GPU attribution and source texture budgets remain open. See [MATCH-RENDER-PROFILE.md](MATCH-RENDER-PROFILE.md) and its hashed evidence record.

## Exact constant bone-channel removal

Removed channels that equal loaded bone rest values at every key across the complete source clip set. The conservative filter preserves original assets/clips, dynamic properties, durations, additive/indexed fallbacks and full-source structure bounds. It removes 1,295 of 19,458 channels and 336 cached Three.js property bindings across one instance of each of 16 source rigs. Ashe and Lux channels remain intact under the strict rule.

All 114 clip-midpoint pixel comparisons match; 1,938 isolated pose pairs plus cross-fades have zero observed matrix error. All 598 checks, the new source comparison browser case, 14 animation-integration cases and production smoke pass. Inspected the ten-champion encounter capture. Clean original/filtered callback-delivery p95 values were 20.2/20.1 ms and p99 values 21.6/22.2 ms, so no FPS improvement is established. An initial overlapping baseline was excluded. Full frame-budget and native-fidelity requirements remain open. See [CONSTANT-BONE-TRACKS.md](CONSTANT-BONE-TRACKS.md).

## GPU timing and frame-clock correction

Added optional nonblocking WebGL2 elapsed queries to the benchmark, with availability polling, disjoint rejection, bounded pending queries and explicit unsupported reporting. Corrected the `frames` clock to browser-supplied animation-frame timestamps and preserved callback-delivery intervals separately. Earlier 19–22 ms callback tails do not establish missed frames; their prior interpretation is withdrawn.

The same ten-champion encounter measured timestamp p95/p99 16.8/16.8 ms both with and without GPU timing, with one of 1,800 intervals above 25 ms in each run. All 1,800 GPU queries resolved; elapsed p95 was 3.41 ms. Three helper tests and the default practice smoke pass; inspected the encounter screenshot. No application rendering/visual changes were made. These tools-only checks do not replace the previous application suites. Full-match, physical presentation, other hardware/browser targets and texture budgets remain open. See [MATCH-RENDER-PROFILE.md](MATCH-RENDER-PROFILE.md) and its new GPU/cadence evidence record.

## Preserve accepted commands through pause and saved-match reload

Removed command-queue clearing from the application pause handler. Pausing still releases held keys and unfinished aim; commands already accepted into the simulation remain part of its frozen state. This fixes a Heal clicked just before a fixed step disappearing when the player opens Pause to save, as well as pending commands discarded by the restored-match pause screen.

A new real-browser regression failed before the repair at the first pause-state comparison. It now uses the actual Heal, Save and Resume controls, checks exact state after pause/reload/repeated blur, and compares the first resumed tick with uninterrupted continuation. All 598 checks, 25 focused browser scenarios and production smoke pass. Inspected the restored pause capture. This is a local checkpoint correctness repair; no native League pause-policy equivalence or full production completion is claimed. See [SAVES.md](SAVES.md) and [verification evidence](reference/queued-command-reload-verification.json).

## Mixed-roster scoreboard identity and visibility

Scoreboard portraits now use each champion's identity, including Lux on either team, independently of player-facing names. Added the pinned 16.18.1 Lux portrait and its hash/size/source record. The icon refresher now merges its records so it cannot silently discard item and atlas entries contributed by other importers; all 32 existing records remained unchanged and all 33 asset files match their manifests.

Visual inspection of the initial ten-row layout exposed clipping despite the panel itself fitting the laptop viewport. Teams now occupy two columns, with five rows each for a full roster. At 1366×768 every row fits inside the panel without scrolling. Small-screen fallback retains stacked teams and scrolling. The new browser case checks actual portrait decoding, alternate displayed names, team/ownership labels, reopening/counter updates and all-row containment. Three focused scenarios and production smoke pass; 598 source/simulation checks passed before the final presentation-only layout adjustment, and the final production build includes TypeScript validation. The initial browser test's 120-pixel source-size assumption was corrected after inspecting the actual 128-pixel images. Final capture was visually inspected.

This is a usable mixed-roster scoreboard foundation, not native pixel parity: items, summoner spells, levels and further match details still need implementation and reference comparison. Human selection and ability HUD remain Ashe-specific. See [scoreboard evidence](reference/scoreboard-identity-verification.json). Movement-speed soft-cap verification remains unresolved as recorded in [MOVEMENT.md](MOVEMENT.md); the renewed source search did not justify changing its current formula.

## Scoreboard levels with saved team observations

Added compact level badges beside champion portraits. Allies and currently visible enemies show their current level; unseen enemies show a question mark until observed, then retain the last observed level while hidden. Simulation ticks update observations independently for both teams, regardless of whether the scoreboard is open. Version 46 checkpoints preserve observations and reject out-of-range, fractional or future levels.

Two simulation cases cover independent team visibility, a hidden level-up, exact restoration/reveal continuation and invalid observed levels. All 600 checks, eight focused scoreboard/save browser cases and production smoke pass. The browser follows unknown → level 2 → hidden gain retained at 2 → reveal at 3; the ten-row laptop layout still passes and the badge capture was inspected. This is a conservative team-knowledge policy, not a patch-specific native visibility/pixel certification. Other scoreboard fields, including enemy CS knowledge, still need their own visibility audit; items and summoner details remain unfinished. No full-match completion is claimed.

## Prevent hidden creep-score updates

The scoreboard previously read actual enemy creep score even when that enemy was unseen. Extended persistent team observations to capture `{ level, cs }` together. Allies and visible enemies use current stats; hidden enemies retain the observed values, and never-observed enemies show unknown CS. Observation records change only when a visible value changes. Version 47 saves enforce integer, nonnegative CS no greater than the actual count and preserve the existing level constraints.

All 601 checks, eight focused scoreboard/save browser cases and production smoke pass. The browser verifies unknown CS, observation at 4, retention at 4 through hidden growth to 6, and update to 6 upon reveal; exact hidden-state save/restore is covered in simulation. Final capture was visually inspected. This closes the direct hidden-CS read in the current scoreboard. Native refresh timing, unknown-value styling, item knowledge and other detailed UI behavior remain unverified; full production scope stays open.

Evidence: [scoreboard CS verification](reference/scoreboard-cs-verification.json).

## Scoreboard item inventories and saved observations

Added six ordered item slots to each scoreboard row, using pinned local item icons and item-name tooltips. Known empty slots and unknown enemy inventories remain distinct. Inventory is captured alongside level and CS in per-team observations; captures clone the array and update only when values differ, preventing hidden purchases/sales/recipes from mutating a previously observed pack. Version 48 checkpoints validate current and observed inventories with the same shared catalog, capacity and unique-item schema while allowing observed ownership to differ from current ownership.

All 603 checks, eight focused scoreboard/save cases and production smoke pass. Added simulation checks for alias isolation, ordered empty slots, hidden changes, exact restore/reveal and invalid observed inventories. Browser cases show a full ten-champion roster with complete builds and verify unknown → Tome/empty/Boots → hidden Wand change retained → revealed Wand/empty slots. An initial strict no-scroll failure led to reduced vertical row padding; the final laptop capture shows all rows and decoded item icons without scrolling and was visually inspected. The first browser run also overlapped a small HUD accessibility edit; the complete final run used stable source.

Item-name tooltips are a foundation; detailed item descriptions, summoner spells, trinkets and native scoreboard pixel comparison remain unfinished. Team observation timing is still a conservative local policy rather than a certified native 26.18 implementation. Full production match scope remains open. See [verification evidence](reference/scoreboard-items-verification.json).

## Complete current browser regression

All 205 Chrome scenarios pass in a single complete run at `b01bb24`, with one worker, no retries and no source edits during the run. This replaces the stale 201-case integration baseline. The full source-animation comparison still reports zero sampled matrix error and 114 identical pixel comparisons. Inspected fresh fixture/laptop and recovery-dialog captures; expected fault-injection console diagnostics were distinguished from test failures. Current source hashes match the prior 603-check and production-smoke evidence, so those checks were not repeated for this documentation-only audit.

No runtime repair was needed. This broadens verified integration coverage after the recent changes; it does not certify the unfinished full-match flow, roster, native visual comparison, offline delivery or performance requirements. See [browser audit](BROWSER-REGRESSION.md) and its current evidence record.

## Scoreboard item inspection

Added a catalog-backed item tooltip with name, full current catalog description and base gold price. It reads only the item ID in the displayed scoreboard slot, preserving observed enemy inventory instead of looking up live hidden equipment. Hover and focus share ownership, tooltips stay within the viewport, and item removal, scoreboard closure, dialogs and window blur clear stale descriptions. Focused slots reconnect across row rebuilds; resize and panel scroll reposition the tooltip. The tooltip is non-interactive so it cannot intercept its own hover target.

Browser testing exposed two integration defects during implementation: the scoreboard inherited disabled pointer events, and row rebuilding cleared focused-item state before reconnection. The panel now receives pointer input, and the focused slot key is captured before replacement. The final ten-case tooltip/scoreboard run and production smoke pass. The 603 source/simulation checks also passed; later repairs only changed presentation/focus handling and the final build reran TypeScript. Inspected the Lost Chapter tooltip at laptop size. The new case verifies old observed Tome information while the live hidden inventory contains Wand, focus ownership, score-refresh continuity, removal cleanup, viewport bounds and modal dismissal.

This reuses the existing catalog descriptions; native tooltip layout, dynamic item-stat details, active-item interactions and broader scoreboard completeness remain unfinished. Snapshot format remains 48. Full production match and native visual requirements remain open. See [item inspection evidence](reference/item-tooltip-verification.json).

## Scoreboard pointer isolation

The interactive scoreboard now suppresses the browser context menu, matching the battlefield and minimap controls. A regression uses the real overlap between the full ten-champion scoreboard and minimap at 1366×768: releasing R or right-clicking the covered area queues no command, the context-menu event is prevented, and E targeting on the exposed minimap still queues a cast.

The initial suspicion of a minimap cast-through gap was disproved: `Hud.minimapPoint` already checks `elementFromPoint` against the minimap canvas, and the pre-fix test passed the blocked-cast assertion. It failed at context-menu suppression, which is the actual repaired behavior. Nine focused cases and production smoke pass; inspected the overlap capture. No simulation or snapshot changes were made. Native layout parity and the full production requirements remain unfinished. See [pointer-isolation evidence](reference/scoreboard-input-verification.json).

## Scoreboard summoner identities

Added Flash and Heal source icons beside every champion portrait, with accessible spell names and name tooltips. These match the current fixed D/F loadout used by both supported champions. No enemy cooldown values enter the scoreboard rows or spell markup. The compact two-icon column preserves the ten-row laptop layout and the existing observed inventory behavior.

Nine focused scoreboard, item-inspection and minimap browser cases plus production smoke pass. The expanded roster test verifies both decoded icons for every team member and unchanged spell markup after enemy cooldowns change. The complete 1366×768 roster capture was visually inspected; all rows, item slots and spell identities remain legible without scrolling. Simulation and save format are unchanged; the existing 603 simulation checks were not repeated for this presentation-only change.

Customizable summoner loadouts, allied cooldown indicators, trinkets, champion selection and native scoreboard pixel comparison remain unfinished. Full production scope remains open. See [summoner identity evidence](reference/scoreboard-summoners-verification.json).

## Scoreboard death and respawn presentation

Dead champions now have a grayscale/dimmed portrait and an integer countdown derived from their existing respawn tick. The row signature includes alive/dead state and rounded remaining seconds, so the counter changes with simulation time and disappears on respawn. A dead champion without a scheduled deadline uses a death mark. The portrait's accessible label includes identity, observed level and death/countdown status.

The final five-case browser run, standalone TypeScript check and production smoke pass. A new case kills Lux, verifies the dead portrait, saves through the actual menu, reloads the exact frozen state, checks countdown progress and the tick immediately before respawn, then verifies color/label restoration on the exact respawn tick. Dead and respawned captures were visually inspected. The existing 603 simulation checks were not repeated for this presentation-only change; no simulation or snapshot schema changed.

This exposes the current simulation's public death/respawn state; native typography, exact countdown display conventions and broader scoreboard parity still require reference comparison. Full production match requirements remain unfinished. See [death presentation evidence](reference/scoreboard-death-verification.json).

## Portable match export and import

Added **Pause → Match files** with a real browser download, native file picker, validated time/result preview and explicit load action. Export preserves the exact current snapshot without touching browser storage, and remains available during graphics loss and at victory/defeat. Import bounds file bytes, applies the existing strict snapshot and battlefield validation, waits for the checkpoint transaction, then reloads into the ordinary paused restore flow. Failed writes retain the current world and previous save and permit retry. Pending accepted commands survive transfer.

Twenty-two distinct focused browser scenarios passed across the successful 17-case save/recovery run and final eight-case file/result run (three cases overlap). These cover isolated Chrome-context transfer, exact next-tick continuation, malformed/version/map/size rejection, failed write and retry, graphics-loss export, result exports, modal focus, regular saves and queued casts. Production smoke and TypeScript passed; the preview, rejection, recovery and both result dialogs were visually inspected. The source simulation and format 48 are unchanged; the existing 603 simulation checks were not rerun.

Early checks exposed test assumptions: fixture time is already advancing before pause; a wrong-map case needs a valid snapshot for that map; the result dialog now has two focusable buttons; and the existing result fixture incorrectly stored an entire Nexus as a reveal point. Tests now use the captured tick, a real Rift snapshot, both buttons in the Tab cycle, and position-only reveal data. Strict validation was preserved. Same-build file transfer is implemented; cross-engine replay certification, migrations, autosaves, offline asset caching and the full production match remain unfinished. See [file-transfer evidence](reference/match-files-verification.json) and [save behavior](SAVES.md#portable-match-files).

## Import failure during graphics recovery

Reproduced a pending-import race at `7eba420`: graphics restoration attempted to rebuild Pause while the import lock was active, then a failed write only updated the detached file dialog and a toast. The recovery dialog remained visible after graphics were ready. On failure, the HUD now releases the import lock and rebuilds the appropriate current graphics/pause dialog when the original file dialog has been replaced.

Screenshot review also showed that the toast was behind the modal. Interrupted-import errors now appear as an alert within the active dialog and persist through graphics restoration; resuming or beginning another import clears the retained error. Existing connected-dialog failures retain their inline status and retry behavior.

Two cases hold an import before its write, force actual WebGL loss/restoration, and abort the real IndexedDB transaction. Both completion orders preserve the exact frozen world and prior checkpoint, expose the error in the dialog, and permit explicit Resume after recovery. The original after-restoration case failed before the fix. All 13 file/recovery browser cases, TypeScript and production smoke passed on final source; both resulting pause dialogs were visually inspected. Simulation and snapshot format are unchanged, and the 603 simulation checks were not repeated. Full production fidelity remains open. See [interrupted-import evidence](reference/match-import-recovery-verification.json).

## Immediate attack-move input

Shift + right-click now issues attack-move on the battlefield and minimap. A directly picked enemy keeps explicit target ownership even with a closer opponent. Ground and allies use the existing attack-move order. The shared battlefield branch handles both A-click and this shortcut, clears unfinished spell aim, and leaves unmodified right-click behavior intact. Controls now explain the shortcut.

All 13 focused attack-move/minimap browser scenarios, TypeScript and production smoke passed. The controls dialog was visually inspected. Simulation and format 48 are unchanged; the existing 603 simulation checks were not repeated. Investigation did not establish frozen-patch soft-cap scope or cursor-priority acquisition boundaries, so neither numerical policy was invented in this change. Full production fidelity remains unfinished. See [input evidence](reference/attack-move-click-verification.json) and [movement coverage](MOVEMENT.md#immediate-attack-move-click).

## Bot last-hit race awareness

Bots now avoid visible lane minions forecast to die to launched allied minion/turret missiles before their own next basic-attack impact. Both last-hit priority and fallback pursuit apply the filter. Bots can take another safe target or hold briefly for the claimed minion's death, then resume lane travel. The forecast uses existing physical-damage and travel values; it does not predict future attacks, champion spells or target motion.

All 608 simulation checks, two focused browser cases and production smoke passed. Both-team regressions preserve exact saved continuation, compare with forecasting disabled, and verify the alternate CS gain. Additional cases protect viable last hits against slow/nonlethal/exhausted missiles and prevent permanent idle behavior. The browser capture was visually inspected. Format 48 is unchanged, but the simulation fingerprint changes checkpoint compatibility as usual. Full match roles, objectives, complete kits and native fidelity remain unfinished. See [bot policy](BOTS.md#avoiding-minions-already-claimed-by-allied-missiles) and [verification evidence](reference/bot-incoming-verification.json).

## Lux marked-minion farming

Lux bots now include an owned Illumination mark in last-hit damage when the mark is expected to survive until impact. The estimate accounts for current AP, separate magic resistance and shield totals, and excludes other Lux owners and short remaining lifetimes. Basic-attack resolution now calls the same existing Illumination damage helper, and farming shares its travel estimate with allied-missile race avoidance.

Both-team marked-selection cases reproduced the gap before implementation. All 612 simulation checks, three focused browser cases and production smoke passed; save/restore preserves the proc and kill exactly. An AP fixture was corrected to account for minion magic resistance, then verified against the same snapshot without Tome. The controlled browser scene was visually inspected. The estimate remains stationary-target bot policy. Format 48 is unchanged but the simulation fingerprint changes; full production fidelity remains unfinished. See [Lux farming behavior](LUX-BOTS.md#mark-aware-last-hits) and [evidence](reference/lux-last-hit-verification.json).

## Complete browser audit and audio-resume race

The final full Chrome suite passed all 221 cases with one worker and no retries (9.8 minutes). This integrates recent scoreboard, file transfer, input and farming changes. The audit found a real event-loss race while AudioContext resume was pending: the mixer consumed a source arrival before the context could play it. Event consumption now waits during that transition, with pause/mute history handling preserved. A controlled delayed-resume regression reproduced the bug before repair and verifies exactly one playback afterward.

Two test assumptions were corrected: the pause-menu Tab cycle now includes Match files and is checked in reverse, and the tooltip ownership case moves the pointer off the HUD before closing the shop to avoid legitimate re-hover events. Both passed five focused repetitions. The initial completed audit had 219 passes and the stale focus failure; intermediate attempts exposed the tooltip timing issue and audio race and were explicitly stopped. The final complete run was uninterrupted and green.

All 612 source/simulation checks, nine focused audio cases and production smoke also pass. Source animation equivalence remains zero sampled matrix error with 114 pixel comparisons. Fresh laptop, full-roster scoreboard and full-Rift recovery-dialog captures were visually inspected. The full production goal remains incomplete. See [audit findings](BROWSER-REGRESSION.md) and [verification record](reference/browser-regression-221-verification.json).


## Selectable local lane match

**Pause → New match → Start lane match** creates a human Ashe in the blue team with four allied bots and five opponents. Both teams use two top, one mid and two bottom assignments, with Lux mid and Ashe elsewhere. The human receives no automatic lane order. All champions start at their team's source fountain; original structures, wave rules and navigation remain intact. The existing bots buy, travel and fight using their current policies. Practice controls are hidden in this mode, and the HUD and scoreboard identify it as a lane match.

Starting replaces the browser checkpoint after explaining that consequence in the selection panel. Download remains available from Match files before replacement. Checkpoint restoration starts paused, restart preserves the chosen mode, and practice can be selected again. Failed checkpoint writes preserve the current world and saved data and leave an actionable error. Snapshot format 49 records the mode and rejects incompatible older saves.

This milestone exposes existing lane AI in the normal game UI. It does not add jungle roles, camps, neutral objectives, human champion selection, the remaining planned roster, or native visual certification. Those remain required work.

Validation: `npm run check` passed 615 tests across 126 files. The focused Chrome integration run passed 29 scenarios, including match selection/restart, failed replacement writes, save/file recovery, pause focus and scoreboard behavior. Nested-path production smoke passed nine audio recordings, navigation, real Hawkshot input and absence of the development hook. The 1366×768 selection and ten-player scoreboard screenshots were inspected. Evidence hashes are in `docs/reference/lane-match-verification.json`.


## Natural lane-match completion audit

The actual `createLaneMatch` entry now has a reproducible `lanes` option in `tools/qa/simulate-rift.mjs`. Unlike the older ten-AI fixtures, it leaves the human Ashe idle at the fountain and uses the shipped nine-bot roster. This deliberately asymmetric case completed at **39:07.883**, blue victory with the red Nexus destroyed, without resource/position bounds violations. Both bases lost structures and inhibitors. The 300-second, 1,200-second and terminal snapshots round-tripped exactly; the first twenty minute samples of the longer run matched the standalone twenty-minute run. This proves this starting configuration can progress naturally to a result, not balance or complete role intelligence.

`tools/qa/restore-match.mjs` imports the naturally reached terminal checkpoint through **Match files**, verifies the exact snapshot and Victory dialog, checks that 120 additional simulation ticks leave the terminal state frozen, then uses **Play again** and verifies a fresh paused ten-champion lane match at tick zero. Its laptop screenshot was inspected. This revealed a browser-default blue focus ring on the dialog; focused dialogs now use the existing gold keyboard-focus treatment. Two focused pause/graphics-recovery browser scenarios and nested-path production smoke passed after that CSS change. The existing 615 source/simulation checks apply to the unchanged simulation.

A 1,800-frame render observation from the actual twenty-minute checkpoint measured rAF timestamp intervals of 16.7/16.7/16.8 ms (median/p95/p99), with no intervals over 25 ms. GPU query times were 3.01/6.48/6.98 ms. It ran concurrently with the separate headless terminal simulation, so it is explicitly an observation under background CPU work, not an isolated comparison, optimization claim, physical presentation measurement or low-end performance certification. The 1920×1080 live top-lane screenshot was inspected. Evidence and hashes: `docs/reference/lane-match-completion-verification.json`.

Reproduce with:

```sh
node tools/qa/simulate-rift.mjs 3600 artifacts/lane-match-terminal.json lanes
node tools/qa/restore-match.mjs http://127.0.0.1:5173 artifacts/lane-match-terminal.snapshot.json artifacts/lane-match-terminal-ui
```

The restore diagnostic requires a development server and a terminal lane-mode checkpoint from the same simulation build. No native client comparison or broader production completion is implied.


## Champion-aware player input foundation

The input path no longer assumes that every Q is Ashe's instant Focus or every W is Volley. Lux Q/W/E/R use hold-to-aim and release-to-cast through the existing command queue. Her active E switches to a point-free instant recast, including queued detonation during flight, using only her own undetonated zone. Heal remains instant and Ashe's existing control behavior remains intact. Lux aimed spells currently require a battlefield cursor; inheriting the global Ashe E/R minimap policy would be incorrect without separate verification.

Lux Q/W/R draw straight corridor guides using the current simulation's range and width; E draws its current zone radius at the cursor position clamped to cast range. The guides reuse the existing dynamic geometry and sample terrain heights. They intentionally reflect current local geometry, whose native targeter relationships remain unresolved in the individual Lux source audits. These lines are not native effect assets or certified pixel matches.

The development fixture exercises a human-controlled Lux via the diagnostic hook: Q remains unspent while held, Escape cancels it, release roots and marks the dummy; W shields the caster; R damages its target; E release creates the zone and another press detonates it without a second mana charge or cooldown reset. The binding and zone guide screenshots were inspected. The still-Ashe HUD visible in these diagnostic captures is an explicit remaining dependency: champion selection, Lux icons/tooltips/title/resources and practice controls must be completed before presenting this as a supported playable Lux mode.

Validation: all 615 source/simulation checks passed. Nineteen existing Ashe tooltip, attack-move and minimap browser cases passed; the final four Lux input cases passed after correcting test timing around the first rendered guide and W's existing cast lock. Production smoke passed on the final input revision. Simulation schema 49 and its fingerprint remain unchanged. Evidence hashes: `docs/reference/lux-player-input-verification.json`.


## Lux player HUD and source spell icons

The restored Lux-player HUD now shows Lux's portrait/title and four pinned source spell icons, correct spell and upgrade names, current rank/AP/level descriptions, rank-one previews and champion-specific health regeneration. E switches between normal cooldown and a free **RECAST** state, including live tooltip updates and clickable detonation. Ashe Focus and Hawkshot charge widgets are absent for Lux; practice reset keeps those Ashe-only fields zero. Controls now describe Lux's aimed Q and E recast. See [LUX-HUD.md](LUX-HUD.md) for provenance and boundaries.

This completes the HUD dependency for the next champion-selection step; ordinary match initialization still selects Ashe. Native tooltip/effect parity and the wider production scope remain incomplete.

Validation: 615 source/simulation checks, 14 focused Chrome scenarios and nested-path production smoke passed. The Lux rank-one Q preview and active E recast screenshots were inspected at 1366×768. Simulation format 49 and fingerprint are unchanged. Evidence: `docs/reference/lux-hud-verification.json`.


## Selectable Ashe and Lux

**Pause → New match** now offers Ashe and Lux as keyboard-accessible choices for both practice and lane matches. The panel identifies the selected champion and explains their lane assignment. Human Lux replaces the allied mid bot; human Ashe replaces one bottom-lane bot. Both choices retain ten champions, nine bots, two Lux/eight Ashe, and the authored structures. Human input remains free: the hero receives no automatic lane order.

The World constructor initializes the chosen champion's real profile and independent spell state. Restart and Play again preserve champion and mode. Lux practice restarts by writing a fresh Lux checkpoint; Ashe practice retains its existing clear-checkpoint behavior. Choosing a different champion only changes the pending menu selection until Start is clicked. The write-failure scenario now explicitly selects Lux and confirms that a failed replacement preserves the previous world and saved checkpoint.

A browser scenario selects Lux with the keyboard, starts her actual lane match, learns Q through the HUD, hits a controlled dummy with real Q input, saves/restores the exact world, restarts the lane match, switches to Lux practice and restarts again. Source-grid simulation cases verify the Lux roster, practice stats/spells and exact saved continuation. Native champion/effect parity, the remaining roster and full role/objective play remain unfinished. Schema 49 is unchanged; simulation fingerprint compatibility changes.

Validation: 617 source/simulation checks and 13 focused browser scenarios passed, covering champion choice, target picking, lane startup/failure handling, Lux HUD and save restoration. The production smoke now also selects Lux, learns/casts Binding with real input, loads all four Lux icons under the nested static prefix, and verifies a Lux lane restart with no development hook. The 1366×768 selector and live Binding screenshots and 1600×1000 production Lux view were inspected. Evidence: `docs/reference/champion-choice-verification.json`.


## Lux basic-attack source package

The source audit confirms that Lux's basic attacks currently use a generic cone in gameplay. A verified replacement source package now includes the complete three-emitter definition, all six lossless textures and the 120-triangle crescent GLB. The exporter verifies the basic-spell → skin resource → decoded binary chain against the pinned client archive. Repeated exports preserve pixel hashes; GLB round trips preserve position, UV, topology and custom source face-color attributes. Unresolved mesh flags, central point and trailing bytes remain recorded rather than guessed.

All model/map asset validators pass with zero errors/warnings, the browser source-inspection case passes and its mesh/texture board was inspected. The production build passes; gameplay code and the prior 617-check simulation are unchanged. See [LUX-BASIC-ATTACK.md](LUX-BASIC-ATTACK.md) for reproduction and remaining shader/particle work. These assets are prepared for integration, not a claim that the generic projectile has already been replaced.

## Native particle shader inspection

Fixed selective extraction for shader archives without subchunk tables, retaining the table requirement for subchunked archives. Pinned four particle shader TOCs, exhaustively verified 2,576 variant hashes, checked 416 programs in five bundles, and extracted/disassembled 14 selected Metal programs without executing them. Repeated shader extraction matches all provenance; the existing Lux source exporter still passes unchanged.

Native disassembly establishes that the ordinary mesh/quad color path multiplies the source texture, vertex color and a separate particle-color lookup sample. Optional palette replacement is a different shader operation. The Lux scale/offset field hashes are identified, but lookup-coordinate generation, actual native variant/blend state and complete effect integration remain open. See [PARTICLE-SHADERS.md](PARTICLE-SHADERS.md). No gameplay/UI behavior changed in this step.

## Particle color stage in WebGL

Traced native quad VS lookup coordinates to the dedicated ATTR9 input, passed unchanged to the pixel shader. Added a reusable initial RGBA-product shader with uniform and vertex lookup paths, plus a development inspector using Lux's source Ring04/ramp and mote/spectral texture pairs. Coordinates are explicit inspection inputs while native age/type mapping remains unresolved.

Twelve GPU probes agree with independent CPU products from source PNG pixels within one byte per channel, including fractional tint alpha and an unrelated uniform in vertex mode. Both focused browser scenarios and the production build pass. The 1440×900 color-inspection screenshot was reviewed. No gameplay/simulation behavior changed; next work remains native coordinate generation, sampler/blend selection, motion and integration. Evidence: `docs/reference/particle-color-verification.json`.

## Native particle multiplier path and translucent texel checks

Extended native shader extraction to 18 selected programs in six bundles, preserving all previous source records and validating all 516 bundled programs. MULT_PASS differs by primitive: mesh replaces the particle-color texture with the multiplier; quad samples both at the same secondary UV. The WebGL color material now supports the extra quad factor. Lux Trail's multiplier scroll and arbitrary-trail field names are resolved against the pinned schema; their runtime mode/units remain open.

Added the trail source/multiplier pair and explicit raw-RGB versus alpha-composited display to the inspector. Thirty-six GPU samples pass against directly decoded, hash-verified PNG texels, including low-alpha trail pixels. This exposed and removed Canvas 2D alpha-round-trip distortion from the test reference. The focused browser test, repeat shader extraction and production build pass; the trail inspection screenshot was reviewed. Gameplay integration and native blending remain unfinished. Evidence: `docs/reference/particle-mult-verification.json`.

## Source-driven hoop lifetime appearance

Pinned a more detailed particle-renderer reconstruction reference and implemented the four lookup-axis modes without the approximate velocity divisor found in another viewer. A source-checked hoop profile now drives lookup, birth color and relative scale in a seekable, slowed lifetime inspector. Switching emitters or returning to manual mode restores the appropriate controls and appearance.

Validation: 622 source/simulation tests across 127 files, two focused browser cases (including all 36 existing GPU color samples), production build, and visual review of the lifetime inspector. External reconstruction evidence and the absence of a native-client capture remain explicit. Particle emission/motion and gameplay integration are unfinished. See [PARTICLE-PLAYBACK.md](PARTICLE-PLAYBACK.md).

## Deterministic emitted hoop cloud

Implemented the hoop's correlated birth distributions, fixed-grid emission, per-axis drag, radian orbital displacement and source-driven lifetime appearance. The live window reconstructs directly from seed/time/stop inputs, preserving exact state across arbitrary seeks without accumulating renderer history. A pooled instanced renderer now displays the moving cloud in a local 3D inspection scene, and particles retire after emission stops.

Validation: 627 tests across 128 files, three focused browser cases (including all 36 shader GPU samples), production build and a reviewed 1440×900 screenshot. The cloud adds one draw call above the reference grid; seeded seek/restore, playback, restart, retirement and geometry-count stability pass. Native RNG/update rate, orientation/extent and final blend appearance remain unverified. Missile attachment, the crescent/trail emitters and gameplay integration remain next. See [PARTICLE-PLAYBACK.md](PARTICLE-PLAYBACK.md).


## Saved Lux attack trajectories

Real Lux basic attacks now retain their launch origin and a contiguous, bounded history of missile positions and headings. Each frame records the post-step pose at its world tick. Swept hits retain the contact point rather than the full-step overshoot; disappearing targets stop the effect at its last position. Stopped records survive 37 ticks, covering the longest currently reconstructed natural particle lifetime. The 40-frame history includes interpolation margin. These limits are reconstruction policy, not a verified native linger rule.

The frame evaluator interpolates position and the shortest angular turn, rejects requests before the retained prefix and freezes at the terminal pose. Schema 50 saves this history and rejects missing active records, duplicate identities, invalid owners, inconsistent endpoints/origins, gaps and expired tails. The records do not apply damage or replay sounds. Gameplay particle attachment is still the next step; the generic Lux projectile remains visible.

Validation: 632 checks across 129 files, nine focused browser cases and the nested-path production smoke passed. Real browser checkpoints restored exact world state both during flight and after impact, continued deterministically and retired the tail on schedule. Other focused cases covered existing saves, champion selection and Lux HUD. No visual rendering changed in this step. Evidence: `docs/reference/lux-attack-history-verification.json`.


## Hoop particles attached to real Lux attacks

`lux-attack-hoops.ts` now reconstructs the hoop's particles from each real attack's saved history. A mote's local offset is rotated through the heading at its birth tick and translated to that birth position. Later missile turns do not drag previously emitted motes. Impact stops new births while the retained record allows old motes to finish aging. Each effect uses its projectile identity as the deterministic seed. The shared instanced renderer accepts either local inspection particles or world-positioned particles.

The game loads the pinned mote and spectral textures under Vite's deployment prefix, with the same raw color, top-row UV and linear sampling policy as the inspector. Enemy motes are filtered individually against current point visibility. When a saved effect retires or a checkpoint removes it, its scene object and owned geometry/material/instance resources are disposed; textures remain shared. No new snapshot format is needed beyond version 50.

This is one integrated emitter of three. The generic missile core still remains while crescent and ribbon integration are pending. Current terrain-relative missile height of 0.9 world units, source-to-world heading interpretation, native billboard extent, RNG, update scheduling, blending and linger semantics still need native-client comparison. Ground height is sampled beneath each mote; a native missile-height trajectory is not yet captured. This does not claim complete or pixel-identical Lux attack presentation.

Validation: 635 checks across 130 files, two focused browser scenarios and nested-path production smoke passed. Model checks verify birth-position/heading transforms, independence from later path changes, JSON replay, stop behavior and unavailable-history handling. The real attack checkpoint scenario verifies identical instance counts and matrices after post-impact reload, enemy visibility removal/reappearance and complete scene-object retirement. The stationary inspector remains deterministic. Both 1440×900 in-flight and post-impact gameplay screenshots were inspected. Evidence: `docs/reference/lux-attack-hoops-verification.json`.


## Lux ribbon birth state and persistent wake distance

The pinned trail definition uses mode 1 (WAKE): the ribbon's longitudinal UV depends on emitter distance at particle birth. Recomputing distance from the retained path would make the texture shift when old frames retire. Each Lux attack history frame now stores absolute cumulative planar travel, including the first launch step and the swept contact segment. Format 51 validates the distance progression and preserves it through saves and bounded-history retirement. The frame evaluator interpolates that counter alongside position and heading. This is planar simulation distance; native height-dependent travel still needs an actual missile-height trajectory.

`lux-basic-trail.ts` records the exact source rate, lifetimes, emitter offset, blend identifier, wake mode, cutoff, tiling, multiplier scroll and authored birth/lifetime curves. `lux-trail-particles.ts` reconstructs live points in newest-first order using the existing explicit 60 Hz emission policy. Birth time drives width, color and Y-axis rotation; particle age drives relative width, color and multiplier scroll. Each point retains its birth pose and unwrapped distance/500 wake coordinate. Old points retire at exactly half a second; computing age from tick differences avoids a floating-point subtraction tail at that boundary.

The source interpretation follows the previously pinned [LeagueToolkit ribbon research, sections 2.12 and T7](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/docs/plans/vfx-particle-renderer.md). The implementation is independent and its profile tests compare directly with the binary-verified local Lux definition. Geometry expansion along each point's local +X, walked cutoff, UV packing/addressing, native material selection and blend validation remain subsequent work. The ribbon is not yet rendered in gameplay; the hoop integration is unchanged.

Validation: 641 checks across 131 files, six focused browser save cases and nested-path production smoke passed. The tests cover curved cumulative travel, bounded history, clipped impact, malformed distance records, exact source curves, separate birth/age clocks, wake-coordinate stability after prefix removal, exact JSON replay and terminal retirement. An initial test exposed the age-boundary rounding defect; the final run includes the repair. No new visual claim is made for this state-only step. Evidence: `docs/reference/lux-trail-state-verification.json`.


## Integrated Lux ribbon geometry and material

The ribbon now renders alongside Lux's hoop particles. `lux-trail-ribbon.ts` expands each retained trail point along its own local +X axis, preserves its authored half-width and RGBA, and walks newest to oldest without smoothing. It stops before the first point whose cumulative walked distance reaches the 1,000-unit cutoff; it does not invent an interpolated end cap. Wake UVs subtract the leading point's even cell, preserving repeating/mirrored parity while keeping coordinates small. The base layer spans V=0–1 because this emitter's tiling Y is zero. The multiplier receives its independent age-based scroll. Hidden points remove adjacent segments rather than joining across the gap.

The material uses raw source textures, top-row UVs, linear repeat sampling and per-vertex RGBA. For this emitter's absent/default-white ramp, the quad product reduces to base × tint × multiplier. Mode 4 uses SRC_ALPHA/ONE additive blending on RGB and alpha, with depth testing and no depth writes. This follows the pinned [ribbon material reference](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/materials.ts), [blend reference](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/blend.ts) and [section 2.45's multiplier reading](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/docs/plans/vfx-particle-renderer.md), implemented independently. Native-client capture remains necessary to certify these reconstructions.

`LuxRibbonMesh` reuses fixed-size GPU attribute buffers; each active effect has one mesh and draw. Effects reconstruct their vertices from saved state after reload, and dispose owned geometry/material when their retained record expires. Shared textures load beneath the deployment prefix. The development preview at `/tools/qa/lux-trail-playback.html` provides seeking, play/pause, restart and textured/wireframe inspection on a curved authored path. Its path stops at 0.7 seconds and its points retire by 1.2 seconds.

Validation: 645 tests across 132 files, four focused browser scenarios and nested-path production smoke passed. Geometry tests cover rotated widths, cutoff, wake-cell packing, independent multiplier scroll and hidden-point gaps. Synthetic GPU probes check all RGBA channels of both the vertex-tinted product and source-alpha additive result within one byte; all 36 prior source-texture GPU comparisons also pass. The GPU probe explicitly disables premultiplied canvas alpha so its nonopaque clear color matches the independent reference. Real checkpoints restore all ribbon attributes/counts exactly after impact, preserve fog hide/reveal and retire both effect maps. The preview verifies deterministic seeks, play/pause, retirement, two scene calls (one grid, one ribbon) and stable geometry counts. Gameplay flight/tail and close-up textured/wireframe screenshots were inspected at 1440×900.

Remaining: crescent integration and removal of the generic projectile core, native birth orientation/height, sampler/material capture, full native linger policy and pixel comparison. Terrain height is still sampled beneath the geometry using the current reconstructed missile height. This completes a rendered ribbon component, not full native attack parity. Evidence: `docs/reference/lux-trail-ribbon-verification.json`.


## Integrated crescent and complete three-emitter playback

Lux basic attacks now use the crescent, ribbon and hoop renderers together. The generic cone/cylinder projectile core is removed for Lux attacks. `lux-basic-crescent.ts` pins the exact crescent emission/lifetime, birth velocity, drag, binding, offset, rotation, scale and lookup fields. `lux-crescent-particles.ts` reconstructs up to six naturally live meshes from saved history. Each post-birth missile displacement contributes its sampled binding weight; multiplying total travel by the current weight would give a different result and is covered by an independent iterative test. Birth velocity uses the emitter's birth phase, drag advances at the existing fixed grid, and the final display interval interpolates the next integrated state. Rotation retains the birth heading and applies the authored local Z half-turn. Scale multiplies the source birth scale by its lifetime curve.

This binding follows the [pinned integrator research](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/integrate.ts). That reference explicitly treats the emitter-phase binding clock as a reconstruction reading rather than an instrumented per-particle native transform. We retain that distinction. Default X lookup uses lifetime with authored scale/offset; constant Y evaluates to one. The source float lifetime is slightly longer than exactly 0.6 seconds, so a particle remains alive at that exact boundary and retires on the following tick.

The renderer loads the verified source GLB and raw Ring04/ramp-down textures under the deployment prefix. The GLB's inspection material and redundant embedded texture are disposed. Each effect owns an instanced geometry clone, lookup attribute, material and six-instance buffer, and disposes them at retirement. Source geometry already contains the 0.01 unit conversion, so its animated scale is dimensionless. The original central point, face-color block and uninterpreted source flags remain preserved but unapplied while their native use remains unresolved. The initial color product and ADD reconstruction are shared with prior particle work. Enemy crescents are filtered against point visibility.

`/tools/qa/lux-attack-playback.html` shows all three emitters on a saved curved path, with individual layer toggles, time seeking, play/pause and restart. At 0.2 seconds it shows four crescents, eighteen ribbon triangles and thirty motes: three emitter draws plus the grid. The empty preview issues only the grid draw. The inspection path stops at 0.35 seconds; remaining particles age naturally. The source Ring04 texture contains rainbow bands; the preview preserves them rather than recoloring based on the emitter's name. Oblique and game-camera views show that the mesh can appear nearly edge-on. These are observations of this reconstruction, not native-image parity.

Validation: 650 tests across 133 files, three focused browser scenarios and nested-path production smoke passed. The source profile, weighted integration, drag recurrence, scale/lookup endpoints, interpolation, retained-history replay and float-lifetime boundaries pass. The gameplay case confirms no generic Lux projectile object, active crescents in flight, exact post-impact instance restoration, fog removal/reappearance and complete retirement of all three effect maps. The combined preview preserves particle/vertex state and geometry counts across seeks and layer toggles. All 36 prior GPU source-color comparisons still pass. Gameplay flight/tail and isolated/combined preview captures were reviewed at 1440×900.

Remaining fidelity work includes native frame/binding-clock and missile-height comparison, source mesh metadata interpretation, exact RNG/update scheduling, native sampler/blend capture and stop/linger modes. The 37-tick retained tail covers the reconstructed natural maximum lifetime; it does not implement the authored 10.6-second crescent linger. This completes the three-emitter reconstruction in gameplay, while native authenticity and the wider game remain unfinished. Evidence: `docs/reference/lux-crescent-verification.json`.


## Resolved type-0 lifetime caps

The basic attack's authored linger numbers do **not** request that many additional seconds after impact. All three emitters omit `particleLingerType` and `emitterLinger`, including their hashed field identities. The pinned [LeagueToolkit schema](https://github.com/LeagueToolkit/LeagueToolkit/blob/76bf57bf4fd195343dec610bf0f912a06b910914/src/LeagueToolkit.Meta.Classes/Classes.cs) defaults these to type 0 and zero wait. The [pinned enum](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/enums.ts) names type 0 `maxLifetimeAfterEmitterDies`; the [settlement reconstruction](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/integrate.ts) caps total particle lifetime rather than resetting it from the stop. The [complex-emitter cap](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/systemModel.ts) also limits authored linger to nominal particle life plus ten seconds.

`lux-basic-linger.ts` now records and applies those three policies. Crescent's approximately 10.6-second cap exceeds its approximately 0.6-second natural life; Trail's 0.5-second cap equals its life; Hoop's one-second cap exceeds every sampled life (at most approximately 0.6 seconds). Thus ordinary type-0 stopping leaves all three natural lifetimes unchanged. It never grants a fresh 10.6 seconds to a crescent. This resolves the earlier documentation's outstanding interpretation of the authored crescent linger value; extending the saved tail to ten seconds would have been incorrect under this mode.

All three evaluators now use the explicit cap, and retained presentation duration derives from the maximum capped source life. It remains 37 ticks, with a 40-frame history including the existing three-frame margin. The maximum hoop lifetime factor is shared with its birth sampler, avoiding a separate handwritten retention bound. Format 51 remains unchanged; the simulation fingerprint changes under the existing same-build checkpoint policy.

Validation: 654 tests across 134 files, two browser scenarios and nested-path production smoke passed. Tests match authored caps, check absence of named/hashed override fields, distinguish total-life caps from added post-impact time, cover the nominal-plus-ten cap, sample 1,001 hoop probability inputs and verify the source-float retention boundary. Real attack saves, all-emitter replay, fog and retirement still pass. No visual appearance change is intended or claimed.

The primary schema/default evidence and external engine reconstruction are distinct from native-client observation. Whether a native Lux missile requests an ordinary soft stop or another termination operation remains to be captured. Exact attachment, orientation, height, binding clock, RNG/timing and shader/sampler comparison also remain open. Evidence: `docs/reference/lux-linger-verification.json`.


## Corrected trail shape/frame rotation separation

The initial ribbon state incorrectly added `SpawnShape.emitRotationAngles` to the particle's own facing. The [pinned birth path](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/emit.ts) instead applies the shape turn to its offset and birth velocity, saves the emitter frame separately, and reads particle rotation from `birthRotation0`. Lux Trail has no shape offset, birth velocity or birth rotation, so its Y-axis shape turn contributes no geometric rotation. Its emitter offset is added after the shape operation. The field is now named `shapeRotationDegrees` in the source profile, and each ribbon point keeps its birth heading. This supersedes the earlier claim that this curve should rotate the ribbon's local +X width.

Validation: 655 tests across 134 files, three browser scenarios and nested-path production smoke passed. The new regression follows several points born before and after a heading change and verifies that they retain their own birth frames without the shape angle. Source-profile matching remains intact. Isolated ribbon and combined previews were visually reviewed at 1440×900; their replay, layer controls, retirement and geometry counts pass. Real save/restore and fog handling also pass.

The parent-orientation default is a separate, unresolved question. Both sources default `particleIsLocalOrientation` to false, supporting retained rather than live particle heading. But the pinned [generated schema](https://github.com/LeagueToolkit/LeagueToolkit/blob/76bf57bf4fd195343dec610bf0f912a06b910914/src/LeagueToolkit.Meta.Classes/Classes.cs) gives `isLocalOrientation` false, whereas the newer pinned [renderer reader](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/readVfxSystem.ts) and its plan use true. The current parent birth-heading policy is unchanged pending stronger evidence. Native-client orientation parity is not claimed.

Two further differences found in this audit remain next: the reference forces at least one particle on first emission, and its emitter odometer measures between emission batches, whereas current scheduling waits for a full rate interval and current saved distance sums every simulation step. These need explicit reconstruction changes and regression coverage; they are not treated as already implemented. Evidence: `docs/reference/lux-trail-orientation-verification.json`.


## First emission and batch-based wake distance

The [pinned birth routine](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/emit.ts) forces at least one particle on a first eligible update, charges that birth against the rate budget, and emits nothing on a stopped update. `lux-emission.ts` now applies these rules to the three constant-rate, zero-delay, non-single Lux emitters on the reconstruction's 60 Hz grid. The first crescent and trail point move to relative tick 1; later births keep their accumulated schedule. For example, the 20 Hz crescent starts at ticks 1, 6, 9 and 12, not 3, 6, 9 and 12. The 200 Hz hoop already emitted multiple particles on its first update. Ordinary emitter lifetime remains inclusive; an explicit system-stop tick is non-emitting. Active hoop playback now represents an unspecified stop as infinity instead of conflating it with the ten-second emitter lifetime.

The same routine measures travel between emitting batches and initializes the counter at the first batch position. The prior every-tick path sum included pre-emission travel and could measure a different arc across a curved gap. World history now stores `trailDistance`: zero before/at the first batch, then planar chord distances between actual batch positions. It holds its value on non-emitting updates, after emitter expiration and at impact. The frame evaluator holds this event counter until the next recorded tick rather than interpolating it. Ribbon particles read their birth frame's counter. Inspector paths use the same emission schedule and distance semantics.

Schema 52 names and validates this changed meaning. Validation checks early zero values, unchanged counters off the emission schedule, batch-to-batch increments where their anchors remain and monotonic progression where the retired prefix owns an unavailable anchor. The existing 40-frame path covers consecutive live emission anchors; long flights preserve the accumulated absolute value when older frames expire. The 37-tick retained tail still covers all naturally surviving particles.

Validation: 659 tests across 135 files, four browser scenarios and nested-path production smoke passed. An independent integer-credit stepper checks all three rates for 600 updates and every resulting birth tick. Tests separate lifetime and stop boundaries, verify real first-update particles, suppress impact-update births, and compare a long curved flight against an explicit trail emission schedule through prefix retirement. Malformed odometers are rejected; checkpoint continuation and all three renderer restores remain exact. Combined, ribbon and hoop previews retain deterministic seeks and retirement. Updated combined and isolated-ribbon screenshots were reviewed at 1440×900.

The fixed 60 Hz grid and arithmetic remain this reconstruction's policy; exact native update frequency, float accumulation and missile termination ordering still require observation. The saved batch distance remains planar because a native height trajectory is not yet captured. Parent-orientation defaults, attachment, binding clock, RNG and shader/sampler parity also remain open. These changes resolve the two specific scheduling/odometer differences identified in the previous audit. Evidence: `docs/reference/lux-emission-verification.json`.


## Gromp legacy particle source and live death flash — October 21, 2026

The [Gromp effect adapter](GROMP-EFFECTS.md) closes the legacy particle source
references through the frozen root DATA archive. Sixteen Troybin records retain
664 typed rows and seven unresolved hashes. All 20 declared DDS/SCB dependencies
are pinned. Nineteen textures export losslessly to RGBA PNG; the original debris
mesh is retained as deferred source. An independent reader matches the pinned
historical reader's decoded values, and every recovered field label passes its
SDBM identity. A repeated extraction reproduces the pin exactly.

Three of the death-pop's eight emitters now render in the controlled encounter:
flash, lightring and flashfrog. They retain source textures, lifetime/appearance
curves, uniform-scale flag, pass/depth declarations and the original posed ground
bone. Playback reconstructs from saved death time, with no new snapshot schema
or renderer history. A lazy module requests only the four required textures.
Hidden/expired layers remove their scene objects and dispose owned materials.

Dispatch on the first local fixed update, scale/extent, Euler orientation,
offset inheritance, omitted tint, uniform-X scale and final shader/blend/sampler
composition still require native comparison. Five death-pop emitters, spores,
source projectile/impact, miniature/submesh dispatch and sound remain open;
standard-mode jungle roles/camp schedules and the full goal remain unfinished.

Validation: four independent binary-reader fixture cases, 1,072 checks across
216 files plus TypeScript, four focused Chrome cases and nested-path production
smoke pass. Each isolated layer contributes over 20 GPU pixels and the combined
effect over 60. Original bone attachment, exact fog/save/reload reconstruction,
material disposal, natural retirement and three RGB blend-factor combinations
pass. Existing right-click combat, retaliation, clear continuation and restart
remain passing. The 1440×900 death capture was visually reviewed; it uses explicit
99999 diagnostic true damage to freeze the short burst. Production still records
17 source audio files and requests no Gromp module, rig or effect texture. No
full browser-suite rerun or native pixel-parity claim is made. Commands, scope
and file hashes are in `reference/gromp-death-verification.json`.


## Eight-emitter Gromp death burst — October 21, 2026

All eight [Gromp death-pop emitters](GROMP-EFFECTS.md) now have live reconstructed
playback. The added ground shadow, 150 debris cards, 15 pop rays, 20 mesh shards
and 35 soft rays retain original distributions, atlas declarations, gravity,
drag, alpha references, scrolling and integrated rotation. The original paper
SCB converts to a 42-triangle GLB with exact expanded positions/UVs and retained
raw face colors, indices, pivot and layout provenance. Every source dependency
now has an exported texture or mesh; spores and other particle systems still
need runtime implementation.

The 224-particle birth burst uses eight emitter batches and 3,744 vertices,
instead of a draw per particle. Batches own dynamic position, UV, tint and lookup
buffers; fixed capacity and shrinking draw ranges preserve source ordinal order.
Visibility and expiry dispose all eight owned geometries/materials. Saved death
clocks reconstruct active buffers exactly without adding renderer history.
Corpse retention grows from the animation-only 299 ticks to 302, covering the
five-second source shadow, its first update and interpolation margin. The
existing schema-86 corpse field and ruleset fingerprint retain this change.

Validation: 1,077 checks across 216 files plus TypeScript, four focused Chrome
cases, all 39 GLBs/map validators and nested-path production smoke pass. The
final recorded isolated batches contribute 269–16,942 pixels each; the combined
draw changes 17,012 pixels. Exact buffer replay after fog/save/reload, nine texture
and one shard-GLB request set, batch/vertex limits, survivor identity, atlas
frames, stepped motion/rotation, natural expiry and final corpse intervals pass.
The revised 1440×900 burst capture was visually reviewed. Ordinary production
entry still requests no Gromp effect assets and records the same 17 source audio
files. The complete browser suite was not repeated.

Native RNG/cadence, shape/frame/extent and binding conventions, scalar XP
lifetime interpretation, legacy linger termination, shader/sampler composition,
mesh pivot/face-color use and native visual parity remain unverified. Death
spores, original projectile/impact/audio and miniature dispatch remain next,
alongside the broader standard camp scheduler, jungle roles and full-match
requirements. This advances the original goal without certifying completion.
Commands, source assumptions, diagnostics and hashes are retained in
`reference/gromp-death-burst-verification.json`.


## Gromp source missiles and retained flight — October 21, 2026

The [Gromp missile adapter](GROMP-ATTACK.md) replaces the generic red projectile
with all four original emitters: orb, subtractive background, a two-particle
flare-plane burst and partially bound trail motes. Source lifetimes, emission
windows/rates, correlated birth tables, shape axes, velocities/drag, binding,
appearance curves, passes and blend readings remain traceable to the frozen
Troybin and full ranged-attack spell. Three previously exported lossless textures
load only with Gromp. Shared Python field extraction leaves death output bytes
unchanged; no bitmap or model assets changed.

Schema 87 retains up to 34 post-step position/heading frames per released attack
and a 31-tick stopped tail. Swept contact uses its exact endpoint and target loss
freezes its prior endpoint. Histories require the neutral Gromp owner and matching
active projectile, reject crossed/missing/gapped/future/conflicting/expired state
and cannot replay damage. Rendering reconstructs all active buffer bytes from
saved clocks and uses up to four emitter draws per flight. Hidden/retired batches
dispose owned geometry/materials. Source textures remain shared.

Validation: all 1,083 checks across 218 files plus TypeScript, six focused Gromp
Chrome cases and ten existing checkpoint/Lux-input/structure-vision cases pass.
The final Gromp cases were repeated after strengthening heading validation.
A real in-flight Flash enters Gromp reset while its released missile continues
and damages its target. All four layers contribute pixels with depth testing
retained: 17/137/88/220 individually and 330 combined in the recorded sample.
Active and stopped buffers survive separate UI save/reload cycles. Fog disposes
four geometries/materials; final tail retirement disposes the remaining two and
removes history/effect objects. Flight and unobstructed paused-tail captures were
visually reviewed at 1440×900. The three RGB framebuffer factor probes pass.

The first close-range check exposed actor occlusion of orb, flare and trail.
Diagnostic caster removal restored those pixels. Current source-root/gravity/
vertical-facing initialization, flat 0.9-height policy, actor overlap and native
ranged/melee selection remain unresolved; stationary close-range presentation is
not certified. These findings are retained rather than tuning depth/range/size to
force visibility. Native RNG, cadence, binding, linger and final composition,
source hit effects/audio, death spores and miniature dispatch remain open.
Standard camps, jungle-role matches and the full project requirements continue.

Repeated export is exact. Nested-path production smoke passes with 17 source
recordings and no Gromp module/asset requests. The complete browser suite was
not repeated. Commands, source hashes, active/stopped GPU buffer checks, the
close-range finding and captures are recorded in
`reference/gromp-attack-verification.json`.
