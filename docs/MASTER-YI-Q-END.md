# Alpha Strike reappearance source

The complete `MasterYi_Q_End` system contains a disappearing atlas billboard and
a distortion billboard. This source checkpoint retains both emitters, all five
texture transports and their 41 authored mip levels privately. It creates no
runtime callback, public asset or audio dispatch.

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
public delivery and texture ownership remain runtime integration work. The
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
