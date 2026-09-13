# Battlefield vision policy

The simulation owns visibility. Rendering and input do not decide whether a unit can be targeted. This is a local gameplay rule, not an anti-cheat boundary: the complete match state necessarily exists in the browser.

## Reference evidence

Riot's [patch 13.22 notes](https://www.leagueoflegends.com/en-gb/news/game-updates/patch-13-22-notes/) reduced the attack reveal radius from 400 to 300 units and its duration from 4.5 to 2 seconds. The practice implementation uses the latter values. Older guides repeating 4.5 seconds should not override this explicit patch evidence. A complete audit of subsequent changes through the frozen 26.18 target is still required before certifying exact parity.

Riot's [patch 26.1 notes](https://www.leagueoflegends.com/en-sg/news/game-updates/patch-26-1-notes/) also describe Faelight wards revealing additional areas. Those authored regions and ward rules are not implemented by the current practice sight model.

The source-grid flag interpretation follows the primary [LoL-NGRID-converter format reference](https://github.com/FrankTheBoxMonster/LoL-NGRID-converter/tree/92943ed2b2d5e82c86d680e69f53f247c89aefee). The runtime uses the extracted AIPath_SRX_3 grid from the frozen map container. This is an independently implemented sight policy, not Riot's original runtime code.

## Implemented behavior

| Surface | Policy |
|---|---|
| Ordinary sight | Living allies share circular sight, clipped by source-grid walls and brush. Champion radius 1,300 and other-unit radius 1,000 remain practice values. |
| Brush | An observer inside a connected brush region can see out and within that region. A ray entering another brush region stops. A living ally inside can reveal occupants to its team. |
| Terrain | Supercover grid traversal tests source walls without movement-clearance padding. Transparent walls block movement while preserving sight. Neutral gate regions allow sight into and out of their interior, but not through. Unknown bit 128 and dynamic overlays remain unresolved. |
| Targeting and bots | Enemy acquisition requires live team visibility. Losing sight cancels an unreleased attack and clears direct pursuit. Released homing attacks keep their existing simulation trajectory. |
| Attack reveal | A shot released from an area hidden without temporary attack reveals creates a stationary 300-unit sight source for the victim's team for 120 simulation ticks. Repeated shots extend exposure through additional areas. Cancellation before release creates no area. |
| Hawkshot | The existing temporary 650-unit area bypasses brush and walls. Travel, charges, lingering trail, and reference reveal details remain future kit work. |
| Projectiles | Allied missiles remain visible. Enemy missiles render only when their current position is visible; visibility of the shooter does not expose a remote missile. Collision continues while hidden. |
| Combat events | Each event receives its team audience at emission. Audio and combat text use that saved audience, including when the subject later becomes visible or is removed. |
| Private feedback | Movement indicators, messages, gold, and level feedback belong to their team. Gold text appears at the player rather than revealing a hidden kill location. |
| Enemy UI | Hidden health bars and target panels stop updating their displayed values. Picking and mobile-unit minimap icons require live visibility. Known intact buildings retain minimap markers. |
| Building knowledge | Initial static placements are known to both teams. Destruction updates their public intact/destroyed state without revealing damage or granting sight. Hidden regrowth retains the last known state until observed. |
| Fog presentation | A reused 256×256 mask samples the shared sight query every eight simulation ticks. Observer bounds limit work and already-revealed cells skip duplicate rays. Terrain materials, including trees and rocks, static building materials, and the minimap share the softened mask. Building fog coordinates are evaluated after skeletal deformation. Gameplay queries the source grid directly, independent of display resolution or cadence. |

## Remaining gaps

Enemy structures now retain their known representation outside vision. `World.visible` remains a live-sight query used by combat and picking. `knownStructureDestroyed` is a separate presentation query: it returns an intact/destroyed state for buildings and no known representation for mobile units. Snapshot version 4 includes per-team structure knowledge. No hidden HP values are stored in that knowledge or displayed by the UI.

Destruction updates public map state directly; the original damage/death event audience remains unchanged, so this does not introduce hidden combat text or ordinary combat audio. Complete global structure announcements and their reference audio remain future work. Respawning buildings update their owner's knowledge immediately and the opposing team's knowledge on observation. This is the current reconstruction policy, including initial map knowledge and the exact hidden-regrowth behavior; it still requires matched League captures before claiming exact parity.

Wards, detectors, stealth, camouflage, true sight, nearsight, terrain transformations, and per-ability reveal rules are not yet modeled. Allied projectiles in fog and spell effects require reference-specific policies rather than one universal visibility rule. The original circle terrain and 128×128 floor mask remain only in the development regression fixture at `/?scene=fixture`. Full-map tests use the source grid. Passing internal alignment tests is not certification against recorded League sight behavior.

## Verification

Nine new simulation scenarios cover brush entry/exit, wall occlusion, shared sight and observer death, hidden target acquisition, lost-vision attack cancellation, release timing and expiry, repeat attack reveal, Hawkshot expiry, hidden missiles/structures, and frozen event audiences (some scenarios cover multiple cases). The existing combat/navigation/economy scenarios still pass. Grid-specific scenarios cover transparent walls, connected brush, team gates, and a full-map route.

A browser fixture checks that hidden and revealed states agree across the actual model, picking, projectile model, health bar, target panel, combat text, and fog mask. It records screenshots before and after entering brush. The earlier eight browser scenarios remain in the suite.

The full-map browser scenario places an enemy in source-authored brush, verifies hidden model and picking behavior, then introduces an allied observer. It compares every one of the 65,536 raw fog samples against the simulation visibility query and requires zero mismatches. Separate checks validate cursor/ground agreement at the elevated fountain and below-zero river floor. The complete current suite has 31 simulation and 16 Chrome scenarios.

## Known-building presentation verification

Four additional simulation scenarios separate initial knowledge, hidden damage, public destruction, and both-team regrowth/observation. A Chrome scenario inspects all 15 enemy structures under fog, their material shader hook, a known minimap marker, hidden health/picking/selection, damage event isolation, and hidden inhibitor regrowth. It then observes the inhibitor and checks that its intact appearance remains remembered after sight expires. Full-base hidden/revealed and regrowth screenshots were visually inspected. This closes the terrain-cutout presentation gap while retaining the live-sight rules.

## Exact fog sample reuse

`FogSampler` caches individual observer-to-pixel results using exact X/Y, radius, and unobstructed status. It records both visible and blocked samples lazily, retaining the union's early-out for pixels another observer already reveals. No observer coordinates are rounded, and no fog samples are removed or deferred. Only sources present in the current update remain cached, so movement, death, and expiring reveals cannot leave an old contribution in the union.

Both current battlefields explicitly declare `visibilityRevision: 0` for their static sight geometry. Any future wall/brush/terrain mutation must advance this revision in the same update as the geometry change. A changed query function or revision clears the cache; an omitted revision disables reuse between updates for mutable/custom battlefields. The cache is presentation-only and never supplies gameplay visibility.

Unit scenarios compare the complete mask with independent `seenFrom` queries through source movement, reordering, overlap removal, radius changes, unobstructed reveal, empty source sets, and cache invalidation. A browser scenario compares all RGBA samples with caching disabled across eight full-map states: initial, stationary, active lanes, sub-cell movement, observer death/restoration, and reveal appearance/expiry. The existing source-brush test independently compares all 65,536 samples with `World.pointVisible`.
