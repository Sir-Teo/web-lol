# Save compatibility dependency audit

The save fingerprint now follows runtime module dependencies from every
TypeScript file under `src/simulation` and `src/content`. This keeps the existing
conservative roots while closing the previously incomplete dependency list.
Schema **113** is unchanged, but the ruleset identity changes; earlier checkpoints
are incompatible and are not migrated.

World executes `mobilePose` when creating units and advancing their saved
animation timelines. Snapshot validation also uses source clip durations and
structure poses. Before this audit, edits to these runtime inputs could leave the
fingerprint unchanged:

- `src/render/mobile-pose.ts`, `recall-animation.ts` and `structure-pose.ts`.
- `src/content/mobile-clip-durations.json`, `champion-clip-durations.json` and
  `structure-animation-profiles.json`.
- `src/content/lux-attack-origin.json`, `lux-attack-origin-2.json` and
  `lux-ground-layers.json`.

`tools/ruleset-fingerprint.ts` now reads the project's TypeScript configuration,
elides type-only syntax using the compiler, and resolves the remaining imports.
It follows runtime imports, re-exports and literal dynamic imports recursively,
including modules outside the two roots and imported JSON. Cycles are visited
once; sorted project-relative filenames and exact file bytes form the SHA-256
input. Mixed `import { type X }` syntax retains an empty runtime import under
`verbatimModuleSyntax`, so the imported module's side effects remain covered.
Unresolved imports, computed module paths and unsupported glob imports fail the
build instead of producing an incomplete identity.

The existing three fetched Rift files and four explicitly pinned presentation
tables remain covered. They have no runtime module edge: the presentation tables
sit behind generated retention constants. Package declarations, the lockfile,
compiler configuration (including extended configs), and the fingerprint policy
itself also participate. Installed package bytes are represented by the declared
lockfile; this is not an integrity scan of `node_modules`. New resources loaded
through `fetch` still need explicit pins. This closes the observed module-graph
gap; it does not certify arbitrary future resource-loading code.

Vite's existing restart hook now watches every discovered dependency. When an
included module adds a dependency, its restart rebuilds both the hash and watched
set. Adding new simulation/content TypeScript remains a restart trigger.
Unimported renderer, audio and HUD implementation edits stay outside the hash.

## Evidence

The current manifest covers **215 files**, compared with 203 before this audit:
the nine missing runtime inputs plus lockfile, compiler configuration and policy.
No previous compatibility input was removed. The report in
[the reference ledger](reference/ruleset-dependency-audit.json) pins the exact
manifest, source hashes and verification outputs for this revision.

Ten targeted tests cover the real missing dependency list, individual hash
sensitivity, transitive additions, runtime/type-only import behavior, cycles,
path aliases, extended configurations, missing data and unsupported imports.
The full TypeScript/unit suite and focused browser/production results are
recorded in that ledger. An initial full run exceeded Vitest's five-second limit
in three existing long simulation cases; the retained rerun used four workers
and a 60-second per-test limit. No assertions were relaxed.

`node tools/qa/ruleset-watch.mjs <unique-run-name>` copies the real Vite config
and fingerprint policy into an isolated synthetic project, launches Vite and
Chrome, then edits only that project's inputs. Six observations show five
distinct identities: initial state, imported JSON edit, pose edit, newly
introduced JSON dependency, subsequent edit of that dependency, and a stable
identity after an unimported renderer addition. The first harness attempt lacked
an explicit IPv4 host; a second used Playwright's timeout option in its argument
slot. Both failed logs are retained. The corrected run passes; the fixture's
missing favicon is the sole recorded console resource error.

The broader replay, 100-seed normal-match, offline, full-roster, performance and
native visual-comparison gates remain open. Historical feature ledgers retain
their original fingerprints and are not rewritten as current-revision results.

## Eclipse presentation module roots — October 23, 2026

Schema 124 adds saved Eclipse phases, poses and audiences. Source W profiles,
asset pins and seekable sampler/material entry modules participate in the
fingerprint. `rulesetModuleRoots` now traverses those entry modules' emitted
imports rather than hashing only their entry bytes. Its isolated fixture checks
a newly imported curve helper/data file and rejects a missing runtime import.
Earlier failed fixture runs are retained; all 1,660 unit cases pass after this
change. The current identity and full validation scope are recorded in
[the Eclipse playback record](LEONA-W-PLAYBACK.md). Complete replay certification
and arbitrary future fetched-resource coverage remain open.

The subsequent [Eclipse surface material](LEONA-W-SURFACES.md) also joins the
explicit traversed module roots. Schema 124 remains; its current ruleset is
`67a9ea30c6ceb0ed42fe4ca72146b78f1b8c0f005271394332393ed59d6c7987`.
