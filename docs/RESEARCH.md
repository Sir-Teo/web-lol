# Research record

Research date: September 12, 2026, America/New_York. This is a bounded investigation of feasibility, reference systems, architecture, content production, and validation. It is not an exhaustive reconstruction of every champion or undocumented engine rule.

## Evidence that changes the design

| Finding | Design consequence | Evidence |
|---|---|---|
| The standard match has five positions, lanes, defensive progression, economy, and neutral objectives | A one-lane arena cannot stand in for the final target | [Riot's game guide](https://www.leagueoflegends.com/en-us/how-to-play/) |
| Patch 26.18 was published September 9, 2026 | Freeze a current, named reference instead of combining memories from different seasons | [26.18 notes](https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-18-notes/) |
| Data Dragon 16.18.1 endpoints for six chosen champions responded successfully | Versioned research data is available without a runtime account service | [Ashe data](https://ddragon.leagueoflegends.com/cdn/16.18.1/data/en_US/champion/Ashe.json) and the [local sample](reference/champion-sample.json) |
| Data Dragon updates can lag patches and builds can differ from regional clients | Store source builds and reconcile hotfixes; do not equate a tooltip export with exact behavior | [Data Dragon documentation](https://developer.riotgames.com/docs/lol#data-dragon) |
| Current match rules include substantial changes from older seasons | Audit quests, inventory, vision, waves, and structures before declaring current fidelity | [2026 launch notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/) |
| League's visual identity depends on several coordinated rendering layers | Budget for terrain, rigs, animation, fog, outlines, effects, and HUD as distinct systems | [Riot's 2017 rendering article](https://technology.riotgames.com/node/55) |
| Smooth-looking fog can be derived separately from visibility data | Keep CPU gameplay visibility independent from the visual blur | [Riot's 2016 fog article](https://www.riotgames.com/en/news/story-fog-and-war) |
| Recognition and threat hierarchy are explicit Riot art goals | Review silhouettes, readable hit areas, and audiovisual priority during real combat | [Clarity in League](https://www.leagueoflegends.com/en-us/news/dev/clarity-in-league/) |
| Phaser is a 2D framework | Prefer Three.js for the recommended 3D presentation | [Phaser documentation](https://docs.phaser.io/phaser/getting-started/what-is-phaser) |
| Three.js WebGLRenderer requires WebGL 2; its WebGPU alternative can also fall back to WebGL 2 | Feature-detect and test the chosen rendering path; do not assume WebGL 1 fallback | [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html), [WebGPURenderer](https://threejs.org/docs/pages/WebGPURenderer.html) |
| Browser storage can be evicted and background work is throttled | Exportable saves, explicit cache completeness, and hidden-tab pause are necessary | [Storage](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria), [visibility](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) |
| WebRTC does not eliminate connection-establishment infrastructure | Nine bots are the reliable interpretation of a complete match with no backend | [WebRTC connectivity](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Connectivity) |
| Riot's fan license does not authorize games using its IP | Asset and content permission must remain separate from technical feasibility | [Riot legal policy](https://www.riotgames.com/en/legal) |

## Reference data experiment

Fetched six champion JSON documents from the explicit Data Dragon version `16.18.1`, parsed them, and recorded selected fields plus SHA-256 hashes of their source responses. These observations are reproducible from the URLs stored in [champion-sample.json](reference/champion-sample.json).

| Champion | HP field | Move-speed field | Attack-range field | Attack-damage field |
|---|---:|---:|---:|---:|
| Ashe | 610 | 325 | 600 | 59 |
| Ahri | 590 | 330 | 550 | 53 |
| Lux | 580 | 330 | 550 | 54 |
| Garen | 690 | 340 | 175 | 69 |
| Master Yi | 640 | 355 | 175 | 65 |
| Leona | 646 | 335 | 125 | 60 |

These are raw base-stat fields. They exclude items, runes, role rewards, and validation of the game's formulas for applying them. They are not six fully specified champions.

A small patch consistency check passed: the 26.18 notes change Master Yi's armor growth to 5, and the fetched `armorperlevel` field is 5. That establishes agreement on one field, not universal agreement across the dataset. [Master Yi data](https://ddragon.leagueoflegends.com/cdn/16.18.1/data/en_US/champion/MasterYi.json), [26.18 change](https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-18-notes/)

The same investigation demonstrates why importers need semantic rules. In the checked Ashe data, Q has a zero cooldown array and E has a five-second cooldown array. These numbers alone do not specify stack prerequisites, ammunition regeneration, or the complete cast state machine. Treating every `cooldown` field as “time until this ability is fully available again” would be unsound. [Ashe source](https://ddragon.leagueoflegends.com/cdn/16.18.1/data/en_US/champion/Ashe.json)

The public champion pages are useful for identities and broad kit explanations; they are living pages, not patch-frozen specifications. Their animation demonstrations can guide a later observation session, but no frame-by-frame gameplay measurement was performed in this research. [Ashe](https://www.leagueoflegends.com/en-us/champions/ashe/), [Ahri](https://www.leagueoflegends.com/en-us/champions/ahri/), [Lux](https://www.leagueoflegends.com/en-us/champions/lux/)

## Source hierarchy and use

1. **Official patch notes:** establish specific changes and their dates. Read sections by mode. Resolve published mid-patch corrections explicitly.
2. **Versioned official static data:** starting values, identifiers, display metadata, and cross-checks. Normalize and validate before use.
3. **Official technical articles:** explain historical design choices. Useful architectural evidence, not authoritative specifications of the 2026 engine.
4. **Controlled reference observations:** required for input feel, camera fitting, navigation, and undocumented interactions. Record patch, settings, frame rate, and conditions.
5. **Community-hosted data:** supplementary evidence with independent provenance and uncertain semantics; not authoritative merely because it is detailed.

CommunityDragon exposes data folders for characters, maps, spells, particles, and other client content. Its `latest` tree moves. If used during further research, pin a revision and inspect metadata rather than treating file names as a stable API. Its availability does not grant game-reuse rights. [CommunityDragon data listing](https://raw.communitydragon.org/latest/game/data/)

No complete League source code, licensed art library, reference client session, or private gameplay implementation was available in the workspace. Research proceeded from public primary sources and direct versioned data requests.

## How to turn research into a reference specification

Create a ledger where each row has:

```text
rule_id
mode + gameplay_patch + hotfix_cutoff
entity / ability / interaction
source_url + version + retrieval_time + source_hash
raw_field_or_observation
normalized_value + units
confidence: data-only | behavior-verified | approximation | unresolved
implementation_reference
test_case
known_deviation
```

Store unknowns as unknowns. A missing cast delay is not zero. A global targeting value is not necessarily a literal projectile-distance cap. An attack-speed field is not proof of its ratio, cap, or growth curve.

Pin source data → normalize into typed schemas → apply documented patches/overrides → run invariant checks → run behavioral scenarios → approve that content revision. Keep the raw source hash even if only normalized fields are included in the game build.

The complete 26.1–26.18 rules reconciliation has not been performed. Before labeling a build 26.18-accurate, inspect intervening changes affecting selected champions, items, objectives, quests, minions, structures, and map variants. Other modes' changes must be excluded. Lock an explicit hotfix cutoff so later edits do not silently move the target.

## Measurement plan

| Area | Controlled observation | Acceptance intent |
|---|---|---|
| Camera | Match viewport, zoom, location, unit size, and visible landmarks | Fit projection and scale without distorting map proportions |
| Movement | Repeated fixed-distance paths, corners, narrow gaps, repeated click changes | Match travel time and path shape within recorded measurement uncertainty |
| Attack cadence | Stationary attacks and movement before/after release, multiple attack speeds | Separate windup, release, projectile travel, and recovery |
| Spell timing | Input/cast cue, projectile spawn, arrival, effect application, cooldown display | Establish a per-spell timeline rather than guessing from animation |
| Collision | Targets at edges, crossing missiles, dash/wall boundaries | Establish radius conventions and sweep behavior |
| Wave economy | Spawn, meeting point, unopposed push, last hit, shared XP | Verify lane pressure and progression together |
| Vision | Brush entry, wall edges, ward expiry, reveal effects, hidden sounds | Establish observable state and permitted exceptions |
| Structures | Aggro switch, repeated hits, backdoor conditions, inhibitor cycle | Verify a complete state machine |
| Shop | Components owned, full slots, unique items, sell/undo, role rewards | Eliminate economy inconsistencies |

When reference footage is only 60 fps, the timestamps themselves have frame-scale uncertainty. A one-tick engine target must not be misreported as a more precise reference measurement. Prefer multiple observations and retain the capture conditions.

Keep screenshot registration separate from gameplay comparison. Different licensed/original art can preserve readability and proportions while preventing pixel-level identity; record that as a content difference rather than an engine defect.

## Technology research references

- [Fix Your Timestep](https://gafferongames.com/post/fix_your_timestep/): foundation for bounded fixed updates and presentation interpolation. The selected 60 Hz rate is our proposed setting.
- [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html): browser model-loading contract.
- [KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html): compressed texture loading and platform transcoding.
- [glTF Transform](https://gltf-transform.dev/): asset processing and validation workflow.
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API): offline resource delivery and lifecycle.
- [Storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria): persistence limits and failure handling.
- [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API): background pause policy.
- [WebRTC connectivity](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Connectivity): why peer transport does not guarantee infrastructure-free PvP.

These sources support capability claims. Proposed frame budgets, roster order, worker strategy, camera starting values, AI frequencies, and milestone gates are engineering judgments to validate during implementation.

## Remaining high-impact uncertainties

| Unknown | Why it matters | First resolution step |
|---|---|---|
| Exact art/content authorization and asset availability | Determines the attainable literal visual/character fidelity | Establish the asset source and terms before producing a distributable content pack |
| Intended historical/current patch preference | A different patch changes content and interaction requirements | Current design uses a clearly identified 26.18 assumption |
| Reference combat timing and edge behavior | Largest risk to the feeling of control | Controlled capture of Ashe attacks and Lux casts |
| Full intervening patch audit | Prevents mixed-era mechanics | Build the rules ledger before reference-mode certification |
| Map/camera measurements | Determines navigation and visual correspondence | Fit a representative lane and river junction first |
| Baseline hardware | Determines real asset and effects budgets | Name one integrated-GPU target and one lower-capability target |
| Bot quality under complete matches | Determines whether the local game remains strategically interesting | Seeded full-match runs and human playtests |
| Production art throughput | Dominant schedule uncertainty | Complete one character and one polished lane environment before estimating roster delivery |

The initial research phase did not run a game or benchmark. Subsequent implementation has produced local scenario tests, browser captures, and practice benchmarks; [PROGRESS.md](PROGRESS.md) records those results and [FIDELITY-PLAN.md](FIDELITY-PLAN.md) records the remaining performance gaps. These local checks are not controlled comparisons against the native League client.

## Research review, September 13, 2026

Rechecked Riot's official game guide, patch 26.18 notes, developer documentation, historical graphics pipeline article, and clarity article, together with Three.js renderer documentation and MDN's WebRTC/storage documentation. The browser-only architecture remains appropriate. The repository's source imports provide much more detail than the initial champion sample, but native camera, input, shader and undocumented gameplay semantics remain separate measurement work.

The [reference validation specification](REFERENCE-VALIDATION.md) now makes that work executable: controlled capture conditions, paired behavior scenarios, visual comparison order, evidence labels, and release coverage. The design's earlier polygon/funnel recommendation has been reconciled with its source-grid architecture and implemented map evidence. This review changes documentation only; it does not rerun or certify the existing runtime changes.
