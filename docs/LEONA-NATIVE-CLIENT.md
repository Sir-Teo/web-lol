# Matching native-client prerequisite

This records the earlier bounded endpoint search. The later
[matching-client follow-up](LEONA-NATIVE-MATCHING.md) now retains and verifies
the 16.18 macOS native artifact, including identical Leona/Metal content chunks.
The unsuccessful search below remains historical evidence.

The pinned Leona assets are 16.18.8175716. The original RMAN
`29CE6E781C3B6368` contains 4,048 files: WAD content plus two metadata files, with
no native executable/library path. Its compressed `content-metadata.json` range
independently resolves to `16.18.8175716+branch.releases-16-18.content.release`.
A matching native-client manifest has not been identified.

The cached CDTB `get_latest_game_manifest` query supplies platform/published only.
That route currently yields standalone content, so it does not locate the native
game client. Official [Riot client configuration](https://clientconfig.rpg.riotgames.com/api/v1/config/public?namespace=keystone.products.league_of_legends.patchlines)
explicitly routes `game_client` through PatchSieve with
`artifact_type_id=lol-game-client` and the requested platform. Its installation
roots are `Contents/LoL/Game` on macOS and `Game` on Windows; these are not verified
executable filenames.

On October 24, 2026, the explicit official EUW1 version-set query returned:

| Platform | Native manifest | Artifact version |
| --- | --- | --- |
| macOS | `B0DE7A4FF23DB6B4` | `16.21.8298620`, releases-16-21, x8664 |
| Windows | `B499FB04B1158CF6` | `16.21.8298620`, releases-16-21, x86 |

These responses identify `lol-game-client` and revision 8298620, with official
manifest URLs. They differ from the frozen 16.18 content. No current native
manifest or executable was downloaded; executable paths and sizes are unknown.

The tested `branch`, `version` and `artifact_version_id` historical filters return
HTTP 400 with invalid-parameter responses. This bounded endpoint investigation
does not establish that historical native artifacts are unavailable. A historical
version-set record or matching native manifest ID is still needed. Once found,
manifest-only inventory can establish the exact target/path/size before static
inspection. No native game or shader executes in this workflow.

The [reading record](reference/leona-native-client-discovery.json) pins official
responses, rejected queries, the original RMAN, its full name/size inventory,
compressed/decompressed target metadata and the bounded CDTB reader source.
`node tools/qa/verify-leona-native-discovery.mjs` verifies those bytes offline.
This discovery does not resolve E sword normal construction, CPU material/global
bindings or native frame acceptance, and does not block other source work.
