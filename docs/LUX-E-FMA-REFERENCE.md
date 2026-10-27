# Reproducing the original Lux sampler checksum

The original checksum is now reproduced exactly by a controlled compiler-math
experiment. This identifies a numerical path that explains the golden; it does
not establish the original machine or its precise build flags. Production math,
the original golden and its existing assertion remain unchanged.

The complete source tree at `ee5b92c1a8a69910f8c2837133158d892564ada2`, where the
checksum assertion first appeared, produces today's Node checksum. Its lockfile
is identical to the current lockfile. The installed Three.js runtime modules
match the original locked package tarball. Node 24.19 and the unmodified official
Node 26.12.1 x64 runtime produce the same result on this host.

The diagnostic extracts V8's pinned sine/cosine bodies and their argument-reduction
helpers, retaining their upstream notice. Standard `bit_cast` replaces header
scaffolding; arithmetic bodies stay unchanged. It compiles the same generated
source for the same x64 FMA/AVX2 instruction set with contraction off, on and fast.
GCC 14 and Clang 21 independently produce the same comparison.

| Contraction | Complete 24-snapshot SHA-256 |
| --- | --- |
| Off | `4258cc67eef3b42afb26960a816f30a9237f2c203a3040e0acf3afb364580f9a` |
| On or fast | `09b53b57121711b36aef97f538295b21e5f04e53bcbfb34cde19450118d628df` |

Only one of 810 distinct trig results changes. Across the full sampler it is
called twice:

| Observation | Float64 bits / value |
| --- | --- |
| Cosine input | `3fe96796f5ab7d51` / 0.7938952253570425 |
| Uncontracted cosine | `3fe66f30a33dc4c9` / 0.7010729969316795 |
| Contracted cosine | `3fe66f30a33dc4c8` / 0.7010729969316793 |

Replaying the compiled trig results substitutes 17,888 calls and reproduces each
complete snapshot stream. Independently substituting only that cosine input in
the current Node process also reproduces the original golden. Two output scalars
change, by at most `5.684341886080802e-14` source units. Both cast to the same
Float32 values. Math functions are restored after every probe, including errors.
These observations do not establish complete GPU-frame or native-client parity.

Run the standalone diagnostic on an x64 host with FMA/AVX2 and a C++20 compiler:

```sh
node tools/qa/lux-e-fma-audit.mjs \
  --output-dir .cache/fresh-lux-e-fma-audit
```

The tool verifies the original Git archive, lockfile, Three package integrity,
installed Three runtime bytes and the pinned upstream V8 source before compiling.
It requires a fresh output directory, stores all source/math/compiler artifacts,
and asserts both complete checksums. `--fdlibm-source` and `--three-tarball` accept
locally cached inputs, which retain the same hash checks. `--cxx`, repeated
`--cxx-arg`, and `--python` select the compiler and reference process. Clang on
this cloud host uses its isolated LLVM library path and the GCC 14 system-header
include path; exact commands are retained in the reading.

The [reading](reference/lux-e-fma-reference.json) and
[verification ledger](reference/lux-e-fma-reference-verification.json) retain the
original closure, package identity, two-compiler comparison, one-input causality,
numeric differences, runtime metadata and rejection checks.

This extends the earlier [Node/Chromium portability audit](LUX-E-SAMPLER-PORTABILITY.md).
The default x64 Node unit assertion still reports its uncontracted checksum;
the compiled reference is a separate diagnostic. The last full application run
remains 3,074 passing tests out of 3,076, with the historical Leona archive and
this host-specific checksum assertion as the two baseline failures.
