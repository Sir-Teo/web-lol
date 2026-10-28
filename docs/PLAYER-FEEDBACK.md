# Feedback for the controlled champion

Allied bots still generate ordinary team-visible events. Personal feedback now
checks the event's `unit` against the controlled champion before presenting a
message toast, click marker or interface sound. Shared combat audio, damage,
healing and floating rewards continue to use captured team visibility.

Move and attack-move commands now attach the issuing unit to their existing
move event. Recall and error messages, gold and level events already carry an
owner. Ownerless system notices and legacy events retain their presentation.
There is no new saved field or schema version; the existing optional event
owner is preserved by checkpoint decoding. The rules fingerprint changes with
the simulation source as usual.

The reproduced failure came from an allied recall overwriting the player's
status while that ally's queued movement created a player marker. Allied gold
and level events also reached the interface-audio path. The browser regression
uses real queued commands, recall cancellation, minion kills, experience and a
learned allied spell. It inspects the HUD, rendered marker and events delivered
through the normal paused-frame audio update. Both champions retain their
movement, CS, recall and own feedback; allied spell audio still passes through.
The original failing run retains its proof, screenshot and trace.

Public assets, gameplay controllers, team event visibility and resource rules
are unchanged. This correction does not certify complete matches, native
presentation or the sound mix.

All 83 focused simulation cases, TypeScript and all 29 Node QA cases pass.
The 22-case browser run passes 21 cases, including the new real-controller
regression, all attack-move and recall cases, and eight audio cases. The
unchanged natural Hawkshot arrival cleanup case times out in this Chromium
host. A separate unchanged-assertion run on parent commit `3f5c2ef` reproduces
that failure. Clock probes on both revisions show the source node ending and
an empty voice set; the polling response arrives outside its 9,209 ms limit.
Original traces and separate baseline/current clock records remain retained.

The broad run passes **3,489/3,495 unit cases across 411 files**, retaining only
the same six independently reproduced baseline failures. The build passes with
schema 163 and rules fingerprint
`e409c1786334df9419d0e995ab612b976e9c33d97a20ffb509f12cec91f971c1`.
Matching pack `0ab44bdfbddb7b018ad9973c162784f29bf53824317fedddcf4dda86aa3c85ed`
contains 1,202 files / 538,103,210 bytes.

The audio fixture now keeps the manually stepped match paused and resumes
only Web Audio. Its corrected isolated run passes with the same source frames,
gain, visual-expiry checks, natural node-closure assertion and 9,209 ms deadline.
Runtime audio is unchanged. Together with the 21 passing browser cases, all 22
selected scenarios have passed; this is not a claim of one clean 22-case batch.
Nested production passes all 32 recordings, development gates and resource/error
checks. Fresh offline acceptance is not repeated for this step. The
[verification ledger](reference/player-feedback-verification.json) pins the
sources, original failures, baseline/current clocks and corrected result.
