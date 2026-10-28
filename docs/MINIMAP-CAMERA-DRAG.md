# Minimap camera dragging

Hold the left mouse button on the minimap and drag to move the camera.
The first press unlocks the camera and returns keyboard focus to the battlefield.
Space can then recenter instead of activating a previously focused HUD button. Pointer
capture keeps the gesture attached to the minimap when the cursor leaves it;
outside coordinates clamp to its edges, then the existing renderer applies
its normal camera bounds. Releasing leaves the camera at that location.

Pause, modal opening, blur, pointer cancellation and lost capture all release
the gesture. Resuming does not restart an interrupted drag. Right-click and
Shift + right-click still queue move and attack-move orders; middle-click does
not move the camera. Temporary held champion-camera shortcuts retain their
existing priority. A camera drag issues no gameplay commands, changes no saved
match fields and does not reveal units through fog.

Controls help and the minimap's accessible label describe dragging. Its CSS
blocks native touch panning over the minimap so pointer gestures stay attached
to that control. The rest of the page retains its existing touch behavior.

## Verification

The final four-case browser run passes both drag scenarios and two native HUD
Tab-navigation scenarios. Trusted mouse gestures verify normal Rift camera
bounds, 1440×900 / 1024×720 layouts, pointer capture beyond the minimap,
secondary-pointer rejection, release, focus recovery and Space recentering
without changing sound. The complete saved match stays byte-identical and
camera input queues no orders. The interruption case separately verifies
pause, modal, blur, cancellation and lost capture, plus middle-click and the
two ordinary right-click order types. These camera cases freeze simulation
stepping while retaining the real HUD, renderer and input loop.

An earlier nine-case batch also passes seven existing teammate-camera and
minimap-casting/overlap regressions, plus the two drag cases before the final
focus correction. Its source hashes and then-current test source are retained.
That last source correction only focuses the battlefield at drag start; the
final four-case run covers it. The existing regression assertions, deadlines
and rendering behavior are unchanged.

TypeScript and the production build pass. The matching pack contains 1,202
files / 538,110,595 bytes, ID
`180aadb3005305d4982afdacd9328e58b8b98fc302203f3bffc703a49c8d710e`.
The simulation fingerprint remains
`abc8dc664ed97c0f0cfac64e4eb52b43dbbc593884a6896a47b1e8e0d34bd04f`,
with schema 163. Public assets and saved fields are unchanged. The original
broad tests, Node QA and full-match results retain their own scope. All 32 nested production recordings/gates pass, with the public chooser
remaining exactly Ashe/Lux and no development hook. Fresh offline validation
follows this step. See the [verification ledger](reference/minimap-camera-drag-verification.json).
