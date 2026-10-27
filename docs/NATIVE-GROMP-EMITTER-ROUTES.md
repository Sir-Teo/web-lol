# Gromp's mixed Simple and Complex emitters

The original death-pop Troy explicitly declares `GroupPart1Type=Simple` for
`flash`. The other seven group-type keys are absent. The checked native system
reader defaults missing types to the literal `Complex` and compares against
`Simple` with case-sensitive byte equality. A single legacy-Troy packing rule
would therefore cross distinct native routes within this one effect.

| Compiled profile | Source group | Type declaration | Primitive / checked route |
| --- | --- | --- | --- |
| 0 flash | 1 | Explicit Simple | Optimized pointer queue; packet orientation remains separate |
| 1 lightring | 2 | Omitted → Complex | Legacy CameraQuad, type 0 |
| 2 flashfrog | 5 | Omitted → Complex | Legacy CameraQuad, type 0 |
| 3 chunks | 3 | Omitted → Complex | Legacy CameraQuad, type 0 |
| 4 shadow | 4 | Omitted → Complex | Separate plane primitive, type 1 |
| 5 pop | 6 | Omitted → Complex | Previously checked Ray, type 2 |
| 6 skinshards | 7 | Omitted → Complex | Separate mesh primitive, type 3 |
| 7 popshards | 8 | Omitted → Complex | Previously checked Ray, type 2 |

The [witness](reference/native-gromp-emitter-routes.json) retains three complete
functions (2,500 bytes), 112 selected instructions and four literals. It inherits
the [queue lineage](NATIVE-PARTICLE-QUEUE-ROUTES.md),
[primitive factory](NATIVE-LEGACY-PRIMITIVE-TYPES.md), and original
[Troy/color source](NATIVE-LEGACY-COLOR-CURVES.md) pins. All 272 typed rows and
decoded labels reparse against the original 2,720-byte file. Profile-to-group
indices are checked explicitly; their orders differ.

At `0x101899bb4`, the field reader receives `Complex` as its default. The
comparison at `0x101899bc4` selects the Simple reader and source list `+0x30`
on equality, or the Complex reader and source list `+0x20` otherwise. The
inherited factory's type-zero branch installs CameraQuad vptr `0x102481ef8`,
whose slot `+0x28` points to `0x1018d7f34`. Together with the queue witness, this
narrows the truncating CameraQuad candidates to profiles **1, 2 and 3**.

This is a static source/loader audit. No application rendering policy changes,
native executable/shader execution, captured live dispatch or pixel-parity claim
are involved. Other construction modes, mutation, admission and final material
selection remain unobserved. Flash orientation and plane/mesh packing stay
outside this candidate scope; color backing modes, clocks/RNG, modifiers and
FPCR remain separate questions.

```sh
python tools/assets/native_gromp_emitter_routes.py --check
python -O tools/assets/native_gromp_emitter_routes.py --check
python tools/assets/test-native-gromp-emitter-routes.py
python -O tools/assets/test-native-gromp-emitter-routes.py
```

Fifteen guards per Python mode cover every complete function and selected word,
parent pins, field/default literals, branch direction, CameraQuad target, original
bytes, the explicit Simple declaration, seven omitted declarations, source/group
order and primitive scope. Offline replay blocks sockets and child processes.
The [verification record](reference/native-gromp-emitter-routes-verification.json)
separates fresh static checks from inherited application acceptance.

The separate [plane color reading](NATIVE-PLANE-COLOR-PACKETS.md) follows the
Complex shadow profile through the legacy p-type1 factory and its virtual packet
builder. This source-only extension leaves the application plane policy unchanged.
