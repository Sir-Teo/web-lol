# Baron numeric sound graph

The pinned wwiser reader parses both original banks without errors. The full
hierarchy has 341 nodes: 87 events, 62 play actions, 34 stop actions, 56 random/
sequence containers, 86 sound nodes, 13 actor mixers and three attenuations.
Every sound resolves to the 82 unique embedded WEM files; four media identities
are shared by multiple sound nodes. Nine events have multiple actions.

The projection preserves all scalar reader fields and each event's complete
action/descendant/media closure. Encoded WEM bytes are extracted within checked
DIDX/DATA bounds, with unique IDs, nonoverlap and exact RIFF extents. All 82 files
remain private and unmodified. Three unresolved global parent/bus IDs stay explicit:
1823673009, 2192106426 and 2770764924. No external mix is fabricated.

The skin declares no event-name list and these banks carry no reader name labels.
Events retain numeric IDs with null declared names. Cue semantics, native
dispatch, decode and runtime playback remain subsequent work. Candidate string
hash cracks must be recorded separately from attested source strings.

Normal/optimized checks, fresh restoration and six rejection probes pass. Probes
cover changed/missing WEMs and edited graph metadata in both Python modes. See
reference/baron-audio-graph.json and its verification receipt.

```sh
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/map-baron-audio.py --check
```
