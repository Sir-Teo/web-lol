# Wuju Style private mip decode

The complete [E source closure](MASTER-YI-E-PARTICLES.md) now has a private decode
for all nine textures and 78 authored mip levels. Six textures use source format
10 (BC1 with alpha) and three use format 12 (BC3). The source references no SCB
mesh, so the shared decoder receives an explicit zero-mesh profile while its
older Q/W/R defaults remain unchanged.

The 78 RGBA8 PNGs total 507,657 bytes and preserve 7,362,212 RGBA bytes. Every level
retains source dimensions, compressed block offset/size/hash, PNG and RGBA hashes,
and alpha statistics. Native smallest-first TEX storage is read backwards to
recover the authored largest-first chain. No mip is resized, generated,
premultiplied or gamma-converted.

The independent checker uses standard-library PNG and BC1/BC3 inspection without
importing Pillow or CDTB. It checks every source range, pixel hash, PNG CRC and
extent, and alpha statistics. The common ramp texture keeps identical compressed
blocks, pixels and PNGs across the existing Q, W and R decodes.

The [decoded record](reference/masteryi/e-particles-decoded.json) pins the frozen
source, layout reader revision, software decoder build and producer artifacts.
Normal and optimized checks and decode replays preserve bytes and timestamps for
all 79 files, including the record. Missing/conflicting outputs fail before any
new output is written. See [verification](reference/masteryi/e-particle-decode-verification.json).

Reproduce the source-backed producer in its pinned environment:

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/decode-masteryi-e-particles.py
PYTHONPATH=tools/assets python tools/assets/decode-masteryi-e-particles.py --check
PYTHONPATH=tools/assets python tools/assets/test-masteryi-e-decode.py
PYTHONPATH=tools/assets python -O tools/assets/test-masteryi-e-decode.py
```

This checkpoint creates private outputs only. It adds no public PNG, runtime
loading, gameplay or save schema. Software decoding does not certify native GPU
compressed-texture rounding, branch/attachment/lifecycle behavior or frame parity.
