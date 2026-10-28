# Held champion targeting

Hold **Backquote** (the key beneath Escape on a US keyboard) to restrict ordinary
battlefield right-click picks and unit-targeted spell picks to champions. A
**Champions only** badge shows while the key is held. Releasing it restores
ordinary picking. The physical key code also works when Shift changes its
printed character.

The picker filters candidate unit kinds before its existing alive/visibility
checks. Overlapping minions can therefore leave the champion selectable. When
there is no champion under an ordinary right-click, it retains the existing
move-to-ground fallback. Unit-targeted casts retain their normal target,
visibility, range, rank, resource and cooldown validation. Skillshots retain
their ordinary points and collisions; A-click and Shift-right-click retain
ordinary attack-move behavior and may target minions. Minimap orders retain
their existing behavior.

Key repeats stay reserved and do not toggle the mode. Pause, modal opening and
blur clear it; auto-repeat after resuming does not reactivate it. A fresh press
is required. Typing and Ctrl/Alt/Meta shortcuts keep their existing guards.
Printable-key audio activation retains its usual path. The held state belongs
to input/UI and adds no serialized fields or simulation rules.

## Verification

All 19 final browser cases pass, with no retries. They cover overlap selection,
exact mode-only snapshot equality, held/released/Shift-modified keys, reserved
repeats, pause/blur/modal clearing, typing/modifier guards, move fallback and
ordinary A-click / Shift-right-click targeting. Existing cases retain actual
attack damage, nearer-enemy exclusion, ground/ally/minimap behavior, cancellation,
paused controls, real audio context creation and native Space button activation.
The new input cases freeze stepping to inspect commands; the Q case then resumes
the real loop and verifies actual champion damage.

The Q rejection first proves that the lone minion is ordinarily picked and
accepted by the existing validator, at 430.116 units within the 600-unit range.
Held champion mode accepts no cast there. At an overlap it queues the champion
ID, the simulation begins Alpha with that primary ID, and the champion loses
health. The initial fixture's lone minion was outside range; that source/result
is retained as an incomplete rejection diagnostic, and the corrected final case
supplies the meaningful check.

The badge captures are reviewed at 1440×900 and 1024×720. TypeScript, formatting,
build and all 32 nested production recordings/gates pass. Public choices stay
Ashe/Lux and the development hook is absent. Schema stays 163; simulation
fingerprint stays
`abc8dc664ed97c0f0cfac64e4eb52b43dbbc593884a6896a47b1e8e0d34bd04f`.
Pack `8511251dbb909130d44970a3e4e453cc58c295a8f9d026637e3a1073bcabb680`
contains 1,202 files / 538,111,476 bytes. Public assets and saved fields are
unchanged. [The ledger](reference/champion-targeting-verification.json) pins
source and retained evidence, including the resumed audit pause. Earlier broad,
Node QA, full-match, offline and native results retain their own scope and pack
identities. The two frozen hundred-seed audits continue against their unchanged
source; no completion is claimed here.
