# Native missile gravity height

The checked native GravityHeightSolver candidate has a runtime factory and a
float32 height evaluator. FixedSpeedMovement's checked runtime table leads to
its progress function and the caller that applies the height result. This source
reading narrows Gromp's remaining flight-height gap; it changes no game behavior.

The [bounded record](reference/native-missile-gravity-height.json) retains 21
complete functions (15,472 bytes), 447 selected instructions, five field
registrations and eight selected config/runtime table slots. Function bounds,
complete bytes, literal defaults, callback links and the exact native image are
checked without native game or shader execution. Names matched through FNV are
candidates, rather than authenticated native literal strings.

| Config object | Field candidate | Offset | Frozen Gromp source |
| --- | --- | --- | --- |
| Gravity solver | `mGravity` | 8 | 1500 |
| Movement base | `mTargetHeightAugment` | 12 | 100 |
| Movement base | `mOffsetInitialTargetHeight` | 16 | 100 |
| Movement base | `mStartBoneName` | 48 | `root` |
| Fixed speed | `mSpeed` | 92 | 1800 |

The compiled Gromp spell matches its complete frozen character-source object.
Its height-solver object authors only gravity and the concrete type. Its facing
object is `VeritcalFacingMatchVelocity`; facing code is outside this reading.
Source values do not by themselves establish native loaded or live values.

The gravity config constructor stores `[0, FLT_MAX]` at offsets 8/12 and clears
byte16. Its runtime factory copies those two floats and byte, clears ready byte17,
and replaces the owner's solver at offset48. Runtime setup reads the planar
speed magnitude. A near-zero speed returns before becoming ready. With the
constructor's optional-height value `FLT_MAX`, setup skips gravity adjustment
and sets ready; a smaller optional height follows the separately retained branch.

For finite, nondegenerate inputs, the checked evaluator describes this parabola:

```text
T = planar endpoint distance / (planar speed magnitude + epsilon)
t = T * progress
a = -0.5 * gravity
v = (targetY - originY) / T - a * T
height = originY + t * (v + a * t)
```

The retained instructions specify float32 operations, including FMADD/FMSUB;
the algebra above does not prescribe a JavaScript evaluation order. Near-equal
old/new planar positions or near-equal planar endpoints return the previous Y.
The checked epsilon has float32 word `3727c5ac`. No target FPCR, rounding or
flush mode has been measured.

The FixedSpeedMovement config constructor installs its checked table. Its
factory calls a property-preparation helper before the runtime constructor;
that helper's body remains outside scope. The base runtime constructor copies
a target point into offsets124–132, adds the config's initial-height offset to
its Y, copies the later target-height augment separately and initializes the
origin at offsets112–120 to the zero sentinel.

The runtime progress method uses the planar distance from that origin to the
predicted missile point, divided by the planar origin-to-target distance and
capped at one. Completion and near-equal branches return one. The height caller
uses that progress, origin, target, previous/new points and a missile vector,
then subtracts the saved missile Y from the returned height and writes the
vertical output offset.

Origin initialization has a conditional direct copy from the missile position
and another branch that reads encoded incoming override fields. Initial bone
sampling, those live overrides and later target refresh remain unresolved.
These gaps leave the current local 0.9-unit height policy unchanged. Native
trajectory reconstruction remains unfinished.

```sh
python tools/assets/native_missile_gravity_height.py --check
python -O tools/assets/native_missile_gravity_height.py --check
python tools/assets/test-native-missile-gravity-height.py
python -O tools/assets/test-native-missile-gravity-height.py
```

The 17 guards mutate complete functions, every selected word, bounds, pins,
field names/offsets/wrappers, all selected table slots, defaults, literal address
instruction types and source values/omissions. The
[verification ledger](reference/native-missile-gravity-height-verification.json)
retains normal/optimized replay, immutable-output checks, provisional scope
extensions and the inherited application identity. No application checks are
claimed as freshly rerun for this source-only change. The match cohort remains
running without a pause for this work.
