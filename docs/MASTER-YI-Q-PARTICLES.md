# Alpha Strike particle source preparation

The [frozen source pin](reference/masteryi/q-particles.json) retains every Q
resource declared by the base skin, re-parsed directly from the patch
16.18.8175716 Riot BINs. This stage adds source data and restore/check tools;
gameplay, presentation, schema 147, ruleset and production pack remain unchanged.

| Resource | Authored complex emitters |
| --- | ---: |
| `MasterYi_Q_Cas` | 2 |
| `MasterYi_Q_Mis` | 5 |
| `MasterYi_Q_AP_Mis` | 3 |
| `MasterYi_Q_Tar` | 4 |
| `MasterYi_Q_Crit_tar` | 3 |
| `MasterYi_Q_End` | 2 |
| `MasterYi_Q_AlphaStrikeMissileBegin_audio` | 1 |
| `MasterYi_Q_Hit` | no emitter list |

All eight bindings retain their exact target record, complete definition and
native BIN identity. The 20 emitters refer to 23 TEX textures and two SCB meshes.
Seven BINs, including the complete skin/resource table, close the source set:
32 files, 2,028,605 bytes and 713,334 compressed bytes read. Texture and mesh
conversion, primitive/birth sampling, shaders, attachment, lifecycle and native
visual comparison remain downstream work.

`Q_Hit` contains only particle name/path and object identity. It does not justify
an invented flash or even an inserted empty emitter list. The audio-labelled
resource retains its actual black-texture dummy emitter; its name does not prove
current sound dispatch or a visible cue. The AP missile variant is retained
without treating it as an active ordinary Q effect.

Five emitter fields retain unknown identifier `{9b111ae4}` and their original
10/30 values. Eight spawn-shape records retain type `{ee39916f}`. Neither hash is
renamed or replaced with an assumed default. Existing point-shape interpretation
research is described separately in [Light Binding](LUX-BINDING.md); its hash
crack does not establish an attested native type name. Omitted fields remain
omitted, and numeric/Boolean distinctions survive native re-parsing.

Discovery reads the base skin's complete 15-link BIN closure plus the skin root.
The eight Q definitions are then selected from those native records. Field/type
labels come from retained source files and exact hash identities; their input
hashes are recorded. Long shared-skin candidate JSON URLs returned 404s, as did
the tested hash aliases. No missing parsed JSON or latest dictionary was
substituted. Native source bytes and the pinned CDTB reader provide the record
proof. Six zero-valued emote/recall references in the wider resource map remain
explicit zero references; they are unrelated to Q's complete nonzero closure.

The tools verify the frozen model/pin and all existing outputs before archive
access. Restore stages files in a temporary directory, checks exact provenance
and complete native definitions, preflights every destination, then creates only
missing identical files. Conflicts reject without replacement. Check mode writes
nothing. All 32 source-file identities and native WAD path hashes are checked.
Native parser path and code checksum are pinned independently.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-masteryi-q-particles.py
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-masteryi-q-particles.py --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python -O tools/assets/extract-masteryi-q-particles.py --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/test-masteryi-q-particles.py
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python -O tools/assets/test-masteryi-q-particles.py
```

Twenty guards pass per Python mode, including closure loss, wrong bindings,
unresolved paths, altered native identities, invented defaults, Boolean/integer
substitution, output conflicts and flat-cache path escape. Actual native checks
and restores pass normally and with optimization. This establishes source
identity and omission preservation; it does not certify native particle runtime
or frame matching.

Exact inputs, restored-file identities, failure diagnostics and staged results:
[source verification ledger](reference/masteryi/q-particle-source-verification.json).

## Private decoded assets

The [decoded record](reference/masteryi/q-particles-decoded.json) retains every
authored mip of all 23 textures: 198 RGBA PNGs, 1,135,265 encoded bytes and
9,852,332 decoded RGBA bytes. Width/height, native compressed range/hash, whole
PNG/hash, pixel hash and alpha statistics are separate per level. There is no
resizing, generated mip chain, gamma conversion or premultiplication. The pinned
LeagueToolkit `Texture.LoadTex` explicitly reads the smallest-first chain in
reverse, confirming its order independently of CDTB's largest-mip converter.
BC1-with-alpha and BC3 use the current canonical Pillow software decoder;
native hardware decoding equivalence remains unverified.

The two SCB 3.2 meshes retain 750 vertices/1,500 triangles and 27 vertices/24
triangles. Their private JSONs total 406,818 bytes and round-trip the complete
original files byte-for-byte, including signed zero, unused source vertices,
face indices/UVs, raw material padding, face RGB, pivot, zero header bounds and
each nonzero uninterpreted 24-byte tail. No normals, coordinate/unit scale,
pivot offset, winding/reflection or material interpretation is added. The
layout readers and their immutable revisions/checksums are retained separately.

The current profile records Python 3.12.14, Pillow 12.3.0, Pillow zlib 1.3.1 and
the independent stdlib zlib 1.3.2, plus actual decoder/plugin/interpreter file
identities. Its frozen record checksum prevents silently mixing another build
profile. Different profiles require separate output/record paths and an
explicitly reviewed `--record-sha256` value; conflicting files never overwrite.
All outputs are preflighted before any missing file is created.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/decode-masteryi-q-particles.py
python tools/assets/decode-masteryi-q-particles.py --check
python -O tools/assets/decode-masteryi-q-particles.py --check
python tools/assets/test-masteryi-q-decode.py
python -O tools/assets/test-masteryi-q-decode.py
```

