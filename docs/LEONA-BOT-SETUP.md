# Leona development bot setup

AI-controlled Leona fixtures now use a separate local skill and defensive-item
policy. They no longer inherit Ashe's opening skill order or critical-strike
shopping route. The policy applies only to Leona; existing player selection and
ordinary Rift spawning restrictions remain in place.

This is setup for a development bot, not complete support combat AI. Subsequent
increments add [W defense](LEONA-W-BOT-DEFENSE.md), [Q recovery resets](LEONA-Q-BOT-RESET.md)
and [E](LEONA-E-BOT-FOLLOWUP.md)/[R](LEONA-R-BOT-FOLLOWUP.md) follow-ups. Complete tactics,
engage/peel safety and full support-role match validation remain open. No native
bot behavior or recommended player build is claimed.

## Skill allocation

AI ticks spend legal points through the shared learning validator. The opening
is Q, E, W, W, W, R; later priority is R, W, E, Q subject to level/rank limits.
Both team fixtures spend one point per level through 18 and finish Q5/W5/E5/R3.
The allocator creates no Ashe Hawkshot charges and preserves the human player's
ranks. An existing level-six Leona fixture with Q/W/E/R already learned uses its
two remaining points on W, finishing Q1/W3/E1/R1.

## Defensive purchases

At the ordinary shop, the local route buys Ruby Crystal, Boots, Cloth Armor and
Null-Magic Mantle, then upgrades the components to Giant's Belt, Chain Vest and
Negatron Cloak through the existing purchase/recipe/economy path. Once an upgrade
is owned, the bot does not repurchase its consumed component. The route ends
with Boots/Belt/Vest/Cloak and does not fall through to Infinity Edge. This uses
the current local item catalog; broader item fidelity/build selection remains
separate work. The existing jungle-companion purchase preamble still applies to
an explicitly assigned jungle role.

A controlled level-one fixture finishes with 996 maximum health, 83 armor,
77 magic resistance, 60 attack damage and 360 movement speed. These are observed
local item/stat results, not native gameplay measurements. Saved AI, role, ranks,
inventory and command clocks resume through the existing schema; no new state
field is serialized.

## Verification

Five new unit cases check both teams through level 18, component consumption and
bounded shopping, unchanged attack damage, exact saved futures and retained
player/Rift gates. The focused learning/Lux checks and full standard check pass: 1,892 units in
311 files, TypeScript and three Node QA tests.
The browser case exercises normal AI ticks, source-rig rendering, a 180-tick
saved future and actual saved-match reload. Existing Leona source-presentation
restore and Lux spell-bot cases also pass. Production/offline acceptance and
source identities are recorded in the [verification ledger](reference/leona/bot-setup-verification.json).

Production passes32 nested-path recordings with no development hook or
unrequested Leona preload. Offline pack
`8a695b3f78c83d6b972e0118b6b49b20e63744d169fcae1c1ec78c18b7cdf00b`
contains1,012 files/513,309,570 bytes; integrity/repair, saved boot and atomic
version-switch checks pass with963 service-worker responses and no production
errors. All966 public files remain byte-identical. Schema126 now uses ruleset
`9aa1414a6ced806885273939c6de36fee034484022aac4a5c843fdb25f45ae50`.

The separate browser typecheck initially lacked Node ambient types; its explicit
QA config now includes them and passes. The first screenshot showed the pause
menu; the final case closes that menu while keeping simulation paused, centers
on the restored NPC and checks/render-captures her rig. Initial evidence remains
retained. The full check and application source are unchanged by that QA-only
correction. No new normal-match cohort or performance result is claimed.

The policy is development-only behavior within the already permitted NPC
fixture. It does not add Leona to the player roster, complete tactical spell AI,
certify native frames or complete the six-character match.
