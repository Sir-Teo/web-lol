# Daybreak shield and contact particles

The development NPC browser now reconstructs Leona's Q shield system and
contact system from their retained source definitions. All fifteen emitter
records are preserved; two impact records are explicitly disabled, leaving six
shield families and seven enabled contact families. Seventeen TEX dependencies
decode to 453,684 PNG bytes without resizing. Shared Sunlight images keep the
same pixels and are borrowed by both renderers.

This extends the [Leona simulation](LEONA.md), [source rig](LEONA-RIG.md) and
[Sunlight effects](LEONA-SUNLIGHT-VFX.md). Human selection/input, source audio,
W/E/R presentation and native acceptance remain required work.

## Frozen source and defaults

`reference/leona-q-particles.json` retains the two complete BIN records and
their Riot build 16.18.8175716 archive/manifest/bundle provenance. The decoded
sidecar pins every source and output image. Missing particle-life, emission,
color and lookup defaults follow the separately pinned external reconstruction
reader; they are not presented as observed native CPU defaults. The source
exporter rejects unhandled fields/dynamics and preserves the disabled records,
source passes, blend modes, lookup selectors, delays, drag, acceleration,
probability tables, filtering and navigation-mask declarations.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-leona-q-particles.py
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/decode-leona-q-particles.py
python3 tools/assets/export-leona-q-particles.py --check
python3 tools/assets/export-leona-q-particles.py --check --readers
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/verify-leona-q-particles.py
```

The ordinary export check needs repository files only. `--readers` additionally
checks the retained external reader bytes. The offline verifier compares both
complete selected BIN definitions and every decoded PNG pixel to the retained
TEX input. Native source audio and script dispatch are not observed by it.

## Saved presentation

Each accepted Q activation owns a rank, activation/stop reason, caster pose
history and at most one confirmed contact. Recast, expiry, consumption, death
and victory close its shield system. A Q committed before empowerment expiry
can still dispatch its contact afterward. Target loss does not invent an
impact. Cosmetic records consume no gameplay IDs or RNG.

The shield uses `BUFFBONE_CSTM_SHIELD_MID` as an explicit local attachment.
Contacts use the existing target centre-bone sampler and procedural fallback.
Both sample saved skeleton poses; death/removal freezes their endpoint. Contact
placement also retains structure transforms, target radius, heading and viewing
audiences. Creation and birth audiences gate contact particles; hidden shield
births cannot replay on later reveal, while later visible continuous births
can appear. Current particle sight remains required.

The local first-update convention emits zero-delay particles on the following
tick and positive-delay particles on their first eligible tick. All source
probability tables remain correlated per birth, with a separate fixed lookup
roll. Stepped drag and draw-time world acceleration follow the existing pinned
reconstruction policy. Type-zero stop settlement caps natural lives instead of
extending them. Generated bounds retain 62 caster-tail ticks and 77 contact
ticks; the full profile table stays in the lazy renderer chunk.

The two enabled ground sigils use vertical terrain projection and a conservative
walkability mask. The mask keeps its GPU index capacity and can restore cells
after a later projection. This is a local policy, not equivalence to a native
navigation-mask texture. Target-size scaling uses captured collision diameter
times the source coefficient. Source primitive UV conventions, render passes,
blend modes and depth flags are applied. The nonzero color-render flag is
retained in the profile; its complete native stage remains unverified.

Schema 123 adds bounded per-owner Q presentation arrays and requires an active
empowerment to have its matching visual record. Decoding checks owner/rank,
activation/contact clocks, target identity/rig/radius/transform, pose frames,
stop phases and frozen endpoint/audience consistency. Older schema/ruleset
saves remain incompatible. The fingerprint pins profiles, all Q image bytes
and decode metadata.

## Verification scope and remaining acceptance

Unit coverage includes source reproducibility, disabled emitters, delayed births,
stop settlement, exclusion keywords, saved futures, expiry during commitment,
recasts, target loss, lethal endpoints, strict decoding and ground-mask reuse.
Browser coverage measures actual pixels for every enabled family and inspects
saved geometry, context recovery, hidden births and terminal playback. Evidence
and any failed attempts are retained in the
[verification ledger](reference/leona/q-vfx-verification.json).

At schema 123 / ruleset `18058f085b96c376177780b67d7783fbb24ce283043ecca3daf394c80fcecb30`,
all 1,607 unit tests across 278 files, three Node QA checks, TypeScript and
sixteen targeted Chrome cases pass. Production smoke passes under `/nested/rift/`
with no development hook or ordinary-world Leona preloads. Two ten-minute
normal-roster simulations pass 72,000 tick checks, twenty exact round trips and
eighteen future comparisons; all twenty checkpoints equal the preceding
Sunlight revision after normalizing only schema/ruleset and the new empty Q
visual arrays. These two active-at-horizon matches do not certify the full
100-seed cohort or complete Leona kit. The final evidence archive retains 304
source inputs, 28 generated build files and nineteen raw particle sources.

```sh
node tools/qa/verify-leona-q-vfx.mjs
```

Use `--historical` to verify retained evidence after canonical sources change.
The initial exporter-field rejection, browser helper failure and five reproduced
contradictory saved-phase cases remain frozen beside the repaired final run.

Shield/target attachment choice, native defaults, mask and bound-size semantics,
cadence/PRNG, color-render flags, blending/shading and source sound dispatch
remain comparison targets. Complete champion interactions, controls, support
AI, roster/full-match, browser/offline/performance and native acceptance remain
open. Source assets and passing browser checks do not establish native parity.
