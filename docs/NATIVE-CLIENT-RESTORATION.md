# Frozen native-client payload restoration

The selected original macOS client payloads can now be restored directly from
the official Riot CDN using the existing immutable
[matching-client pin](reference/leona-native-matching.json). This restores the
82,268,192-byte universal executable, three version metadata files and the app
plist. It enables further static particle/attachment analysis against the same
16.18.8175716 code and content cohort used by the game assets.

The executable SHA256 is
`97edcf2c88fec3169a1ec36345276569de3329e27fd9b32c8162957a77135c6c`.
Both original x86_64 and arm64 slices match their pinned offsets, headers and
hashes. The metadata/plist identify build `16.18.8175716`. Both manifests retain
identical complete ordered chunk-ID/decoded-size sequences for the frozen
Leona WAD (4,650 chunks) and Metal shader WAD (5,824 chunks).

```sh
PYTHONPATH=tools/assets .tools/cdtb-venv/bin/python tools/assets/restore-native-client.py \
  --receipt .cache/fresh-native-restore-receipt.json
PYTHONPATH=tools/assets .tools/cdtb-venv/bin/python tools/assets/restore-native-client.py --check
PYTHONPATH=tools/assets .tools/cdtb-venv/bin/python -O tools/assets/restore-native-client.py --check
PYTHONPATH=tools/assets .tools/cdtb-venv/bin/python tools/assets/test-native-client-restore.py
```

Existing conflicts reject before network access. Each fetch is bounded to its
expected size plus one byte; ranges require HTTP 206 and the exact Content-Range.
Manifest/range bytes, decoded chunks and reconstructed files must match the
original SHA256 pins. All selected payloads verify before missing target files
are created. Existing identical files retain their timestamps and permissions.
Receipts refuse existing destinations. The tool does not rewrite the source
pin or install/execute a native target.

The restoration made fifteen official-CDN requests: one 16,778,397-byte manifest
and fourteen compressed ranges totaling 24,730,508 bytes. The existing frozen
assets manifest was reused. Twenty missing files were restored; twenty-one
payload files participate in verification, including that existing manifest.
The complete payload set totals 140,462,443 bytes.

Eighteen HTTP/cache guards pass normally and with optimization. Five additional
fault injections reject corrupted manifests, compressed chunks, metadata,
executables and a preexisting cache conflict without partial outputs. Network
connections are denied during normal/optimized checks and restore replays;
all twenty-one files retain byte hashes, timestamps and permission modes. The
cached executable has no execute bit set. The pinned reader remains unchanged;
restoration calls its explicit body parser after checking/decompressing the
manifest header, avoiding its unsupported file-like constructor path.

This is recovery of the exact selected native payloads. Historical collector,
command-log, inventory and disassembly archives remain a separate evidence
set; the older full historical verifier still requires those original files.
The existing missing-archive test failures are not declared resolved. Static
byte consistency establishes neither code-signing validity nor native rendering,
attachment, shader or CPU-dispatch behavior. Further calibration must cite its
own inspected code/data ranges.

The application remains at schema 163 with fingerprint
`d7e71965d6aa7ac28ff74c6526b48d83dd73b0111a67c72eeb76af89163f3747`
and the same production pack. No game source or public asset changes in this
checkpoint. Exact receipts, source snapshots and offline/fault checks are in the
[verification ledger](reference/native-client-restoration-verification.json).
