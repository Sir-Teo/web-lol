# Volley fidelity

The character root's second spell entry selects `Characters/Ashe/Spells/VolleyAbility/Volley`. This matters because older `VolleyRank2` through `VolleyRank5` records remain in the character data with different damage values. The source pin records the root selection and full main/missile records, and the exporter verifies them against the complete cached character source hash.

The selected spell has seven arrows at rank one (7/8/9/10/11 across normal ranks), 60/95/130/165/200 base damage and a 1.0 bonus-AD coefficient. The linked ordinary, center and sound projectile records agree on 1,500 units/second. The runtime now uses rank-one values: seven arrows, 60 + bonus AD, and source projectile speed. This replaces nine arrows, 20 + total AD, and 1,800 speed. [Patch 26.1](https://www.leagueoflegends.com/en-sg/news/game-updates/patch-26-1-notes/) also documents Volley's current bonus-AD ratio.

Bonus AD is computed by subtracting Ashe's level-scaled base AD from current AD, clamped to zero. This correctly separates the prototype's current base growth and flat item bonuses, but a complete stat system with temporary modifiers and negative bonuses is still needed. Damage is captured when casting, retained in saved projectiles, and applied once per victim per cast through the existing hit registry. Each victim's armor is applied at impact.

The exporter retains all five rank values, but skill-point allocation is absent and W remains rank one. The current 0.8-radian fan and radius-12 collision shape remain provisional: tooltip cone fields and missile-width metadata do not by themselves establish runtime launch spacing or hit geometry. Cast windup, source projectile visuals and complete ability rank behavior remain unfinished. Champion hits now apply the decaying enhanced slow documented in FROST-SHOT.md.

Two simulation cases check arrow count/speed/range budget, early/late base AD separation, item bonus scaling, center direction, saved captured damage and single-hit behavior. The existing collision test now expects the current base damage. A browser case casts and renders all seven source-speed arrows.