Thirty-four decode guards pass per Python mode. Hand-calculated controls cover
all five PNG filters; independent replay verifies CRCs, exact extents, pixels and
alpha without importing Pillow or CDTB. Mip controls cover rectangular/minimum
blocks and storage order; SCB controls cover indices, nonfinite coordinates,
unreferenced points, signed zero and opaque-tail retention. Actual independent
checks and complete re-decodes pass normally and with optimization; the record
and all 200 asset timestamps remain unchanged. This adds private source assets
only. Public files, runtime, schema/ruleset and the production pack stay at the
Highlander checkpoint; visual playback still needs its own acceptance work.

Decoder/profile identities, all 200 asset hashes and validation evidence:
[decode verification ledger](reference/masteryi/q-particle-decode-verification.json).

## Contact texture transport

The ordinary and critical target systems select seven textures, containing 59
authored mip levels. The private [transport record](reference/masteryi/q-contact-texture-transport.json)
packages those levels into seven lossless PNG containers totaling 193,214 bytes.
Each rectangle retains its original dimensions and RGBA checksum. Transparent
unused space is checked separately. This is a delivery format: each rectangle
must be extracted into a separate texture level, including level zero. Sampling
the packed image as an ordinary texture would be incorrect.

The packer uses only the standard library and replays the frozen native/decode
closure before packaging. It preserves RGB beneath zero alpha, adds no generated
mips or resized pixels, and preflights every output before creating missing
files. The first private staging directory remains retained; the final guarded
producer uses `.cache/masteryi-q-contact-packed-v2`.

```sh
python tools/assets/pack-masteryi-q-contact-textures.py
python tools/assets/pack-masteryi-q-contact-textures.py --check
python -O tools/assets/pack-masteryi-q-contact-textures.py --check
python tools/assets/test-particle-mip-atlas.py
python -O tools/assets/test-particle-mip-atlas.py
PARTICLE_MIP_CHROMIUM=/usr/bin/chromium node tools/qa/particle-mip-upload.mjs
```

Fourteen tests pass in each Python mode, covering rectangular and non-power-of-two
chains, a single authored level, invisible RGB, dimensions, missing/reordered
mips, layout corruption, padding, extra rows and PNG integrity. The actual seven
textures pass independent source checks. Chromium 154.0.8037.57 with SwiftShader
also extracts, uploads and reads back all 59 levels with exact canonical RGBA
hashes. The browser test serves only its verified inputs on loopback and uses
`createImageBitmap` with color conversion and premultiplication disabled. This
establishes the tested browser upload path; it does not establish native Riot GPU
decoding, native particle behavior, physical-device performance or frame parity.
No runtime or public assets changed in this checkpoint.

Source, transport and browser evidence:
[transport verification ledger](reference/masteryi/q-contact-texture-transport-verification.json).
