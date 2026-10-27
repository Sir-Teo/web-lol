# Ahri development bot progression

Development Ahri NPCs now spend legal skill points and use the existing mage
shopping path. Previously an AI-marked Ahri retained every point and fell through
to the physical-item shopping path. This step provides progression for the
future Ahri role bot; tactical spell selection remains unfinished.

The local policy opens Q, E, W, Q, Q, R and then prioritizes R, Q, W, E through
the ordinary learning validator. It reaches Q5/W5/E5/R3 by level 18 and respects
the level-six/eleven/sixteen ultimate gates. It does not create Ashe Hawkshot
charges. A dead AI can allocate accumulated points without being resurrected.
The human Ahri player keeps manual learning and purchasing.

Ahri uses the existing mage component/recipe transactions: Tome and boots,
Lost Chapter, Deathcap and Wand. Purchases consume owned components once and
stop at this bounded build. Existing gold, fountain, affordability and inventory
capacity checks still apply. This is local development tuning, not a recovered
native bot build or a complete six-item strategy. Lux's policy and shopping path
retain their prior behavior.

Ordinary production selection and roster remain Ashe/Lux. The Ahri practice and
human Rift trial retain their trusted host/save boundaries, and the Rift trial
still has nine Ashe/Lux bots. This step does not add Ahri to that bot roster,
implement tactical Q/W/E/R decisions, change spell controllers, alter public
assets or certify native presentation. Saved state layout remains schema 163;
the rules fingerprint changes under the existing same-build save policy.

Seven new checks cover both team orientations through level 18, bounded mage
purchases and component consumption, unaffordable purchases, exact saved
learning/shopping futures, learning while dead, and manual human/admission
boundaries. All 72 focused checks pass, including existing Ahri player/Rift,
learning and Lux/Leona/shopping regressions. TypeScript passes.

One old Q test intentionally expected the now-replaced AI point-retention
behavior. The retained first run passes 21 cases and fails that assertion. The
updated case requires AI Q learning, zero Hawkshot charges and explicit legal
allocation of a later point. Human manual control has separate coverage.

The full unit run passes **3,405/3,407 tests across 404 files**. Only the two
unchanged baseline failures remain: missing original Leona Eclipse evidence
files and the host-sensitive Lux missile golden digest. Their original
assertions remain. All 29 Node QA checks and the production build pass. The
nested-path production smoke passes with all 32 recordings, development entry
gates, real casts, save/restart, ward/companion/Oracle flows and no page errors.
No new development browser cases were run for this simulation-only change;
the human practice/Rift UI retains its earlier browser acceptance, with its
manual-control and saved-future behavior rechecked in the focused unit run.

The full offline audit passes with 978 service-worker responses and zero
production errors, including integrity/retry, network-disabled restore, a new
Lux lane match and atomic version activation. All 1,125 source asset/data file
sizes and mtimes remain unchanged. The accepted pack is
`691ca564ab73a842254e2c1808c39224e76b4874ea0cda7b20c01625c0f35738`
(1,202 files / 538,093,581 bytes); rules fingerprint:
`1c157c003ae34059e931ff6a3409eb6896195e906f6104af9c25b1ee50c26bcd`.
Source, build and evidence hashes are retained in
[the verification ledger](reference/ahri-bot-progression-verification.json).
