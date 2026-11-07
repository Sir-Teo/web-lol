# Spirit Rush particle source

The isolated source checkpoint retains all twelve R-prefixed base-skin resource
declarations. Eleven reference native VfxSystemDefinitionData records;
Ahri_R_Transform_Out explicitly references {00000000}. It supplies no invented
transform-out system. Ahri_R_TextureSwaps contains only its native identity and
particle name/path: both emitter arrays are omitted, rather than authored empty
arrays or an inferred texture-swap implementation.

The eleven systems contain 55 complex emitters. Missile variants remain separate,
as do the three indicator variants with one, two and three emitters. No simple
emitter arrays are present. The exact dependency closure contains eight BINs,
51 textures and four meshes: 63 files / 3,523,385 bytes. All asset paths resolve.
The source uses the existing pinned patch 16.18.8175716 manifest and Ahri WAD;
its record retains chunk provenance, complete definitions, native hashes,
omissions, unknown field labels and original curve ordering.

The source pin is [r-particles.json](reference/ahri/r-particles.json), SHA-256
3f283be14704aa77c680d2c11eb67441d8376586835e43283ae7be440c956991.
Complete native reparsing and restore pass with the unchanged pinned CDTB parser.
Eleven guards pass in normal and optimized Python. They reject closure/identity
changes, missing or invented null declarations, introduced emitter arrays,
boolean/number substitutions, conflicting native files and leaf/parent symlinks.
Restore preflights existing conflicts before network work or output writes.
See [verification](reference/ahri/r-particles-source-verification.json).

```sh
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/extract-ahri-r-particles.py --check
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/extract-ahri-r-particles.py
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/test-ahri-r-particles.py
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python -O tools/assets/test-ahri-r-particles.py
```

These checks require native inputs and the retained parser installation. No public
transport, save field or runtime binding is added. The accepted Charm runtime
remains schema 180 / d625c0ee. Private decoding, explicit spell/animation joins,
saved visual observations, rendering and native calibration follow separately.
Resource names alone establish no native callback timing or gameplay policy.

## Private authored-mip and mesh decode

All 51 textures retain their 428 authored mip levels as private PNGs totaling
2,144,485 bytes. Compressed ranges, dimensions, straight RGBA pixels and alpha
statistics are checked; no resized/generated mips, gamma conversion or
premultiplication are introduced. Pillow's canonical software BC1/BC3 decode
does not establish native GPU appearance.

The four SCB 3.2 flag-2 meshes retain 844 vertices / 1,531 triangles. Their
individual vertex/triangle counts are 201/380, 260/480, 183/351 and 200/320.
Three have native BGRA vertex colors with separate RGBA projections; the fourth
omits colors. Points, indices, face UV/material bytes, bounds and pivots all
round-trip byte-for-byte to native sources. No normals, reflection, winding
change, unit scaling or pivot offset is added.

The frozen [decode record](reference/ahri/r-particles-decoded.json), SHA-256
d9c25753b0e04e08194709fbafa272ad52003859179f41af7f92b01dcb35dde4,
regenerates exactly. Ten guards pass in normal and optimized Python, covering
mesh/color corruption, invalid indices, nonfinite coordinates, PNG corruption,
changed record identity and whole-output conflict/symlink preflight. See
[decode verification](reference/ahri/r-particles-decode-verification.json).

```sh
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/decode-ahri-r-particles.py --check
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/decode-ahri-r-particles.py
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/test-ahri-r-decode.py
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python -O tools/assets/test-ahri-r-decode.py
```

These artifacts remain private. Public transport, producer joins, saved visual
clocks, rendering and native calibration are separate work.

## Explicit producer joins

The pinned character records explicitly select Ahri_R_mis_02 for the missile and
Ahri_R_Tar for contact. Launch bone `chest` remains distinct from contact bone
`C_BUFFBONE_GLB_CHEST_LOC`. FixedSpeedMovement retains speed 1,400 and both
100-unit height declarations. Tracking and visibility fields remain omitted;
CastOnMovementComplete precedes DestroyOnMovementComplete.

Three buff conditions connect the indicator variants to BuffCounter material
drivers with literal operands 1, 2 and 3. Comparison operators are omitted.
The reading preserves the complete driver records without declaring an equality
rule or mapping counters to local remaining charges. A skin HasBuff condition
adds two eye instances on L_Eye/R_Eye and separate TextureSwaps/Ready_tar instances
on the layout bone. TextureSwaps still has no authored emitter arrays.

These nine producer references join eight systems / 39 emitters with 38 textures
and two meshes. Ahri_R_cas, Ahri_R_mis and Ahri_R_Ready_Aura remain unjoined.
There are no R-prefixed ParticleEventData declarations in the pinned animation
clip map. Resource names do not supply the missing dispatch or chronology.
The explicit null Transform_Out resource is retained separately.

The [producer record](reference/ahri/r-particle-bindings.json) regenerates from
committed inputs without private caches, CDTB or Pillow. Nine rejection probes
and five source-pin mutations pass in normal and optimized Python, along with
two Node QA cases. A dedicated R source workflow runs the three portable Python
commands; no remote workflow is dispatched locally.

```sh
python3 tools/assets/read-ahri-r-bindings.py --check
python3 tools/assets/test-ahri-r-bindings.py
python3 -O tools/assets/test-ahri-r-bindings.py
node --test tools/qa/ahri-r-particle-bindings.test.mjs
```

Native counter semantics, missing dispatch, saved visual histories and rendering
remain open. The accepted schema-180 runtime is unchanged.

A fresh committed-file export of 449864c9 passes the reader check, normal and
optimized guard scripts, and both Node QA cases. It contains all required
committed inputs and no private caches, decoder tools or node_modules. This
validates portable producer reading, not native extraction or decoding in CI.
See [portable verification](reference/ahri/r-portable-reading-verification.json).
