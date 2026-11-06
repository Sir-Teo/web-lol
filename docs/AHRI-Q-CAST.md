# Ahri Q cast preparation

This isolated branch prepares the three-emitter `Ahri_Q_Cas` effect. The eight-emitter `Ahri_Q_Orb_Cast` event remains separate. Complete native definitions, frames and attachment limitations stay in [Q source preparation](AHRI-Q-PARTICLES.md). No new runtime files, visual history or renderer are bound at this checkpoint.

## Complete private texture transport

Four textures retain all28 authored mips /95,189 packed PNG bytes: BigGlow02_2, BlastRing, Color-Hold and the recursively referenced Q Smoke Erode2 texture. The erosion dependency is required alongside the three base textures. Every unpacked rectangle matches its original software-decoded RGBA dimensions/hash; the packed image is a transport, not a directly sampled atlas. All four private guard tests pass in normal/optimized Python modes, including missing erosion, changed source/mip metadata and leaf/parent symlinks.

## Source swirls GLB

The23,176-byte GLB retains603 vertices and792 triangles from the native flag-2 swirls mesh, after glTF Transform dedup/prune with attributes retained. Every rendered source triangle, UV and RGBA vertex byte replays exactly through glTF Transform. The application Three.js GLTFLoader also verifies the vertex/index/UV/color attributes, normalized colors and identity transform. The standard GLB validator reports zero errors/warnings. No normal, pivot/scale, reflection or winding conversion is applied. The unlit white material is a transport placeholder; native particle shader arithmetic remains unbound.

The pinned manifests are `reference/ahri/q-cast-texture-transport.json` and `reference/ahri/q-cast-mesh-transport.json`; all transports remain private. Regeneration reproduces the GLB and packed textures. The attached-mesh cast emitter retains one matched Tails selector and one unmatched selector without a substitute.

## Independent gameplay baseline

The producer verifies all611 archived source files from actual Recall-history World `aff9186` / `41da4dfc` and executes that World directly. Ten guarded scenarios yield262 complete projections: stationary cast, windup/flight movement, genuinely accepted post-release Flash, death before/after launch, two actual casters, hidden birth and victory before/after launch. Older Recall/lifecycle/attack/P/R/W/Q/E histories remain in every projection; only schema/ruleset and proposed `ahriQCastVisuals` are excluded. No identity bridge or current-World import produces the baseline.

The current World matches all262 projections, and TypeScript passes. The producer's initial copied ruleset expectation was corrected to the actual Recall-history archive before this reference was frozen. Future observer work must preserve the frozen helper, producer and expected hashes. Audio cast history is130 ticks, shorter than the attached cast particle's four-second life, so it cannot own the new visual lifetime. An independent saved clock remains the next step.

## Explicit local animation-event clock

The exact46,826-byte native Spell1 ANM restores from its original model ledger and matches SHA `55b13152`. Its retained40-byte version-5 header declares211 tracks,14 frames and frame duration0.03333333507180214. Pinned LeagueToolkit reader `61a08ed7` computes float32 FPS29.999998092651367; the last sampled frame0.4333333671092987 matches the shipped clip metadata exactly.

The raw frame5 sample is0.1666666716337204 seconds. The explicit local adapter rounds this to the nearest simulation tick (ten ticks), rather than applying a floating-point ceiling to eleven. Native callback equivalence remains unverified. Three single particles retain source lives0.5 /0.4000000059604645 /4 seconds; the maximum finite bound is240 ticks after birth,250 after accepted cast. Raw linger is retained without extending visible lifetime. Separate Orb_Cast end-frame7 remains unbound.

Timing publication checks all inputs and both final outputs before writes. Normal/optimized five-probe guards pass without private tools/caches. Independent TypeScript tests derive the native frame grid and finite-life bound from the retained header and particle source. Full native restoration and optimized recheck pass.

## Independent saved cast dispatch

Isolated schema176 adds optional nonempty `ahriQCastVisuals`, keyed by source/cast tick without new IDs or RNG draws. Accepted Q creates a pending record; the local ten-tick event captures its own birth audience. Death or victory cancels an unborn dispatch. Born particles keep their independent finite four-second life, including after audio history expires or the owner dies. No particles or renderer are bound yet.

