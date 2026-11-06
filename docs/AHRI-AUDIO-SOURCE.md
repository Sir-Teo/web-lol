# Ahri base SFX source banks

The pinned base skin declares Ahri_Base_SFX with two bank paths and 56 stored
event names. Both banks are retained privately from the same 16.18.8175716 Riot
manifest and DATA/FINAL/Champions/Ahri.wad.client archive as the source rig.
Together they contain 1,334,190 bytes; both report bank version 145. Exact hashes,
archive chunks, path identities and bank headers are frozen.

The separate Ahri_Base_VO banks and voice WPK are outside this extraction.
The source record alone establishes no hierarchy, decoded media, event timing,
native mix or playback. Later stages are documented in AHRI-AUDIO-GRAPH.md and
AHRI-AUDIO-MASTERS.md; public assets and the tested 7ae8e0 ruleset are unchanged.

Normal/optimized checks and a fresh second-cache restore pass with identical
provenance. Twelve probes reject corrupt, missing or symlink banks, changed
helper bytes, edited bank-unit metadata and altered expected bank hashes.
The original banks remain unchanged.

[Source record](reference/ahri-audio-source.json) ·
[verification](reference/ahri-audio-source-verification.json).
