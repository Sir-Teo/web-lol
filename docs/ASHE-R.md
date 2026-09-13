# Enchanted Crystal Arrow fidelity

The standard 16.18 spell record selects `AcceleratingMovement`: initial/minimum speed 1,500 units/second, acceleration 200 units/second², maximum speed 2,100. The prototype now uses these values instead of a constant 1,600 speed. `docs/reference/ashe-r.json` retains the entire spell record and source hash; `python3 tools/assets/export-ashe-r.py` verifies the cached source and selected record before exporting the movement constants.

The simulation integrates constant acceleration within each 60 Hz step and handles reaching the cap partway through a step. Collision sweeps use the resulting step distance. The projectile's existing speed field stores its current speed, so saves need no new field. Range consumption and terminal removal retain the existing behavior. Launch timing, source bone/height, missile model/effects and exact reference collision geometry remain unfinished.

At one second the model travels 1,600 units and reaches speed 1,700; at three seconds it travels 5,400 units and reaches 2,100; subsequent flight stays capped. These are local integration checks using source constants, not measurements from a League client capture.

The pinned record also includes minimum/maximum stun durations of 1/3.5 seconds, rank-dependent damage, splash data and visibility settings. The selected data does not expose the distance threshold needed to implement the stun curve confidently. The current fixed two-second stun remains provisional. Full distance scaling, splash damage/slow, rank/AP scaling and missile vision are not established by this movement change.

Two simulation cases cover launch acceleration, integrated distances, cap, range removal and saved continuation. A browser case advances and renders the arrow before and at the cap. Existing ultimate collision and save regressions remain relevant.
