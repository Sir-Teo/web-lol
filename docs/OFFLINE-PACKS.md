# Versioned offline game packs

Production builds now offer **Pause → Offline files → Download game pack**.
The complete source-quality deployment is approximately **490.4 MB** in this
revision. Opening the panel checks metadata; downloading files is an explicit
player action while the match is paused. Leaving the panel cancels the download.
Verified partial files remain available for retry. The development server shows
an unavailable message and does not register a worker or download a pack.

`npm run build` emits `offline-pack.json` and `offline-worker.js` beside the two
HTML entry points. The manifest includes every other deployment file: application
chunks, styles, fonts, map/navigation, models, audio, textures and asset metadata.
No assets are simplified or substituted. This also includes prepared content
outside the selectable roster; the download label describes the full deployment,
not an optimized core pack. Existing delivery/storage targets remain exceeded.

The pack ID hashes the sorted file paths, exact sizes and SHA-256 digests, plus
the worker policy template's SHA-256. The generated manifest and embedded worker
are excluded from their own file list to avoid a circular identity. The worker
policy still contributes to the pack ID. Pack identity is independent of the
simulation fingerprint; no schema or match rules change in this increment.

## Download, activation and recovery

Each fetched file is read and checked against its size and digest before being
written to a scope/version-specific Cache API cache. The browser decodes HTTP
content encoding before validation, so digests refer to the deployment file
bytes. Stored MIME types are retained. Downloads use one file at a time and never
renew gameplay assets from moving external URLs. Incomplete, failed or cancelled
new packs do not receive a completion marker. Checking a complete valid pack
retains readiness for other tabs, including if that check is cancelled. Quota exhaustion reports a recoverable
error. Retry reuses matching responses after rehashing their cached bodies, including unchanged files from
older packs in this deployment scope.

Only after verification completes does the browser enable the generated worker.
An already installed matching worker is reused without a network update, so a
complete pack can be checked and repaired while offline.
Its installation requires its own completed pack. A build changed during download
cannot install a worker for mismatched files. First installation claims the game
page; later workers wait while older clients remain open. Closing all older tabs permits normal browser activation. **Reload cached game** explicitly activates a verified
waiting version and reloads after controller handoff. It refuses activation while
another game tab in that scope is open. Downloading an update does not silently
replace the running match or another tab's asset version. Save the match before
reloading if it should resume.

The worker serves the selected pack's two HTML pages and listed assets from the
completed cache, including query-based game navigation. Explicit metadata checks
use the network, falling back to the installed manifest offline. Metadata remains
readable when an entry is missing so the open application can report an incomplete
pack and repair it. A staged completed update remains selectable offline even
while the older worker controls the page. Download requests bypass the older
worker's asset cache and verify the intended new bytes.

An observed missing entry revokes readiness. **Remove offline files** unregisters
this scope and removes its current/older pack caches. It leaves IndexedDB match
checkpoints and unrelated caches untouched. Older completed packs remain until
that explicit removal; space use can therefore exceed one pack after updates.
Browser eviction and private-mode/quota limits still apply. Downloading a pack
establishes cached availability at that time, not permanent storage.

## Verification and limits

Nine targeted unit cases cover complete-pack marking, MIME retention,
cancellation/retry, corrupt downloads and cached bodies, failed worker setup, HTTP/quota errors,
manifest/path rejection, missing entries and cross-version reuse. Production
checks in `tools/qa/offline-pack.mjs` use real Chrome, Cache Storage and service
workers under `/nested/rift/`, with a strict static host and actual network-off
browser contexts. The audit also uses a tiny isolated two-version deployment to
exercise activation without downloading a second full source pack.

The production audit covers deliberate file corruption, cancellation, reuse on
retry, a complete real pack, paused save-tick restoration offline, the explicit
cached reload control, and starting a Lux 5v5 match with spell input and scoreboard
while offline. The isolated deployment covers refusal with another tab open,
explicit version handoff offline, retention of the old complete pack, missing-file
readiness revocation and scope-only removal. It is not a full-length human match
or proof of browser/device parity. The first run passed actual production offline
play and update switching, then exposed a raw fetch error after a missing-entry
marker was removed; metadata fallback now retains a clear repair path. That run's
failure report remains frozen. A later test assertion incorrectly looked for Ashe's charge badge on Lux; the final audit checks Lux's actual RECAST state instead.

All 1,441 unit checks across 262 files pass. The unchanged HUD integration also
passed 21 adjacent Chrome regressions; the final storage-only refinements are
covered by the full unit suite and production offline audit.
The [reference ledger](reference/offline-pack-verification.json) records exact
build hashes, pack bytes, tests and captures. Run `node tools/qa/verify-offline-pack.mjs`
to check the frozen evidence against this build.
Chrome production offline availability is implemented; Firefox/Safari, persistence
across browser storage policies, optimized delivery packs, full-match performance,
the six-champion roster and native visual comparison remain separate open gates.
