# Display-density changes

GameView now checks the current display pixel ratio whenever it resizes, retaining
the existing 1.75 maximum. It changes the renderer ratio only when necessary.
Previously the ratio was set only during construction, so a resize after moving
from a high-density display to DPR 1 retained a 1.75 framebuffer. The reverse
transition could likewise retain a lower-resolution buffer.

The browser case starts at native DPR 2, observes the capped 1.75 framebuffer,
controls a DPR-1 resize and restores the native property for a reverse resize.
The original application fails at the lower-density assertion (1.75 instead of
1). The updated renderer uses exactly the CSS width/height at DPR 1, restores
its former dimensions at DPR 2, and retains identical projected coordinates and
champion picking in all three states. At DPR 1 this avoids rendering 3.0625 times
the required pixel area in the controlled scenario. It is not a measured FPS
improvement or a physical monitor-hotplug certification.

The [result](reference/display-density.json) retains actual ratios, framebuffer
sizes, projections and picks. Its screenshot was reviewed. A test-helper attempt
incorrectly deleted the browser's native DPR property instead of restoring its
own descriptor; its raw failure remains retained. The corrected helper passes.
The existing paused/hidden energy-idle browser scenario also passes, as do build,
TypeScript, all 42 Node QA cases and diff checks. No simulation rules or saved
fields change; fingerprint remains `629ed5…` and schema 163.

The preceding nested-host production report retains its earlier pack identity;
it is not relabeled as verification of this new presentation build. Native
reference comparison, physical-device performance and full-game completion
remain separate work.
