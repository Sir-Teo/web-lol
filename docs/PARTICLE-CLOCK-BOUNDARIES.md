# Float32 particle timestamp boundaries

The external pool stores birth and linger timestamps as float32 while the
preview's system clock is double. At now = 1/30, the stored birth time rounds
slightly upward, so now - birthTime is negative. Raw spin and UV ramps retain
that signed age; life fractions clamp it to zero. Clamping raw age would change
angles and flipbook samples. This is an external JS behavior, not proof of the
native client's clock widths or intended visual behavior.

Spin, appearance, frame and UV adapters now accept finite signed particle ages.
Nonfinite ages still reject. Lifetime settlement compares pool timestamp bounds
at float32 precision, accepting the current rounded clock bin while rejecting
the next bin. Double emitter-finished clocks retain their original precision.

Eight independent boundary cases execute the external functions at positive
system times; seven produce negative age. They check spin, UV, appearance,
placement and lifetime/linger writes, including repeated settlement with an
upward-rounded stamp. Fixtures never import application adapters. All 2,878
cases across the five affected suites and boundary suite pass, preserving every
old positive-age golden. TypeScript passes. The former negative-age rejection
assertions now test negative infinity; new exact-byte boundary assertions define
the expanded finite signed-age contract.

Evidence: `artifacts/particle-clock-boundary-tests.log`. Reproduce fixtures with
`node tools/assets/export-particle-clock-boundary-samples.mjs --check`.
Full system composition remains in progress; no active renderer or gameplay
changes in this correction.
