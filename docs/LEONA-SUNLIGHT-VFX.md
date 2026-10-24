# Sunlight source marks and detonation

The development browser now renders all nine emitters from Leona's three
Sunlight systems: the ordinary-target mark, the two-layer champion mark and the
six-layer detonation. Twelve source textures are decoded without resizing;
their packaged PNGs total 381,490 bytes. This extends the NPC rig integration.
It does not certify complete Leona, native rendering or script dispatch.

## Frozen source and rebuild

`reference/leona-sunlight-particles.json` retains the complete selected source
definitions, BIN record names, archive paths, bundle ranges, hashes and frozen
Riot manifest. The package belongs to build 16.18.8175716 / standard PC 26.18.
Discovery found every named resource in the skin's resolver; only Sunlight's
three systems are imported here. The independent read-only verifier compares
each selected definition against the retained BIN and every PNG pixel against
the decoded TEX. Field/type/path labels must match their hashes. No live native
client was observed.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-leona-sunlight-particles.py
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/decode-leona-sunlight-particles.py
python3 tools/assets/export-leona-sunlight-particles.py --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/verify-leona-sunlight-particles.py
```

Extraction uses the fixed archive and verifies the existing pin on later runs.
The decoder verifies existing image pixels; the exporter without `--check`
writes profiles. The two verification commands do not write source/assets.
The narrow offline verifier uses labels from the pin and needs no global naming
dictionary. The first verifier attempt omitted its path-label mapping and tried
to load an absent external dictionary; that failed attempt remains preserved.
The corrected verifier supplies all hash tables from the retained definitions.

## Local presentation policy

An active gameplay Sunlight mark selects the champion system for champion
targets and the ordinary system for other eligible targets. Refresh restarts
its clock; removal immediately retires its mark particles. The normal system's
3.5-second authored particle is therefore cut by the current 2.5-second gameplay
mark. Native refresh, expiry and lingering behavior remain unmeasured.

An accepted allied consumption creates one independent detonation, including
a lethal proc. A separate serial consumes neither gameplay identities nor
World RNG. The local first-update convention births all six emitter families
on the following tick: 14 rays, 15 flares in each direction, one streak, one
ring flare and one ring. Source probability tables remain correlated per birth.
The fixed-step drag/interpolation adapter supports deterministic seeks. The
type-zero linger fields do not extend these particles' natural lives. A
65-tick retained history covers the maximum life and endpoint margin.

The source centre buff bone is an explicit provisional anchor; procedural
targets fall back to their root plus 0.9 world units. Hit histories preserve
posed skeletons, placement, heading, target radius and viewing audiences.
Unbound flares retain their birth origin and heading; fully bound layers follow
the sampled target until death/removal freezes the endpoint. Target-size offset
scaling uses captured collision diameter times the authored coefficient.
Native script attachment, bound-size input, inheritance, cadence, PRNG and
shader/framebuffer equivalence remain required comparison work.

Creation and birth audiences must both include the viewing team, and each hit
particle's current position must be visible. A later reveal cannot replay an
unseen birth. Mark visibility follows the living visible target. Terminal
playback drains frozen effects without advancing the saved match. Source
textures and quad geometry are shared; effect retirement releases private
materials and CPU pose samplers. Leona source images are requested only when
her NPC content is present.

Schema 122 stores the cosmetic serial and bounded pose/audience histories.
Validation rejects foreign sources, invalid/duplicate serials, incompatible
rigs, changed target radius, missing frames, invalid pose clocks and changed
detached endpoints/audiences. The ruleset pins all twelve image files and their
decode metadata, as well as the source profiles and history policy. Older
schemas/fingerprints remain incompatible.

## Verification and remaining work

Unit tests cover source export/image pins, first-update populations, mark
appearance values, saved futures, identity/RNG preservation, repeated same-tick
consumptions, lethal detachment and malformed histories. Browser tests measure
pixels from every source layer, exact saved placement, context recovery,
unseen births, shared asset disposal, lethal bursts and finite result playback.
Screenshots were inspected. The [verification ledger](reference/leona/sunlight-vfx-verification.json)
retains source/build/run inputs and the initial failed source-verifier attempt.

Sunlight's named source sound event is retained but source audio is not wired.
Q/W/E/R effects/audio, human controls/selection, support bot policy, native
comparison and full roster/match/browser/offline/performance acceptance remain
required. See [Leona](LEONA.md), [the source rig](LEONA-RIG.md) and the explicit
combat/presentation policy audit.
