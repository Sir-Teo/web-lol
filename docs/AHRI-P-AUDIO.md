# Essence Theft source audio reading

The frozen Ahri SFX graph joins four stored passive event names to four Play actions. The reading retains 23 nodes and five unique decoded masters (1,279,504 WAV bytes). No Stop or Reset actions are selected. It uses the existing immutable graph and decoded corpus; no new decoding, runtime assets, saved history or playback binding is introduced by this reading.

Missile launch and hit each keep one master. The two buff-activation branches each retain three sound nodes and share the same three media IDs:158983157,282828401 and704313670. Shared WAV identity does not merge their sound/container identities or properties. The generic passive-missile buff branch has−8 dB MakeUpGain; the explicitly named minion-heal branch has−12 dB. Missile launch is−15 dB and hit−12 dB. Actor ancestry runs through mixer595867950 and shared spell mixer353175404.

Raw playlists, pitch/property omissions, limits, positioning and attenuation remain unflattened. Event names alone do not establish native Essence spawn, contact, healing or minion-counter callback timing. A future local binding must distinguish those choices. Native dispatch, listener/bus behavior, inheritance and virtualization remain unverified.

The producer pins both frozen input hashes and records its own SHA. Cache-free normal/optimized checks reproduce the record and reject missing/changed output, leaf/parent symlinks, changed graph bytes and missing decoded metadata. Shared-media IDs are explicitly checked while every sound node remains separate. This preparation is isolated from accepted W and the ongoing R delivery checks.

## Isolated shared-master stage

The passive branch stages five unchanged mono44.1 kHz float masters and a generated source table: six outputs /1,290,292 bytes. Eight distinct sound rows retain four container identities and two local mixers while sharing the three heal WAVs. Publication deduplicates only identical media bytes; it keeps each sound's parent and properties separate. No timing, history or playback is bound yet.

All nine asset/property tests, TypeScript and both normal/optimized whole-closure guard modes pass. Six rejection probes per mode cover final-output conflict before any earlier WAV is written, corrupt output, leaf/parent symlinks and changed source bytes. Cache-free fixtures use the committed identical masters. CI includes source reading and publication guards in both Python modes.
