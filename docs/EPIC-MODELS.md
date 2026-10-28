# Epic-objective base rigs and animation bindings

Baron, Rift Herald and Void Grub (`SRU_Horde`) now have source-quality local
base-rig previews. The original patch archive supplies 138 files / 10,479,726
bytes: six skin/animation definitions, meshes, skeletons, three diffuse textures
and every referenced atomic animation file. The complete definitions and 144
graph entries are retained in the [source pin](reference/epic-models-source.json).
A separate cache reproduces the entire extraction and pin exactly.

| Base skin | Triangles | Bones | Bound glTF clips | Source graph entries | GLB bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| Baron skin 0 | 22,296 | 131 | 85 | 85 | 13,473,732 |
| Herald skin 0 | 14,373 | 76 | 27 | 27 | 3,539,904 |
| Grub skin 0 | 5,662 | 67 | 28 | 32 | 2,007,068 |

Positions, joint translations, inverse binds and animation translations share
the existing source-to-metre conversion. Authored skin scale is approximately
0.9 for Baron and 0.8 for Herald. Grub omits skinScale and uses identity before
the 0.01 conversion. Baron's authored hidden Horn/Eye submeshes retain metadata
and stay hidden in the preview. Materials use original diffuse assignments with
unlit preview shading. Native materials, effects, audio and dispatch remain open.

The first extraction resolved three diffuse hashes but exposed hashed animation
paths as well. The completed pin retains 126 finite xxh64-verified path labels
from the discovery dictionary; subsequent reproduction needs no mutable
dictionary. The initial failed attempt and its source/log remain retained.

## Four Grub entries with no matching rig joints

The converter's missing-clip check caught four omitted Grub declarations:
`dormant`, `dormant_loop`, `dance_in` and `dance`. Their source animation poses
contain thirteen joint hashes. None matches this skin's 67 named skeleton
joints. The normal idle supplies 75 source hashes, of which all 67 skeleton
joints match. This distinguishes the missing bindings from empty or static
animations; the original files have nonzero durations and remain retained.

The [binding audit](reference/epic-models-bindings.json) evaluates every source
frame time and the exact duration of every atomic entry through the pinned
LeagueToolkit decoder. It retains source/skeleton hashes, exact float32 duration
bits, all observed source joint hashes and matched skeleton names. ELF-lower
name hashing is restricted to the ASCII joint names actually present. A second
run reproduces the entire audit exactly. This measures decoder binding behavior;
it does not establish native animation selection or visual parity.

Conversion requires the matching source/helper/toolkit audit identities and
checks each classification against the retained joint-hash sets. Every bound
entry must still survive conversion. The four unbound declarations receive
explicit manifest records; no replacement pose, invented motion or empty glTF
animation is generated. The Grub GLB therefore has 28 clips while the source
pin keeps all 32 declarations.

## Reproduce and inspect

Restore the pinned .NET 8.0.425 SDK and lol2gltf commit from [ASSETS](ASSETS.md).
The isolated Linux restoration uses the same documented ImageSharp 3.1.12
selection. Its SDK archive is checked against Microsoft's release SHA-512;
NuGet canonical content-hash metadata matches the lock, and raw package hashes
match cache sidecars. Raw signed-archive hashes are retained separately from
NuGet's canonical content hashes. Existing dependency advisories remain in the
retained build log. The [toolchain inventory](reference/model-converter-toolchain.json)
records SDK/package/library identities. This is an offline build tool, not an
application package. An existing Blue source extraction reproduces all 64 files.
Its Linux GLB differs from the shipped binary, while the unmodified converter
from `8aba1e6` produces exactly the current Linux result. Original public media
is preserved. This does not certify binary reproduction across hosts.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python \
  tools/assets/extract-epic-models.py \
  --report artifacts/epic-models-fresh-extraction.json
node tools/assets/inspect-animation-bindings.mjs \
  --report artifacts/epic-models-fresh-bindings.json
node tools/assets/convert-roster-base.mjs SRU_Baron \
  --output-dir .cache/epic-model-previews
node tools/assets/convert-roster-base.mjs SRU_RiftHerald \
  --output-dir .cache/epic-model-previews
node tools/assets/convert-roster-base.mjs SRU_Horde \
  --output-dir .cache/epic-model-previews
```

Open `/tools/qa/jungle-characters.html?character=SRU_Baron` on the development
server. The selector includes all eleven epic character identities; the three
prepared rigs load on demand from the ignored cache. Other epic identities show
their complete character variants without requesting a model. Scrub or play
bound clips, orbit/zoom, and use **Frame model** to fit the current skinned pose.
The Grub view exposes the four unbound source entries. Retry and late-response
guards are shared with the existing ordinary-monster preview.

The conversion destination defaults to the existing production model directory;
`--output-dir` supports a relative review directory and records its matching
local URL. The current epic outputs remain in the ignored cache. No game rigs,
public media, rules, saved fields or production asset requests change here.
All six final browser cases pass, including ordinary monster/Scuttler
regressions, real pose changes, source variants, retry and late-response guards.
All three final captures are reviewed after framing the current pose. Independent
glTF validation reports zero errors, warnings and informational issues. Edited
binding classification, an escaping output directory and an unknown option are
rejected while existing output bytes stay unchanged. Baron and Herald GLBs
repeat exactly; Grub GLB repetition is exact too. A corrupted animation cache is preserved and
rejected; deletion recovery restores its original bytes and revalidates all 138
files. The verification ledger records these checks. Explicit preview TypeScript, formatting and build pass.
The build reproduces the existing 1,202-file production pack exactly; no fresh
production browser or offline certification is claimed for this tooling change.

Some decoder nominal durations exceed the final glTF key by one 30 Hz frame
(at most 0.033333421 seconds in these outputs). Manifests retain both
`sourceDurationSeconds` and the converted `durationSeconds` key span, together
with source FPS. Native end/transition semantics remain unverified; the preview
does not imply a calibrated runtime animation clock. The [verification ledger](reference/epic-models-verification.json) pins source,
outputs, captures, diagnostic history, real CLI checks and the resumed audit
pause. Live objective combat, calendars, rewards/buffs and native comparison
remain separate work.
