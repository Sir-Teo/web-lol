# Master Yi development rig preparation

Target: standard PC Summoner's Rift 26.18, frozen Riot build 16.18.8175716.
The base rig is prepared for development review with all atomic source clips.
Master Yi still has no integrated runtime kit, player scene or production roster
entry. Native appearance, animation-graph behavior, effects/audio and role AI
remain unfinished.

## Retained model and source identity

[masteryi-model.json](reference/masteryi-model.json) retains the complete skin and
animation graph definitions, manifest/archive/bundle provenance and 29 source
files: 24 distinct ANMs plus SKN, SKL, texture and two definition BINs. Its SHA-256
is `4295bceeba96cfb15e006d392e7d0f3c480bb51bf8cff8872a9c39fc9873c7ce`.
Both complete model BINs reparse exactly, including authored `__linked` resources;
they contain two skin records and one graph record. These links are preserved.
The character-only reference is documented in [Master Yi](MASTER-YI.md).

The source graph has 58 entries: 47 AtomicClipData mappings, seven sequencers and
four parallel entries. All 47 atomic aliases are exported; several share one ANM.
Hashed names remain `entry_<hash>` rather than acquiring guessed state names.
Spell1 maps to the attack1 ANM, Spell3 to masteryi_spell3, and Spell2_In/Loop to
separate source files. These bindings do not establish native state transitions.

The GLB is `public/assets/models/masteryi-base.glb`: 6,487,088 bytes, SHA-256
`7aae9e8e486c34d780113349c4a4d06830a5498a906ff291a49263090da471cc`.
It contains 5,760 vertices, 9,144 triangles, 90 joints and 47 atomic clips.
Source texture assignment is preserved in its embedded image. Preview shading is
unlit; authored self-illumination, reflection/gloss, material switching, attachment
and rig-modifier behavior remain unimplemented.

The source skinScale is explicitly 1.5. The declared local 0.01 conversion bakes
unitScale 0.015 into positions, inverse-bind translations, node translations and
animation translations. All normals, UVs, weights and indices remain exact.
Only 13,475 joint slots with zero weight are canonicalized to joint zero; nonzero
influences remain unchanged. No resampling or key simplification is applied.
The exact-key comparison passes all 12,492 channels and 899,082 input keys across
the 47 aliases, accounting for the declared scale and quaternion policy.

## Non-unit source rotation policy

The Spell3 ANM is a 35,172-byte `r3d2anmd` version-3 file, SHA-256
`55bab3175c4cfade3634c6b17b234e8d08226428b98e6626dd9b2c1787f475c7`.
At offsets `32152 + 28*i`, for i=0..25, the source literally stores little-endian
float32 bytes `000000000a80583f0000000000000000`, or
`[0, 0.8457037210464478, 0, 0]`. The bone is
`C_BUFFBONE_GLB_CENTER_LOC`; its flag 2 is retained without assigning semantics.

Independent bounded CLI metadata/IL inspection of the actual converter library
shows its version-3 legacy reader calls four ReadSingle operations to construct a
quaternion. Compressed version-5 decoding is a separate path. This tuple is not a
compressed-quaternion reconstruction artifact. That result concerns the retained
conversion tool; native game magnitude handling remains unknown.

For valid glTF, exactly these 26 Spell3/center-bone keys are normalized to
`[0, 1, 0, 0]`. Any other non-unit rotation or correction count rejects the
conversion. Original raw values remain in the public model sidecar and retained
ANM. This is an explicit development conversion policy, not a native equivalence
claim. The affected leaf influences six vertices. Across 141 sampled CPU poses,
the correction changes them by at most 0.0023502488817375884 world units, or
0.23502488817375883 local game units after authored skin scale. The maximum
normalized-reference/export error is 0.0000009196078109411115 world units.
These calculations use the current Three.js interpolation/matrix conventions.

