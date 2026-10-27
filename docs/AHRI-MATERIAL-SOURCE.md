# Ahri base material source audit

The current Ahri preview uses four unlit GLB materials. This audit preserves the
original skin declarations needed to improve that presentation without inventing
native shader defaults. It changes source evidence and tools only.

The source cohort is `16.18.8175716`, manifest `29CE6E781C3B6368`, from
`DATA/FINAL/Champions/Ahri.wad.client`. The original extraction ledger remains
unchanged in [ahri-model.json](reference/ahri-model.json). Seven original files
(3,839,558 bytes) were restored from the pinned archive and verified against that
ledger. The exact 20,378-byte skin BIN and the 332-byte SKN submesh table are
retained under `docs/reference/ahri/`; the full SKN and five textures remain
identified by their original hashes and the restoration receipt.

[ahri-materials.json](reference/ahri-materials.json) records the two local custom
materials, five samplers, four submesh routes and current GLB transport. An
independent pinned CDTB decode compares all four local skin records and the 23
linked package names with the original reference. Those linked packages have
not been decoded.

| Submesh | Source route | Current preview |
| --- | --- | --- |
| Body | `Shaders/SkinnedMesh/2_Diffuse_Lerp` | Unlit |
| Eyes | Default skin mesh texture; no custom override | Unlit |
| Tails | `Shaders/SkinnedMesh/Diffuse_Bloom` | Unlit |
| Tail_Large | Texture-only override; initially hidden | Unlit, initially hidden |

`Body_Proxy` also appears in the initial-hide declaration but is absent from this
SKN table and GLB. That observation does not establish its absence from other
native resources. The table records index counts 45,162 / 1,248 / 16,776 / 1,848.

Eight parameter values and five switch states are absent in the declarations;
the projection preserves their absence. Body's AhriR-driven lerp declares on/off
times 0.25 / 2.5, with no on/off values. Tails' AhriR-driven bloom declares on/off
values 1.25 / 0.15000000596046448, with no on/off times. Explicit false switches
remain distinct from missing states. Numeric blend factors and sampler address
modes remain numeric because their native enum meanings are unverified.

Native shader arithmetic, constructor defaults, dynamic driver dispatch and
blend enum mappings remain open. The audit inspects GLB transport structurally;
it does not recertify texture conversion or claim native pixel parity. No
renderer, game rules, public asset or production selector changed.

Run from the repository root:

```sh
python tools/assets/export-ahri-materials.py --check
PYTHONPATH=.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/verify-ahri-skin.py
PYTHONPATH=.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/test-ahri-materials.py
```

The exporter uses pinned inputs, preserves exact float32 words and refuses to
overwrite differing output. All 15 guard groups pass under normal Python and
`python -O`; the independent decode and exporter checks pass in both modes.
Coverage includes tampering, missing-field preservation, boolean/number and
signed-zero distinctions, submesh routing, linked names, output no-overwrite
behavior and parser identity. The first export attempt rejected an incorrect
empty-linked-package assumption; its log is retained with the corrected result.

Application acceptance is inherited from the Ahri Rift trial: rules fingerprint
`c722d7ca3bb84c44a976e8c72eb57887b4d6a9ba529844a795ac080766139b62`, pack
`5aff35be26d9be78e6f660f7eb1b6af5112024b90622034aa3b0f2ab933eced2`.
All 1,125 source asset/data sizes and mtimes remain unchanged. No fresh frontend
acceptance is claimed. Evidence hashes and limits are recorded in
[the verification ledger](reference/ahri-material-source-verification.json).
