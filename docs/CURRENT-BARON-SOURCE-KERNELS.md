# Current Baron source-effects and candidate-audio checkpoint

Current save schema **167**, ruleset
`7ae8e0f8513df40ceca31f52ad146bbe08b388b09163e996538133fbe600229f`.
The private encounter draws all **21 source effect profiles** (nine missile,
twelve hit) and plays **three candidate audio profiles from eight source float
masters**. Saved jaw/chest poses, complete bounded launch paths and the original
target point reconstruct effects. Audio uses explicit local release/contact
anchors and saved audiences; source delay/probability/gain/pitch fields remain
separate from local selection and mix policies.

Missed cast audio survives checkpoint reload after particle expiry. Exported
source bounds are140cast/59hit ticks; presentation and strict snapshot validation
retain every release through the cast bound. Existing125tick hit history and
312frame cap suffice. See BARON-BASIC-AUDIO-PREVIEW.md.

At application commit0fa0072, the full suite passes **8,462/8,464** tests across
468files. Only the historical missing Leona checker/archive and Lux sampler hash
gaps remain; expectations and deadlines are unchanged. The delivery checkpoint passes **66 Node QA** and **seven real-input Baron
browser cases**, including exact effect centre/tint/
UV restores, real float decoding, mute/resume, world replacement and unchanged
gameplay snapshots. Fifty-nine focused audio/history cases cover the saved tail.

Current pack
`37f029770e7940fb8bd1ac9f3270de23603d46678f27dd3df835ec1614aeae43`
contains **1,246files /554,951,561bytes**. Complete file/worker/identity audit,
named nested-prefix production and full offline lifecycle pass, with977worker
responses, zero production errors and zero unsolicited Baron model/effect/audio
fetches. The authoritative receipt is
[retained audio acceptance](reference/baron-basic-audio-retained-acceptance.json).
Later source/float-format guards pass separately (70 Node QA at the Ahri corpus
checkpoint; see AHRI-AUDIO-MASTERS.md). The earlier607225d/ce32b45a audio receipt explicitly leaves the since-fixed saved
cast-tail gap open. Earlier d3eb639/all-effects and hit-only receipts remain
historical, not relabeled current acceptance.

Native target-height routing remains an explicit local single-elevation policy;
hit bound factors match the external reader's neutral omission. Audio event labels
are corroborated hash cracks, not attested stored strings. Native dispatch,
shuffle/global mix/listening parity, particle RNG/cadence/complete fidelity and
device performance remain uncertified. Chromium/SwiftShader is a local QA tool.

The frozen e20/schema163 ordinary hundred-seed cohort remains98victories,
two unfinished and zero invariant failures. It is not current-ruleset/full-roster
or completed milestone4 acceptance. Both archived unfinished games later reach natural Red victory in separate
frozen-source continuations; the original horizon outcomes stay unchanged.
See E20BDC-UNFINISHED-HORIZON.md. A fresh current-ruleset development-roster
hundred-seed run is in progress; see CURRENT-DEVELOPMENT-ROSTER-HUNDRED.md.

Earlier fixed-name QA artifacts were overwritten; newer preview and production
runs use exclusive namespaced claims. Historical hashes are preserved. See
QA-ARTIFACT-RUNS.md.
