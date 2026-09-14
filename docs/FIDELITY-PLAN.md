# Fidelity production plan

Reviewed September 13, 2026. This supplements [DESIGN.md](DESIGN.md), [RESEARCH.md](RESEARCH.md), and [ROADMAP.md](ROADMAP.md). It is a design and evidence review, not a new runtime milestone or a claim that all possible reference information has been recovered.

## Product decision

Build a complete desktop, mouse-and-keyboard, local 5v5 match: one player, four allied bots, five opposing bots. A static host delivers versioned content; the browser owns all match rules, bot decisions, saves, and replay. Preserve reference match pacing. Practice and controlled scenarios support the full match.

Keep TypeScript/Vite and Three.js, with a fixed-step planar simulation and a 3D presentation. Browser-only execution does not require a simplified 2D art style. It does require budgets for simulation, asset transfer, texture allocation, animation, and effects on the same device. WebRTC is a separate multiplayer project: connection setup and relay needs remain relevant even when peers simulate the game. [MDN connectivity](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Connectivity)

## Evidence and remaining research

Freeze standard PC Summoner's Rift 26.18 as the target, including an explicit hotfix cutoff when behavior is measured. The official patch page is available and Data Dragon currently advertises 16.18.1; those facts do not certify all imported content or mechanics. Riot documents delayed Data Dragon updates and regional version differences. [Patch notes](https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-18-notes/), [Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon)

Use four complementary sources:

| Source | Answers | Does not establish |
|---|---|---|
| Official changes and guides | Published rules and specific balance changes | Every inherited rule, exact input timing |
| Frozen static records | Identifiers, numbers, map transforms, authored clips | Server initialization, hidden modifiers, complete behavior |
| Controlled client captures | Camera, animation timing, range edges, input response | More precision than the recording supports |
| Local scenarios and profiling | What this implementation does and costs | Agreement with League without a reference comparison |

The existing source manifests, map conversion, and scenario suite are useful foundations. The largest research gaps are controlled reference captures and reconciliation of runtime initialization with raw data. For example, importing a damage field does not resolve spawn-time upgrades or on-hit effects; importing a death animation does not resolve particle events and state transitions.

Every discrepancy should have a stable ID, target patch/mode, reproduction conditions, reference source, local observation, confidence, implementation owner/file, and acceptance case. Separate behavior-verified, data-only, approximate, and absent coverage. Report counts by system rather than inventing one global accuracy percentage.

## Visual comparison contract

Establish a fixed capture set before tuning more presentation. Each reference must record viewport, aspect ratio, zoom, HUD scale, camera position/orientation, graphics settings, team, location, unit state, and animation time. Retain original captures alongside registered comparisons.

| Capture | Compare first | Gate |
|---|---|---|
| Empty lane and both bases | Projection, landmark positions, elevation, texture color | One coherent camera fit works across locations |
| Champion idle, walk, turn, attack | Silhouette, world scale, feet, facing, release pose | Motion and projectile origin agree throughout the sequence |
| Minion wave and structure destruction | Spacing, independent animation, parts, rubble, effects | No missing state, clipping, or premature corpse removal |
| Vision boundary and brush | Edge shape, shading, unit reveal, UI and audio filtering | Gameplay observation and presentation agree |
| Each complete ability | Windup, active geometry, impact, decay, sound | Visible threat corresponds to tested collision and timing |
| Busy fight | Effect hierarchy, outlines, health bars, sound priority | Threats stay recognizable without excessive occlusion |
| HUD at multiple sizes | Widget position, type metrics, icons, interaction regions | No overlapping or inaccessible controls |

Fit camera and scale before compensating through model resizing or texture edits. Measure landmark projection errors in pixels and timing differences in frames/ticks, with uncertainty from the source recording. Choose numeric tolerances after repeat captures establish noise. A screenshot metric alone is insufficient: it can reward a frozen pose while missing incorrect motion or gameplay.

Use separate comparisons for terrain, units, effects, and UI, then a full composited review. Assess temporal continuity with clips. Exact pixel identity across different renderers and graphics settings remains unproven; pursue documented discrepancies rather than claiming it from recognizable assets.

## Gameplay implementation contract

Define every champion through an executable behavior matrix. Required dimensions include ranks, levels, attack speeds, resources, cast modes, cancellation, target loss, collision boundaries, shields/resistances, crowd control, and relevant item/rune interactions. Full passive and four abilities, animations, effects, audio, and bot support are the unit of roster completion.

