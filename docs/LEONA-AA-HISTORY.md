# Saved Leona ordinary attack attempts

Ordinary Leona attacks now retain their actual start, release and cycle end,
resolved animation, captured critical/Eclipse override flags, target identity,
start audience, cancellation and accepted contact. Q keeps its own history.
These records prepare ordinary source audio; this increment keeps the existing
ordinary synthesized feedback and adds no new particle family.

The record exists before contact, so canceled attempts and Q resets cannot be
reconstructed as invented hits. Contact separately captures target rig, material,
position, audience, radius, transform and posed frames. Cast and contact audiences
are independent; later reveal cannot rewrite a hidden start. Moving caster poses
continue through the finite cast tail. Lethal endpoints freeze without following
respawn or later hidden movement. Histories retire at a finite bound.

## Source declarations and local choices

The independent dispatch audit verifies character/animation BIN identities and
all 29 pinned armor-material assignments. Source Attack1/Attack2 weights are
0.5/0.5, Attack3 has zero weight and critical probability is omitted. Attack4
exists with `Spell2_attack`, but does not appear in the weighted slots or extra
spell list. Selected attack clips have no explicit audio event maps. Attack
spell declarations apply material on hit, without establishing native OnCast/
OnHit invocation or the anonymous switch group's setter.

The current deterministic animation choice, critical-over-Eclipse precedence,
W override, ordinary windup and full-cycle animation scaling remain local
policies. Saved records preserve the resolved choice rather than sampling W or
critical state again at contact/reload. Material names hash to all four source
switch values. Unknown/dummy rigs retain the existing local Flesh fallback;
Leona's skin omits `armorMaterial`. No native W→Attack4 invocation, random history,
listener/bus mix, filter transfer or listening/frame comparison is established.

Generated bounds cover every source master, the maximum 40 ms cast delay and
slowest authored -300-cent material-hit pitch: 30 caster frames and 80 contact
frames. The calculation preserves the untouched master lengths. Full attack-cycle
identity remains available until its captured end. Strict schema128 requires the
new array and rejects missing ownership, unsupported variants, contradictory
phases, changed clocks/materials/transforms and invalid posed histories. Old saves
are rejected instead of manufacturing missing starts.

## Verification

Two retained regression failures show the missing start/contact and cancellation
records before implementation. Fourteen new units exercise ordinary, critical,
Eclipse and Q separation; order/target-loss/Q-reset cancellation; death/result
closure; Flesh/Metal/Stone/Wood targets; strict saves; moving/lethal bounds;
independent reveal audiences; and source-derived timing coverage. A neutral-target
fixture initially called the generic spawn API and was corrected to `spawnMonster`.
Its type/runtime failure logs remain. TypeScript, all 1,984 tests in 321 files and
three Node QA checks pass.

Four new Chrome cases use real Save/reload for ordinary, critical, Eclipse and
canceled attacks. They preserve exact snapshots and following 90-tick futures,
correct Metal contact and resolved variants, with zero browser/GL errors. The
Eclipse capture is inspected. These are controlled development navigation and
visibility fixtures, not native frames or ordinary Rift pathfinding acceptance.

Normal/optimized export checks pass. Four isolated timing mutations are rejected,
with both pristine baselines passing. The independent static review is retained
with exact raw inputs and snapshots of the local policy it inspected, distinct
from later source changes. The broader browser, production and offline results
are pinned in `docs/reference/leona/aa-history-verification.json`. All 1,005 public
files are unchanged. Verify the frozen checkpoint with:

```sh
node tools/qa/verify-leona-aa-history.mjs
# After later project changes:
node tools/qa/verify-leona-aa-history.mjs --historical
```

All 44 browser cases and 32 production recordings pass. Schema128 ruleset is
`927e3ae2b99e42f3350360606c406a1aedad983e4e4f17d07f4519eb7185f6b5`. Pack
`e149df5b7aba816fe2ab6134bf123067af1ed44939e0a253ea2c78915e579c9d` contains 1,052 files / 518,236,266 bytes.

Offline integrity, repair, saved boot and atomic version-switch controls pass
with 963 worker responses and zero production errors.
