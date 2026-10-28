# Frozen reference-cache recovery

Four former source-verification failures are resolved by restoring original
inputs. The fresh full run passes **3,574/3,576 tests across 416 files**: 414
files pass, and two retain their identified failures. No assertions, expected
hashes or deadlines are changed. The final focused run after recovery fault
checks passes **23 tests across the four recovered files**.

## Restored inputs

The Riot manifest `29CE6E781C3B6368` downloads successfully and matches SHA-256
`564984ff169e7554607cae96d3cdca7812dfc5978736e889f347def39142a0cb`.
The documented CDTB commit and every pinned Python dependency are restored in
ignored tool directories. Original extraction scripts reproduce both Garen
banks and the passive inputs against their unchanged provenance.

The tracked `tools/assets/restore-reference-cache.py` verifies 97 cache files:

- Garen: two source banks, 34 basic-attack and two passive WEMs, and six passive
  BIN/texture inputs. The encoded media total 328,799 bytes. Bank index/offset,
  RIFF extent, graph and decoded-manifest hashes all agree.
- Distortion: eight archive resources, 15 original Metal libraries, their 15
  embedded AIR modules, and all 15 textual disassemblies. Original chunk/file
  hashes, library extents and bitcode wrapper offsets remain checked.

Linux LLVM 19 reads the modules but does not reproduce the frozen IR text;
its absolute/relative-path probes remain retained. Isolated Debian Clang 21.1.8,
cross-targeted to `arm64-apple-macosx26.5.0` with LLVM passes disabled, reproduces
**all 15 original disassembly hashes exactly**. The original Apple compiler
record and all reference pins remain unchanged. This verifies static source
identities; no Metal program or native game client is executed.

## Command and safeguards

Use the reader/Python setup pinned in [ASSETS.md](ASSETS.md). A compiler is
needed for missing textual disassemblies; its output is admitted only if the
existing frozen hash matches. A fresh report path is required.

```sh
.tools/cdtb-venv/bin/python tools/assets/restore-reference-cache.py \
  --garen --distortion --clang /path/to/clang-21 \
  --report artifacts/fresh-reference-recovery.json
```

An isolated Linux compiler can receive a child-only shared-library search path
through `--clang-library-path`; the retained package metadata pins the three
LLVM package sizes and hashes. Existing complete caches can be reverified
without `--clang`. Source download requests retain the original manifest and
chunk checks. The command writes ignored caches and the requested report;
application sources, public assets and reference pins retain their bytes.

The real CLI checks recreate a temporarily removed WEM and disassembly,
reproduce their exact bytes, refuse a deliberately corrupt WEM without
replacing it, and refuse an existing report without modifying it. The test
restores the original audio bytes explicitly and revalidates all 97 files.
The first command version omitted Garen's subchunk-table mapping and failed
before extraction; its source, traceback and failed report remain retained.
The corrected command supplies that dependency explicitly.

## Remaining evidence gaps

The Leona Eclipse test now reaches its retained-input check through the restored
reader, but `.cache/leona-attached-skin-reflection-reading-v1-20261024/check.py`
and other original retained inputs are absent. The native input gate remains
open. The Lux 24-sample legacy digest remains different from its frozen expected
`09b53b…`: Node 24.19.0 produces `4258cc…`, while retained Node 22.23.4 produces
`e9695d…`. Both failures and full digests are recorded. Expected values and
runtime particle code are unchanged; switching Node does not close the gate.

[The verification ledger](reference/reference-cache-recovery-verification.json)
pins scripts, raw reports, failure probes, exact input/output identities,
package metadata, test logs and resumed audit-pause receipts. Both 100-seed
audits continue against frozen `a3e47aa` and ruleset `abc8dc…`; this step claims
no hundred-seed completion. Schema 163 and pack
`8511251dbb909130d44970a3e4e453cc58c295a8f9d026637e3a1073bcabb680`
remain unchanged. Preceding production/offline results retain their exact
source and pack scopes.
