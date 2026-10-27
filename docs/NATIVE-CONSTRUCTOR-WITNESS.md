# Native particle constructor witness

The restored frozen client now supplies a reproducible, bounded witness for
particle constructor fields and the identified generic BIN loader. The checker
reads the exact arm64 image directly; it needs no native target execution,
disassembler or regenerated historical LLVM text.

The [native record](reference/native-constructor-witness.json) verifies 28 inline
spans, 73 selected word records, 20 direct branches, six type registrations and
seven field registrations. It checks the original 173,303-entry function-start
table and 44 declared adjacent function bounds. These are selected static
observations, not complete function or runtime-dispatch certification.

| Constructor field | Definition offset | Witnessed construction | Current Yi alignment |
| --- | --- | --- | --- |
| Primitive pointer | `0x60` | Registered CameraQuad factory vptr, 24-byte object, kind byte 0 | Nine omitted primitive fields compile to billboards |
| Base texture name | `0x98` | Empty string at `0x102230369` | All eleven Yi base textures are explicit |
| Alpha reference | `0x77` | Byte 5 in packed little-endian store | Seven omitted fields use byte 5; four explicit values remain explicit |

Type/field labels are FNV/layout candidates. They do not authenticate literal
native names or exclude hash collisions. Constructor/factory pointer arithmetic,
callback addresses, sizes, field offsets and exact instruction bytes provide
additional structure. The selected generic loader chain retains constructor
fields when those fields are omitted; actual Yi dispatch and subsequent overrides
remain unobserved. Conversion of alpha bytes by 255 remains a local reader/material
policy, rather than an attested native upload conversion.

The separate [Yi alignment record](reference/masteryi/primary-hit-native-default-alignment.json)
re-decodes all eleven native emitters as LIST80 containing STRUCT82 objects with
concrete type hash `09cde442`. It distinguishes absent fields from explicit ones
and compares the current compiled primitive/alpha choices. The full Master Yi WAD
matches across the native and frozen asset manifests: 116,876,257 decoded bytes,
3,851 ordered chunks and identical chunk IDs/sizes. Its sequence digest is
`2badef070739588eadc792993da5e3b2ef4e444873d1f71ff2fd1540f518bca2`.

The primary-hit profile compiler consumes the immutable constructor record for
omitted primitive and alpha-byte defaults. This replaces literal fallback
values with checked native evidence while retaining the same generated data.
Explicit source fields, local attachment/force choices, shader selection and
all unverified controls keep their separate scope.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/prepare-native-constructor-witness.py --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/test-native-constructor-witness.py
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/test-masteryi-primary-hit-profiles.py
```

If the native payload is missing, restore it using the
[frozen payload restorer](NATIVE-CLIENT-RESTORATION.md). The existing primary hit
source cache is independently hash-checked and reparsed. Existing differing
witness/readings reject rather than overwrite.

Twenty-seven native-image/decoder guards and 33 profile guards pass in both
Python modes. Checks/replays preserve all seventeen outputs in bytes and
modification times, including the fourteen accepted runtime exports. The
application remains at schema 163 and its accepted fingerprint/production pack;
no game code, asset or rendered parameter changes. The original historical
LLVM/collector evidence sets and their missing-input tests are not rebased or
claimed restored. Exact sources and checks are in the
[verification ledger](reference/native-constructor-witness-verification.json).

The later [atlas and packed-flag witness](NATIVE-EMITTER-SCALAR-DEFAULTS.md)
checks three atlas registrations and 22 flag masks in the same frozen client.
It supports the existing one-frame and local-orientation defaults without
changing game parameters.
