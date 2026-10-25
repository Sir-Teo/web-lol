# Development Wuju Style empowerment

This document records the schema-140 E checkpoint. [Meditate](MASTER-YI-W.md)
adds W, paid E-pause accounting and the attack-reset interaction at schema 141.
Earlier references below to unimplemented W describe this prior checkpoint.

The private `/?scene=fixture&npc=masteryi` NPC can learn and cast E through the
shared development command API. Ashe remains the human; Q/W/R, Master Yi player
controls, role AI and production selection remain unfinished. The mechanic adds
no public assets or borrowed champion animation/effects. Native activation,
on-hit dispatch, sound, sword effects and visual calibration remain open.

## Retained declarations

`tools/assets/export-masteryi-e.py` checks the frozen complete character package
and the E spellbook/buff bindings. Standard-mode ranks use named slots 1..5:
20/25/30/35/40. The coefficient remains the source float
`0.3499999940395355`, with stat 2/formula 2 interpreted as bonus AD using the
existing stat convention. The retained Cherry mode override is not selected.
Duration is five seconds and cooldown is fourteen seconds at every rank.

BIN `mana` and `mAnimationName` are absent. Their projection stays null. The
separate Data Dragon 16.18.1 mana values are zero, and the development resource
policy uses those public values. It does not call an omitted BIN field an
authored zero. Legacy sword VFX duration three seconds, generic cast time
0.3812499940395355 and the root's uncancellable-windup declaration are retained;
none establishes native activation or a body animation callback.

## Explicit local controller

E activates instantly as a self buff after the shared learned-rank, cooldown,
alive, stun and silence guards. Root permits this self empowerment. Acceptance
cancels recall, leaves orders, ordinary windups and primary attack deadlines
intact, and starts the hasted fourteen-second cooldown. It creates no pending
body cast or projectile. Automatic learning remains disabled for the manual NPC.
Q/W/R still reject before borrowing another kit.

During `[startTick, endTick)`, eligible basic contacts apply the captured rank's
base damage plus the source coefficient times **live bonus AD**, as a separate
true-damage proc after physical damage. Bonus AD subtracts Master Yi's checked
base/growth AD, retaining the existing explicit BIN growth 2.5 choice despite
the unresolved public growth 0. Stat changes during the buff affect later
contacts. True damage is not multiplied by ordinary critical damage.

Double Strike's secondary retains its own captured half-AD physical payload but
receives the full E on-hit when E is active at that contact. Activating E after
the child commits can therefore empower its later contact. Expiry between the
primary and child removes the later bonus. E's proc does not itself add a Double
Strike stack or schedule another attack. Native proc order remains unverified.

Shared armor/MR rules leave true damage unmitigated; shared shields absorb it.
Buildings, wards and resetting/invulnerable targets do not receive this proc.
Source death and victory clear empowerment. The five-second expiry runs before
commands/contact on the boundary update; it does not wait for an attack to finish.
Changing ability haste later cannot alter the accepted cooldown or buff duration.

## Saved continuation

Schema 140 retains nullable start/end/rank empowerment. Validation rejects foreign,
dead or terminal owners, unlearned/over-ranked E, impossible skill budgets and
clock/expiry errors. Non-E Master Yi ranks/cooldowns and unsupported cast states
remain rejected. Ranked E keeps Hawkshot charges at zero. Earlier schemas and
ruleset fingerprints remain incompatible; this is not save migration.

The public chooser and Rift spawning guards stay unchanged. Private Save/reload,
restart and checked imports continue using the existing Master Yi NPC slot.
An active buff and pending child must restore byte-identically, including future
true-damage contacts and the source Passive pose.

## Reproduction

```sh
python3 tools/assets/export-masteryi-e.py --check
python3 -O tools/assets/export-masteryi-e.py --check
python3 tools/assets/test-masteryi-e.py
python3 -O tools/assets/test-masteryi-e.py
npx vitest run tests/masteryi-wuju-style.test.ts tests/masteryi-double-strike.test.ts tests/masteryi-development.test.ts tests/red-buff.test.ts
npx playwright test e2e/masteryi-wuju-style.spec.ts e2e/masteryi-double-strike.spec.ts e2e/masteryi-development.spec.ts
npm run check
npm run build
```

The cloud runner uses the system Chromium through a temporary Playwright launcher
override; assertions and deadlines remain unchanged. The prior Double Strike
checkpoint records six existing broad-suite audit failures in this fresh cloud
checkout, reproduced on untouched main. Those checks remain intact. Results for
this milestone are recorded in [progress](PROGRESS.md).

The final broad run passes 2,243 of 2,249 cases across 341 files, including all
29 Wuju Style cases. The same six baseline audit cases fail with the same Lux
digest; no existing assertion was relaxed. TypeScript, three Node QA cases,
normal/optimized source checks and eight mutation cases per Python mode pass.
All ten targeted Chromium browser cases pass without skips/retries, including
actual E-plus-child Save/reload with exact world bytes, 90-bone poses and a
300-tick future. The pending capture was visually reviewed. The production build
and nested static-host smoke pass with 32 recordings and zero Master Yi preloads.
No fresh offline/full-browser/native/performance certification is claimed.

[e-verification.json](reference/masteryi/e-verification.json) records the changed
runtime/test hashes, save/future/pose digests, baseline failures and production
result. It also identifies the behavior-preserving eligibility-variable rename
between browser checks and the final broad/build checks. Raw evidence remains in
`.cache/masteryi-e-cloud`. Schema is 140; ruleset is
`21d7aa5b3f691b028344b8f93dcf26158ed5f6616f2e798ee38a83e09fa7e5da`.
