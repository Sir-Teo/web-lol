# Garen basic-attack particles

Garen's development fixture now renders the linked ordinary swing and
normal/critical impact effects from the frozen base-skin source. This adds
twelve emitter implementations to the existing attack animation/audio history.
It does not enable Garen in normal production selection or certify native
particle playback. The complete champion and six-character milestone remain open.

## Source closure and dispatch

[The source ledger](reference/garen-aa-particles-source.json) retains all six
resource definitions, fourteen emitters, four animation events, three spell hit
bindings, original dependency provenance and exact packaged asset hashes.
Nineteen PNGs preserve decoded RGBA without resampling or recoloring. Three GLBs
package four SCB aliases; source positions, UVs, face RGB, flags, pivots and
uninterpreted tails remain in the retained decoding records. Geometry was
validated with zero glTF errors/warnings and exact attribute round trips.

| Dispatch | Source key | Binding |
| --- | --- | --- |
| Attack1 frame 6 | `Garen_AA_Atk_01` | `C_Buffbone_Glb_Center_Loc` |
| Attack2 frame 7 | `Garen_AA_Atk_02` | `C_Buffbone_Glb_Center_Loc` |
| Attack1/Attack2 frame 5 | `Garen_AA_Sword_Swipe_Front` | `weapon` |
| Accepted ordinary contact | `Garen_AA_Tar` | `C_BUFFBONE_GLB_CHEST_LOC` |
| Accepted critical contact | `Garen_Crit_Tar` | `C_BUFFBONE_GLB_CHEST_LOC` |

The Crit animation graph has no particle event in the retained source. A
separate `Garen_AA_Crit` weapon resource therefore remains unlinked and is not
dispatched merely because its name exists. The critical target distortion
emitter is also retained but deferred; scene refraction is not replaced with a
colored quad. These are the two excluded definitions, not silently lost layers.

Ordinary event coordinates use the existing full-clip-over-captured-cycle pose
policy, then the existing first-update emission grid. Attack2's own emission
delay remains separate from its animation event. This does not reinterpret the
spell's cast-frame field or change melee contact timing. Q keeps its independent
empowered-swing implementation. Indexed per-birth cosmetic draws consume no
World RNG or gameplay IDs, and source probability components remain correlated.

## Independent saved presentation

Schema **115** adds bounded caster pose frames and an independent
`poseStopTick`/reason to the existing basic-swing records. Orders, movement,
spells, target loss, death and match end can stop bound swing particles after
an accepted contact without deleting that contact or its audio. Capture stops
once the source swing emitters can no longer draw, even if the combat recovery
continues. Natural completion retains its own end reason.

Each confirmed hit captures attacker heading, target collision radius, authored
structure placement and an independent target pose/visibility history. Its first frame is
finalized after that tick's animation and recall placement. The 39-frame bound
includes the longest source lifetime and interpolation endpoint. Target death
or removal freezes the saved placement and pose; later motion or respawn cannot
reattach it. A winning world remains frozen while presentation retires its tails.

Validation rejects missing/gapped/reordered frames, wrong pose rigs/clips,
crossed stops, future detachment, forged live endpoints or target transforms,
and movement after detachment. Earlier schemas and strict fingerprints remain
incompatible. Production imports have no migration or diagnostic identity bridge. The raw
particle table is an explicit fingerprint input alongside its generated timing
constants, including when it has no simulation module edge.

## Rendering and ownership

The source pack loads only for Garen presence. Concurrent loads share a promise;
a failure drains and disposes partial resources, and an explicit retry can load
again. Frame updates do not create a network retry loop. Textures and source
geometry remain shared; retiring effects dispose their own materials and dynamic
ray buffers. The user-facing content-pack retry interface remains unfinished.

An independent skeleton samples saved weighted poses and resolves an explicit
authored bone, with case folding and duplicate detection. Garen's ordinary chest
binding is independent of Lux's normal-centre/critical-chest selection. The
shared Lux attachment behavior is retained. Unknown/procedural targets and
structures without the named bone retain an explicit centre-plus-0.9 fallback.

Source textures, color/scale curves, lookup coordinates, atlas selections,
scroll, draw passes, blend modes and depth flags drive the rendered layers.
Mesh, arbitrary-quad, billboard and ray primitives remain distinct. Movement
uses the existing local 60 Hz acceleration/drag adapter; native cadence and
distribution state are not established by deterministic local reconstruction.

Enemy casts require their captured creation audience and current caster sight.
Hits require their contact audience, sight at each particle birth, sight at both
interpolated bound attachment endpoints, and current sight at the drawn position.
Revealing an enemy later cannot expose its earlier unseen swing/contact or
replay a particle born at an unseen target position. Known unbound particles can
finish without following hidden attachment frames. A known
contact does not authorize following a hidden target with a visible effect.

## Verification and remaining calibration

Current standard validation passes TypeScript, 1,485 Vitest tests across 269
files and three Node QA checks. Targeted Chrome checks cover both ordinary
variants, critical impacts, every implemented layer's nonzero framebuffer
contribution, exact UI save/reload, moving targets, fog, disposal, real graphics
loss/recovery and finite victory cleanup. The active-hit recovery comparison
matches every framebuffer byte. The existing animation/audio and Lux attachment
checks remain separate from these particle checks.

The initial browser fixture used the wrong item ID for its critical setup. Its
first pixel probe also crossed a frame boundary before reading the default
framebuffer. Both were corrected, the failed run remains retained, and accepted
pixel probes render/read synchronously. An enemy-audience fixture initially
looked for a second swing before its normal cooldown; it now waits for the
actual next attack. No combat timer or source effect was changed for these cases.

A later standard run timed out in two existing long simulation cases. Both
passed the focused recheck, and the standard command subsequently passed after
the new Garen-only history lookup skipped unrelated champions. Timeouts,
assertions and harness worker policy were not changed; timing variation alone
does not identify a cause. The earlier logs remain retained.

The final build and nested-host smoke pass with 32 source recordings. A passive
observer recorded 2,482 localhost requests and no Garen AA pack request during
ordinary Ashe/Lux production scenarios. Two normal ten-minute smoke matches pass
independent verification across 72,000 ticks, 20 strict round trips and 18
restored-future comparisons. Their twenty minute checkpoints equal the prior
wave-advance pilot after excluding only schema/ruleset identity fields. These
interim-roster runs contain no Garen and do not certify his full matches.

Commands, source/archive identities, failed attempts and final captures are in
the [verification ledger](reference/garen-aa-particles-verification.json).
`node tools/qa/verify-garen-aa-particles.mjs` checks current source/evidence
integrity; `--historical` checks the retained source overlay instead. This is an
integrity audit of recorded behavior, not a new browser or native run.

Source orientation type **2** still lacks native runtime interpretation. The
local hit adapter uses captured attacker heading. The critical spark bound-size
coefficient is preserved; its local adapter uses captured collision diameter,
whose equivalence to native bound-object size remains unverified. Bone rotation,
stop/linger behavior, coordinate calibration, distortion and unlinked critical
weapon dispatch still require native evidence. Full-match rendering performance,
normal Garen acceptance and the broader roster/browser/offline matrix also remain
required. The procedural development fixture is not final map-art acceptance.

With the retained frozen research cache present, repeat packaging with:

```sh
python3 tools/assets/export-garen-aa-particles.py
```

The exporter checks source/research digests before copying exact assets and
regenerating profiles/timing. This command packages retained extractions; it does
not claim to re-extract or execute a native client.
