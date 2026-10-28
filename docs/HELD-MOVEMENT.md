# Held right-click movement

Right-click keeps its immediate move/attack behavior. Holding the primary
right mouse button over the battlefield follows cursor changes. Shift changes
ground orders to attack-move; held Backquote restricts ordinary attack picks
to champions. Releasing either modifier updates the next held order.

Updates have a 120 ms minimum interval and issue at most one command per frame.
Matching attack targets and ground destinations less than four world units apart do not
restart the current order. The newest queued order takes precedence in this
comparison, so returning to an earlier destination still expresses the newest
intent. Camera pan and zoom are applied before projecting the held pointer.
The existing World order validator and simulation remain authoritative.

The gesture belongs to the pointer that started it on the battlefield. Other
pointers cannot move or cancel it. Moving over the HUD suspends updates;
release there still ends the gesture. A right-button gesture begun over the
HUD cannot start movement when it enters the battlefield. Stop, recall, a
spell, ward targeting, A-click targeting, pause, a modal, blur or pointer
cancellation ends the gesture. Accepted commands stay queued. Resuming play
requires another right-button press.

Input state is temporary and introduces no serialized fields or simulation
rules. All 29 final browser cases pass, including four new held-gesture cases, eight
existing attack-move scenarios, champion targeting, real Yi Q, keyboard/audio,
minimap cast boundaries and ward/spell transitions. TypeScript, formatting and
build pass. The nested-path production check passes with its 32 expected audio
recordings, Ashe/Lux chooser and no development hook/private preloads. The
reviewed capture uses the controlled practice fixture; it is not native visual
calibration. Initial deduplication failure and an edit-triggered Vite reload are
retained separately from the clean final batch.

Schema stays 163 and the simulation fingerprint stays
`abc8dc664ed97c0f0cfac64e4eb52b43dbbc593884a6896a47b1e8e0d34bd04f`.
Pack `6e09abbd2512ff34eb8e0c578aac9d45d226ae1fd3c2e0670bf18e454c54fcde` has
1,202 files / 538,116,691 bytes. The
[verification ledger](reference/held-movement-verification.json) pins source,
logs, command evidence, captures and the resumed audit pause. Earlier broad,
full-match, offline and native evidence retains its original source/pack scope.
