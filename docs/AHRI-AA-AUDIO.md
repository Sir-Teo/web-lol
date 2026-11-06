# Ahri basic-attack source audio

## Frozen event/property reading

`read-ahri-aa-audio.py` reads the immutable Ahri SFX graph and decoded metadata, retaining twelve named events, nine Play actions, three Stop actions,42 nodes and twelve unique masters /2,050,764 WAV bytes. The ordinary, alternate and critical event names retain distinct event/action identities but target the same three cast/missile/hit containers:367977750/276401545/768158277. Each contains four source sounds. Stop descendants identify the affected missile closure rather than clips played by Stop.

Cast declares gain−12, pitch200 and its separate modifier; missile declares gain−15 and hit−11.5. Container caps are2/4/2. All three missile Stops declare100 ms Linear. Raw playlist order, loop/mode flags, priority and actor ancestry remain separate from any future local playback policy.

Attack mixer362837995 inherits actor91257365, whose priority56, attenuation134343538 and unresolved global bus211064428 differ from spell audio. The stored three-point dB table is(0,0,Constant),(1350,0,Linear),(2412,−1,Linear); it must not inherit the spell attenuation table. Native listener/bus calibration, global playlist state, attack event dispatch and stop timing remain unverified.

Normal/optimized cache-free guards reproduce the exact reading and reject missing/changed output, output/parent symlinks, changed graph bytes and missing decoded metadata. No attack runtime masters, saved history, gameplay or playback binding is added. Passive playback delivery remains isolated and retains its own evidence.

## Isolated master and graph stage

The branch stages twelve unchanged mono44.1 kHz float masters and the unflattened generated graph: thirteen outputs /2,065,931 bytes. Twelve event/action identities retain their shared three-container targets, including each100 ms Linear Stop. The graph keeps the distinct attack actor root, priority56, unresolved bus and three-point attenuation. No attack history, local finite timing or playback is bound.

All15 asset/property checks and TypeScript pass. Normal/optimized publication guards each pass six rejection probes, including a conflict in the final graph before any master is written, corrupted output, leaf/parent symlinks and changed input. Fixtures use committed identical masters without private decoder caches. CI includes source reading and whole-closure publication guards. Passive acceptance remains isolated.

## Independent attack gameplay baseline

The producer verifies all590 frozen source/QA files from the actual schema172 / `29c2a12a` World and executes it directly under the pinned Node/V8 runtime. Ten guarded scenarios yield120 complete projections: ordinary/critical contact, movement cancellation, owner death in windup/flight, target death in windup/flight, actual Flash during flight, moving target and a lethal champion hit followed by passive consumption. Only schema/ruleset and proposed attack audio history are excluded; existing P/R/W/Q/E histories remain included.

All36 scoped baseline/assets/development/critical checks and TypeScript pass. Source-stage `26ed1b6` separately passes cache-free CI:320 tests in41 files,26 Python modes and28 commands, reusing dependencies without private caches/tools. Attack history/playback remain unbound.

## Local profiles and finite retention

The publisher now emits a separate finite timing table: fourteen outputs /2,066,099 bytes. Independent Python and TypeScript derivations agree on88/70/43 ticks for cast/missile/hit and six ticks for the source100 ms Linear missile Stop. Each profile retains three distinct event/action aliases and shared source caps2/4/2.

The local additive ancestry policy preserves cast pitch200 plus its independent−300..+300 range. Cast master1071743868 has its own+1 gain declaration, producing local−11 against container−12; the other three cast variants retain−12. Missile and hit have no pitch declaration. This remains separate from the unflattened source graph and does not certify native inheritance or global shuffle.

All39 scoped source/policy/baseline/development/critical checks and TypeScript pass. Normal/optimized six-probe publication modes preflight the final timing table before writing any master. Attack dispatch history and playback remain unbound.

## Saved attack dispatch history

Isolated schema173 adds optional nonempty `ahriAttackAudio` records keyed by existing owner/start tick and linked to the existing projectile ID. Accepted windup captures target, release deadline, critical flag, origin and birth audience. Release captures its own origin/audience, homing flight updates the point, and swept contact closes before damage. Target loss, range exhaustion and match settlement close the source missile independently; owner death or Flash after release does not cancel it. Windup cancellation retains only the finite cast tail. No gameplay ID or World RNG draw is added.

Transient release feedback carries the existing windup identity for later source/fallback coordination. Saved records retain pending windups, live missiles and finite cast/stop/contact tails after projectile pruning. Strict restoration checks canonical audiences, ownership, unique keys/projectiles, windup and launch clocks, live projectile links, source speed/remaining travel, swept displacement bounds, actual range deadline and terminal closure.

Nine history cases cover every-frame ordinary/critical restoration, repeated faster attacks, immediate order/death saves, post-release death/actual Flash, separate launch/contact vision, pruned contacts, target loss/range deadline, five victory phases, malformed saves and transient release identity. All353 scoped checks pass, with a final20-case restoration/reference follow-up after travel validation. The immutable120-projection attack baseline still matches; the older W comparison removes the newly introduced attack presentation field on its current side without rewriting its frozen helper or expected hashes. TypeScript passes. Full/cohort verification follows; attack playback remains unbound.

## Frozen history verification

Runtime `9f2fe8c`, schema173 / `2ba54634`, passes8,700/8,702 full-suite cases in504 files with only the two historical failures. All155 Node QA cases pass. Clean CI passes TypeScript,353 cases in46 files and26 Python guard modes without private caches/tools, across28 commands.

The frozen597-file roster archive finishes naturally Blue at157,116, with44 exact restores,43 future checks and2,580 future ticks. All45 projections match `29c2a12a`, retaining P/R/W/Q/E histories. Source hashes/extents, runner, inputs, reports and snapshots verify. See `reference/ahri-attack-history-verification.json`; this evidence is not relabeled to later playback or the older hundred-seed baseline. Attack playback proceeds in a separate worktree.
