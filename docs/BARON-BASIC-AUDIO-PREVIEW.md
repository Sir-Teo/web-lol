# Local Baron candidate audio preview foundation

Eight unchanged source float masters are staged under assets/audio/baron-basic.
The exporter checks frozen property/decoder/candidate inputs and preflights all
nine outputs before writing missing files. Existing differences and symlinks
reject. Normal and optimized export checks pass. The delivery pack has not yet
been rebuilt for these assets, and no gameplay audio controller is bound yet.

The pure preview state uses saved projectile identity and launch tick for
independent cosmetic probability, variant and pitch draws. It does not consume
World RNG or IDs. Cast dispatch uses an explicit local release anchor, followed
by the source200ms delay for the two-media action. The four-media action keeps
its35percent probability. Hit uses saved contact time,−12dB makeup gain and a
−500 to+500-cent pitch modifier around zero. Cast makeup gain is−14dB.
Native event dispatch and shuffle semantics are not reconstructed.

Cue audiences are supplied separately for release and contact. States derive
sample offset from age and pitch, expire at actual sample duration and reproduce
exactly after JSON restore or record reordering. They retain no mutable runtime
state. Fifteen tests cover these policies and original float32 WAV/PCM hashes,
frame extents and over-unity samples. TypeScript passes.

The source attenuation curve is exported separately. External bus2770764924,
listener calibration and the final playback mix remain unresolved. No native
listening parity is claimed.
