# Unfinished ordinary match: exact continuation

The ordinary seed-2 game reaches its original 60-minute horizon without a
winner. A separate diagnostic imports that exact final save and lets ordinary
rules continue. Red wins at tick **217,745 (60:29.083)**, after **1,745 added
ticks**. The Blue Nexus is the only additional destroyed structure. This
single result supports a late natural finish, rather than a permanent stall.
It does not establish the behavior of other unfinished seeds.

The original 60-minute cohort result remains **unfinished**, with no winner.
Neither its report nor its final save is replaced. A byte comparison against
copies taken before the diagnostic confirms both remain unchanged. This is
not an additional seed or a hundred-seed acceptance result.

## Scope and reproducibility

The continuation compiles the cohort's archived simulation source at revision
`a3e47aa48b3cd0f6089c0077f328a26df0b127f6`, under fingerprint
`abc8dc664ed97c0f0cfac64e4eb52b43dbbc593884a6896a47b1e8e0d34bd04f`.
It imports the schema-163 save using a fresh ordinary Rift terrain. The save's
random state, automated human, roles, economy, structures and orders remain
intact. There are no new orders, reseeding, timing changes or forced winners.
The requested diagnostic horizon is 80 minutes; ordinary victory ends it early.

The entry is a recorded transformation of the archived `match-seed.ts`. Only
initialization, diagnostic report fields, absolute frozen imports and the
initial checkpoint are changed. The original contract still checks every
added tick for finite bounded resources/economy and independently exposed
structures before health loss. Its minute/boundary checks produce two exact
round-trips and one exact saved future covering 60 ticks. Winning state is
frozen across another 120 requested ticks.

A separately compiled verifier checks all archived source, map, runner and
origin hashes, strictly decodes every checkpoint and compares report counts.
It then independently replays all 1,745 ticks from the original save, checks
resources and victory on every tick, observes protected-structure damage,
and reproduces the exact final state and damage/destruction records. The
terminal freeze check also passes independently. Node/V8 identity is pinned.
The verifier does not mutate the original corpus or trust its final winner
without replaying the added interval.

## Retained local evidence

The ignored artifact directory is
`artifacts/certification-abc8dc/ordinary-seed2-80m/`. It contains the preparation
script, generated runner source and bundle, origin copies, map copies, source
manifest, checkpoint/result files, independent verifier source/bundle and
verification report. Source archives remain in the frozen ordinary corpus.
The compact [verification ledger](reference/unfinished-match-continuation-verification.json)
pins the relevant files and logs. Absolute paths in these local manifests
identify this execution workspace; they are not published URLs.

The two original 100-seed audits continue against their frozen source, with
recorded pauses for earlier browser checks. Their elapsed wall times are not
uninterrupted performance measurements. This diagnostic does not change
simulation source, application build, offline pack, public assets or saves.
Earlier browser, broad-test, Node QA and native-source results retain their
own scope; no fresh run of those suites is claimed here.
