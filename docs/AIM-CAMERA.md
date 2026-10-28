# Cursor-aligned previews after camera movement

Held spell and ward previews now refresh on each rendered frame after the
camera and actor poses are positioned, before the indicator is drawn. A
stationary pointer stays aligned as the camera zooms, pans, resizes or follows
a champion. Active targeting also reads the current model poses. Release uses
the existing input-to-world and cast validation paths.

The original failure is retained on source `ef233d0`: zooming while holding W
moves the actual cursor/release point by 165.516979 world units while the
preview remains at its earlier point. The repaired case records zero gap and
an actual release point exactly equal to the displayed preview. A ward case
also passes zoom, pan and 1024×720 resize, then cancels without spending a charge
or leaving a pending/placed ward. Both captures are reviewed.

The controller supplies an optional pre-indicator callback. It updates active
hover/aim from the current camera and model poses; ordinary and direct manual
preview hover retain their existing post-render behavior. Each path performs
one hover query. Pointer events still update immediately. No spell, ward,
resource, movement, fog or targeting rule changes are involved.

Thirteen relevant browser scenarios pass across the final batch and corrected
legacy recheck: the two new cases plus minimap E/R, battlefield/HUD transitions,
scoreboard clipping, cancellation, instant HUD casting, real ward placement,
midflight saves, ward combat, expiry and cooldown reset. The original transition
fixture's 30-second timeout also reproduces on exact pre-fix `ef233d0`. Its
static input case now freezes painting after one complete scene, retaining the
real simulation loop, keyboard/mouse handling, charge assertions and original
deadline; it passes in 8.4 seconds. Both failures remain retained. Rendered
camera/aim behavior stays covered by the separate new cases.

TypeScript, formatting and build pass. Schema remains 163 and simulation
fingerprint remains
`abc8dc664ed97c0f0cfac64e4eb52b43dbbc593884a6896a47b1e8e0d34bd04f`.
The frozen ordinary and combined 100-seed audits retain their earlier source
and continue with recorded quiet-test pauses. No hundred-seed result is claimed
before completion/verification. Nested-path production smoke passes all 32 recordings and development gates.
Matching pack `8ae8b3ce5e4cbde0a48a69287af97f387ffcfc9b1b9795361a514b7ad81682af`
contains 1,202 files / 538,109,411 bytes. No public media or saved fields change.
Broad/Node QA and full-match results retain their preceding evidence; no fresh
broad, completed 100-seed, native/performance or offline result is claimed.
See the [verification ledger](reference/aim-camera-verification.json).
