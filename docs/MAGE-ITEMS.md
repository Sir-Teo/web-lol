# Mage equipment

The catalog now includes Blasting Wand, Needlessly Large Rod and Rabadon's Deathcap. Their complete Data Dragon entries and corresponding raw item/group records are retained in [reference/mage-items.json](reference/mage-items.json). Both cached full-response hashes were checked. Sources are [Data Dragon 16.18.1](https://ddragon.leagueoflegends.com/cdn/16.18.1/data/en_US/item.json) and [CommunityDragon 16.18](https://raw.communitydragon.org/16.18/game/items.cdtb.bin.json), using standard map-11 availability.

| Item | Flat AP | Total gold | Sell gold | Recipe |
|---|---:|---:|---:|---|
| Blasting Wand | 45 | 850 | 595 | Direct component |
| Needlessly Large Rod | 65 | 1200 | 840 | Direct component |
| Rabadon's Deathcap | 130 | 3500 | 2450 | Two Rods + 1100 gold |

The Deathcap root's named `APAmp` value is 0.3, corroborated by its current tooltip. Its two retained ownership groups identify `3089` and `APMultiplier`, each allowing one. The shop rejects a second Deathcap and the snapshot decoder rejects duplicate ownership. Other future AP-multiplier items will need the same group policy when added.

`tools/assets/export-mage-items.py` generates the runtime catalog and amplification constant. `--check` verifies the checked-in output without rewriting it. The exporter checks prices, AP, map availability, repeated recipe links, tooltip amplification and unique ownership groups. Source item prices are combine costs; catalog prices are full costs from Data Dragon. The selling reference now includes all three items. Original 16.18.1 item PNGs are stored locally with source URLs, hashes and sizes in `public/assets/reference-manifest.json`.

## Stat and transaction behavior

`World.abilityPower` sums the champion's flat item AP and applies Deathcap's 1.3 multiplier once when owned. It uses the existing stat precision helper. All current AP-scaling damage and shields use this shared value; already captured spell payloads retain their cast-time AP through later purchases or sales. There are no AP runes, adaptive-force buffs or other percentage-AP modifiers in the current catalog; their future interactions require explicit implementation.

Recipe planning consumes two distinct Rod slots, never the same slot twice. A third Rod remains. Full inventories can upgrade when components free a slot. Missing components are paid as part of the remaining cost, so direct purchase costs 3500, one-Rod completion costs 2300 and two-Rod completion costs 1100. Failed purchases are atomic. Selling the completed item removes its flat AP and amplification while leaving other items unchanged. Ownership and stat recomputation survive checkpoint restoration; no new serialized stat field is needed.

The shop displays the same remaining-cost quote as the transaction, loads the three source icons, and updates effective AP. Duplicate ownership disables the purchase. Existing fountain/death access rules and inventory handling apply.

Lux's local bot policy starts with Tome and boots, then buys Rods toward Deathcap or completes it directly when the remaining price is affordable, followed by Wand. It does not rebuild consumed Rods after completion. Shopping recalls use remaining recipe cost and permit a full inventory when recipe components provide space. This path is an interim use of implemented equipment, not a claim that Deathcap-first is the optimal native build. Haste, penetration, active items, richer passives and complete six-item plans remain outstanding.

## Sapphire Crystal and bonus mana

The same pinned source bundle and generator now include Sapphire Crystal (`1027`): 300 mana, 300 total gold, 210 sell gold, no recipe. Data Dragon's `FlatMPPoolMod` agrees with raw `flatMPPoolMod`; both full-response hashes were checked before retaining the complete records. The original icon is local and hashed in the asset manifest. Multiple copies occupy separate slots and add their mana independently.

Purchasing applies net item mana after subtracting consumed components. Selling removes the selected copy's mana. The current **local resource policy** adds the stat delta to living owners' current mana, preserving missing mana unless removal would go below zero. Maximum mana uses the shared stat precision helper. Dead owners retain current mana, clamped to the new maximum, until respawn restores the equipped maximum. Level growth remains additive; recall and fountain regeneration already use that maximum. No new snapshot fields or schema version are needed: inventory, current mana and maximum mana were already serialized.

Native current-mana behavior for ordinary item purchases, sales and recipe completion still requires calibration. Riot's [10.13 Ornn notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-10-13-notes/) describe percentage preservation for Ornn's field crafting; that champion-specific rule does not establish ordinary fountain transactions. No Ornn crafting or mana-item recipe is implemented here. Sapphire is available to human purchases and the shared owner API; the interim Lux bot build remains the AP path above until its mana-item upgrades are implemented.

Validation at this addition: 584 source/simulation checks, four focused Chrome shop scenarios, source regeneration and nested-path production smoke pass. New cases cover source agreement, multiple copies, low-mana sale clamping, both champions' growth, independent ownership, exact living/dead checkpoints, respawn, recall and atomic failures. The browser case verifies source icon loading, price, buy/sell balance and mana readouts. `artifacts/mana-shop.png` was inspected. No full-match, full-browser or rendered-performance rerun was performed for this stat/catalog addition.

## Validation

579 source/simulation checks pass. Six new cases cover dual-source stats/recipes, two distinct components in a full inventory, direct/partial recipes and unique ownership, AP capture across all four Lux spells and sale, bot completion, and full-inventory shopping recall. Existing sell-price checks cover the new catalog entries. Two Chrome shop scenarios pass, including source icon loading, remaining price, AP readout and duplicate ownership; `artifacts/mage-shop.png` was inspected. Source regeneration checks, original hash checks and nested-path production smoke pass.

A twenty-minute headless Rift diagnostic with eight Ashe and two Lux finished without finite/resource violations and with exact checkpoint round-trip state. Both Lux bots owned Tome, boots, Deathcap and Wand at the end, yielding 253.5 AP. Blue Lux reached level 12 with 11 kills/5 deaths; red Lux level 10 with 6 kills/11 deaths. No winner was reached. These are diagnostic outcomes, not balance or human-quality evidence. Source and report hashes are retained in [reference/mage-items-verification.json](reference/mage-items-verification.json). Full-match completion, rendered performance and native comparison remain unverified by this run.
