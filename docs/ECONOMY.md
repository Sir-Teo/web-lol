# Match economy

## Ambient gold

The standard Rift reference starts ambient income at 65 seconds. The earlier 100-second value belongs to the previous season: the 2026 game-start changes moved it forward with the earlier minion waves. [Official 26.1 notes, Game Start Time](https://www.leagueoflegends.com/en-sg/news/game-updates/patch-26-1-notes/)

The pinned 16.18 map follows `Maps/Shipping/Map11/Modes/CLASSIC.mGameModeConstants` to `{6cf687be}`. Its ambient fields specify 65 seconds, an amount of `10.199999809265137`, and a five-second interval. The exporter normalizes the float to 10.2, equivalent to 2.04 gold per second. This is the client's internal standard-mode identifier; it must not be confused with a separately advertised Classic ruleset or with the map's Swiftplay configuration. The mode link and original fields are retained in [the reference pin](reference/ambient-gold.json). `python3 tools/assets/export-ambient-gold.py` verifies the cached map SHA and selected fields before regenerating the runtime module.

**Runtime cadence policy, pending a matched reference capture:** accrue continuously after the start boundary, at 0.034 gold per 60 Hz simulation step. The balance remains 500 at exactly 1:05 and becomes 520.4 at 1:15 without other rewards or spending. The exported interval establishes a rate; it does not by itself prove whether the reference pays batches, accrues continuously, or credits its first payment at the boundary. Do not describe this cadence as measured reference behavior.

Balances retain fractional gold, rounded to six decimals on accrual to avoid accumulated binary floating-point drift. HUD and shop display the floor, and purchases compare the actual balance against the full price. Death continues income. Pause stops simulation steps; victory also freezes income. Checkpoints preserve the fractional balance and match tick without another timer or accumulator. Debug time jumps do not retroactively award skipped income. The practice fixture uses the same ambient rule.

Tests cover the start boundary, sustained rate, purchase threshold, fractional change, checkpoint continuation, death, victory, time jumps, and both browser balance displays. These establish the local implementation, not parity with a reference client.

## Remaining economy work

Starting gold and most rewards still need a complete patch audit. Role quests, support income, kill/assist sharing, shutdown bounties, turret plates, neutral-objective rewards, ordinary minion bounty scaling, item recipes, sell/undo, and complete bot builds remain incomplete. This ambient correction does not establish a complete match economy.

Cannon and super-minion bounty growth is now implemented; see [the minion gold specification](MINIONS.md#cannon-and-super-gold-growth) for evidence and remaining timing assumptions.

## Champion reward ownership

Ambient income now accrues independently for every champion, including through death. Last-hit bounties and CS belong to the champion that dealt the killing damage; champion kills increment that owner's kill counter. Same-team kills grant no last-hit gold or kill/CS credit. Gold feedback uses the recipient's position and team audience. Damage and Hawkshot reveal assist counters are implemented; assist gold, shutdowns and team structure rewards remain incomplete. Shared purchasing and a finite fountain-only bot plan are implemented; complete item builds and recipes remain unfinished.

## Champion base kill gold

The standard-mode `BaseGold` array in [the complete bounty configuration pin](reference/assist-window.json) specifies 300 gold at victim levels 1–6, then 310 through 420 at levels 7–18. Riot's [25.09 Champion Bounties / Tuning notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-25-09-notes/) independently describe the ten-gold-per-level increase beginning at level 7. The pinned 16.18 record retains that table.

`python3 tools/assets/export-champion-kill-gold.py` validates the cached map hash, mode/config link, full configuration and independently described progression before generating the runtime table. On a direct opposing champion kill, the game reads the victim's level before XP distribution and credits the source champion, including posthumous sources. The current supported level range is 1–18. Explicit practice `goldBounty` overrides still replace the base amount. Nonchampion final blows do not yet resolve execution attribution.

This replaces the flat 300 base reward. First blood is implemented below; positive/negative bounty accounting, suppression and assist gold remain outstanding. Unknown hashed configuration fields have not been assigned speculative meanings. Tests cover every supported victim level on both teams with different killer levels, duplicate death protection, gold event ownership, saved continuation, posthumous credit, overrides and the visible player balance.


## First blood

The first credited opposing champion kill grants an additional 100 gold to the killer. Both the pinned configuration's `FirstBloodBonus` and Riot's [26.1 notes, Atakhan, Blood Roses, Feats, and Kills](https://www.leagueoflegends.com/en-sg/news/game-updates/patch-26-1-notes/) establish the restored bonus. The base-gold exporter also validates and exports this value.

The match owns a saved `firstBloodClaimed` flag, independent of team and mutable scoreboard counters. It is set during reward processing before a later death can claim the bonus. Same-tick kills use the existing ordered damage processing; this is a deterministic local convention, not native simultaneous-kill calibration. The bonus adds to the base reward (or explicit practice override) and appears in the same gold event. It does not go to assistants. A posthumous champion source remains eligible.

Kills of minions/structures/dummies, same-team debug kills, and uncredited nonchampion final blows do not claim first blood. Execution attribution remains unfinished, so a death that should be credited to a previous champion attacker can still differ from the reference. First-blood announcement artwork/audio is not implemented. Tests cover both teams, same-tick trades, assistants, uncredited deaths and save continuation before/after the award.


See [the assist-gold reconstruction audit](ASSIST-GOLD.md) for verified cross-version/mode records, unresolved field meanings, and the death-transaction requirements for implementing assist payouts.


## Selling owned items

The shop now lists owned items with explicit sell actions and prices. Sales remove one selected inventory slot, credit its owner and remove that item's currently implemented flat stats. Duplicate copies remain independent. Selling Boots frees the unique boots restriction. Both teams use their own fountain radius (the existing local 400-unit shop boundary), and dead champions can sell without moving. Invalid slots, unknown champions, out-of-shop living champions and ended matches reject the transaction without mutation.

Pinned Data Dragon 16.18.1 sell values are Doran's Blade 180, Boots 210, Long Sword 245 and Pickaxe 613. Use the explicit integer amounts rather than a generic percentage: starter items and rounding differ. [Source](https://ddragon.leagueoflegends.com/cdn/16.18.1/data/en_US/item.json), [pin](reference/item-selling.json). `python3 tools/assets/verify-item-selling.py` validates the cached source hash, version and complete selected gold records; scenario tests compare the runtime table against the pin.

**Local health-removal policy pending native calibration:** subtract the removed flat health from maximum and current health, retaining at least one HP for a living champion and zero for a dead champion. Selling cannot revive or kill the owner or reset its respawn deadline. Existing purchase health behavior and the incomplete Doran's Blade passive remain separate fidelity gaps. Sales retain interior empty slots, and purchases fill the first empty slot without moving later items. Omitted trailing slots also represent empty inventory positions. Drag-and-drop reordering is now implemented as described below. Undo, component recipes and full native shop layout also remain unfinished. Checkpoints already serialize the resulting inventory, gold and unit stats, and snapshot 28 explicitly supports null empty slots.


## Inventory reordering

Drag an owned HUD item onto another inventory slot to swap them, or onto an empty slot to move it. `moveItem(from, to, championId)` operates on that champion's six positions without changing stats, resources or prices. Reordering is allowed away from the fountain and while dead; ended matches reject it. Empty sources and invalid indices reject without mutation. Snapshot 28 already supports the required null positions, so no new fields are needed.

The HUD accepts only a drag begun from its own owned item, ignores external drag data, checks that the source still contains the same item at drop time, and rejects drops while paused or behind a modal. Shop sale labels use the resulting slot numbers. The source icon cannot launch a separate browser image drag. Item actives, keyboard-accessible reordering and native drag feedback remain unfinished.


## First component recipe: Ruby Crystal and Giant's Belt

Added source-pinned Ruby Crystal (400 gold, +150 health, sells for 280) and Giant's Belt (900 total, +350 health, sells for 630). Giant's Belt consumes one owned Ruby Crystal and costs the remaining 500 gold. Without that component, it costs the full 900. Both icons ship locally with URLs, hashes and byte lengths in the reference asset manifest. [Data Dragon 16.18.1 source](https://ddragon.leagueoflegends.com/cdn/16.18.1/data/en_US/item.json), [full selected item records](reference/health-item-recipes.json).

`purchasePlan` identifies distinct owned component slots and quotes remaining cost before mutation. `buy` validates cost and capacity after considering the consumed slots, clears exactly those components and adds only the net flat stat difference. A full inventory can upgrade when a component frees a slot; insufficient gold does not consume it. The first empty or consumed position receives the result (local slot-selection policy). Dead buyers gain maximum health without current HP or respawn changes. Existing living purchase-health behavior remains the local flat-delta policy.

The shop displays the same quoted cost as the transaction and refreshes it after buying/selling. This first recipe supports the declared immediate components; recursive recipe trees, active/passive item effects, undo and full catalog/build-tree presentation remain unfinished. Existing bots retain their finite build plan. Source verifiers cover records and icons; scenarios cover both teams, duplicates, full inventories, insufficient funds, checkpoint continuation and dead upgrades.
