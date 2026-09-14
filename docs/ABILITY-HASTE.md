# Ability haste and mage components

The shared stat now sums ability haste from owned items. [Riot's 10.23 explanation](https://www.leagueoflegends.com/en-au/news/game-updates/patch-10-23-notes/) establishes 1% faster casting per point: effective cooldown is `base seconds × 100 / (100 + haste)`. Haste adds before that conversion; it is not a percentage subtraction from the base cooldown. The runtime applies this to Ashe and Lux champion spells. Flash and Heal use their original cooldowns; ability haste is separate from summoner haste, which is not implemented.

## Pinned items

| Item | AP | Ability haste | Total gold | Sell gold | Recipe |
|---|---:|---:|---:|---:|---|
| Glowing Mote | 0 | 5 | 250 | 175 | Direct component |
| Fiendish Codex | 25 | 10 | 850 | 595 | Tome + Mote + 200 |

Full Data Dragon 16.18.1 and raw CommunityDragon 16.18 records are retained in [reference/mage-items.json](reference/mage-items.json), with original response hashes. `tools/assets/export-mage-items.py --check` compares generated values and checks source recipes, AP, mana, prices, standard-map availability and haste against current tooltips. Data Dragon does not populate haste in its `stats` object. The raw `mAbilityHasteMod` field and current tooltip agree; Codex's legacy `mEffectAmount=-0.1` is not treated as 10% cooldown reduction. The two original icons are stored locally with source URL, SHA-256 and byte size in the asset manifest.

Codex consumes one Tome and one Mote and charges the remaining cost, including in a full inventory. Deriving haste from the resulting inventory prevents double-counting consumed Mote haste. Multiple copies add independently, and selling removes just the selected copy. Lux's interim bot build has not yet been changed to use these components; complete mana/haste upgrades and build decisions remain outstanding.

## Cooldown lifecycle and presentation

A newly started cooldown captures effective duration and rounds readiness up to an integer 60 Hz tick. Cast windups, projectile speed, shield duration, buff duration and mana costs are unchanged. Purchases and sales do not rescale already-running deadlines. New casts use current equipment. This capture policy, exact native rounding and Ashe E's inter-cast cooldown scaling need direct native calibration; the formula alone does not prove those details.

Hawkshot's pinned `ChargeCooldown` calculation explicitly multiplies `BaseCooldown` by `CooldownMultiplierCalculationPart`, supporting haste on charge recharge. Initial charge consumption starts a hasted recharge; spending the other charge preserves that timer. When a charge returns, a new sequential cycle captures current rank and haste. A sale during recharge therefore affects the following cycle. Recharge continues through death under the existing policy. The current cycle's saved duration drives its progress bar, while the tooltip shows the current stat-based duration for future cycles. The tooltip rounds to two decimal places, avoiding long floating-point strings.

Snapshot 44 preserves integer deadlines and captured recharge durations. Validation accepts durations reachable from any six-slot combination of current catalog haste and any E rank, because the original equipment may have been sold or the rank changed. It rejects arbitrary durations such as one tick. Future rune/buff haste must extend this validation alongside its stat implementation. No haste total is redundantly serialized.

## Verification

589 source/simulation checks pass. New coverage verifies pinned haste and recipes, additive conversion, full-inventory component consumption, both champion kits, owner isolation, summoner exclusions, unchanged cast windups, cast-time cooldown capture, exact save restoration, readiness boundaries, sequential charge recharge after sale and invalid saved durations. Seven focused Chrome scenarios pass across the existing ability-tooltip suite and new Codex shop/tooltip case. The latter completes the recipe, checks AP, observes Volley 16.36-second and Hawkshot 81.82-second tooltips, then confirms live reversion on sale. Its initial attempt exposed a test timing issue with a lazy-loaded shop icon; the test now scrolls to the item and waits for decoded dimensions. `artifacts/haste-tooltip.png` was inspected. Source regeneration and nested-path production smoke pass. These checks do not certify native lifecycle conformance, full-match completion, full-browser regressions or rendered performance.
