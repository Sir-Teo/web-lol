# Fox-Fire source audio reading

The frozen Ahri SFX graph joins seven stored W event names to five Play and three Stop actions. The raw reading retains 34 nodes and eleven decoded masters (2,974,908 WAV bytes). It uses the existing pinned graph and decoded corpus; no new decoding, runtime assets, gameplay history or playback binding is introduced.

The activation container `594831512` retains `bIsContinuous=1`, `sLoopCount=0`, transition time 200 and transition mode 4 (source label SampleAccurate). Its single master is not evidence that the continuous container should become a looping AudioBufferSource. The activation Stop event preserves ordered Stop `1144857` targeting that container, followed by Play `649502302` targeting separate tail container `607705804`. The stop duration is 200 ms, curve 6 (Exp1).

Missile launch and hit use separate three-master containers. Their Stop actions retain 500 ms Exp1 and 1,000 ms Log1 respectively. Cast uses another three-master container. Actor ancestry runs through W mixer `577453666`, then shared spell mixer `353175404`; it differs from the Q/E local mixer. Source gains, pitch/range omissions, playlists, voice limits, positioning and attenuation remain in unflattened scalar rows. A Stop descendant closure describes affected media, not clips played by Stop.

The producer verifies both immutable source hashes and records its own SHA. Cache-free normal and optimized guard runs reproduce the record and reject missing/changed output, leaf/parent symlinks, altered graph bytes and missing decoded metadata. Native continuous-container scheduling, dispatch conditions, inheritance, global bus/listener behavior and virtualization remain unverified. Any later controller needs its own explicit policy and gameplay baseline.

## Isolated master and graph stage

The separate Fox-Fire branch stages eleven unchanged mono 44.1 kHz float masters and a generated graph: twelve outputs / 2,989,821 bytes. Five containers retain loop/continuous flags and explicit transition times/modifiers; eleven sound rows, two mixers, seven events and ordered actions stay separate. No finite retention timing is generated for the continuous activation container. No playback or saved history is bound.

All fourteen asset/property tests and TypeScript pass. Normal/optimized whole-closure publication guards each pass six rejection probes, including a conflict in the final graph output before any earlier master is written, corrupt masters and leaf/parent symlinks. Fixtures use identical committed masters without private caches. CI includes source reading and publication guards in both Python modes.

## Independent gameplay baseline

The reference producer verifies all 568 archived source/QA files and executes the actual frozen schema-169 World from the Q-history cohort (`f77814b` / `1b65f941`), with the original Node/V8 runtime. Eleven scenarios yield 132 complete state projections, excluding only schema/ruleset and the proposed Fox-Fire audio history. Existing Q and Charm histories stay included. Cases cover three hits, miss/expiry, priority targeting, hidden-target reveal, death before/after release, target loss, a moving target reaching the flight deadline, caster movement, overlapping casters and accepted post-release Flash.

Explicit fixture assertions verify those paths, including an active flight late in the deadline case and actual Flash displacement. The reveal case's longest shot is still travelling at tick 60, so its all-three-contact assertion uses the retained tick-120 checkpoint. No gameplay timing was changed. All 33 scoped checks (fourteen assets, eighteen W mechanics, one 132-sample comparison) and TypeScript pass. Helper/producer hashes are locked to the reference before audio history work begins.

A clean checkout of source stage `ca7e3bc` passes TypeScript, 143 audio CI cases in nineteen files and fourteen Python guard modes with no private caches/tools. Dependencies are reused from the parent installation; remote CI is not dispatched. The updated CI selector additionally includes the W mechanics and independent gameplay baseline.

## Log1 envelope preparation

The retained hit-stop action uses curve 2 (Log1), distinct from Exp1. A new producer directly executes the pinned external wwiser interpolation routine for 45 evaluations and records source/producer hashes. The application helper now supports that curve, while the earlier 90 Linear/Exp1 evaluations remain unchanged. Shared finite-envelope scheduling uses exact Linear endpoints and piecewise original-domain Log1/Exp1 curves.

All 164 scoped CI cases in 22 files, 97 Node QA checks and TypeScript pass. A separate native Web Audio fixture renders twelve full, late-seek, early-stop and naturally truncated cases across all three curves; maximum error is below 1e-5 and output is zero after each finite end. The empty browser fixture imports only the envelope module and does not boot the game. External-reader arithmetic and local scheduling do not certify native dispatch or mix. In particular, the source hit-stop action remains distinct from natural clip completion; its gameplay dispatch clock is not assigned by this preparation.

The updated baseline selector also passes 162 tests in 21 files from a clean detached checkout. `reference/ahri-fox-fire-source-stage-verification.json` pins the distinct source, baseline and Log1 checks; their revisions remain separate.

## Local profile and finite-tail bounds

The publisher now additionally generates a separate timing table: thirteen outputs / 2,990,062 bytes. The finite cast/launch/hit/tail maxima are 123/70/65/82 ticks under the explicit local additive ancestry and slowest pitch policy. Activation remains continuous with no natural maximum; its explicit stop fade is twelve ticks. The separate launch/hit Stop metadata retains thirty/sixty ticks, with hit-stop dispatch still unassigned.

Five local profiles preserve gains, caps, pitch bases and modifiers independently of the raw graph. The activation profile has a null finite bound and retains its single full source master. The stop-tail profile selects the second Play action in the ordered activation Stop event. Three profile checks independently compare Python retention bounds with TypeScript derivation; all 36 scoped source/policy/gameplay checks, TypeScript and both six-probe publication modes pass. No saved history or playback is bound yet.
