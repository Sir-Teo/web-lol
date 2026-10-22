# Companion purchases and consumption

Gustwalker Hatchling, Scorchclaw Pup and Mosstomper Seedling can now be bought
through the ordinary Rift shop. Each costs 450 gold and requires Smite in either
slot. The purchased companion uses the shared [ownership and passive controller](OWNED-COMPANIONS.md).
Earned companion growth is available in both Rift practice and the interim lane
match; jungle roles and native item behavior remain unfinished.

Use Pause → New match, select Smite, start practice or the lane match, and buy a
companion at your fountain. Selecting Smite is the current shop binding. Other equipment is
locked until the player owns a companion. The current catalog has no consumables;
health potions and the complete shop remain future work. [Rift practice](RIFT-PRACTICE.md)
now supplies the same scheduled camps and Scuttlers as the lane match.

## Ownership rules

The three items share a one-companion limit and conflict with the current
catalog's Doran's Blade. Buying checks fountain access or death, gold and capacity
before mutating inventory or creating ownership. Failed purchases leave the
checkpoint unchanged. Buying while dead preserves death and creates an actor
that stays hidden until the owner is alive.

The companion starter cannot be sold or replaced. The shop marks that owned item
as unavailable for sale and explains the reason. Other item purchases, recipes,
sales and inventory movement retain their existing behavior.

The starter stays in inventory through the first evolution. At 35 earned feeds,
the controller removes that item from its actual current slot and captures the
consumption tick. Interior empty slots remain stable; only trailing empty slots
are trimmed. The actor, earned Smite stage, passive, feeding history and reserved
starter group persist after consumption. This frees an inventory slot without
allowing another companion or Doran's Blade. A new match resets the ownership.

There is no manual evolution selector. Normal camp deaths, including a real
Smite last hit, drive the existing feeding/reward paths. The published counter
discrepancy, local bonus-clock phase/cap, post-quest treat lifecycle and reward
bindings documented in the ownership notes remain unresolved native work.

## Asset preparation and saves

The shop prepares the selected original rig before committing a companion
purchase. While preparing, repeated purchase clicks are serialized. Failed asset
preparation spends no gold and can be retried. Once loading finishes, the game
checks current gold, ownership, capacity, game state and fountain access again.
A model can remain cached after an unsuccessful revalidation, so retrying a legal
purchase does not require another download. Unowned variants are not preloaded.

Schema 101 introduced the distinction between free development fixture grants and
purchases; schema 102 retains it alongside the shared Rift practice calendars.
Purchased records retain a nullable consumption tick: before full growth, exactly
one matching starter must be in the owner's inventory; after full growth, no
starter may remain and consumption must match the full-growth tick. Malformed
or conflicting item/owner combinations are rejected. The fixture grant remains
restricted to the development Gromp encounter. Purchased ownership restores in
ordinary Rift matches and prepares its rig before play resumes.

## Source evidence and remaining work

[The item source pin](reference/companion-items-source.json) links the existing
frozen 16.18 item records, original Data Dragon starter icons and the exact
Doran's Blade group membership. Both DoransItems and GoldItems explicitly cap
ownership at one. Source records retain the 450 price, required Smite, max stack
one and zero sell metadata. The expanded sell-price ledger retains the same
original Data Dragon digest and adds these three records.

Riot's [position-binding context](https://www.leagueoflegends.com/en-us/news/dev/dev-season-2-gameplay-changes-preview/)
links the jungle role to Smite. The specific shop gate, no-sale policy,
consumption timing and persistent group entitlement remain explicit adapters;
metadata-only scripts do not establish the complete native purchase callbacks.
Full role selection, team role constraints, support starters, limited undo,
consumables, jungle bot decisions and role reward/modifier systems remain
unfinished. Native behavior and visual/timing comparison remain open.

Reproduce the source-linked catalog and verify original icons:

```sh
.tools/cdtb-venv/bin/python tools/assets/export-companion-items.py --check
```

The command uses `.cache/jungle-quest/items.json`, whose frozen URL and full digest
are retained in the pin. Normal generation downloads missing original icons from
the pinned Data Dragon version, generates `src/content/companion-items.ts` and
updates the shared sell-price ledger. Check mode verifies without rewriting.

[The verification ledger](reference/companion-items-verification.json) records
unit cases, real Rift browser purchases and camp input, diagnostic feeding limits,
asset failure/retry checks, production results and capture hashes. These checks
do not certify a complete role match or native lifecycle. The full project goal
remains active.
