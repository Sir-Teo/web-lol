# Baron candidate basic-attack float masters

Eight candidate cast/hit WEMs decode to 2,096,892 bytes of mono 44,100 Hz
IEEE float32 WAV masters. The pinned vgmstream/Ogg/Vorbis sources, built binary,
static libraries and compiler identity are recorded alongside every encoded,
WAV and PCM hash. Fresh temporary decoding checks frame counts, channel layout,
finite samples and exact extents before comparing the frozen record.

The highest decoded sample magnitude is 1.3630971908569336. These are float
masters: samples above unity are retained. No gain, normalization, resampling,
downmix, fades or loop expansion is baked in. Playback must account for headroom.

Normal and optimized checks and a fresh restore pass. Six rejection probes
cover corrupt, missing and symlink masters in both Python modes. The files remain
in ignored private cache; no public asset or runtime binding has been added.
Candidate labels remain hash-derived. Native dispatch, timing, shuffle, global
routing/mix and listening parity remain unresolved.

Evidence: [decoded record](reference/baron-basic-audio-decoded.json) and
[verification receipt](reference/baron-basic-audio-decode-verification.json).
Regenerate/check with `PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python
tools/assets/decode-baron-basic-audio.py --check` from the repository root.
