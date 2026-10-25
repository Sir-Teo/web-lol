# Master Yi development NPC foundation

This document records the schema-138 NPC foundation. The later
[Double Strike controller](MASTER-YI-PASSIVE.md) adds passive behavior and source
pose continuation at schema 139; the remaining kit and production gates stay open.

Use `/?scene=fixture&npc=masteryi` with the development server. Ashe remains the
human champion; a manually controlled Master Yi NPC adds his own stats, melee
attacks, rig and saved continuation. The private fixture does not expose Master Yi
in player selection or the production Rift roster. Double Strike and Q/W/E/R,
role AI, native effects/audio and full champion delivery remain unfinished.

## Own profile and combat boundary

`tools/assets/export-masteryi-profile.py` projects the checked
[complete character reference](MASTER-YI.md). It retains source float values for
base/growth/resource stats, attack-speed ratio, selection cylinder, collision
radius and attack windup offset. Attack-speed growth is converted from percent to
fraction. Normal and optimized exact-output checks pass; differing existing
output is never overwritten.

The development profile explicitly uses BIN attack-damage growth 2.5. The public
client's 0 remains an unresolved conflict. Base HP/mana are 640/251, AD 65, armor
33, MR 32, movement speed 355, attack range 175 and attack speed 0.6790000200271606.
Selection radius/height are 125/155 and source pathfinding radius is 35.

The three ordinary/critical attack records omit a missile specification. This
adapter chooses local immediate melee contact at the accepted release tick,
without creating a projectile. Windup uses the shared estimate
`round((0.3 + sourceOffset) * 60 / baseAttackSpeed)`, or 22 ticks at level one.
Attack-speed scaling, interruption, damage mitigation and the ordinary critical
policy use the common combat controller. The raw critical multiplier is 2 and
coincides with the common multiplier; native release/contact markers and special
Double Strike timing/procs remain unverified.

The NPC does not gain Ashe Focus or apply Frost. Double Strike extra attacks are
not inferred from the extra attack-slot declaration. All four spells start at
rank zero with one unspent point; leveling leaves every point unspent. Learning,
automatic allocation and queued spell casts reject before borrowing another
champion's capabilities or spending mana. The spell-spec API rejects unsupported
Master Yi spells. Shared summoners retain their existing behavior.

The first focused run caught generic NPC initialization assigning all four ranks
to one. Master Yi now uses the explicit unlearned initialization path. The original
four failures remain retained; the corrected focused run passes.

## Rig and presentation

The [prepared base rig](MASTER-YI-MODEL.md) loads only when a Master Yi unit is
present at startup, including restored checkpoints. Both exact duration tables
include all 47 atomic aliases. Local body choices are source aliases
`entry_56f6d84b` for idle, `run`, `entry_d5c55cfd` for an ordinary swing and
`entry_e1798980` for a critical swing. These are explicit choices rather than a
recovered animation-graph dispatcher or randomized attack-variant policy.

Recall follows the authored Recall sequence order, `Recall_In` then `Recall_Loop`,
using the exact `recall_in`/`recall_loop` durations. Idle, movement, pending contact,
recovery, critical, both recall stages and death poses retain the own 90-bone rig
through isolated model reconstruction. Picking uses the own source cylinder.

The scoreboard portrait is the pinned Data Dragon 16.18.1 Master Yi image,
29,421 bytes, SHA-256
`1c23534926a7956a260591fb3cee8f38cb6de3d9d4f064fe93fb88c8f76b1b66`.
It is the only newly fetched public asset. The model remains the documented unlit
development preview with its explicit 26-key quaternion normalization policy.
Native magnitude handling, materials, graph transitions and source effects/audio
remain open. Ordinary attack feedback uses the existing generic diagnostic tone.

## Saved scenes and file controls

Schema 138 permits Master Yi only as a non-player practice-fixture unit. Constructor
and spawning reject a human Master Yi or a Rift unit; decoding enforces the same
boundary. Learned ranks, nonzero Q/W/E/R cooldowns, unsupported pending/cast
animation state and an invalid unspent-point budget reject. Non-Ashe and foreign
spell ownership checks continue to apply. Earlier schemas are incompatible under
the existing same-build policy.

The scene uses `development-masteryi-npc-fixture`, separate from the ordinary
`practice-fixture` save. Restoring requires Ashe and a Master Yi NPC. Restart
recreates the manual NPC with all spells unlearned and keeps the ordinary save
exact. The scene's match-file preview rejects a different human champion or a
missing NPC before persistence; its own exact checkpoint loads normally. General
development-fixture files remain bounded by their supplied map context, and
production Rift does not accept these NPCs.

The ruleset now explicitly includes the fetched Master Yi GLB and sidecar as well
as the imported stats, clip tables and pose policies. Mutating either rig input
invalidates compatibility without pretending it is a binary module import.

The full check passes 2,192 tests across 339 files, TypeScript and three Node QA
checks. The 34 focused checks cover the new ten-case NPC suite, existing Ahri
behavior and ruleset dependencies. All 55 targeted Chrome cases pass without
failures, skips or retries. Six NPC cases cover eight exact pose/save round trips,
finite bone matrices, ordinary contact without a projectile, two actual
Save/reloads with identical 300-tick futures, separate ordinary/private saves,
restart, rejected imports and exact own-file loading. Canonical idle/death
captures were visually reviewed at 1440×900. The earlier three- and six-case
smoke runs remain retained alongside the final full run.

Production passes 32 recordings, rejects the exact NPC fixture URL and exposes
no development hook or unrequested Master Yi rig preload. Offline continuation,
repair and version-switch checks pass with 963 service-worker responses and no
production errors. Of the 1,017 previous public files, 1,016 remain byte-identical;
only the reference manifest gains the portrait record, with all existing records
retained. The new portrait brings the public count to 1,018.

Pack `72f1d7cc409de83255d37ff55633da06174c0992c9e73760c687bdcab9c2a57e` has
1,068 files / 526,605,720 bytes. Ruleset:
`f0b34678b01520ce117fcc4630a01317b8bfc1969a7c698a33fb298715dbd6f6`.
The existing bundle-size warning, source-quality storage target and full-match
performance gate remain open.

Frozen source/build/evidence closure:
[development-verification.json](reference/masteryi/development-verification.json),
checked with `node tools/qa/verify-masteryi-development.mjs` or `--historical`
after later changes. NPC integration, own ordinary combat and private
save/restart/import boundaries are verified. Full kit, player/roster/role
integration, native behavior/presentation, full performance and project completion
remain open.
