# Matching native-client evidence

A matching macOS game-client artifact is retained for static analysis. This adds
new evidence after the [bounded discovery](LEONA-NATIVE-CLIENT.md).

The third-party `Morilli/riot-manifests` index at revision
`ae19e16c9fabd5b686d45c9f66324d944f8dde2c` supplied the candidate
[official Riot manifest URL](https://lol.secure.dyn.riotcdn.net/channels/public/releases/524F266AA13F85A9.manifest).
The retained raw index has Git blob
`4691a8b5f59c15964fb166379fd2a59b94d8ddd7`. The index's filename alone does not
establish the client version.

The retained RMAN is 16,778,397 bytes, SHA256
`a47010ec6b22299c3480ea9764f20674b05ddc4c8b4697bb70c483498273ffac`.
Fourteen retained official-CDN compressed ranges (24,730,508 bytes) reconstruct
five selected files. The code metadata reports
`16.18.8175716+branch.releases-16-18.code.public`; the content metadata reports
`16.18.8175716+branch.releases-16-18.content.release`. The app plist identifies
`com.riotgames.LeagueofLegends.GameClient` and bundle version `16.18.8175716`.

The main executable is
`.cache/leona-native-matching-v1-20261024/native/LeagueofLegends.app/Contents/MacOS/LeagueofLegends`,
82,268,192 bytes, SHA256
`97edcf2c88fec3169a1ec36345276569de3329e27fd9b32c8162957a77135c6c`.
Its universal FAT32 header contains two little-endian Mach-O64 `MH_EXECUTE` slices:

| Architecture | File offset | Bytes | Slice SHA256 |
| --- | ---: | ---: | --- |
| x86_64 | 16,384 | 42,644,576 | `6dd6005cebcaabf43760aab4355afb9f8f557f693f81ae96ebd1a3b82f2afbb7` |
| arm64 | 42,663,936 | 39,604,256 | `18c6f615d1963d7062f4133fab351dc4550ce460e869c76f5c8604627f349885` |

The new RMAN lists 4,069 files. Parsing it and the frozen assets RMAN
`29CE6E781C3B6368` confirms identical complete ordered chunk-ID/decoded-size
sequences for:

| Archive | Decoded bytes | Ordered chunks |
| --- | ---: | ---: |
| `DATA/FINAL/Champions/Leona.wad.client` | 146,734,953 | 4,650 |
| `DATA/FINAL/ShaderCache.metal.wad.client` | 315,068,869 | 5,824 |

[The provenance pin](reference/leona-native-matching.json) records official RMAN
URLs, compressed range locations/hashes, decoded chunk hashes, selected-file
hashes, metadata, full plist, static architecture headers, slice hashes,
sequence digests and the exact CDTB reader bytes. The collector source matches the exact pinned revision byte for byte; it supplies
context, not independent authentication of historical entries. The verifier never
executes it or the extraction script.

Run the read-only offline verifier from the repository root:

```sh
.tools/cdtb-venv/bin/python tools/assets/verify-leona-native-matching.py --check
```

It hashes retained files, parses both RMANs, checks the complete inventory,
decodes retained Zstandard ranges, compares reconstruction bytes, checks the
metadata/plist, reads universal/Mach-O headers and hashes the slices. It performs
no network request, installation, extraction write, compiler invocation, binary
session operation or target launch.

This verifies consistency of retained bytes and their recorded official-CDN
provenance, not current CDN availability or an independently retained HTTP
transport audit. Code signing/notarization is unverified. Only the selected main
executable and four metadata/plist files were reconstructed; this is not a full
client installation. The Windows index entry remains an unverified candidate.
Matching version/content does not resolve native emitter dispatch, attachment
frames, CPU shader bindings, SCB normal construction or visual parity.
