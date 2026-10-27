# Development Meditate channel

This document records the schema-141 W checkpoint. [Highlander](MASTER-YI-R.md)
adds R and W/R pause accounting at schema 142. Statements below about unavailable
R describe the earlier checkpoint.

The private `/?scene=fixture&npc=masteryi` NPC can learn W and E through the
development command API. Meditate adds its own channel, healing, mitigation,
upkeep, attack reset, passive stack pulses and paused E duration. Ashe remains
the human. Q/R, Master Yi player/role integration and production selection remain
unfinished. Source particles/audio, native channel dispatch, cancellation order
and appearance calibration remain open.

## Frozen source

`tools/assets/export-masteryi-w.py` verifies the complete frozen character package,
normal spellbook binding, formulas, source traits and animation aliases. Standard
rank slots 1..5 contain 120/200/280/360/440 base healing, four seconds, half-second
heal frequency, damage reduction near 45/47.5/50/52.5/55%, initial extra reduction
near 25/22.5/20/17.5/15%, and a half-second initial/linger window. The initial
formula explicitly sums ordinary and extra reduction, near 70% at every rank.
Turret reduction is multiplied by 0.5. Raw float values are retained.

Base mana is 40; named upkeep is 0.05999999865889549 maximum mana per second.
The BIN omits cooldown and the heal calculation's stat ID. The projection keeps
those fields null. The separately pinned public client says cooldown ten seconds.
The development controller uses that public value and selects AP for the omitted
heal stat under the existing local calculation convention; neither is called a
recovered serialized default. The source coefficient is 1.0. Missing-health bonus
ratio is 1.0, interpreted locally as up to twice the ordinary healing.

The source declares self targeting, zero cast time, channel/heal/parry/attack-reset
traits and `Spell2` for both body and loop. The exact graph maps `Spell2` to a
sequence containing `Spell2_Loop`; the adapter uses the existing `spell2_loop`
atomic clip. `Spell2_In`/`spell2_in` remains a prepared candidate. Its existence
does not establish an entry transition, so the controller does not invent one.

All source guards remain active under optimized Python. The exporter refuses to
overwrite differing output and supports staging outside runtime inputs. Eight
mutation cases cover omissions, rank/formula changes, numeric/boolean separation,
public cooldown, own animation and the attack-reset trait.

## Explicit local timing

Acceptance pays 40 mana, starts the hasted public ten-second cooldown, cancels
recall and an ordinary attack, sets an idle order and resets the primary attack
deadline. The channel captures rank and AP. Healing starts after thirty updates,
repeats every thirty, and includes a final pulse at the natural 240-update end.
Each pulse takes one eighth of captured total healing, scaled by the current
missing-health fraction, and caps at maximum HP. Ordinary regeneration remains
independent. Full health does not end the channel or its upkeep/stack clocks.

Each elapsed interval pays continuous upkeep from live maximum mana before input
and expiry. If a full interval cannot be paid, mana becomes zero and the channel
stops before its new heal/stack pulse. This is a fixed-step policy, not native
fractional-interval behavior. A paid interval extends a live E deadline and its
saved paused-update count before normal E expiry. E therefore cannot disappear
on a boundary that the previous channel interval paused. E accepted during W
starts pausing on the following interval. Highlander is not implemented and no
foreign R timer is used.

Commands then interrupt before a due heal/stack pulse. Movement, attack, stop,
recall and Flash end the channel. Stun, silence and Charm end it at application;
root and ordinary damage do not. Unsupported/rejected casts do not cancel W.
Instant E and the existing non-displacing summoners retain their own accepted
behavior. The channel contributes one passive stack per second, capped at three,
without recursively creating Double Strike. Pulse order is local: a committed
child contact runs before this unit's heal and stack pulses.

Mitigation applies to physical and magic damage before shared armor/shields.
True damage bypasses it. The initial extra window is measured from W acceptance;
base mitigation continues through the half-second stop linger. If cancellation
occurs inside the initial window, its remaining initial portion and subsequent
base linger follow those same clocks. Native linger/early-stop behavior remains
unverified. Death and victory clear the channel immediately, including linger.

