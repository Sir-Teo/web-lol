# Development Alpha Strike

The private `/?scene=fixture&npc=masteryi` NPC now supports all four own ability
controllers. Alpha Strike adds unit targeting, saved marks, delayed/repeated
physical contacts, scaled Wuju Style on-hits, temporary untargetability,
reappearance and recovery. Basic attacks reduce its current cooldown, and
Highlander's passive now refunds Q alongside W/E. Ashe remains the human;
player/role integration, production selection and native calibration remain open.

## Frozen declarations and secondary evidence

`export-masteryi-q.py` checks the complete frozen 26.18 character package,
spellbook/root/children, standard named values and formula references. Five ranks
retain base damage 20/40/60/80/100, raw AD coefficient `0.699999988079071`, monster
bonus 60/85/110/135/160, four marks, subsequent-hit ratio 0.25 and on-hit ratio
0.75. Mana uses source slots 0..4 (50/55/60/65/70); cooldown uses rank slots 1..5
(20/19.5/19/18.5/18). Source/public resources and range 600 agree.

The damage formula references raw stat 2 but omits its stat-formula selector.
The projection retains that omission as null; the controller selects total AD
under an explicit local convention. The root also omits animation and targeting
type. Neither is filled with a fabricated serialized default. The prepared
`spell1` clip does not establish a native root animation binding.

The root's generic cast/total declarations are 0.25/1.0 seconds. First, bounce
and return missile children separately declare approximately 0.20/0.18/0.15
seconds. Authored radii 300 and 550 remain distinct from the root range and local
bounce search. These numbers do not recover the complete native callback chain.
The source basic-hit cooldown calculation explicitly includes a cooldown
multiplier; it is not Highlander's percentage-of-remaining refund.

The [May 12, 2026 community revision](https://wiki.leagueoflegends.com/en-us/Master_Yi?oldid=4016673)
provides additional behavioral leads for marking, delayed first hits, immediate
repeats, return selection, cooldown reduction and E/R interactions. It is not a
controlled 26.18 timing capture. [Source preparation](reference/masteryi/q-preparation.json)
records the preceding staged projection and unresolved dispatch questions.

## Explicit local controller policy

Q requires an explicit hostile, visible, targetable non-structure/non-ward unit
within 600 of the caster. Protected spawns and resetting monsters reject it.
Root, stun, silence, Charm, death, missing rank/resources and cooldown reject it.
Acceptance pays own mana, starts the hasted cooldown, interrupts recall/Meditate,
cancels an ordinary windup and retains its existing attack recovery deadline.
A committed Double Strike survives independently; its body pose is stopped so
it cannot resume after Q. There is no inferred Q attack reset or generic body
cast. Out-of-range casts reject rather than implement native walk-in buffering.

Mark pulses occur every fourteen fixed updates, at most four times. Each searches
within 600 of the preceding target's live position (or its captured position if
removed), with a 2,000-unit caster-origin follow limit. Fresh eligible enemies
are preferred by distance then ID. When all nearby enemies were marked, repeats
cycle by least mark count and first-mark order. Selection consumes no RNG. If no
eligible enemy remains, Q ends its vanished phase at that scheduled pulse.
These are local timing/selection policies, separate from the frozen missiles.

Each mark captures live total AD, rank damage, an independent own critical roll
and its payload. The local critical bonus uses the existing own attack critical
damage statistic and retained coefficient. Monster bonus is added separately
without critical multiplication; repeated-hit scaling applies to the combined
payload. First marks wait until reappearance. Repeat marks deal 25% immediately.
First E procs use 75% effectiveness; repeated E procs use 18.75%. Armor, mitigation
and shared shields remain in the ordinary damage pipeline. E true damage keeps
its existing live bonus-AD convention at actual contact.

Q contacts use the shared supported on-hit adapter without becoming basic
attacks: they neither build Double Strike nor reduce Q's cooldown. Existing
Cinders slow/burn application and phase-preserving refresh remain unscaled buff
policies; native Q interaction with that proc remains open. Other item/passive
behavior remains limited to the existing shared pipeline. Mark-only assist
qualification before damage is not implemented; actual damage uses existing
kill/assist attribution.

At reappearance, a valid primary within the follow limit supplies a point 75
units in front of its facing, or along the player's selected exit direction.
The battlefield resolves reachability. A dead, hidden, untargetable or distant
primary falls back to the original cast position. Position and previous position
blink together, so no fake run displacement or collision sweep crosses the gap.
Pending first marks then resolve against their original eligible targets; lost
marks never redirect their payload. Recovery lasts ten further updates.

Movement/attack clicks while vanished select exit direction. Recovery can buffer
a movement/attack/idle order; Stop suppresses the automatic follow-up. At recovery
end, the buffered order takes precedence; otherwise a surviving primary champion
receives an attack order, and other target kinds leave Yi idle. Native selection
cutoffs and general ability buffering are not certified.

