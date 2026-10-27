# Native particle definition and draw queues

The [bounded witness](reference/native-particle-queue-routes.json) connects source
system fields to prepared definitions, runtime emitter objects, queue insertion,
and the consuming draw dispatcher. It retains eight complete functions
(19,356 bytes), 260 selected instructions, ten direct calls and the job's
virtual dispatch target. The native executable and shaders were never run.

| Checked path | Complex emitters | Simple emitters |
| --- | --- | --- |
| Registered source field | `complexEmitterDefinitionData`, offset `0x20` | `simpleEmitterDefinitionData`, offset `0x30` |
| Prepared list in definition wrapper | Pointer `+0x08`, count `+0x10` | Pointer `+0x18`, count `+0x20` |
| Prepared emitter wrapper allocation | `0xe0` bytes | `0x98` bytes |
| Runtime constructor | `0x1018f4f08`, `0x120` bytes | `0x1019052ec`, `0x160` bytes |
| Runtime system list | Pointer `+0x30`, count `+0x38` | Pointer `+0x40`, count `+0x48` |
| Draw queue | 32-byte records, runtime pointer at `+0x10` | 8-byte runtime pointers |
| Consumer | `0x1018decbc`, inherited primitive virtual slot `+0x28` | `0x1018f1bc4` for quad kinds 0/1 |

Offsets refer to the object named in each row. They cannot be carried unchanged
between object layouts. The legacy runtime constructor stores float −1 at
object `+0x10`; the optimized runtime constructor clears a pointer there.
The new lineage resolves the earlier mistaken possibility that those two
observations described the same runtime object.

`0x101898bc8` reads the raw definition through prepared wrapper `+0x38` and
populates the separate lists. Its complex and simple source loops stay distinct
through this adapter. Admission filters and a third source-list branch are
retained in the complete function; this record does not turn them into an
invented general optimization predicate.

`0x1018fd41c` stores its prepared-definition argument at runtime system `+0x1d0`
and calls `0x1018fda18`. That factory consumes the prepared lists, invokes their
separate constructors, and appends the results to their corresponding runtime
system lists. `0x1018e735c` then creates the two queues. Its stack job installs
vptr `0x102486810`; slot `+0x18` contains `0x101915d68`, reached through the
checked virtual call at `0x1018e8870`. The dispatcher sends the 32-byte records
to the legacy consumer and optimized pointer batches to the optimized quad
consumer at both checked batch flush sites.

The inherited [CameraQuad packet witness](NATIVE-CAMERAQUAD-PACKETS.md) connects
the legacy primitive builder to truncating byte packing. The optimized route
has separate local truncation and billboard clamp/FMA rounding. This new record
connects those conditional routes to source emitter classes through this
adapter and factory. It adds no rendering policy: individual exported effects,
alternate loaders or mutations, live admission, primitive/material selection,
prepared color, texture composition, native clocks/RNG and FPCR still require
their own evidence. No live native draw or pixel parity is claimed.

Reproduce without a disassembler, network or target execution:

```sh
python tools/assets/native_particle_queue_routes.py --check
python -O tools/assets/native_particle_queue_routes.py --check
python tools/assets/test-native-particle-queue-routes.py
python -O tools/assets/test-native-particle-queue-routes.py
```

The guards reject changed complete-function bytes, selected words, source hashes
and offsets, allocations/constructors, runtime list/queue insertions, dispatch
calls and job vptr/slot. Inherited packet checks remain active. Outputs use the
existing immutable writer: conflicts reject, check mode creates nothing, and
identical replays preserve timestamps. The [verification record](reference/native-particle-queue-routes-verification.json)
records fresh static checks separately from inherited application acceptance.
