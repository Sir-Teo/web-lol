# Ahri basic-attack source audio

## Frozen event/property reading

`read-ahri-aa-audio.py` reads the immutable Ahri SFX graph and decoded metadata, retaining twelve named events, nine Play actions, three Stop actions,42 nodes and twelve unique masters /2,050,764 WAV bytes. The ordinary, alternate and critical event names retain distinct event/action identities but target the same three cast/missile/hit containers:367977750/276401545/768158277. Each contains four source sounds. Stop descendants identify the affected missile closure rather than clips played by Stop.

Cast declares gain−12, pitch200 and its separate modifier; missile declares gain−15 and hit−11.5. Container caps are2/4/2. All three missile Stops declare100 ms Linear. Raw playlist order, loop/mode flags, priority and actor ancestry remain separate from any future local playback policy.

Attack mixer362837995 inherits actor91257365, whose priority56, attenuation134343538 and unresolved global bus211064428 differ from spell audio. The stored three-point dB table is(0,0,Constant),(1350,0,Linear),(2412,−1,Linear); it must not inherit the spell attenuation table. Native listener/bus calibration, global playlist state, attack event dispatch and stop timing remain unverified.

Normal/optimized cache-free guards reproduce the exact reading and reject missing/changed output, output/parent symlinks, changed graph bytes and missing decoded metadata. No attack runtime masters, saved history, gameplay or playback binding is added. Passive playback delivery remains isolated and retains its own evidence.
