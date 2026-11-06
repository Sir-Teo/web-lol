# Fox-Fire source audio reading

The frozen Ahri SFX graph joins seven stored W event names to five Play and three Stop actions. The raw reading retains 34 nodes and eleven decoded masters (2,974,908 WAV bytes). It uses the existing pinned graph and decoded corpus; no new decoding, runtime assets, gameplay history or playback binding is introduced.

The activation container `594831512` retains `bIsContinuous=1`, `sLoopCount=0`, transition time 200 and transition mode 4 (source label SampleAccurate). Its single master is not evidence that the continuous container should become a looping AudioBufferSource. The activation Stop event preserves ordered Stop `1144857` targeting that container, followed by Play `649502302` targeting separate tail container `607705804`. The stop duration is 200 ms, curve 6 (Exp1).

Missile launch and hit use separate three-master containers. Their Stop actions retain 500 ms Exp1 and 1,000 ms Log1 respectively. Cast uses another three-master container. Actor ancestry runs through W mixer `577453666`, then shared spell mixer `353175404`; it differs from the Q/E local mixer. Source gains, pitch/range omissions, playlists, voice limits, positioning and attenuation remain in unflattened scalar rows. A Stop descendant closure describes affected media, not clips played by Stop.

The producer verifies both immutable source hashes and records its own SHA. Cache-free normal and optimized guard runs reproduce the record and reject missing/changed output, leaf/parent symlinks, altered graph bytes and missing decoded metadata. Native continuous-container scheduling, dispatch conditions, inheritance, global bus/listener behavior and virtualization remain unverified. Any later controller needs its own explicit policy and gameplay baseline.
