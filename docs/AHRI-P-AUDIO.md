# Essence Theft source audio reading

The frozen Ahri SFX graph joins four stored passive event names to four Play actions. The reading retains 23 nodes and five unique decoded masters (1,279,504 WAV bytes). No Stop or Reset actions are selected. It uses the existing immutable graph and decoded corpus; no new decoding, runtime assets, saved history or playback binding is introduced by this reading.

Missile launch and hit each keep one master. The two buff-activation branches each retain three sound nodes and share the same three media IDs:158983157,282828401 and704313670. Shared WAV identity does not merge their sound/container identities or properties. The generic passive-missile buff branch has−8 dB MakeUpGain; the explicitly named minion-heal branch has−12 dB. Missile launch is−15 dB and hit−12 dB. Actor ancestry runs through mixer595867950 and shared spell mixer353175404.

Raw playlists, pitch/property omissions, limits, positioning and attenuation remain unflattened. Event names alone do not establish native Essence spawn, contact, healing or minion-counter callback timing. A future local binding must distinguish those choices. Native dispatch, listener/bus behavior, inheritance and virtualization remain unverified.

The producer pins both frozen input hashes and records its own SHA. Cache-free normal/optimized checks reproduce the record and reject missing/changed output, leaf/parent symlinks, changed graph bytes and missing decoded metadata. Shared-media IDs are explicitly checked while every sound node remains separate. This preparation is isolated from accepted W and the ongoing R delivery checks.

## Isolated shared-master stage

The passive branch stages five unchanged mono44.1 kHz float masters and a generated source table: six outputs /1,290,292 bytes. Eight distinct sound rows retain four container identities and two local mixers while sharing the three heal WAVs. Publication deduplicates only identical media bytes; it keeps each sound's parent and properties separate. No timing, history or playback is bound yet.

All nine asset/property tests, TypeScript and both normal/optimized whole-closure guard modes pass. Six rejection probes per mode cover final-output conflict before any earlier WAV is written, corrupt output, leaf/parent symlinks and changed source bytes. Cache-free fixtures use the committed identical masters. CI includes source reading and publication guards in both Python modes.

## Independent gameplay baseline

The reference producer verifies all583 frozen source/QA files from the actual schema171 / `c5d6be5a` World. Ten guarded scenarios yield120 complete projections, retaining R/W/Q/E histories and excluding only schema/ruleset and proposed passive audio history. Cases cover ninth minion/monster kills, champion consumption, partial/full overheal, death in flight, moving owner, captured AP, eight kills without a birth and the actual R extension. Terminal assertions retain observed consumption before the existing30-tick gameplay history expires.

All20 baseline/mechanics checks and TypeScript pass. Source-stage `bd9ea69` separately passes cache-free CI:284 tests in35 files and22 Python guard modes. No passive audio history or playback is bound.

## Local finite profiles

Four source profiles retain launch/hit/orb-buff/minion-heal gains−15/−12/−8/−12 and four voices per container, with zero pitch omissions preserved. The two healing profiles share three unchanged WAVs while keeping separate source sound identities. Independent Python and TypeScript ancestry derivations agree on109/56/102/102 finite ticks. No passive source Stop action exists or is invented.

The publication closure now has seven outputs /1,290,479 bytes. Both six-probe normal/optimized guards preflight the final timing table before writing any master. All31 source/policy/baseline/mechanics checks and TypeScript pass. Native global playlist state and event dispatch remain unverified; no passive history or playback is bound.

## Saved Essence audio dispatch

Isolated schema172 adds optional nonempty `ahriPassiveAudio` records using the existing Essence ID, owner, victim and kind. Birth captures origin/audience; homing updates position; consumption/death/deadline and match settlement close the record. Immediate death and direct Essence advancement hooks preserve saves before the next World step. No World IDs, RNG draws, healing, counter or R-extension logic change.

Local dispatch assigns launch to both traveling kinds, champion consumption to hit plus orb-buff activation, and minion consumption to its separate healing event, including full overheal. This is an explicit local event policy; native script dispatch remains unverified. Finite launch clips finish naturally because the source declares no Stop. Arrival tails survive gameplay pruning, and active records remain through pursuit even after the launch master finishes.

