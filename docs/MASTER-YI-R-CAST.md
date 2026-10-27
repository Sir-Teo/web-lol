# Highlander cast effects

Accepted R in the private Yi scene creates all eight `MasterYi_R_Cas` emitters.
The existing seven-second buff owns stats, Q/W pause accounting and takedown
extensions. The cast effect has its own finite 27-tick retention bound. The
canonical spell's animation name is empty; this integration adds no fabricated
cast animation. The public selector remains Ashe/Lux.

| Source emitter | Primitive | Retained behavior |
| --- | --- | --- |
| `speed` | Native cone mesh | Two-particle burst, velocity, rotation, scale and color |
| `fireball` | Native fireball mesh | Root bind, velocity, orientation, color and finite life |
| `ring` | Native cone mesh | Distinct birth scale, velocity, rotation and color |
| `ground_glow` | Arbitrary quad | Two-particle burst, root bind and ramp lookup |
| `lensflare` | Arbitrary quad | Single burst, scrolling UV and omitted emitter lifetime |
| `speed2` | Native cone mesh | Authored delayed first emission and separate scale/color |
| `Distort` | Billboard | Mode 2, raw power 1, normal texture, uniform growth and lookup |
| `flash` | Billboard | Authored rate, uniform scale and lookup |

The [full R source](reference/masteryi/r-particles.json),
[private decode](reference/masteryi/r-particles-decoded.json),
[texture transport](reference/masteryi/r-cast-texture-transport.json),
[mesh transport](reference/masteryi/r-cast-mesh-transport.json) and
[compiled reading](reference/masteryi/r-cast-runtime-reading.json) stay separate.
Ten textures retain all 86 authored mip levels. Four transports reuse existing Q
URLs; six PNGs and two GLBs are new. No mip is resized, generated, gamma-converted
or premultiplied. Yi programs share verified page-owned textures while retaining
independent readiness and selective explicit retry.

The 1,440-vertex/480-triangle cone exports 1,440 corners; the 161-vertex/300-triangle
fireball exports 900. Native corner/UV order and face RGB round-trip exactly at
an explicit 0.01 transport scale. Original flags 1/5, pivot, bounds, unused vertices
and zero/24-byte tails remain in metadata. No normals, reflection, winding change
or black material tint is invented. Face RGB is a custom audit attribute rather
than a fabricated vertex-color input. The cone geometry is shared by its three
emitter families. The shared surface program applies its explicit root reflection.

Schema 156 saves rank, admission origin/audience and lossless per-tick root runs.
An instantaneous follow-up order can change the endpoint without rewriting the
accepted origin. R during Q retains admission while its body-hidden birth frames
remain unknown; those births cannot appear later. Known unbound particles finish
at their captured birth roots. Bound particles require current known frames,
including suppression by a later Q. Death freezes the root. Victory can finish
already-admitted particles through presentation time without advancing the world.
No extra gameplay RNG or entity/event identity is consumed.

The retained cast has no varying probability tables or random atlas starts, so
its pure samples stay identical across cosmetic seeds. Curves and UV scroll seek
from saved time. The delayed burst uses the existing Solar
`max(1, ceil(delay * 60 - 1e-5))` first-update grid; raw delay
0.10000000149011612 remains unchanged. Omitted lens emitter lifetime stays null,
with local unbounded birth phase zero for its one burst. Source linger fields do
not extend finite visible life. Q/W pauses and R extensions do not stretch or
restart the cast effect.

Mode 2 uses the existing local early-copy distortion route with raw strength 1.
Source-to-power conversion, native phase/default/sampler setup, root axes,
first-update emission and native script/GPU parity remain unverified. Omitted
lookups use an explicit local neutral white product. These policies are recorded
in the compiled reading. R_Cas omits sound, so this renderer adds none. Existing
finite R audio and the separately declared sustained trail sound remain distinct.
[Takedown effects](MASTER-YI-R-KILL.md) use their own saved finite histories.
Sustained rank variants and the attached overlay remain separate work.

Reproduce with `python tools/assets/export-masteryi-r-cast-particles.py --check`
and `python tools/assets/test-masteryi-r-cast.py`, including optimized Python,
plus `node tools/assets/convert-masteryi-r-cast-meshes.mjs`. History/sampler unit
checks and `e2e/masteryi-highlander-cast.spec.ts` cover runtime behavior. The
[verification ledger](reference/masteryi/r-cast-verification.json) indexes source
identities, GPU mip readbacks, ordinary-family pixel coverage, exact saved futures,
selective retry and production results. This is not a physical-device or native
frame-matching certificate.