E/R and supported Heal/Smite can be accepted while Q owns the body. W, Flash,
recall and new trinket actions cannot replace it. Each vanished interval pauses
live E/R before expiry, including an exact expiry boundary; a buff accepted
during Q begins pausing on the following interval. Recovery adds no pause. Death
and victory clear Q so pending contacts cannot fire later.

Every accepted basic contact, including Double Strike, structures and wards,
reduces a positive learned-Q cooldown by `ceil(60 * 100 / (100 + abilityHaste))`
updates. Ready/overdue cooldowns remain unchanged. Actual awarded champion
kills/assists apply R's existing exact-float remaining-cooldown refund to Q/W/E.
An early repeat kill therefore refunds Q before its pending first mark resolves.
All quantization, stat sampling and dispatch order remain explicit local policies.

## Targetability and presentation

`World.targetable` is separate from damage/protection permission. Enemy
acquisition, windup release, new controls, projectiles, area contacts, Ahri's
controllers, Smite and companions use targetability. A fixed-target projectile
fizzles when its target vanishes. Already attached Cinders/Scorchclaw damage
continues through the ordinary damage permission path; Q is not invulnerability.

Neutral aggro retention also differs from permission to attack: an engaged
monster waits through the vanished phase within the existing sight/leash rules.
It cannot attack Yi or reset/heal merely because he temporarily became
untargetable. Inherited Krug aggro and cleanup deadlines retain the same rule.
This is not a replacement for the still-limited general neutral patience model.

Yi's model root and health bar hide while vanished and reveal during recovery.
The saved ordinary own body timeline supplies the visible pose; no borrowed or
inferred Spell1 pose is introduced. Hidden cached bones are not an observable
pose. Q adds no source particle/audio assets. Native target-area vision, mark
visuals, source effects/audio, active clip transitions and appearance remain open.
Underlying vision stays at the actor's original location while vanished.

## Saved continuation and verification

Schema 143 saves rank, origin/primary point, mark/settled clocks, every payload,
critical/repeat decision and result, exit direction, return/end phase and buffered
order. Validation checks own learned/live state, exact pulse/recovery arithmetic,
repeat order/scales, result phases, source range, positions and past ID bounds.
All own Q/W/E/R ranks share the level/skill budget; generic pending/body casts and
borrowed Ashe state remain rejected. Earlier formats/fingerprints are incompatible.

The focused scenarios cover ranks/resources/rejection, one/two/four targets,
mark timing and payload sampling, defenses, monsters/aggro, ordinary/child
cooldown reduction, R refunds, E/R pause, W/Flash exclusion, target loss, return
and buffered orders, controls/projectile dodge versus attached damage, death,
victory, strict saves and deterministic futures. Actual private Save/reload
checks pending-child and marked vanished phases plus visible recovery. Exact
world bytes and 300-update futures match; the visible recovery pose matches all
90 bone matrices, while hidden phases verify root/bar suppression and later
finite own-rig reveal.

Reproduce with the Q exporter/guard commands in the preparation record,
`npx vitest run tests/masteryi-alpha-strike.test.ts`, and
`npx playwright test e2e/masteryi-alpha-strike.spec.ts`. Cloud browser runs use
only the temporary Chromium executable-path override. Full results, unchanged
baseline failures and build/production checks are recorded in [progress](PROGRESS.md).


The final one-worker broad run passes 2,379/2,382 cases in 344 files, including
all 53 Q and all 200 Master Yi cases. The three remaining prior failures are
missing Leona native/research inputs, missing distortion-source/disassembly
caches and the unchanged Lux sampler digest discrepancy. The Garen audit groups
repaired earlier remain passing. The original wave-clock deadline also passes.
The focused Q/neighbor run passes 282 cases in twelve files. Normal/optimized
source checks, eleven guard cases per Python mode, TypeScript, three Node QA
cases and the production build pass.

Three new Q browser checkpoints pass. The sixteen-case regression batch passes
fifteen and times out the existing thirty-second NPC recovery reload. That run
writes its proof after all assertions passed, but still counts as a timeout;
the unchanged isolated case passes in 29.0 seconds. Thus nineteen distinct cases
have passing runs across batches, not one clean nineteen-case run. No assertion,
deadline or quality setting was weakened, and automatic retries remain zero.

Nested production hosting passes 32 recordings, actual save/restore, development
flag rejection and zero Master Yi preloads. No public asset bytes changed. The
existing large-bundle warning remains. Ruleset is `1228a6d9dd799df0e1ee9e2d4447f631a3437a17ae362ac5e5bc041040c9cc1d`;
pack `983a00ead5156f3aba448d873c637541f4e8a918e46f203b954306d742fc5abf` contains 1,068 files /
526,628,509 bytes. The [verification record](reference/masteryi/q-verification.json)
preserves changed-input hashes, fixture corrections, the actual neutral reset
bug and its fix, failed/intermediate runs, reload timeout, final phase evidence
and production result. No fresh offline/full-browser/native/GPU/device/FPS or
whole-project completion claim is made.