Strict restore checks owner/victim identity, global IDs, canonical audiences, chronology, pursuit geometry, live Essence links, terminal reasons and finite-tail expiry. Seven history cases cover both kinds every frame, independent birth/contact vision, overheal, immediate death, pruning, four victory phases, malformed active/completed saves and pursuit expiry. All38 focused checks and TypeScript pass, including120 passive projections and210 existing R projections. The frozen R reference/producer/helper stay unchanged; its current-side comparison excludes only the new passive presentation field in addition to its original exclusions. Full/cohort verification follows; playback is unbound.

## Frozen history verification

Runtime `4b9aac2`, schema172 / `29c2a12a`, passes8,661/8,663 full-suite cases in498 files with only the two historical failures. Test-only `a5fcb1e` updates the strict schema assertion to172. The first broad run also hit a lane-clock timeout under concurrent load; its unchanged follow-up and authoritative full v2 pass. All138 Node QA cases pass. Clean CI at `a5fcb1e` passes TypeScript,294 cases in38 files and22 Python guard modes without private caches/tools; its first concurrent run timed out in unchanged R restoration, and v2 passes.

The frozen590-file roster archive finishes naturally Blue at157,116, with44 exact restores,43 future checks and2,580 future ticks. All45 archived projections match `c5d6be5a`, retaining R/W/Q/E histories. Source extents/hashes, runner, inputs, reports and snapshots verify. See `reference/ahri-passive-history-verification.json`; this evidence is not relabeled to later playback or the older hundred-seed baseline. Playback remains a separate branch.

## Local finite playback

The isolated playback branch lazy-loads five unique PCM masters, deduplicating the three shared healing clips before fetching/decoding while preserving eight source sound identities and four event profiles. Launch follows the saved moving Essence point; arrival stays at captured consumption. Champion arrival dispatches hit plus orb-buff, minion arrival its separate healing profile. Death/deadline/terminal cancellation does not create a healing cue. Source finite launch masters finish naturally; no source Stop or fade is invented.

Cosmetic variants are deterministic per Essence/event without World RNG. Source gains/attenuation feed a local0.2 mix. Four per-container voice caps retire oldest observed voices; finished/stolen voices remain suppressed. Mute/suspend releases nodes, resume seeks the original finite sample offset, and world replacement/rewind resets ownership. The shared terminal clock drains finite tails without changing a winning World. Existing generic heal events have no synthesized tone, so no fallback event tagging or simulation mutation is needed.

All305 scoped cases in40 files, TypeScript and build pass. Eleven new state/controller checks cover finite boundaries, independent audiences, shared media/gain ownership, failed-resource retry, mute/seek, caps, ended suppression and terminal draining. Three browser cases verify real keyboard Q champion and ninth-minion kills, actual healing, both arrival dispatches, five exact PCM masters/five requests, mute/resume/restore, pruned gameplay history and no-Ahri zero downloads. Both contact screenshots were reviewed. Software Chromium provides functional evidence only. Full combined-browser/production/offline acceptance follows this implementation commit.

## Verified playback delivery

Application `0ee4ffc`, schema172 / `780b914f`, passes8,672/8,674 full-suite cases in500 files with only the two historical failures. All138 Node QA cases, clean305-case CI in40 files, TypeScript and22 Python guard modes pass. Sixteen combined browser cases verify61 exact Ahri PCM masters, including five unique passive masters, real keyboard champion/ninth-minion kills, healing, mute/seek and restoration after gameplay pruning. Production subdirectory and offline lifecycle pass with978 service-worker responses and zero production errors. Pack `f31b3721` contains1,313 files /570,486,751 bytes. All archived simulation/content bytes match frozen `29c2a12a`; its45 roster projections retain their scope. Native dispatch/global playlists/mix remain unverified. Basic-attack preparation is isolated. See [acceptance](reference/ahri-passive-playback-acceptance.json).
