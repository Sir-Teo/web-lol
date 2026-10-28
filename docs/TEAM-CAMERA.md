# Held champion camera shortcuts

Hold **F1** to follow your champion. In a 5v5 match, hold **F2–F5** to follow
teammates in the same stable allied order as the scoreboard. The camera tracks
actual movement while the key is held. Releasing it leaves a free camera at
that location, or returns a locked camera to your champion. The user's lock
setting is preserved throughout.

The newest held function key takes priority; releasing it returns to an older
key that is still down. Space takes priority over function keys and returns to
them when released. Repeated keydown events reserve the browser shortcut without
adding another hold. Blur, pause and modal transitions clear temporary focus.
Typing, modifier shortcuts and native HUD button Space behavior retain their
existing input boundaries. Practice offers F1 alone.

Target selection includes only allied champions and retains dead teammates as
known friendly camera targets. The renderer independently rejects an opposing
focus ID; it keeps a free camera in place or uses the human as the locked
fallback. These controls alter the view only. They issue no movement, attacks,
casts or summoner commands, and introduce no saved match field.

Ten focused target/intent cases, TypeScript, formatting and the build pass.
Two browser scenarios pass all five keys, overlapping holds, repeats, Space,
lock preservation, real pause/blur cleanup, a moving ally, the renderer's hidden
enemy rejection, typing/modifier boundaries and unchanged human movement/order
and summoner cooldowns. Both 1440×900 captures are reviewed. Help lists the
shortcuts. This is a local control policy, not a measured native-client binding
or device-performance certificate.

Schema remains 163 and the simulation fingerprint remains
`abc8dc664ed97c0f0cfac64e4eb52b43dbbc593884a6896a47b1e8e0d34bd04f`.
The frozen ordinary and combined 100-seed audits continue independently in a
separate checkout. Their owned processes receive recorded pauses for quiet
browser checks; sources, maps, workers and simulation clocks are unchanged.
Neither 100-seed result is claimed before completion and independent verification.
Nested-path production smoke passes all 32 recordings and development gates.
Matching pack `89b7ab0f6ca11ab71239cd3159555176d526f3c6b35ef47b121708e2fc430abe`
contains 1,202 files / 538,109,144 bytes. Public media is unchanged. Broad unit
and Node QA results retain their preceding identities; no fresh broad or offline
acceptance is claimed. See the
[verification ledger](reference/team-camera-verification.json).
