# Champion health-bar divisions

Champion overhead bars previously used a repeating 16-pixel stripe. That kept the number of divisions almost constant even as leveling and items increased maximum health, so the stripes did not communicate health amounts.

The presentation now divides the full bar at 100-health intervals and uses stronger full-height marks at 1,000-health intervals. Minor marks occupy the upper 60% of the health area. Both are CSS background layers, avoiding one DOM node per division. Their percentages are recalculated only when a visible champion's maximum health changes; damage changes the fill independently. The existing 86-pixel width, team colors, names, mana bars, world anchoring, and visibility rules remain in use. Structure and minion bars do not inherit champion divisions.

This is a presentation policy improving semantic readability, not a source-calibrated reconstruction of Riot's health-bar shader or geometry. Exact tick widths, heights, alpha, bar dimensions, shield treatment, zoom behavior, and density rules for very large health pools still need matched reference captures. No pixel-parity claim is made.

The selected-target panel now rounds current and maximum health upward consistently with the player's resource display, rather than showing fractional maximum health alongside an integer current value.

The browser check covers 610, 2,327, and 2,407 maximum health through actual level progression and an item purchase. It checks both CSS division intervals, unchanged bar width, and readable selected-target health. Captures are `artifacts/health-divisions-base.png`, `health-divisions-level18.png`, and `health-divisions-item.png`; all three were visually inspected. The existing progression HUD check also passes. Simulation behavior is unchanged.
