# Browser League: quality-first design review

September 14, 2026. Reviewed against repository revision `3a9316b`, the existing [system design](DESIGN.md), [research](RESEARCH.md), and primary references below. This is a planning review; no native-client measurements or new runtime certification were performed. The investigation is bounded: public data cannot establish every undocumented League interaction.

## Recommended product

Build a complete desktop 3D Summoner's Rift match with one human, four allied bots and five enemy bots. Preserve laning, last-hitting, trading, recalling, buying, jungle routes, vision, objectives and Nexus victory. Keep practice, pause, saves and replay as first-class modes. Quality governs the order of development, while the full match remains the destination.

Continue TypeScript + Vite + Three.js. Use a planar, fixed-step simulation beneath the 3D scene, a DOM HUD, and Web Audio. This project needs authored camera projection, terrain, animated characters and layered effects; a sprite-only presentation would make the requested visual fidelity harder. Three.js provides a WebGL 2 rendering foundation, not the match simulation. [Renderer documentation](https://threejs.org/docs/pages/WebGLRenderer.html)

All gameplay, AI and persistence run locally. Static HTTPS hosting distributes versioned files. No API key, remote language model or game-server response belongs in a match. Offline operation requires a complete cached content pack and a service worker that serves it. Reliable internet PvP is a separate architecture: WebRTC requires connection information exchange and can require relays. [MDN caching](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Caching), [WebRTC connectivity](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Connectivity)

## Research contract

Retain the repository's frozen standard-PC 26.18 target rather than switching to a moving latest patch. Record the exact client build and hotfix cutoff for new measurements. Keep raw files, source hashes, converter versions, normalized parameters and known exceptions linked together. Data Dragon is useful static metadata; it does not supply executable ability behavior. [Riot developer documentation](https://developer.riotgames.com/docs/lol#data-dragon)

Every feature needs separate evidence for its data, behavior and presentation. A decoded projectile speed establishes an authored field. A native capture establishes how that field behaves under a particular setup. A local regression test establishes that our implementation keeps behaving consistently. None substitutes for the other two.

Use the existing [capture specification](REFERENCE-VALIDATION.md) to record repeated native and browser scenarios. Keep uncertain values explicit. Missing data must not silently become zero, and a community parser's defaults must not be described as verified native engine behavior.

## Build the fidelity loop before expanding content

Create one reusable scenario package containing initial state, inputs, deterministic seed, camera settings, event timestamps, audio cues, screenshots and resulting state. The following gates define development order, not claims of completed work.

| Gate | Work | Acceptance evidence |
|---|---|---|
| Camera and control | Projection, world scale, ground picking, selection, edge pan, movement and attack cancellation | Fit several map landmarks; validate held-out locations, both sides and multiple viewport sizes; compare repeated native movement and release timing |
| Complete two-champion fight | Ashe and Lux passives, ranks, Q/W/E/R, resources, projectiles, shields, CC, animation, audio and cleanup | End-to-end casts and interruption/expiry cases; visible and hidden targets; save/restore during flight; matched recordings |
| Complete lane loop | Waves, unit obstruction, aggro, XP/gold, items, recall, death and structural progression | Both teams can gain an advantage, buy and convert it into a valid push without reward or targeting inconsistencies |
| Complete strategic match | Jungle roles, camps, major objectives, wards, role systems, full builds and nine coordinated bots | Seeded full matches reach valid outcomes; stalled matches retained for diagnosis; bots cannot inspect hidden enemies |
| Finished delivery | Cohesive art, busy-fight performance, offline packs, interruption recovery and browser compatibility | Named-device measurements, first-use ability checks, network-disabled reload, repeated-match resource stability and complete reference comparisons |

Start with two fully integrated champions, then six covering the five roles, with mirrors allowed. A full roster is a later content program. Do not use champion count as a proxy for completeness.

## Rendering and audiovisual design

Calibrate camera, terrain alignment and character proportions before adjusting lighting. Then compare static terrain, skinned animation, character shading/outlines, vegetation/water, ground indicators, particles, fog and HUD independently. Riot's historical graphics article documents these as distinct rendering concerns; it is useful architectural evidence, not a specification of today's renderer. [Riot graphics pipeline](https://www.riotgames.com/en/news/trip-down-lol-graphics-pipeline)

The renderer should expose diagnostic views for UVs, depth, alpha, render order, attachment transforms and fog. A spell fixture should allow frame stepping from cast to impact and expiration, including moving targets and interrupted effects. Validate color space, blend mode, texture addressing, mesh orientation and lifetime curves before adding broad postprocessing.

Keep CPU visibility authoritative and smooth its visual representation separately. Apply the same information policy to models, health bars, minimap markers, positional audio and bot observations. Riot's fog article illustrates why visual smoothing and gameplay visibility should be distinct; its historical grid resolution is not a current gameplay constant. [Riot fog study](https://www.riotgames.com/en/news/story-fog-and-war)

Treat audio as part of the cast state machine: release, flight, contact, sustained status and termination can have different cues. Preserve source timing and attenuation where established. Use explicit concurrency and cleanup policies so seeking, restoring or pausing does not duplicate sounds.

## Simulation and bot design

Keep 60 Hz as the local engineering choice, without claiming it matches League's server rate. Simulation owns hit decisions and deadlines; animation displays them. Use swept projectile tests, distinct pathing/selection/hit radii, stable event ordering and serializable random streams. Introduce workers only after profiling demonstrates a need.

Bots need three layers: team priorities, role tactics and command execution. Team priorities allocate defense, pushes and objective contests; role tactics handle farming, trades, recalls, ganks and retreat; command execution obeys the same legality checks as human input. Expose only team observations and dated memory. Difficulty changes reaction and decision quality, with its parameters documented as our design choices.

## Current foundation and next work

The repository already has reference terrain/navigation, Ashe and Lux, lane simulation, structures, fog, a shop, checkpoints and browser scenarios. It is not an empty scaffold. Recent Light Binding work also has source-pinned target meshes, birth parameters and lifetime appearance, but those modules do not by themselves establish an integrated or visually matched target effect. See [progress](PROGRESS.md) and [Light Binding](LUX-BINDING.md).

Finish a bounded Light Binding cast-to-cleanup fixture, including moving attachment and source-space motion, then return to whole-champion and lane acceptance. Keep the native camera/movement/attack capture packet as a separate unresolved gate. Further isolated particle detail should be prioritized by its contribution to those gates.

Profile the full fight throughout development. Existing download and texture budgets are exceeded by the source map pack, so measure lossless packaging, compression alternatives, draw calls and animation costs before reducing visible detail. Existing tests and historical frame samples must retain their revision and scenario scope; this review does not certify current full-match performance.

Exact Riot assets also carry a release dependency: Riot's published developer policy excludes games using its IP. Public availability of files is not authorization for a clone's distribution. The architecture should support independently authored content or appropriately authorized content. [Riot policy](https://developer.riotgames.com/docs/lol#developer-api-policy)

Use the detailed [design](DESIGN.md), [roadmap](ROADMAP.md) and [reference validation](REFERENCE-VALIDATION.md) as the implementation specification. Estimate delivery after measuring complete-character throughput and full-match performance; a credible schedule cannot be inferred from the number of decoded assets.
