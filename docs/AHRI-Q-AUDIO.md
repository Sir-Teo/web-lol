# Orb of Deception source audio reading

`reference/ahri-q-audio-properties.json` is a frozen subset of the attested Ahri SFX graph and decoded corpus. It preserves eight stored event declarations, ten ordered actions, 53 nodes and 22 numeric float masters (4,233,316 bytes). Full raw scalar rows retain playlist order, repeated child IDs, randomized modifiers, ancestor properties and the shared attenuation node. The reading itself adds no runtime files or gameplay bindings.

The cast event declares two `ResetPlaylist_E` actions, targeting the outward and return hit sequences, before its Play action. Each hit sequence has seven playlist entries: a distinct initial child followed by six references to another child. Outward child groups store +200 cents; the outward flight container stores +400 cents. The return hit groups have their own gains, and two individual return-hit sounds add +0.5 dB. The return-missile `buffdeactivate` container stores −18 dB and a Pitch modifier range of −200 to +200 cents; that range is separate from a base pitch property.

Outward missile stop stores 500 ms / Exp1 curve 6. Return missile stop stores 750 ms / Linear curve 4. The shared local mixer ancestry reaches the same attenuation node as Charm, while the global bus remains unresolved. These are source declarations. Native reset scope across owners, sequence exhaustion/wrapping, dispatcher ordering, stop/cancellation conditions and listener calibration remain unverified. In particular, the stored `buffdeactivate` name does not independently certify a native catch condition.

The reader pins both source record hashes and records its own SHA. It retains Reset/Stop media as affected closures rather than claiming those actions play clips. Normal and optimized checks reproduce the same record. Five cache-free rejection probes in each Python mode cover missing/changed records, symlink output, changed graph bytes and missing decoded metadata. Future playback must preserve these distinctions rather than flattening the two hit sequences into ordinary random playlists.


## Isolated master and graph stage

The separate `dev/ahri-orb-audio` branch stages 22 unchanged mono 44.1 kHz float masters and `src/content/ahri-orb-audio.ts`: 23 outputs / 4,258,619 bytes. The generated table preserves all ten containers, 22 sounds, two local mixers, eight events and their ordered actions. Gains, base pitch and randomized modifiers remain separate; playlists retain repeated IDs, child voice caps of two and parent hit-sequence caps of eight. No Q controller or gameplay history is bound yet.

All 26 asset/property tests and TypeScript pass. Normal/optimized export checks agree. Six publication rejection probes per mode cover missing/conflicting outputs, corrupt masters, leaf and parent-directory symlinks and changed source inputs, with complete preflight before publication. The fixture guards use committed identical master bytes and require no private cache. The audio CI workflow includes the source reading, asset checks and publication guards.

The pinned external wwiser reader (`71654ed1a2c4642894bd7e7ed79eba66986fb770`, `wwiser/generator/render/bnode_hircs.py`) describes `bResetPlayListAtEachPlay` as applying in continuous mode. These source containers store `bIsContinuous=0` while retaining that reset flag as one. This external interpretation is useful context, not native engine certification; the raw flags and explicit reset actions remain separate in the staged graph.
