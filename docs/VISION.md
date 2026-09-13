# Practice vision policy

The simulation owns visibility. Rendering and input do not decide whether a unit can be targeted. This is a local gameplay rule, not an anti-cheat boundary: the complete match state necessarily exists in the browser.

## Reference evidence

Riot's [patch 13.22 notes](https://www.leagueoflegends.com/en-gb/news/game-updates/patch-13-22-notes/) reduced the attack reveal radius from 400 to 300 units and its duration from 4.5 to 2 seconds. The practice implementation uses the latter values. Older guides repeating 4.5 seconds should not override this explicit patch evidence. A complete audit of subsequent changes through the frozen 26.18 target is still required before certifying exact parity.

Riot's [patch 26.1 notes](https://www.leagueoflegends.com/en-sg/news/game-updates/patch-26-1-notes/) also describe Faelight wards revealing additional areas. Those authored regions and ward rules are not implemented by the current practice sight model.

## Implemented behavior

| Surface | Policy |
|---|---|
| Ordinary sight | Living allies share circular sight, clipped by the authored rock obstacles and brush. Champion radius 1,300 and other-unit radius 1,000 remain practice values. |
| Brush | An observer inside a brush can see out. A ray from outside stops at the brush. A living ally inside can reveal occupants to its team. |
| Terrain | Uses the same circular wall definitions as pathfinding, with no movement clearance padding. Art and collider parity are not yet measured. |
| Targeting and bots | Enemy acquisition requires live team visibility. Losing sight cancels an unreleased attack and clears direct pursuit. Released homing attacks keep their existing simulation trajectory. |
| Attack reveal | A shot released from an area hidden without temporary attack reveals creates a stationary 300-unit sight source for the victim's team for 120 simulation ticks. Repeated shots extend exposure through additional areas. Cancellation before release creates no area. |
| Hawkshot | The existing temporary 650-unit area bypasses brush and walls. Travel, charges, lingering trail, and reference reveal details remain future kit work. |
| Projectiles | Allied missiles remain visible. Enemy missiles render only when their current position is visible; visibility of the shooter does not expose a remote missile. Collision continues while hidden. |
| Combat events | Each event receives its team audience at emission. Audio and combat text use that saved audience, including when the subject later becomes visible or is removed. |
| Private feedback | Movement indicators, messages, gold, and level feedback belong to their team. Gold text appears at the player rather than revealing a hidden kill location. |
| Enemy UI | Hidden health bars and target panels stop updating their displayed values. Picking and minimap icons require visibility. |
| Fog presentation | A reused 128×128 mask samples the exact sight query every eight simulation ticks, then scales and lightly softens it for display. The battlefield and minimap share this canvas. Gameplay uses continuous geometry, independent of mask resolution or update frequency. |

## Remaining gaps

The practice mask shades the ground plane; elevated tree and rock materials still need consistent fog treatment. Enemy structures currently disappear outside vision. A known-building representation, last observed state, and explicit globally announced destruction are needed to reproduce League's map presentation without exposing hidden health changes.

Wards, detectors, stealth, camouflage, true sight, nearsight, terrain transformations, and per-ability reveal rules are not yet modeled. Allied projectiles in fog and spell effects require reference-specific policies rather than one universal visibility rule. The authored circle terrain and brush are temporary, so passing these tests is not proof of Summoner's Rift geometry parity.

## Verification

Nine new simulation scenarios cover brush entry/exit, wall occlusion, shared sight and observer death, hidden target acquisition, lost-vision attack cancellation, release timing and expiry, repeat attack reveal, Hawkshot expiry, hidden missiles/structures, and frozen event audiences (some scenarios cover multiple cases). The existing ten combat/navigation/economy scenarios still pass.

A browser fixture checks that hidden and revealed states agree across the actual model, picking, projectile model, health bar, target panel, combat text, and fog mask. It records screenshots before and after entering brush. The earlier eight browser scenarios remain in the suite.