Strict restore checks owners/teams, unique chronological cast keys, pending Q/audio links, accepted origin/aim where audio remains available, exact delayed birth, canonical audiences and finite expiry. Victory retains born history without advancing simulation. Six history cases verify every-frame exact restores/futures, immediate unborn cancellation, finite post-death life, delayed visibility independent of earlier audio, two real casters, victory and malformed saves. All23 scoped history/reference checks and TypeScript pass; the262 independent projections retain all earlier histories. Older helpers/producers/goldens remain unchanged, with only the new visual field normalized in their current-side outer tests. Full/cohort verification follows before rendering work.

## Frozen visual-history verification

Runtime `ab45bfa`, schema176 / `b94ae619`, passes8,776/8,778 full-suite cases in521 files with only the two historical failures. All212 Node QA cases pass. Clean CI at `48a17d7` passes438 cases in65 files, TypeScript and42 commands:40 Python invocations (38 guard modes and two portable reading checks), with no private caches/tools and reused dependencies. Its later comparator commit changes no frozen runtime bytes.

The616-file frozen roster archive finishes naturally Blue at157,116, with44 exact restores,43 future checks and2,580 future ticks. All45 complete projections match actual Recall-history `41da4dfc`, retaining every earlier audio history. Source bytes, runner, inputs, reports and snapshots verify. See `reference/ahri/q-cast-history-verification.json`; no one-seed result is relabeled as the older hundred-seed baseline. Rendering proceeds separately.

## Source renderer checkpoint

The rendering branch publishes four checked PNG transports (all 28 authored mip levels), the 23,176-byte source-coordinate swirls GLB, and all three emitter profiles. Portable normal/optimized guards reproduce publication from committed transports and reject source changes, output conflicts, corruption and symlinks before partial writes.

A deterministic sampler seeks the three single particles from the saved birth tick. The renderer follows a private current Ahri pose at the authored center bone. The matched Tails draw uses the existing checked attached-skin Fresnel/erosion path; the unmatched selector stays unmatched. Short surfaces use the shared source-surface renderer. Page-owned textures/geometry are borrowed; each cast owns its material and cloned skeleton. Explicit failed-load retries preserve successful resources, and ordinary rosters load no cast pack.

The runtime converts retained SCB centimeters to scene meters without altering public transport bytes. Source-X reflection follows the existing surface adapter. Mesh UV rotation is applied about the texture center before centered scale and scroll as an explicit local convention. Skin blend 1 uses SrcAlpha/OneMinusSrcAlpha; authored depth bias and the explicit local alpha-reference default are applied. Missing global/native CPU bindings, exact callback dispatch, native pixels and device performance remain unverified. Raw linger does not extend finite visible life. Separate Orb_Cast, missile, impact and speed particle systems remain outside this checkpoint.

Saved birth audience suppresses hidden births after later reveal. Current point visibility gates drawing, including a dead owner's location; the finite clock survives death even while not drawn. Victory drains presentation time without changing World. Focused checks cover exact restored drawings, attachment movement, Tails selection, BGRA replay, scene units, material controls, resource ownership and lazy retries. Browser evidence and broader acceptance are recorded separately once complete.


## Verified rendering delivery

Application `f003386`, schema 176 / `732a3ce3`, passes 8,792/8,794 full-suite cases in 526 files with only the two historical failures. All 214 Node QA cases and 454 cache-free CI cases in 70 files pass, together with TypeScript and all 44 CI commands. Three cast browser cases and all 27 existing audio/envelope cases pass; two cast screenshots were reviewed. Production nested-path and offline lifecycle gates pass, with no unsolicited cast downloads, 978 service-worker responses and zero production errors. Pack `44d4243d` contains 1,337 files / 575,974,327 bytes.

The archived history closure is unchanged in 615/616 files; only the ruleset collector differs, with new render/content files recorded separately. The older cohort retains its original identity. See [acceptance](reference/ahri/q-cast-rendering-acceptance.json) and [source delta](reference/ahri/q-cast-rendering-source-delta.json). Callback, native pixel and device-performance limits above remain open. Separate projectile asset preparation stays isolated.
