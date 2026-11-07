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
