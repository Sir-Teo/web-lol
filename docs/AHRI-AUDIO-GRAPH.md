# Ahri’s complete base SFX hierarchy

Pinned wwiser parses256hierarchy nodes and56events without parser errors.
Every one of the skin’s56stored event strings joins a bank event by Wwise FNV-1
ID, with no unmatched declarations or unnamed bank events. These are source
strings, not guessed labels; native script dispatch still requires verification.

All86sound nodes resolve to83unique embedded RIFF/WAVE media, totaling
1,319,535bytes. Checked media spans fit the DATA chunk without overlap. The633
bytes of padding remain in the immutable original audio bank. All scalar parser
fields, event/action/descendant closures and playlist order remain in the record.

Q’s OnCast has two ResetPlaylist_E actions followed by a Play action. Reset/Stop
action media lists describe affected descendants, not sounds necessarily played
by that action. No scheduling or random-state policy is invented from those
closures. External parent/bus IDs211064428,1259461568and2232828494remain explicit.

Normal/optimized checks, fresh graph/XML/media restore and twelve isolated
corrupt/missing/symlink/XML/record/helper rejection probes pass. The pinned parser
revision and tracked source cleanliness are checked. No voice bank, decoded
master, runtime cue, native mix or boss/champion implementation is added by this
source reading. The current roster cohort’s ruleset is unchanged.

[Full graph](reference/ahri-audio-graph.json) ·
[verification](reference/ahri-audio-graph-verification.json).
