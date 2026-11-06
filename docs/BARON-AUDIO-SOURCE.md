# Pinned Baron base sound banks

The source skin declares one NPC_Map11_Baron_SFX_audio bank unit with two shared
SFX banks. Both are privately frozen from the same pinned 16.18.8175716 manifest
and Map11 WAD as the body/effects. Together they contain 2,142,507 bytes. The audio
container is version134 (bank ID1237871473); the event bank is version145
(ID4081957254). No voice bank or additional audio declaration is inferred.

The source checker pins the skin record, CDTB revision, helper, manifest/archive
chunks, declared closure and each bank's bytes/SHA-256. Existing conflicting inputs
reject before extraction. Checks pass in normal and optimized Python; a fresh
restore reproduces exact provenance. Eight rejection probes cover changed, missing
and symlinked banks and edited helper pins under both Python modes. The first
experimental absolute-helper-path record remains an ignored artifact; the frozen
record uses a portable repository-relative path.

```sh
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/extract-baron-audio.py --check
```

See reference/baron-audio-source.json and its verification receipt. Event/media
graphs, cue selection, decoding and playback remain subsequent work. These banks
are not public assets and no runtime audio or application pack changes here.
