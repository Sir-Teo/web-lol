# Private Ahri base SFX float masters

All 83 embedded SFX media decode to **28,374,812 bytes** of mono 44.1 kHz IEEE
float32 WAV masters. The exact decoder binary, static codec libraries, source
revisions and compiler match the existing frozen toolchain. The Baron decoder
record anchors the tools only; it supplies no Ahri event semantics.

Maximum sample magnitude is **1.3226501941680908**. Source headroom remains intact;
no gain, normalization, fades, resampling or downmix is baked in. Base spans decode
without loop expansion. None reports embedded WEM loop metadata; hierarchy and
event repetition remain separate source properties.

The shared float parser checks RIFF/chunk extents, codec, rate, channels, frame
alignment, finite samples, PCM/WAV hashes, peak and RMS. Its cache-independent
format tests reject eight invalid inputs in both Python modes and preserve
stereo 48 kHz headroom. It also reproduces every measurement of the eight existing
Baron runtime masters. Existing frozen producers remain unchanged.

Normal and optimized corpus checks, fresh restore, twelve isolated destination/
record rejection probes and a post-probe original-cache check pass. All 70 Node
QA checks pass. The masters remain under ignored .cache/ahri-audio-decoded-v1;
no Ahri runtime assets or playback are added. Native dispatch, playlist state,
global mix and listening parity remain unresolved. The running roster cohort
keeps its original ruleset.

[Decoded record](reference/ahri-audio-decoded.json) ·
[verification](reference/ahri-audio-decode-verification.json).
