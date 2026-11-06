# Ahri’s complete base SFX hierarchy

Pinned wwiser parses 256 hierarchy nodes and 56 events without parser errors.
All 56 stored skin event strings join bank events by Wwise FNV-1 ID, with no
unmatched declarations or unnamed events. These are source strings; native script
dispatch still requires verification.

All 86 sound nodes resolve to 83 unique embedded RIFF/WAVE media, totaling
1,319,535 bytes. Media spans fit the DATA chunk without overlap. Its 633 padding
bytes remain in the immutable original bank. All scalar fields, event/action/
descendant closures and playlist order remain in the record.

Q’s OnCast has two ResetPlaylist_E actions followed by a Play action. Reset/Stop
media lists describe affected descendants, not sounds necessarily played by that
action. No scheduling or random-state policy is invented from those closures.
External parent/bus IDs 211064428, 1259461568 and 2232828494 remain explicit.

Normal/optimized checks, fresh graph/XML/media restore and twelve isolated
corrupt, missing, symlink, XML, record and helper rejection probes pass. The pinned
parser revision and tracked source cleanliness are checked. This reading adds no
runtime cues or native timing/mix claims. Decoded private masters are documented
separately in AHRI-AUDIO-MASTERS.md.

[Full graph](reference/ahri-audio-graph.json) ·
[verification](reference/ahri-audio-graph-verification.json).
