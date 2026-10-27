# Alpha Strike reappearance source

The complete `MasterYi_Q_End` system contains a disappearing atlas billboard and
a distortion billboard. The source checkpoint retains both emitters, all five
texture transports and their 41 authored mip levels privately. The runtime
integration below delivers these emitters at the local accepted return transition.

The disappear emitter has rate 34, emitter life 0.1 seconds, particle life
0.18000000715255737 seconds, upward velocity 250, root bind 1 and a random 2×2
four-frame atlas. The raw `{9b111ae4}` field retains value 10 and exactly matches
the `frameRate` name candidate. Authored scale/rotation probabilities, spawn
height 10, lookup and particle linger remain in the reading.

The single distortion particle has life 0.25 seconds, upward velocity 50, uniform
birth size 320, scale 0→3, blend 1 and an omitted bind weight. Its explicit
`distortionMode` is 2, strength is 0.09000000357627869 and normal texture is
`common_distort-heat.tex`. Base texture `common_Aura_Self.tex` and color lookup
`common_color-bellcurve32.tex` remain distinct inputs. Its particle linger 10 and
emitter linger 1 are retained as source fields. Neither extends visible finite
life on the local adapter. No on-create sound field is authored.

The five private PNG transports preserve canonical decoded pixels for every
source mip. Two transports are byte-identical to existing Q cast/contact assets;
runtime delivery reuses those URLs and the page-owned Yi texture cache. Three new
PNGs complete the pack; no texture consumer disposes borrowed bitmaps. The
first-update reconstruction grid needs at most 18 ticks for all births and
finite lives. Source identity and exact transport do not prove native creation
callbacks, force integration, random sequencing, GPU sampling or frame matching.

The source's mode 2 does not itself establish a render phase or a source-to-shader
power conversion. The existing local early-copy route may be used only as an
explicit adapter. Reappearance naming/resource identity likewise does not prove
native script timing; a later integration must state which accepted gameplay
transition creates this system and how roots and visibility are saved.

The [frozen Q source](reference/masteryi/q-particles.json),
[private transport record](reference/masteryi/q-end-texture-transport.json) and
[complete projection](reference/masteryi/q-end-particle-reading.json) are separate.
Reproduce with `python tools/assets/prepare-masteryi-q-end.py --check` and
`python tools/assets/test-masteryi-q-end.py`, including their optimized Python
modes. [Source verification](reference/masteryi/q-end-source-verification.json)
indexes exact inputs, guards, output replay and unchanged application identity.


## Saved runtime integration

Schema 155 creates Q_End at the actual completed or target-loss reappearance,
after placement/facing are established and before pending contacts resolve.
Vanished death/victory cancellation creates none. The saved record retains the
accepted cast tick, rank, mark count, return reason/point and separate creation
audience. Lossless root runs retain exact per-step poses and visibility for 18
ticks, including the eight ticks after Q recovery clears. Existing finite tails
freeze on death and finish on the terminal presentation clock without stepping
the world. No extra gameplay RNG or event/entity identity is consumed.

Disappear binds to the current root. The distortion emitter omits bind weight;
the separately pinned reader default of zero keeps its accepted birth root.
Hidden creation cannot appear when vision returns. Known bound particles also
require known current root frames; a later Q hides them while its body vanishes.
Known unbound distortion can finish at its captured birth point.

The local renderer maps the explicit mode 2 to the existing early-copy pass and
binds the raw 0.09000000357627869 strength directly. This preserves the chosen
adapter and shader inputs; native CPU phase selection, power conversion and
sampler/default setup remain unverified. The atlas keeps the same explicit
age-times-frame-rate seek used by Q cast, with a fixed cosmetic random start.
Source linger fields do not extend visible finite lives. Q_End adds no sound.

Present/late Yi units load the five-texture closure. Each program retains its
own readiness and successful verified resources; explicit retry fetches only
failed files. Ordinary Ashe/Lux startup skips the private pack. The
[runtime reading](reference/masteryi/q-end-runtime-reading.json) records the
compiled delivery, and [runtime verification](reference/masteryi/q-end-verification.json)
indexes source identities, GPU mip readbacks, save/future checks and production
results. The earlier source ledger remains the source-only checkpoint.
