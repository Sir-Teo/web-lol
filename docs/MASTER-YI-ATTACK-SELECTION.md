# Source-declared ordinary attack choices

The private Yi controller supports both ordinary source poses, trails and audio
cues. The character's default slot and first extra slot explicitly author weights
of 0.5. The latter names `MasterYiBasicAttack2`; the other extra slots name
`MasterYiBasicAttack` and `MasterYiDoubleStrike` while omitting weights. Those
omissions stay distinct from zero and contribute no invented selection weight.

A stable indexed cosmetic hash of actor ID and accepted start tick chooses
between the two supported ordinary poses using those declared weights. An
already determined combat critical selects Crit. Native PRNG state, graph
transitions and exact slot dispatch remain uncalibrated. Selection consumes no
combat random value or entity ID and changes no windup, contact, damage, cooldown,
critical-roll or Double Strike scheduling behavior.

Attack1 uses `entry_d5c55cfd`; Attack2 explicitly declares `Attack2` and uses
`entry_0d6139b0`. The default spell's animation name and default slot's attack name
remain omitted in the raw reading. Their existing Attack1 aliases stay explicit
local bindings. Both ordinary trail events use literal frame 5, indexing their
own retained rendered clocks; Crit uses frame 8. The default/event arrays match.

Attack2's complete `MasterYi_BA2_Trail` authors additive blend 4, full bind,
no culling, source offset `[0,-40,-20]`, omitted birth scale, lifetime
0.2199999988079071 and UV X rate 1.399999976158142. Its texture, common ramp and
1,500-corner native geometry already belong to the verified trail caches. The
primary table now covers four textures and all 34 authored mip levels.

The declared cast event is `Play_sfx_MasterYi_MasterYiBasicAttack2_OnCast`, with
its own action, four source masters, gain -11 dB, ±100-cent range and **55 ms**
action delay. The declared hit event has its own event/action identities while
sharing the existing four-material switch with Attack1, with zero action delay.
The original ten audio profiles retain their exact ordered values and sampling
salts; five Attack2 profiles are appended. The original 24 WAVs retain their bytes
and timestamps, and four exact float masters are added. Finite bounds remain
88 cast ticks and 51 hit ticks. No composite passive audio is inferred.

Schema 162 records `attack1`, `attack2` or `crit` on each accepted primary history.
Decoding checks deterministic ordinary identity and current cycle linkage. Body,
trail and audio use the same choice, and Save/Load preserves the exact future.
Older schemas/fingerprints remain incompatible. Root histories keep the existing
20-tick bound and current-joint visibility policy.

See the [selection reading](reference/masteryi/attack-selection-reading.json),
[verification](reference/masteryi/attack2-runtime-verification.json),
[primary trails](MASTER-YI-PRIMARY-TRAILS.md) and
[attack audio](MASTER-YI-AA-AUDIO.md). Transform, callback, sampler and native mix
calibration limits remain explicit in those readings. The public roster remains
Ashe/Lux; ordinary startup requests none of these private assets.