Independent metadata review findings SHA-256:
`8bc015f24972ee02edb7ceab652bc5d9b143283e98b0812ee59217d58f941ceb`.
Source-byte/decoder findings SHA-256:
`f6f9667a3e7f2a3eab3aa12c53e7b31d4ea6200a2ef8d913faa46f4c3d66dcf1`.
Both retained audits pass normal and optimized checks. The bounded decoder reader
is independent retained analysis, not REA Evidence or native execution.

## Rebuild and review

```sh
node tools/assets/convert-masteryi-base.mjs --source-root .cache/masteryi-model-research-20261023/archive --output-root .cache/masteryi-model-new-build
PYTHONPATH=.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/verify-masteryi-model.py --source-root .cache/masteryi-model-research-20261023/archive
PYTHONPATH=.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/test-masteryi-model.py
PYTHONPATH=.tools/cdtb .tools/cdtb-venv/bin/python -O tools/assets/test-masteryi-model.py
node tools/assets/verify-masteryi-keys.mjs --raw-conversion .cache/masteryi-model-new-build/masteryi.glb
```

The converter verifies the exact pin, all source files and retained decoder/tool
identities before conversion. Its output directory must be new. Both fresh rebuilds
match the reviewed GLB byte for byte. Tampered input rejects before output creation;
an existing output rejects without altering its asset. Five source tests per Python
mode cover complete records, all 29 input hashes, numeric/boolean separation,
changed graph mappings and retained linked resources.

Open `/tools/qa/masteryi-model.html` with the development server to select clips,
scrub exact times and view front/side/back poses. This page loads the prepared
asset directly; ordinary matches do not. Culling is disabled for isolated pose
review, so this is not gameplay culling or performance certification.

The first review used a bind-pose camera and clipped a raised sword. Updated bounds
fit the animated pose; direct GPU silhouette checks and completed rendering make
capture boundaries explicit. Earlier cropped captures remain retained. The first
model-source verifier also incorrectly required empty character-style links;
the model's authored nonempty links are now compared exactly, with a retained
regression rejecting changed links. Neither correction alters source bytes.

The final full check passes 2,182 tests across 338 files, TypeScript and three Node
QA checks. All 49 Chrome cases pass without failures, skips or retries. The new
model case renders 141 sampled poses, exercises clip selection and keyboard
scrubbing, checks eight actual GPU silhouettes, and retains eleven captures.
Representative idle/run, attack, Meditate, Spell3, death and recall captures were
reviewed across the retained runs. Existing Ahri/Garen/Lux/Leona controls, rigs,
selection and match-file/reload scenarios also pass.

The broader asset audit first stopped on an existing Garen particle mesh because
the validator expected a sidecar. Three Garen meshes already have their exact
hashes and triangle counts in a shared source manifest; the validator now reads
that manifest. All 74 model assets and the map pass with zero errors/warnings.
The first failure remains in the evidence; those Garen assets did not change.

Production passes 32 recordings and verifies no Master Yi preload. Offline
continuation, repair and version-switch checks pass with 963 service-worker
responses and no production errors. All 1,015 prior public files remain exact;
the rig and sidecar bring the public count to 1,017. Schema remains 137 and ruleset
`5eb9fc897a3193c5a5d575afca7dc397dc987bbe8d8a47df35fadea1f4d0e29c`.
The new pack has 1,067 files / 526,570,727 bytes, ID
`531452e69c6d8f9ac4e34947761cdae19017a8f913c0776b410e624082047068`.
The existing source-quality storage and full-match performance gates remain open.

Frozen source/build/evidence closure: [model-verification.json](reference/masteryi/model-verification.json).
Run `node tools/qa/verify-masteryi-model.mjs` or `--historical` after later edits.
Development rig preparation, exact rebuild/key preservation and isolated review
are verified. Native quaternion magnitude, native appearance/graph/events,
playable kit, production roster expansion, full performance and project completion
remain unverified.
