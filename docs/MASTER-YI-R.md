# Development Highlander

This document records the schema-142 R checkpoint. [Alpha Strike](MASTER-YI-Q.md)
adds Q and includes it in the passive refund at schema 143. Statements below
about unavailable Q describe the earlier checkpoint.

The private `/?scene=fixture&npc=masteryi` scene supports manual W/E/R learning
and casts on its Master Yi NPC. Ashe remains the human. R adds its own temporary
stat bonuses, slow immunity, champion takedown extension and passive W/E cooldown
refund. Meditate pauses R as well as E. Q, player/role integration, source R
presentation and native behavior calibration remain unfinished.

## Frozen declarations

`tools/assets/export-masteryi-r.py` checks the complete frozen character package,
normal fourth-slot binding, passive child, named values and public client data.
Standard rank slots 1..3 contain 25/45/65 percent bonus attack speed and 40/50/60
percent movement speed. Duration and kill/assist extension are seven seconds;
cooldown is 85 seconds and mana is 100 at every rank. Cooldown refund retains
the authored float `0.699999988079071`. Arena overrides are not imported.

The root omits `mSpellCalculations`; its projection keeps null. The animation
name is present as an empty string and stays empty, rather than becoming null
or a fabricated Spell4 binding. Generic cast time `0.4043000042438507` and the
uncancellable-windup declaration are retained as evidence, not treated as a
recovered native activation callback. Guards survive Python optimization and
refuse differing existing output. Eight mutation cases exercise source/public
changes, omissions, passive identity and numeric/boolean separation.

## Explicit local controller policy

Acceptance is an instant self buff: pay 100 mana, start a hasted 85-second
cooldown, cancel recall and retain the current order, primary windup/recovery,
committed Double Strike and body clip. It does not reset an attack or invent
an R body animation. Rank is captured for the buff. Root permits activation;
stun, silence, Charm, death, insufficient mana and a cooling/unlearned R reject
it through the shared command rules.

Attack speed adds the own source attack-speed ratio times the captured rank
bonus to attacks per second. Base stats remain unchanged. New primary and child
windups sample the existing shared timing convention; accepted contacts and
primary recovery deadlines keep their captured clocks. Movement speed adds the
rank percentage to the existing shared haste sum. HUD, travel and run playback
use that same effective movement speed. The shared movement-speed soft caps and
full stacking rules remain [unverified and unimplemented](MOVEMENT.md). Thus the
local 355-base rank-one result is 497 before other modifiers; this is explicitly
not a certified native effective speed.

