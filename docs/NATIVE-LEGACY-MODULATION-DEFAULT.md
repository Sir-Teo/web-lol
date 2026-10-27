# Legacy emitter modulation default

The checked legacy loader supplies `[1,1,1,1]` as the default for
`e-color-modulate`. A bounded static trace follows that tuple through the color
reader's missing-value path, constant-value evaluator and store to emitter
definition offset `+E0`. This complements the earlier
[legacy primitive mapping](NATIVE-LEGACY-PRIMITIVE-TYPES.md) and
[fallback DDS resources](LEGACY-PARTICLE-DEFAULT-TEXTURES.md).

The caller places float ones at `SP10` and `SP20`, then passes `SP20` as the
four-float default to `10189c878`. If its lower color reader returns false, the
wrapper stores the supplied tuple at object `+58` and sets count `+54` to 1.
The constant predicate additionally requires a null probability pointer.
Vtable slot `+50` evaluates this single value into the caller's output. The
count-one evaluator returns the four stored floats directly; the caller stores
the result at definition `+E0`.

| Checked function        | Start       | Role                                         |
| ----------------------- | ----------- | -------------------------------------------- |
| Legacy color wrapper    | `10189c878` | Supplied defaults and constant output        |
| Single-value predicate  | `10188c898` | Count equals one                             |
| Constant predicate      | `10188c8a8` | Single value with no probability pointer     |
| Constant output wrapper | `10188d200` | Four-float result storage                    |
| Color evaluator         | `10191c180` | Direct return for count one                  |
| Color reader            | `101922e60` | Immediate false return when key reader fails |
| Color key reader        | `10192336c` | Base value and numbered-key parsing          |
| Section hash prefix     | `10162f4d8` | ASCII folding, SDBM and separator 42         |
| Field hash composition  | `101632c54` | Append field to section prefix               |
| String lookup wrapper   | `10163036c` | Empty fallback and explicit missing path     |

The native hash helpers fold ASCII uppercase letters, multiply by 65599 and
append `*` between section and field. The complete retained typed Troy rows
contain neither the base modulation key nor its first numbered curve key for
either Gromp Ray emitter. The check searches every typed row, including rows
without a recovered label.

| Section     | Base key hash | First numbered key hash |
| ----------- | ------------- | ----------------------- |
| `pop`       | `85036d84`    | `295bf3ad`              |
| `popshards` | `3abfffaf`    | `74eeec42`              |

The string lookup wrapper has multiple configuration-mode branches. Its
explicit missing path copies the supplied empty default and returns false.
The color key reader stops at an empty first numbered field and returns false
when neither base nor first key exists. Live parser flags and all backing-store
implementations are not observed here. This is a conditional default chain,
plus exact source-key omissions, rather than a live Gromp execution trace.

Ten complete function spans, 85 selected instructions, two literals, three
vtable slots and seven direct calls are checked against the matching native
executable. Fourteen guard groups run in normal and optimized Python, covering
every span and selected word, function bounds, vtables, literals, source pins,
unlabeled field insertion, ASCII hashing and inherited Ray scope. Offline
observation blocks sockets and subprocesses.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/native_legacy_modulation_default.py --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/test-native-legacy-modulation-default.py
```

No game asset, sampler, prepared color, blend policy or saved state is changed.
Native curve resampling, prepared-RGBA arithmetic, actual live dispatch and
complete composition remain outside this evidence. Native game code and Metal
shaders are not executed. The [record](reference/native-legacy-modulation-default.json)
and [verification ledger](reference/native-legacy-modulation-default-verification.json)
retain source identities and replay evidence.
