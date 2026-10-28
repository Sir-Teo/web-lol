# Result effects use wall time

After victory, finite visual effects and death poses now advance with elapsed
presentation time. Simulation catch-up keeps its existing 0.1-second/six-tick
limit. Active play and ordinary paused presentation retain their previous
clocks; hidden or interrupted rendering excludes the time spent asleep.

Previously, a 250 ms rendering interval advanced result visuals by 100 ms.
Audio tails already use the audio context's wall clock, so low frame rates could
make visual tails linger at a slower rate. The result clock now advances by the
full visible interval without advancing the frozen match.

The controlled browser scenario creates a lethal Lux Nexus impact through the
simulation, then drives real frame callbacks at 250 ms intervals. It observes
2.25 seconds of presentation time, a retired impact, an unchanged tick/snapshot
and exclusion of a synthetic hidden minute. The same test first failed against
the preceding application code with 100 ms observed instead of 250 ms.

All ten selected browser checks pass, including normal/critical impacts,
projectile/beam cleanup, fixed victory interpolation, FPS accounting and
paused/hidden sleep. Fifteen existing frame-counter/pacer cases also pass.
Type-checking includes the new browser file. The simulation fingerprint and
snapshot format remain `5a5379…` / 163.

This fixes the presentation clock. Result-loop scheduling, native-client timing
calibration and physical-device performance remain separate work. The
[verification ledger](reference/terminal-wall-clock-verification.json) records
the baseline reproduction, current checks and production build identity.

Production passes its 32 expected recordings, public Ashe/Lux selection,
no development hook and zero Baron preloads. Pack `16429f3c30452493f95c68cff4805c1b86113a273f51350ae2da3b53216795b1`
contains 1,204 files / 551,658,225 bytes. The prior full unit result
remains 3,628/3,630 at `3c461ce`; the historical archive/checksum failures are
unchanged. Earlier full-match and offline checks retain their original pack
identity until repeated for this build.