## Attack and body continuity

A committed Double Strike survives W's ordinary attack reset and can hit while
W owns the body. Its physical damage, target and release clock remain captured.
The body enters the own channel loop; the child's independent pose-stop clock
prevents its old attack pose resuming when W is cancelled.

An earlier slow child may still be pending when W resets attacks and a later
level increase shortens a new primary windup. Both contacts remain independent.
The counter may therefore grow before that older child releases. Decoder guards
allow this only with the child's recorded body override, and the renderer uses
the visible action's start clock rather than blindly taking any retained child.
This interaction has a saved-state/pose regression; no accepted contact is dropped.

## Schema and reproduction

Schema 141 saves channel start/end, rank/AP, settled clock, next heal/stack
deadlines and stop/cause. E saves paid paused updates; Double Strike saves its
separate pose-stop clock. Validation checks owner/rank/skill budgets, foreign or
terminal phases, natural/stop/linger clocks, pulse alignment, active control/order
conflicts, E duration accounting and child pose-stop consistency. Older schema/
ruleset combinations remain incompatible under the existing same-build policy.
The private save/import/restart slot and production roster gates are unchanged.

```sh
python3 tools/assets/export-masteryi-w.py --check
python3 -O tools/assets/export-masteryi-w.py --check
python3 tools/assets/test-masteryi-w.py
python3 -O tools/assets/test-masteryi-w.py
npx vitest run tests/masteryi-meditate.test.ts tests/masteryi-double-strike.test.ts tests/masteryi-wuju-style.test.ts tests/masteryi-development.test.ts
npx playwright test e2e/masteryi-meditate.spec.ts e2e/masteryi-wuju-style.spec.ts e2e/masteryi-double-strike.spec.ts e2e/masteryi-development.spec.ts
npm run check
npm run build
```

The cloud runner uses system Chromium with a temporary executable-path override.
It retains original assertion strength and deadlines. The earlier passive/E
checkpoints document six existing broad-suite audit failures in the fresh cloud
checkout, reproduced on untouched main. Those checks remain intact. Current
validation scope is recorded in [progress](PROGRESS.md).

The final broad run passes 2,289/2,296 cases across 342 files, including all
47 Meditate cases. Its six known source-audit failures remain; one existing
31-minute wave-scheduler case also exceeds its five-second deadline in that batch.
That scheduler and all 47 channel cases pass together in isolation (56 cases,
one worker) with the original deadlines. TypeScript, three Node QA cases, the
production build and eight normal/optimized source mutation cases pass.

Thirteen distinct targeted browser cases have passing runs. The first batch has
twelve passes and one existing NPC pending-reload deadline failure; its unchanged
isolated rerun passes in 26 seconds within the original thirty-second limit.
The three new channel cases pass again after screenshot review found fractional
heal text. HUD labels now round to integers while HP, events and future damage/
healing retain their precision. All new saves preserve world bytes, 90-bone
matrices and 300-tick futures. Loop/overlap captures were reviewed.

Nested production hosting passes with 32 recordings, ordinary save/reload,
development URL rejection and zero Master Yi preloads. No new public assets,
fresh offline audit, full browser suite, native acceptance or performance
certification is claimed. Schema is 141 and ruleset is
`0392157a812acbbb4b8e48f4d5aeb5d06905aec3aa40ee37c4f26cc464fae468`.

[w-verification.json](reference/masteryi/w-verification.json) retains changed
input hashes, exact phase/save/pose digests, the initial ID-test correction,
both deadline failures and their isolated passes, the HUD repair and production
result. Raw evidence remains in `.cache/masteryi-w-cloud`.

The complete native effect source closure is now retained separately in
[Meditate particle preparation](MASTER-YI-W-PARTICLES.md). It does not change
the channel controller or establish native particle creation callbacks.

The [seven-emitter cast effect](MASTER-YI-W-CAST.md) now follows accepted W
with a separate finite saved presentation. Channel healing, mitigation, mana
and interruption mechanics remain governed by the controller above.
