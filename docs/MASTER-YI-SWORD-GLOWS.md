# Saved sword glow presentation

The private Yi fixture renders the five [skin-declared instances](MASTER-YI-SWORD-BINDINGS.md):
four effects on sword joints one through four while the local active Wuju Style
child is present, and `MasterYi_E_buff` on sword one during Highlander. The normal
sword subresources absent from that table remain retained and undispatched. The
complete source profile includes all 14 emitters; the table uses 11 unique
families and 13 emitter instances when both conditions are present.

Nine textures retain all 78 authored mip levels. Eight PNG transports are new;
the common ramp reuses an existing verified texture. Programs share page-owned
verified resources, preserve successful loads through selective explicit retry,
and do not load during ordinary Ashe/Lux startup. No audio is added.

All referenced emitters author full bind and local orientation. The surface
adapter uses current posed joint position and full quaternion, including local
billboards, with no root fallback for missing or ambiguous joints. Each posed
joint is resolved once per update and reused by its attached instances. Source-X
reflection and 0.01 VFX units are explicit local choices; the rig separately bakes
skin scale 1.5 into 0.015 translations. Native VFX scale inheritance, reflection,
shader inputs and frame parity remain uncalibrated.

Source rates, lifetime, scale/rotation probabilities, paired textures, UV scroll,
lookup controls and UV mode are retained. Flare `numFrames=4` with omitted
`texDiv` stays distinct from the beams' explicit 2×2 grid. The local omitted grid
is 1×1; no automatic atlas layout is inferred. This is a reconstruction policy,
rather than a native sampler certificate.

Persistent clocks advance during Q/W pauses of the underlying buff. Actual local
removal caps new emission; existing particles keep finite lives of at most one
second. The conservative saved tail is 62 ticks. Emission samples only the live
birth window, so long R extensions do not accumulate particle sampling work.
Fixed cosmetic draws consume no gameplay RNG or entity IDs.

Schema 159 saves condition/cast identity and rolling lossless actor-root visibility
runs. At most 62 ticks of roots are needed because every source particle is fully
bound/local and current animation supplies the joint transform. Decoding checks
accepted E/R audio lifecycle linkage, mandatory active/recent admissions, unique
ordered identities, exact window coverage and current endpoints. Recasts remain
separate, E/R in one tick have a canonical order, and removals do not restart
finite flare/beam bursts.

Hidden births remain hidden. A later reveal can admit newly born continuous
particles. Q hides current bound effects; new known births can appear after
return. Remaining particles follow known corpse joint poses after death, and
victory drains finite tails through presentation time without stepping the world.
Native reveal, restart, removal and destruction behavior remains a calibration
limit, separately from the authored buff predicates and attachment names.

See [runtime reading](reference/masteryi/sword-runtime-reading.json) and
[verification](reference/masteryi/sword-runtime-verification.json). The accepted
base rig's shading and source-rotation conversion limitations remain documented
in [the model reading](MASTER-YI-MODEL.md). The public roster stays Ashe/Lux.
