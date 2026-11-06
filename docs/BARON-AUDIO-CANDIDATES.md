# Baron cast/hit candidate labels

The candidate strings Play_sfx_SRU_Baron_BaronBasicAttack_OnCast and
Play_sfx_SRU_Baron_BaronBasicAttack_OnHit hash to original bank events
2790228445 and4168404463 with the pinned Wwise FNV reader. The source actor path,
BaronBasicAttack script/attack declaration and existing event naming convention
corroborate them. They are hash-derived labels, not attested stored event strings.
The immutable numeric graph keeps its null declared names.

The cast event has two simultaneous play actions: one two-media random container
and one four-media container. The hit event has one two-media play container.
All eight media IDs are embedded in the pinned bank. Normal/optimized candidate
checks pass; the reading pins graph, character and helper bytes.

No runtime binding or native timing is selected yet. Native dispatch, shuffle/RNG,
global bus/mix and listening parity remain unresolved. See
reference/baron-audio-candidate-reading.json and its verification receipt.
