# Ahri death and respawn source audio

## Frozen lifecycle reading

`read-ahri-lifecycle-audio.py` reads the immutable SFX graph and decoded metadata, preserving three events, two Play actions, one Stop action,12 nodes and two unique masters /1,546,020 WAV bytes. Death Play targets889858872/master357887993, with container gain−12 and a3.8795691609977325-second master. Respawn Play targets451024335/master1057065243, with gain−9 and a4.8842176870748295-second master. Both are finite step containers. The death Stop affects889858872 and declares5000 ms Linear; its descendant master is an affected closure, not a new playback.

Actor693628260 declares priority55, attenuation687014649 and unresolved global bus2232828494. Its stored three-point dB table is(0,0,Constant),(1350,0,Linear),(2412,−1,Linear). This actor is distinct from spell and attack roots even though its attenuation points match the attack table. Source identity, omitted gain/pitch properties, playlist order, caps and action timing remain unflattened.

Normal/optimized six-probe guards reproduce the reading without private banks, tools or caches and reject missing/changed output, leaf/parent symlinks, changed graph bytes and missing decoded metadata. Native death/respawn/Stop callback timing, global playlist state, inheritance and listener/bus calibration remain unverified. No lifecycle runtime masters, saved history or playback binding is added; attack delivery remains isolated.