Activation clears legacy, contribution and critical movement slows. During R,
the shared slow factor is one and new shared slow applications are rejected.
Ashe's projectile adapters also avoid writing legacy/critical slow records, while
still dealing damage and applying separate stuns. Expiry does not revive cleansed
slows; a fresh application after expiry works normally. Charm retains its own
control record and forces walking with its slowing factor suppressed; roots/stuns
still prevent movement. There is no attack-speed slow system to extend this
policy to yet. The cleanse/immunity interpretation additionally follows the
[May 12, 2026 Wiki revision](https://wiki.leagueoflegends.com/en-us/Master_Yi?oldid=4016673),
which matches the pinned R ranks/resources. This is secondary reference evidence,
not recovered native immunity dispatch. Ghosting is not implemented.

An actually awarded champion kill or assist invokes the passive once after the
score increments, including existing shared execution/support credit. Minions,
monsters, structures, dummies, unrelated allied kills and duplicate damage to a
corpse do not award a champion takedown. A live, active R gains 420 updates from
its existing deadline. Every learned-R takedown also replaces each positive
remaining W/E cooldown with `ceil(remaining * (1 - refund))`; ready/overdue spells
and R itself stay unchanged. Because the source float is just below 0.7, 100
remaining updates become 31, and 1,000 become 301. Repeated awards apply to the
remaining cooldown in damage-processing order. Q is unsupported. Posthumous
awards apply the passive refund but cannot extend a cleared active buff. These
credit, ordering, quantization and posthumous decisions need native comparison.

Each paid Meditate interval extends a live R deadline and increments its pause
count before expiry, including a deadline exactly on the current boundary.
R accepted during W preserves the channel and starts pausing on the next
interval. W accepted after R has already expired cannot revive it. W interruption
ends further pausing; death and victory clear both buffs.

## Saved continuation

Schema 142 adds nullable own R start/end, captured rank, paused updates,
extension count, score at cast and latest extension tick. Validation checks
ownership, live phase, learned rank, exact score delta, exact duration arithmetic and
extension clocks. R ranks must respect levels 6/11/16. W/E/R consume the own skill
budget; Q and unsupported pending/body cast state remain rejected. Earlier
schemas and ruleset fingerprints remain incompatible. Public chooser, Rift
spawning and private development save-slot gates stay unchanged.

The focused tests exercise ranks/resources, rejection, stat composition,
independent attack clocks, slow and Charm behavior, kills/assists, inactive and
posthumous refunds, repeated extensions, Meditate boundaries, death/victory,
malformed saves and deterministic continuation. Browser checks use actual private
Save/reload at movement/slow-immunity, paused-channel and extended-duration
checkpoints, comparing saved bytes, 90-bone poses and future simulation.

## Reproduction

```sh
python3 tools/assets/export-masteryi-r.py --check
python3 -O tools/assets/export-masteryi-r.py --check
python3 tools/assets/test-masteryi-r.py
python3 -O tools/assets/test-masteryi-r.py
npx vitest run tests/masteryi-highlander.test.ts tests/masteryi-meditate.test.ts tests/masteryi-wuju-style.test.ts tests/masteryi-double-strike.test.ts tests/masteryi-development.test.ts
npx playwright test e2e/masteryi-highlander.spec.ts e2e/masteryi-meditate.spec.ts e2e/masteryi-wuju-style.spec.ts e2e/masteryi-double-strike.spec.ts e2e/masteryi-development.spec.ts
npm run check
npm run build
```

Cloud verification uses system Chromium via launcher-only overrides, without
weakening assertions or deadlines. Results and remaining baseline audit failures
are recorded with this milestone in [progress](PROGRESS.md).


## Verification checkpoint

The final one-worker broad run passes 2,323 of 2,329 cases across 343 files,
including all 33 Highlander cases and all 147 Master Yi cases. The six audit
failures reproduced on untouched main remain: absent original Garen audio,
Garen particle, Leona native/toolchain and distortion-shader caches, plus the
unchanged Lux sampler digest discrepancy. The earlier two-worker run also
exceeded the original wave-clock deadline and exposed the former explicit Lux
schema pin. The final wave clock passes within its unchanged deadline; the Lux
assertion now explicitly expects schema 142. No source assertion was relaxed.

Sixteen distinct targeted browser cases have passing runs across batches. The
initial run passes nine old cases and is intentionally interrupted during the
first R screenshot to correct slow cleansing/immunity. The next seven R/W/E
cases pass. All three R phases pass again on the final ruleset after the own-unit
lookup guards, preserving exact saved bytes, 90-bone matrices and 300-update
futures. This is not one final sixteen-case batch. Captures were reviewed; native
R appearance is not calibrated.

Normal/optimized source checks and eight mutation cases per Python mode pass.
TypeScript, three Node QA cases and the production build pass. Nested production
hosting passes 32 recordings, actual save/restore, all development-flag rejection
checks and zero Master Yi preloads. The existing large-bundle warning remains.
No public asset bytes changed. Ruleset is `6e9ae9dddc9111a6d568308368a6ec2a4c79edc104c34199bb9d0c0778ad1f93`;
pack `556eaf226816257a74f33ee9abf8aff72fff2b58ee0ef4907560ee4868e29e4b` contains
1,068 files / 526,620,268 bytes. The
[verification record](reference/masteryi/r-verification.json) retains changed-input
hashes, every failed/interrupted run, final phase proofs and production results.
No fresh offline audit, complete browser/native/GPU or device/FPS certification
is claimed.
