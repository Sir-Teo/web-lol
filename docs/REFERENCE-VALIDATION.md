# Reference validation specification

Design review: September 13, 2026. Read with [the complete design](DESIGN.md), [research sources](RESEARCH.md), and [milestones](ROADMAP.md). This specifies future measurements; it does not claim that native reference captures exist.

## Design decision

Build a desktop 3D game with one human and nine local bots, a complete three-lane match, and reference pacing. TypeScript owns a fixed-step planar simulation; Three.js presents terrain, animation and effects; HTML/CSS presents the match HUD; Web Audio presents simulation events. Ship versioned static files and keep all match decisions local. Practice, pause, saves and replay are first-class tools for both players and fidelity testing.

This architecture can reproduce a rich solo match without an application backend. It cannot provide trusted competitive rankings or dependable internet matchmaking on its own. Peer transport still has connection establishment and relay considerations. [MDN WebRTC connectivity](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Connectivity)

The highest quality route is to measure one complete champion and lane interaction, then extend the same verified systems to the full match. Completing increasingly small particles without validating camera, combat and a playable match would leave major fidelity questions unanswered. Finish isolated effects through bounded acceptance cases, then return to the larger milestone.

## Evidence inventory and boundaries

| Evidence available in this workspace | Useful for | Still missing |
|---|---|---|
| Versioned champion records and normalized parameters | Stats, authored timelines, source identifiers | Complete executable spell semantics and server-side overrides |
| Source terrain, placements and navigation grid | Geometry, landmark alignment, height, blockers | Matched camera fit and native path comparisons |
| Skinned models and atomic animation clips | Silhouette, rigs, individual poses | Full transition/event graphs and measured playback behavior |
| Particle records, textures and local adapters | Authored dimensions, colors, curves, source provenance | Native defaults, orientation, phase, color-space and blend calibration |
| Local simulation and browser regression tests | Reproducibility and implementation consistency | Independent evidence that the implementation agrees with League |
| Practice performance reports | Identifying present costs | Nine-bot, complete-objective, final-effects device certification |

Use [map provenance](MAP-ASSETS.md), [asset pipeline](ASSETS.md), [Ashe E evidence](ASHE-E.md), and [current progress](PROGRESS.md) as entry points. Do not treat uncommitted runtime work as a completed milestone.

Freeze standard PC Summoner's Rift 26.18 for this design, with an explicit client build and hotfix cutoff for every capture. The official patch was published September 9, 2026. Its changes do not define every inherited rule, and other modes on the page must be excluded. [Official patch notes](https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-18-notes/)

