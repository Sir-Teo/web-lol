# Teammate portraits and cameras

A 5v5 match shows four teammate portraits above the minimap, in the same order
as F2–F5 and the allied scoreboard. Each portrait shows the friendly champion,
current health and, after death, a respawn counter. Hover or focus supplies the
champion name, role, health/death status and camera key. The held F-key target
also receives a visible border.

Click a portrait to unlock and move the camera to that teammate's current
position, including their known death position. Pointer activation returns
keyboard focus to the battlefield. Keyboard Enter/Space activation keeps button
focus, so native Tab navigation can continue across the row. Space from the
battlefield and held champion-camera keys retain their existing behavior.
Pause and modal guards apply before a camera action. Camera input issues no
orders and does not change the saved match.

The row is hidden in practice. Its images have no source until an allied slot
is available, so an empty practice row requests no teammate portraits. Friendly
selection happens through the existing F-key helper before owner or health
reads. Buttons revalidate that target at click time; their DOM unit IDs are
presentation data. Existing button nodes stay in place while status updates.

The initial three browser cases pass exact camera-only snapshot equality,
four real Rift clicks, native Enter/Tab/Space focus, real damage/death/respawn,
held F2 highlighting, dead-body camera access and modal guards. A private-roster
case rejects enemy owner/health reads, checks current friendly identities,
ignores forged DOM unit IDs and guards practice. Painting is stopped after a
complete frame in that controlled private boundary case; the public cases
retain real rendering/input with stepping frozen except for lifecycle probes.
Reviewed public captures cover 1440×900, 1024×720 and a dead teammate view.
All 14 final browser scenarios pass, including the explicit private champion
identities, spell/ward exclusion over portraits and existing held-camera,
minimap-drag/cast/overlap and native-HUD-focus regressions. TypeScript,
formatting, build and all 32 nested production recordings/gates pass. The
public chooser remains Ashe/Lux, with no development hook or unsolicited
private-champion media. Schema stays 163 and the simulation fingerprint stays
`abc8dc664ed97c0f0cfac64e4eb52b43dbbc593884a6896a47b1e8e0d34bd04f`.
Pack `3167ca1b0c6fab78013e69c15ccb05a5806532d7fe3ef88830dda9dd66e639ff` has
1,202 files / 538,114,369 bytes. Public media and saved fields are
unchanged. [The verification ledger](reference/ally-portraits-verification.json)
pins source, captures, real CLI/browser results and the resumed audit pause.
Prior broad/Node QA/full-match/offline/native results retain their own source
and pack scope. The two frozen hundred-seed audits continue.
