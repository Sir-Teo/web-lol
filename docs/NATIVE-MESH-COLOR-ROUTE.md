# Legacy mesh color route

Gromp's skin shards follow a separate mesh primitive path. The legacy quad
consumer explicitly excludes kind3, and the mesh vtable's quad-builder slot is a
four-byte return stub. Extending the billboard/plane byte writer to this mesh
would lack the required source support. This reading changes no runtime behavior.

The [bounded record](reference/native-mesh-color-route.json) retains five complete
functions (7,856 bytes), 110 selected instruction words and the virtual-slot bytes.
It replays against the checked ARM64 image without network, a disassembler or
native game execution, and inherits the checked factory/source class evidence.

| Link | Checked result |
| --- | --- |
| Original source | Gromp group7 / compiled profile6, `skinshards`, Complex, p-type3 |
| Factory branch | `0x10189bb74`, 144-byte object, kind3 at offset8 |
| Vtable / quad slot | `0x1024861e0` / offset40 → `0x101914694` (`RET`) |
| Legacy quad consumer | Kind mask `0x30888` excludes 3/7/11/16/17 |
| Separate selector | `0x1018e1240`, mask `0x70848`, includes kind3 |
| Separate draw call | `0x1018e15ac` → `0x1018df18c` |
| Color product | Float32 modulation RGBA × draw-record RGBA |
| Value transfer | `0x1018df6e0` → `0x1019536c4`, conditional 16-byte Q0 copy |

The separate selector tests three override fields before its mask path, so the
mask is not its entire admission policy. The draw routine consumes 44-byte
records; its adjusted pointer locates RGBA at record offset4. Definition
modulation lives at offset`0xe0`. It conditionally premultiplies RGB and sets A=1
when `(blend | 2) == 2`. The authored mode1 skips that branch.

The called setter searches for a parameter identity, compares its stored 16-byte
value, and copies the supplied Q0 when the matching value changes. This checked
copy does not convert RGBA to bytes. The identity is loaded from mutable zero-fill
global `0x1025e8568`; its live initialization, name and shader binding remain
unresolved. Later material/shader conversions are not certified by this reading.

```sh
python tools/assets/native_mesh_color_route.py --check
python -O tools/assets/native_mesh_color_route.py --check
python tools/assets/test-native-mesh-color-route.py
python -O tools/assets/test-native-mesh-color-route.py
```

All 15 guards pass in each interpreter mode. They mutate complete bytes, selected
words, bounds, input pins, switch/vtable targets, factory stores, selector masks,
float-copy sources, branch/call targets, source bytes and profile/blend scope.
Identical outputs retain their bytes and modification time; conflicting outputs
and missing `--check` destinations reject without mutation or creation.
The [verification record](reference/native-mesh-color-route-verification.json)
retains these checks and inherits application acceptance from `891abcc`.

Actual queue scheduling, native draw admission, live color backing/cache mode,
phase, clocks/RNG, external modifiers, FPCR, material/layout/shader selection and
complete appearance remain outside this evidence. Geometry, UVs and textures
stay unchanged. An independent conditional raw-key arithmetic projection is the
next step; this source record does not certify that future runtime change.