Data Dragon supplies versioned static data, with documented update and regional-version caveats. Use it as an input to a specification, not as an executable game engine. [Riot Data Dragon documentation](https://developer.riotgames.com/docs/lol#data-dragon)

## Capture packet

Each experiment must retain the original capture plus a small machine-readable sidecar containing:

```text
experiment_id, question, game_mode, patch, client_build, hotfix_cutoff
champion, skin, level, ranks, items, runes, buffs, team
world_location, target_location, relevant_unit_radii
viewport_pixels, device_scale, HUD_scale, camera_zoom, graphics_settings
capture_rate, frame_timestamps, input_observation_method
setup_steps, ordered_actions, repetitions, observed_events
source_files_and_hashes, local_build, local_scenario_id
measurement_uncertainty, result, known_deviations
```

Record unavailable fields as unknown. Record video frame timestamps rather than assuming constant frame rate. An input overlay or synchronized input trace is required to measure input-to-feedback delay; ordinary gameplay footage cannot reveal the exact physical keypress time. Reference network conditions can affect observed action timing and belong in the record when known.

Use at least five repeats for the first timing experiment as a proposed screening minimum. Increase repetitions when results vary or lie near a decision boundary. At 60 fps, a visible transition is bounded by adjacent frames about 16.7 ms apart; comparing two uncertain endpoints can have larger uncertainty. Do not present a sub-frame result without a supporting measurement method.

Keep raw observations, normalized values and implementation choices in separate fields. Unknown probability distributions remain unknown even when a source supplies a minimum and maximum.

## First comparison set

These are proposed experiments, not claims about native outcomes.

| ID | Controlled experiment | What it resolves |
|---|---|---|
| CAM-01 | Same viewport and zoom, stationary champion at both bases, lane and river; several landmarks per view | Projection, global scale, camera height/pitch, terrain alignment |
| MOVE-01 | Straight unobstructed travel at a fixed speed, then repeated corners and narrow gaps | Speed integration, stopping, route shape and radius clearance |
| INPUT-01 | Right-click, attack move, stop, hold/release targeting, cancel, minimap and camera lock | Command interpretation, focus boundaries and feedback latency |
| ATK-01 | Ashe stationary attacks at several attack speeds; move just before and after release | Windup scaling, missile origin/travel, cancellation, recovery |
| Q-01 | Acquire stacks, activate during an attack cycle, change targets, let the buff expire | Eligibility, reset timing, per-hit behavior and animation transitions |
| W-01 | Targets at center, cone edge and behind a blocker; cast while moving | Arrow geometry, collision ordering, damage/slow and release timing |
| E-01 | Short and long flights over walls and brush; endpoint and tail recorded | Flight/reveal semantics and complete travel/arrival/linger presentation |
| R-01 | Short/long hits, eligible/ineligible blockers and nearby secondary targets | Collision, distance effects, area consequences and impact presentation |
| FOG-01 | Brush entry/exit, vision expiry, target acquired then hidden, relevant reveal effects | Rules shared by selection, minimap, audio and bot knowledge |
| LANE-01 | Unopposed waves followed by last hits, nearby shared XP and champion aggression | Initialization, growth, meeting point, economy and aggro |
| BASE-01 | Turret retaliation, dependency protection, inhibitor destruction/regrowth | Structure state machines and future wave changes |
| MATCH-01 | Two complete compositions through lane, purchase, jungle, objectives and base conversion | Whether the isolated mechanics form a credible match |

Expand spell cases across ranks, levels, haste, attack speed, CC and target state only where those variables affect the question. Use targeted boundary cases and pairwise interaction selection before attempting a large Cartesian test matrix. Every discovered exception becomes a named regression scenario.

## Visual calibration order

1. Fit one coherent camera and coordinate transform across several views. Hold out another location to check the fit; avoid per-screenshot camera adjustments that conceal inconsistent geometry.
2. Align terrain and model silhouettes, feet, orientation, sockets and animation time. Report landmark errors in pixels with a viewport reference.
3. Compare material color, lighting, shadow, fog and outline passes. Preserve a source-quality asset baseline while evaluating delivery optimizations.
4. Compare each effect's emission, trajectory, size, UV animation, color curve, blend, depth interaction and cleanup through time. Inspect the full composite after isolated passes.
5. Match HUD anchoring, typography, scale, bar dimensions and interaction regions at multiple resolutions; test hit regions as well as screenshots.
6. Compare sound onset, cue identity, audibility under fog, mix priority and overlap in a busy fight.

Riot's historical graphics article supports examining separate rendering stages; it is a 2017 description, not a specification of the current renderer. Its clarity article supports evaluating recognition and threat hierarchy in motion. [Graphics pipeline](https://www.riotgames.com/en/news/trip-down-lol-graphics-pipeline), [Clarity in League](https://www.leagueoflegends.com/en-us/news/dev/clarity-in-league/)

Save side-by-side video, registered stills, landmark error tables and timing deltas. Mask a region only for an explicit reason, such as unrelated UI animation; retain an unmasked view. Use image differences to locate discrepancies, with human review for animation and threat readability. Low image error alone cannot certify correct gameplay.

Source-faithful art and native-pixel agreement are different statuses. A lossless texture import proves preservation of that texture, not that its shader, blend order or on-screen color is correct. Likewise, identical paused/restored browser pixels prove restoration consistency, not native parity.

## Full-match and browser acceptance

The final mode needs all five roles, meaningful jungle and objectives, item/rune behavior, progression, team vision, victory and defeat. Use the [roadmap's seeded match tests](ROADMAP.md) and human playtests to identify indecision, unfair knowledge, poor objective conversion and stalled games. Keep offscreen simulation active. Run bots through the same command validation as the player and expose only team-filtered observations to their decision code.

Measure the complete stress scene on named devices in Chrome, Firefox and Safari. Treat 60 fps at 1080p as a target until measured. Record p95/p99 frame time, simulation time, draw calls, texture allocation, download/decode cost and repeated-match growth. The existing practice benchmark and terrain costs already exceed parts of the proposed budget; a new architecture claim does not erase those measurements. See [the fidelity plan](FIDELITY-PLAN.md).

Offline delivery should use immutable content revisions and an atomic readiness record: fetch the selected pack, verify required entries, mark it ready, and start a match pinned to that revision. A partial download is retryable and must not replace a usable pack. Do not activate incompatible code/content during a saved match. Test a fresh offline reload and a first cast of every supported ability with network disabled.

Store snapshots and settings in IndexedDB, assets in versioned caches, and provide export/import for valuable saves. Handle quota failure and eviction; request persistent storage where appropriate but keep recovery paths. Browser-managed storage is best-effort by default. [MDN storage behavior](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)

## Coverage and next decisions

Report separate counts for behavior-verified, source-data-only, approximate, unimplemented and regressed cases. Also report complete champions, objective systems, bot roles and certified device/browser combinations. Keep the denominator fixed within a release audit. A particle emitter count must not become a percentage of overall League accuracy.

The next high-value work is the capture packet and camera/attack/complete-Ashe comparison set, followed by a second kit that exercises new interactions and the complete match systems. Continue performance work where measured costs justify it. Roster expansion should reuse verified primitives while retaining explicit champion exceptions.

Exact Riot content remains a separate production dependency: Riot's developer policy excludes games using its IP. Public source availability does not establish distribution authorization. Keep provenance and content substitution boundaries in the architecture; this research does not establish a license. [Riot developer policy](https://developer.riotgames.com/docs/lol#developer-api-policy)
