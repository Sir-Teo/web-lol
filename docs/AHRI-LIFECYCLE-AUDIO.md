# Ahri death and respawn source audio

## Frozen lifecycle reading

`read-ahri-lifecycle-audio.py` reads the immutable SFX graph and decoded metadata, preserving three events, two Play actions, one Stop action,12 nodes and two unique masters /1,546,020 WAV bytes. Death Play targets889858872/master357887993, with container gain−12 and a3.8795691609977325-second master. Respawn Play targets451024335/master1057065243, with gain−9 and a4.8842176870748295-second master. Both are finite step containers. The death Stop affects889858872 and declares5000 ms Linear; its descendant master is an affected closure, not a new playback.

Actor693628260 declares priority55, attenuation687014649 and unresolved global bus2232828494. Its stored three-point dB table is(0,0,Constant),(1350,0,Linear),(2412,−1,Linear). This actor is distinct from spell and attack roots even though its attenuation points match the attack table. Source identity, omitted gain/pitch properties, playlist order, caps and action timing remain unflattened.

Normal/optimized six-probe guards reproduce the reading without private banks, tools or caches and reject missing/changed output, leaf/parent symlinks, changed graph bytes and missing decoded metadata. Native death/respawn/Stop callback timing, global playlist state, inheritance and listener/bus calibration remain unverified. No lifecycle runtime masters, saved history or playback binding is added; attack delivery remains isolated.

## Isolated master and graph stage

The branch stages two unchanged mono44.1 kHz float masters plus the generated graph: three outputs /1,550,648 bytes. The publisher retains both finite playlists, zero instance declarations, gains−12/−9, actor priority55, distinct attenuation/bus identity and the separate5000 ms Linear death Stop. No positive native instance cap or Stop callback clock is invented.

All five source/property/master checks and TypeScript pass. Normal/optimized six-probe publication modes reject a conflict in the final graph before writing either master, corrupt output, leaf/parent symlinks and changed input, using committed identical masters without private decoder caches. No lifecycle history, timing policy or playback is bound. Attack delivery remains isolated.

## Independent lifecycle gameplay baseline

The producer verifies all597 frozen source/QA files from the actual schema173 / `2ba54634` World and executes it directly. Ten guarded scenarios yield228 complete projections, retaining attack/P/R/W/Q/E history and excluding only schema/ruleset and proposed lifecycle history. Cases cover levels1/18, death during attack windup/released flight, Q/W/R/Essence activity, two genuine lives and hidden death followed by visible respawn. Actual death timestamps, scheduled timers, return at the exact spawn, full health/mana and completed life counts are asserted. Sampling includes both finite master boundaries and real respawn deadlines.

All15 baseline/assets/respawn/death-scaling checks and TypeScript pass. Source stage `5885298` separately passes cache-free CI:374 tests in49 files,30 Python modes and32 commands with reused dependencies. Lifecycle history and playback remain unbound.

## Local finite profiles

Four publication outputs /1,550,830 bytes now include independent finite bounds:233 ticks for death,294 for respawn and300 for the declared source death Stop. Python and TypeScript ancestry derivations agree. Both gains and zero pitch omissions remain explicit.

The source instance declarations stay zero. A separate local ceiling of16 voices per cue bounds private fixtures while exceeding a standard ten-player roster; it makes no claim about native zero/inheritance semantics. The source5000 ms Linear death Stop keeps its event/action/target identity without a local callback clock. Finite masters finish naturally under this local policy.

All18 scoped checks, TypeScript and both normal/optimized six-probe publication modes pass. Final-table preflight prevents partial master writes. Lifecycle history/playback remain unbound.

## Saved death and actual respawn dispatch

Isolated schema174 adds optional nonempty `ahriLifecycleAudio` groups keyed by the existing transient death-feedback ID. Death captures source/level, position, exact feedback audience and the already-scheduled respawn deadline. The group remains silently pending after the finite death master ends, then captures the actual respawn position/audience. Level gain while dead does not rewrite the frozen timer. Match settlement closes waits without inventing a respawn or source Stop callback. No World ID or RNG draw is added.

Strict restore checks identities, owner/level, source death-timer calculation, pending corpse/timer links, canonical audiences, actual respawn chronology, map spawn position and finite tails. Existing death-event IDs join the reserved identity check. Empty history is omitted. Historical scenario helpers, producers and expected hashes stay unchanged; their current-side comparisons remove only the newly introduced lifecycle presentation field.

Seven history cases cover every-frame dead-wait/respawn/tail futures, maximum-level waiting, hidden death versus visible spawn, immediate second death with an older respawn tail, posthumous progression, three victory phases and malformed pending/completed records. All394 scoped cases in54 files,228 independent lifecycle projections and prior family baselines pass; fourteen archived-state comparator tests and TypeScript pass. Full/cohort verification follows. Lifecycle playback remains unbound, including the source five-second death Stop callback.
