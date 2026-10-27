# Recovering the original distortion shader evidence

The original frozen distortion evidence is available again. All eight native
resources, fifteen Metal libraries, fifteen AIR bitcode payloads and fifteen
textual disassemblies match the existing source pin. The recovery creates only
missing canonical files and refuses conflicting existing files. The source pin
and shader test retain their original hashes and assertions.

The producer reads nine exact CDN ranges, totaling 81,660 compressed bytes,
against the pinned Riot 16.18.8175716 manifest and shader archive. Range status,
framing, bounded response size and SHA-256 are checked. Reconstruction binds
those ranges to the manifest, verifies all eight native resource hashes, and
checks four TOC tables, every define combination, program inventory and bitcode
wrapper before publishing the complete 53-file closure.

LLVM 19 and direct LLVM 21 module printing did not reproduce the historical text.
Debian Clang 21.1.8 with LLVM passes disabled and the original explicit host
triple reproduces all fifteen disassembly hashes exactly. Compilation occurs in
an isolated staging directory while retaining the original logical relative
input filenames. The output destination can vary without changing the text.
A nonmatching disassembly rejects before any canonical evidence output is written.
No Metal shader or game client executes during recovery.

The local LLVM tool directory was extracted from three official LLVM packages
without installing system packages or executing package maintainer scripts.
Their 41,372,464 bytes match the signed package index. The LLVM archive signing
fingerprint is `6084F3CF814B57C1CF12EFD515CF4D18AF4F7421`. Package/index signatures,
receipts, tool hashes and initial unsuccessful text candidates are retained.
The recovery tool also accepts an explicitly supplied compatible Clang.

```sh
# Complete caches verify and replay offline, without invoking a compiler.
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python \
  tools/assets/particle_distortion_recovery.py --check

# Missing evidence uses the local .tools/llvm21 compiler by default.
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python \
  tools/assets/particle_distortion_recovery.py \
  --receipt .cache/fresh-distortion-recovery.json

# Another compatible Clang can be selected explicitly.
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python \
  tools/assets/particle_distortion_recovery.py --clang /path/to/clang \
  --library-dir /path/to/compiler/libraries \
  --receipt .cache/another-fresh-distortion-recovery.json
```

The receipt path must be new. Optional `--work-dir` must provide fresh compiler
staging outputs; the default creates a fresh run directory. Downloaded compressed
inputs may remain cached after a failed reconstruction. Canonical evidence is
preflighted for conflicts before input retrieval and again after complete staged
verification. Replays preserve existing canonical bytes and modification times.

Seventeen guards pass under normal and optimized Python. They cover input/pin
corruption, exact closure, malformed TOCs and program bundles, conflicting files,
nonmatching compiler text and offline replay. Check/replay preserves all 64
tracked files: 53 canonical outputs, ten cached manifest/chunk inputs and the
unchanged source pin. Network connections and child processes are blocked during
these complete-cache runs.

The unchanged three-case shader suite passes, including the exact original
fifteen-program identity assertion. Full-suite results, tool/source snapshots and
hashes are retained in the [verification ledger](reference/particle-distortion-recovery-verification.json).
Game code, assets, schema, fingerprint and production pack retain the accepted
[motion/fingerprint checkpoint](PARTICLE-SPATIAL-DRAG-REPLAY.md).

The original text retargets its header to `arm64-apple-macosx26.5.0`; that header
is not the AIR module's original target. Original bitcode remains canonical.
Byte-identical text recovery establishes no new native CPU dispatch, sampler
state, Metal execution or visual parity. Other missing historical Leona evidence
and the original Lux sampler portability failure remain separate.

The full regression run now records 3,074 passing tests out of 3,076 across
388 files. The shader archive failure is removed; the two remaining failures
are the prior historical Leona input and Lux sampler golden checks. The original
wave deadline passes. No pin, golden, deadline or existing assertion changes.
