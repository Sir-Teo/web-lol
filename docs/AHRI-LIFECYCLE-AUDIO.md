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

## Frozen lifecycle history verification

Runtime `9307043`, schema174 / `d1e66691`, passes8,732/8,734 full-suite cases in510 files with only the two historical failures. All173 Node QA cases pass. Clean CI passes TypeScript,394 cases in54 files and30 Python guard modes without private caches/tools, across32 commands.

The frozen604-file roster archive finishes naturally Blue at157,116, with44 exact restores,43 future checks and2,580 future ticks. All45 projections match `2ba54634`, retaining attack/P/R/W/Q/E history. Source hashes/extents, runner, inputs, reports and snapshots verify. See `reference/ahri-lifecycle-history-verification.json`; this evidence is not relabeled to playback or the older hundred-seed baseline. Lifecycle playback proceeds separately.

## Local finite lifecycle playback

The playback branch lazy-loads two unchanged masters. Death stays at its captured point; actual respawn follows the current owner with the saved spawn point as fallback. A silent pending death group never loops or extends the finite death master. The source five-second death Stop remains callback-unbound; terminal closure does not invent a Stop action. Raw zero instance declarations remain separate from the explicit local16-voice ceiling per cue.

Source gains and lifecycle attenuation feed a local0.2 mix. Ended/stolen sources stay suppressed, mute/resume seeks original sample phase, world replacement/rewind resets ownership, and the shared terminal clock drains finite death/respawn tails without changing victory. Generic death/heal events have no synthesized tone, so no fallback event tagging or gameplay mutation is needed.

All406 scoped cases in56 files, TypeScript and build pass. Twelve state/controller cases cover silent waiting, independent birth/current visibility, finite offsets, actual return eligibility, local ceilings, failed-resource retry, owner resets and terminal draining. Three browser cases verify combat death from an actual NPC attack, the real scheduled respawn after a silent wait, two exact PCM masters/two requests, mute/resume/restore, hidden death becoming visible without replay and independently audible enemy respawn, plus no-Ahri zero downloads. Three screenshots were reviewed. Software Chromium is functional evidence only. Full/combined-browser/production/offline acceptance follows this implementation commit.

## Playback acceptance

Application `8671be1`, schema174 / `617100a7`, passes8,744/8,746 full-suite cases in512 files, with only the two historical failures. All173 Node QA cases and cache-free CI (406 cases /56 files, TypeScript,30 Python modes /32 commands) pass. Twenty-two combined browser cases cover all seven Ahri families and the generic envelope. Production passes with zero lifecycle preloads and no development hook; offline passes with978 service-worker responses and zero errors. Three lifecycle screenshots were reviewed.

Pack `94853da0` contains1,329 files /574,118,545 bytes and passes all file/worker audits. The604-file frozen source comparison changes only the fingerprint collector, adding two playback modules; every archived simulation/content byte remains unchanged. See `reference/ahri-lifecycle-playback-acceptance.json` and its source delta. Frozen history and hundred-seed results retain their original scope. Recall preparation remains isolated.
