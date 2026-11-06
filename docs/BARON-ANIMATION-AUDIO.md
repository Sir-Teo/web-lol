# Attested Baron animation audio names

The frozen animation source contains17audio-event occurrences using nine stored
strings. Eight unique strings hash to events in the pinned base SFX bank; one
does not. This evidence is an overlay on the immutable numeric graph, whose
skin-declared event-name list remains empty.

| Stored label suffix | Bank event | Match |
| --- | ---: | --- |
|BaronDeathBreath_cast_vosfx|664523563|Yes|
|BaronPullSpellMissile_cast|1073307821|Yes|
|BaronSpellCast6NS_cast|2922317206|Absent|
|NewSpellLivingArtillery_cast_foley|1484972021|Yes|
|NewSpellLivingArtillery_foley|1429942533|Yes|
|spawn_hands|536467164|Yes|
|spawn_out_cast_vox_reverb|1735369909|Yes|
|spawn_void|3448841052|Yes|
|BaronPullSpellMissile_end_Attack3D (Play_vo)|1915380787|Yes|

The record retains full strings, source clip/event keys, animation resources,
raw event flags and start-frame presence/value. Omitted frames remain absent;
no frame rate, default time or native dispatch is invented. Matched events retain
the numeric graph's action/media closure. The absent event has no invented
fallback or media assignment.

These names are stored source strings. The basic-attack cast/hit names remain
separate hash-derived candidates; this reading does not attest those names.
It adds no runtime playback or boss ability implementation. Native timing,
shuffle and global mix remain unverified.

The FNV reader revision and exact tracked reader bytes are checked. Normal and
optimized checks pass. Twelve rejection probes cover changed source/graph,
record/helper changes, missing readings and discovery collisions. No frozen
source, existing record or runtime asset is overwritten.

[Reading](reference/baron-animation-audio-reading.json) ·
[verification](reference/baron-animation-audio-verification.json).
