# Match economy

## Ambient gold

The standard Rift reference starts ambient income at 65 seconds. The earlier 100-second value belongs to the previous season: the 2026 game-start changes moved it forward with the earlier minion waves. [Official 26.1 notes, Game Start Time](https://www.leagueoflegends.com/en-sg/news/game-updates/patch-26-1-notes/)

The pinned 16.18 map follows `Maps/Shipping/Map11/Modes/CLASSIC.mGameModeConstants` to `{6cf687be}`. Its ambient fields specify 65 seconds, an amount of `10.199999809265137`, and a five-second interval. The exporter normalizes the float to 10.2, equivalent to 2.04 gold per second. This is the client's internal standard-mode identifier; it must not be confused with a separately advertised Classic ruleset or with the map's Swiftplay configuration. The mode link and original fields are retained in [the reference pin](reference/ambient-gold.json). `python3 tools/assets/export-ambient-gold.py` verifies the cached map SHA and selected fields before regenerating the runtime module.

**Runtime cadence policy, pending a matched reference capture:** accrue continuously after the start boundary, at 0.034 gold per 60 Hz simulation step. The balance remains 500 at exactly 1:05 and becomes 520.4 at 1:15 without other rewards or spending. The exported interval establishes a rate; it does not by itself prove whether the reference pays batches, accrues continuously, or credits its first payment at the boundary. Do not describe this cadence as measured reference behavior.

Balances retain fractional gold, rounded to six decimals on accrual to avoid accumulated binary floating-point drift. HUD and shop display the floor, and purchases compare the actual balance against the full price. Death continues income. Pause stops simulation steps; victory also freezes income. Checkpoints preserve the fractional balance and match tick without another timer or accumulator. Debug time jumps do not retroactively award skipped income. The practice fixture uses the same ambient rule.

Tests cover the start boundary, sustained rate, purchase threshold, fractional change, checkpoint continuation, death, victory, time jumps, and both browser balance displays. These establish the local implementation, not parity with a reference client.

## Remaining economy work

Starting gold and most rewards still need a complete patch audit. Role quests, support income, kill/assist sharing, shutdown bounties, turret plates, neutral-objective rewards, ordinary minion bounty scaling, item recipes, sell/undo, and independent bot inventories remain incomplete. This ambient correction does not establish a complete match economy.

Cannon and super-minion bounty growth is now implemented; see [the minion gold specification](MINIONS.md#cannon-and-super-gold-growth) for evidence and remaining timing assumptions.

## Champion reward ownership

Ambient income now accrues independently for every champion, including through death. Existing last-hit bounties and CS belong to the champion that dealt the killing damage; champion kills increment that owner's kill counter. Same-team kills grant no last-hit gold or kill/CS credit. Gold feedback uses the recipient's position and team audience. This ownership correction retains the existing bounty amounts and does not implement assists, shutdowns or team structure rewards. Bot purchasing remains unfinished.
