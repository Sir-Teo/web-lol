# Allied bot intent in the scoreboard

The 5v5 scoreboard now shows a short current plan beneath each allied bot's
role: Defending, Pushing, Ganking, Contesting river or Advancing. A real recall
channel displays Recalling, and retreat takes priority over an older job.
Labels clear when the job expires or is removed. Dead allies, human-controlled
slots, practice and finished matches have no automated intent label.

The projection reads only a living AI ally's owner record and friendly team
plan. It rejects opponents before reading either, including when an enemy is
visible. It uses the captured assignment and never resolves its target's live
position, health or order. Plans can still be preempted by combat and path
safety. Displaying them does not add orders or change bot decisions.

Five boundary tests pass, including a throwing opponent-plan/owner getter,
exact expiry, manual and QA-human exclusions, recall/retreat priority and
unchanged snapshots. TypeScript, formatting and build pass. The browser scenario
passes four simultaneous friendly plans, a real queued NPC recall, live label
changes/removal, an explicitly visible opponent without a plan label, exact
real Save/reload and reviewed 1440×900 / 1024×720 layouts. The smaller layout
stays inside its viewport without horizontal overflow.

Four existing scoreboard browser cases pass death/respawn, item focus, live
record updates and observed enemy stats. The mixed portrait case's original
30-second timeout reproduces on unchanged commit `c0d50c1`. Its final fixture
stops only the animation loop while retaining normal Tab input, all original
portrait/summoner/name/item/layout assertions and the same deadline; it passes
in 11.6 seconds. Both baseline and candidate failures remain retained. A paused
attempt correctly blocks Tab, and batched reads still reach the time budget;
those unsuccessful fixture attempts are preserved separately.

This is a display-only change. Schema stays 163 and rules fingerprint stays
`abc8dc664ed97c0f0cfac64e4eb52b43dbbc593884a6896a47b1e8e0d34bd04f`.
The preceding [seven-game audit](BOT-TEAM-DETOUR-MATCHES.md) retains that same
simulation identity. Its 3,560/3,566 broad test result and 39 Node QA checks
remain preceding evidence; this UI step claims its five targeted cases and
six verified browser scenarios without labeling a new broad run. No public
assets or save fields change. Nested-path production passes all 32 recordings
and development gates, including the exactly-Ashe/Lux public chooser. Matching
pack `dae2505815d5c0c14a45e155ec36c0746048f1ae6f866092a5e842e17c37ac77`
contains 1,202 files / 538,108,050 bytes. No fresh headless match or offline
acceptance is claimed for this display-only step. See the
[verification ledger](reference/allied-intent-verification.json).
