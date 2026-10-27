# Native Gromp missile color routes

The restored 1,114-byte original missile Troy record contains 114 typed rows.
All four group-type declarations are absent, so the checked legacy loader uses
its `Complex` fallback. The [bounded source record](reference/native-gromp-attack-colors.json)
replays the existing checked queue, raw-color, CameraQuad and plane witnesses.

| Emitter | Primitive | Mode | Premultiply RGB / replace alpha |
| --- | --- | --- | --- |
| Mis_orb | CameraQuad | 0 | Yes |
| black_background | Plane | 2 | Yes |
| mis_plane | Plane | 4 | No |
| trailorbs | CameraQuad | 0 | Yes |

Both checked primitive paths call the same truncating BGRA helper. Modes 0 and
2 multiply float32 RGB by alpha and replace alpha with one first. This differs
from the rounded Ray packing path. The source has 13 numbered raw-color keys
across the first three emitters; trailorbs retains its constant white base.
All four omit the ten checked birth/probability color fields.

Original bytes were restored through the frozen manifest, bounded CDN range,
chunk SHA256 and final resource SHA256. The original typed and decoded records
match the existing source ledger exactly. This restores one missile record,
without restoring missing historical evidence closures.

```sh
python tools/assets/native_gromp_attack_colors.py --check
python -O tools/assets/native_gromp_attack_colors.py --check
python tools/assets/test-native-gromp-attack-colors.py
python -O tools/assets/test-native-gromp-attack-colors.py
```

The default input is `.cache/gromp-attack-color-source/sru_gromp_ba1_mis.troybin`;
`--source` accepts another copy with the same exact bytes. Thirteen mutation
and replay guards pass in each Python mode. The immutable-output checks retain
identical bytes and mtimes and reject conflicts/missing check outputs. The
[verification ledger](reference/native-gromp-attack-colors-verification.json)
retains the restoration receipt and bounded extraction recipe.

This increment changes no application behavior. Static routing and conditional
raw color arithmetic do not establish native clocks, random values, cache mode,
external modifiers, material admission, FPCR or complete appearance. The local
missile's root/gravity/height, hit effect and audio remain separate work.
