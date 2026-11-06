# Source flight orientation

The external missile basis aligns local +Y with travel and keeps local X level.
Its zero and vertical cases are explicit, including the fixed zero-travel frame.
The adapter returns owned float32 matrices and rejects invalid/overflowing input.
It chooses neither height nor a root trajectory.

All 269 direction cases match the pinned external flightInto function's exact
float32 bytes. Cases include principal axes, near-vertical and extreme finite
magnitudes, plus deterministic integer directions. The fixture producer imports
no application arithmetic. With regeneration and ownership/invalid-input checks,
271 focused tests pass. TypeScript passes.

The isolated real-asset preview now uses the supplied horizontal travel frame
for the missile. All 21 emitters still draw across eight screenshots; the reviewed
missile image aligns along its travel rather than the preview's former identity
frame. See reference/source-flight-basis-verification.json. The active gameplay
missile remains provisional while native height/root mapping remains unresolved.
No native-client or device-performance parity is claimed.

Preview QA now accepts a unique run name, refuses existing output paths and puts
all screenshots/report under that name. The initial fixed-name preview artifacts
were overwritten by subsequent runs before this fix; those earlier receipt hashes
remain historical, not current-verifiable evidence. Namespaced flight-axis-v1
outputs preserve the current proof without changing those historical hashes.
