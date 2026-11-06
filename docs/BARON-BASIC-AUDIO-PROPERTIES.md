# Baron candidate attack audio properties

The derived reading preserves all scalar fields for 16 relevant action, sound,
container, parent mixer and attenuation nodes from the immutable numeric graph.
It retains playlist order, range modifiers, positioning, voice limits and flags.
Normal and optimized regeneration checks pass. No runtime audio is bound.

Candidate cast action368143698 has DelayTime200 and targets the two-media
container1016434090. Action309000490 has Probability35 and targets the four-media
container723497964. Both containers specify MakeUpGain−14 and shuffle with
avoid-repeat count1. The actions are not unconditional simultaneous layers;
the earlier candidate summary has been corrected.

Candidate hit container128610958 specifies MakeUpGain−12 and Pitch−500, with
two entries, shuffle and avoid-repeat count1. Playlist weights are50000 per
entry in all three containers; the using-weight flags remain in the record.

All three containers inherit mixer312946903. It references attenuation298947283
and external bus2770764924. The local attenuation node is retained. The external
bus remains unresolved; local gains do not establish the final native mix.
DelayTime is relative to event dispatch, whose native gameplay timing is still
unknown. No native shuffle/RNG or listening parity is claimed.

Record: [source properties](reference/baron-basic-audio-properties.json).
Check: `python tools/assets/read-baron-basic-audio-properties.py --check`.
