# Complete bounded Baron launch history

Save schema 166 requires each Baron path to begin at its launch tick. The previous
90-frame sliding window could lose the prefix during a long flight or retained
tail, preventing exact particle RNG, birth and odometer reconstruction on reload.
The local 4,000-unit projectile cap and 1,300-unit/second speed bound flight to
185 ticks. Adding the longer 125-tick retained tail and two safety intervals bounds
the complete path at 312 frames. Gameplay outcomes and random streams are unchanged.

The original source-envelope record and generator remain historical and unchanged.
The new full-history generator checks that record, pinned missile facts and its
new generated output. Run `PYTHONPATH=tools/assets python3 tools/assets/export-baron-full-history-bounds.py --check`.
Both ordinary and optimized Python checks pass. The old generator describes the
retired 90-frame transport and no longer checks the active presentation module.

Forty-six focused cases pass, including a real long-range saved flight beyond the
old 90-frame limit: rebuilding its source system exactly matches all checkpoint
fields/packets and 20 further live steps. Reconstruction does not mutate the World.
Dropping the launch frame rejects. TypeScript passes. See
reference/baron-full-prefix-verification.json. Native attachment/size/height and
active renderer integration remain independent work.
