# Spirit Rush source audio reading

The frozen Ahri SFX graph joins six stored R event names to five Play actions and one Stop action. The raw reading retains 34 nodes and fourteen decoded masters (4,118,468 WAV bytes), using the existing immutable graph/decoded corpus. No new decoding, runtime assets, saved history or playback binding is introduced by this reading.

The activation container `294973194` retains `bIsContinuous=1`, `sLoopCount=0`, transition time 1,000 and transition mode 4 (source label SampleAccurate). Its single master remains a source sound beneath that continuous container. R cast, missile and hit each select among four masters; deactivation uses a separate single-master container. Local actor ancestry passes through R mixer `601059309` and shared mixer `353175404`, preserving gain, pitch/range omissions, playlists, limits and attenuation without flattening inheritance.

The missile Stop targets container `525682343`. Crucially, deactivation event `4029049614` contains only Play targeting `598713583`; it does not contain an explicit Stop for the continuous activation container. A future local cessation policy must remain distinct from this source fact. Native emitter lifetime, continuous scheduling, dispatch, bus/listener behavior and virtualization remain unverified.

The producer verifies both frozen input hashes and records its own SHA. Cache-free normal/optimized guard modes reproduce the record and reject missing/changed output, leaf/parent symlinks, changed graph bytes and missing decoded metadata. Stop-descendant media describe the affected closure rather than clips played by Stop. Source preparation remains isolated from the accepted Q primary and W delivery gates.
