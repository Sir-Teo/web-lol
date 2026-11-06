# Baron attack source decoding

The original [attack closure](BARON-ATTACK-SOURCES.md) now has a private,
reproducible software decode. All 25 textures retain every authored mip level:
214 PNGs / 838,682 bytes. No mip is resized or generated. The 22 BC3 and three
BC1 textures use the pinned CDTB/Pillow path; independent PNG CRC/filter replay
checks exact RGBA bytes and recorded alpha statistics. This is software decode
evidence, not native GPU sampling or visual acceptance.

Both SCB 3.2 meshes retain their flag-2 layout and per-vertex BGRA bytes, rather
than borrowing Yi's face-color interpretation. The meshes contain 121/247 vertices
and 220/456 triangles. All 1,472 color bytes, native points (including signed
zero), pivot, original header, face indices, six UV values per face and full
64-byte material slots reconstruct their original SCBs byte for byte. No axis,
unit, winding, normal or color-channel interpretation is applied yet.

The [decode record](reference/baron-attack-decoded.json) has SHA-256
`ab8f06fee053cd0b2f89759f99f53c5abb1986c9c32e977812ae9129e306da20`.
It pins the source closure, helper identities, native block ranges, layout
references, Python/Pillow/CDTB environment and every decoded output. Files stay
under ignored `.cache/baron-attack-decoded`; nothing is added to public media.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python \
  tools/assets/decode-baron-attacks.py
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python -O \
  tools/assets/decode-baron-attacks.py --check \
  --record-sha256 ab8f06fee053cd0b2f89759f99f53c5abb1986c9c32e977812ae9129e306da20
```

First discovery requires `--discover`, a missing record and fresh output directory.
Ordinary regeneration must reproduce the existing record exactly. All original
inputs preflight before decoding; all existing outputs preflight before any
missing output is created. Conflicts are refused rather than overwritten.

A second source/output cache reproduces the complete record and files. Six
probes verify complete-output preflight (late corrupt PNG plus early missing
PNG), corrupt source refusal, edited-record refusal, repeated-discovery refusal,
exact missing-file recovery and optimized independent checking. The canonical
record stays unchanged. Six offline mesh/mip unit cases pass normally and with
Python optimization; all 44 Node QA checks pass. The
[verification ledger](reference/baron-attack-decode-verification.json) retains
raw report identities. An initial probe harness had a string/bytes typo before
calling the decoder; correcting the harness allowed all six probes to run.

Runtime rendering still uses the provisional Baron missile marker. Native
material/color interpretation, attachment bones, saved emission/contact roots,
particle playback and native visual comparison remain open. Schema 163,
`e20bdc…` simulation fingerprint and the two selected full-match results retain
their existing scope.

## Private GLB staging

`node tools/assets/convert-baron-attack-meshes.mjs` stages both decoded meshes
under `.cache/baron-attack-packed` (or `--output-dir` for a fresh copy). Triangle
corners expand in original order, with unflipped UVs and the established 0.01
scene scale. Packed native BGRA bytes are a normalized custom
`_SOURCE_VERTEX_BGRA` attribute; they are not converted into a standard glTF
material color. No normals, material, pivot offset, reflection or winding change
is introduced. The original decoded meshes retain every native source point.

The 220- and 456-triangle GLBs occupy 17,940 and 35,304 bytes. Both pass the glTF
validator with zero errors and warnings. NodeIO retains exact attributes,
normalization and source extras. The actual Three.js GLTFLoader returns one
identity-transformed mesh with exact position, UV and raw BGRA components. The
first loader assertion incorrectly compared the entire interleaved backing
buffer; reading each accessor's own raw components verifies the actual data.

Fresh-directory output and repeated output match exactly. A late conflicting
mesh refuses before an earlier missing mesh is recreated; missing-file recovery
reproduces the exact bytes. The [staging ledger](reference/baron-attack-mesh-staging.json)
pins converter/output/attribute identities and checks. This remains private
geometry preparation. Native material dispatch, attachment and visual acceptance
are still open; no runtime or public media changes.