Start with Ashe to close movement, ranged attack, slow, and scouting semantics; use Lux next to exercise returning shields, multi-target collision, persistent zones, and recasts. Garen, Master Yi, Leona, and Ahri broaden the systems and role coverage. Mirrors permit a complete five-role match before ten distinct champions are finished.

Keep simulation deadlines authoritative. Animation blends express state; they never independently apply damage. Commands from both player and bots use the same validation. Bots consume team-visible observations and timestamped memory, then combine role planning, local tactics, and movement execution. Difficulty adjusts reaction and decision quality without reading hidden state.

Prioritize interactions that change the match: minion initialization and growth, shared XP, turret aggression and defenses, complete recall/shop/respawn rules, jungle resets, objectives, and patch-specific role systems. Static terrain and functioning base destruction do not establish full match fidelity.

## Performance without sacrificing accuracy

The latest saved 90-second practice benchmark tested `d0d65a5` on Chrome 152 / Apple M5 Pro / 64 GiB at 1920×1080: callback-delivery p95 18.8 ms, p99 22.2 ms, 231 draw calls, 379,519 triangles, and simulation p95 0.3 ms. These are prior recorded observations from [runtime-verification.json](reference/runtime-verification.json), not measurements rerun for this review or certified for the current revision. The sample covers 180 frames with 103 unit records. Nine complete bots, camps, and final effects are absent. A consistent 60 FPS full-match gate remains unmet; there is no controlled comparison with the earlier benchmark.

A newer ten-champion encounter sample at `ddb465d`, restored from the 20-minute mixed lane checkpoint, measured 1800 callback-delivery intervals with p95 19.6 ms and p99 21.2 ms on the same Chrome/M5 Pro hardware class. Simulation p95 was 0.5 ms; application render p95 was 7.2 ms. This is a different fixture, not a controlled performance improvement comparison. The CPU profile exposes animation and matrix work for further investigation. The old callback-delivery metric was mislabeled frame cadence and does not establish missed frames. Corrected browser animation-frame timestamps and optional elapsed GPU queries are now recorded in the linked report; full-match and physical presentation certification remain open. See [MATCH-RENDER-PROFILE.md](MATCH-RENDER-PROFILE.md).

The source texture path alone transfers 145.77 MB and allocates an estimated 327.42 MiB of GPU block storage. This exceeds the original design's 60 MB core-pack and 256 MiB texture targets. Preserve a source-quality reference pack; evaluate separate delivery variants against the same capture set before changing the default. Progressive download cannot be called offline-ready until the required pack is complete. See [map evidence](MAP-ASSETS.md).

Animation-aware building bounds and native per-mesh culling have since been implemented and checked with sampled deformed-vertex containment and frozen-frame comparisons; unsupported rigs retain the uncullable fallback. See [structure bounds](STRUCTURES.md#animation-aware-rendering-bounds). An idle-pose bound remains unsafe for new animated rubble or cloth: Three.js explicitly notes that animated skin bounds must reflect animation state. New assets need conservative bounds covering every supported clip and blend, or validated updates/fallbacks. [SkinnedMesh documentation](https://threejs.org/docs/pages/SkinnedMesh.html)

Retain deformed-vertex containment checks and identical frozen-view renders with culling enabled/disabled, including both bases, viewport edges, destruction, and shadows. The next performance decision should follow a complete-match profile rather than repeat the completed building-culling milestone. Measure draw calls and frame tails on the same fixture. Keep offscreen simulation active. Consider workers or more complex skinning only after profiling demonstrates their benefit.

## Execution order and release gates

1. Establish registered reference captures and an uncertainty ledger; reconcile camera, scale, and outstanding lane rules.
2. Address measured rendering waste with visual-equivalence checks; retain the source-quality baseline.
3. Finish the first champion's full audiovisual and behavior matrix, then the second champion and duel interactions.
4. Complete economy, jungle, objectives, vision variants, and role systems while expanding to the six-character roster.
5. Add nine role-aware bots and validate complete seeded matches, including stalled matches and objective conversion.
6. Finish offline caching, versioned saves/replays, context-loss recovery, accessibility/settings, and browser/device certification.

Each stage closes with inspectable evidence and small commits. Existing regression passes must stay intact; matching a new screenshot does not justify breaking hidden-state filtering or combat. The full roadmap remains the completion standard. Public distribution of exact Riot content also remains a separate permission dependency already documented in the design.
