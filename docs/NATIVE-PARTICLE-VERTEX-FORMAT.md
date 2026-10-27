# Native particle vertex declaration and Metal bindings

The [vertex-format witness](reference/native-particle-vertex-format.json)
connects the first declaration assembled by the particle buffer setup routine to
its Metal factory, constructor, stream binder and format setter. It checks six
complete native functions, 28 selected instructions, seven Objective-C selector
stubs and the native loader bindings. No target code or Metal shader is executed.

| Attribute | Byte offset | Metal format | Input |
| --- | --- | --- | --- |
| 0 | 0 | 30 / Float3 | Position |
| 3 | 12 | 9 / UChar4Normalized | Packed color |
| 8 | 16 | 27 / Half4 | UV0 and frame values |
| 9 | 24 | 25 / Half2 | Lookup / secondary UV |

All four attributes bind the same supplied vertex buffer with stride 28. This
matches the separately recovered [quad](NATIVE-ATLAS-RUNTIME.md) and
[ray](NATIVE-RAY-PACKET.md) CPU packets. The setup routine creates four layout
variants; this record reconstructs its first 28-byte variant. Draw-specific
selection of this layout and the default quad shader remains unobserved.

The declaration initially encodes color as internal type 1 with component count
1. The Metal constructor copies eight bytes per attribute and changes that
type's component count to 4. The format updater maps it to value 9. This prevents
mistaking the initializer's count for a one-byte color attribute. Position maps
to Float3; the two half descriptors map to Half4 and Half2.

The initializer writes descriptors into BSS after a guard check. The producer
reconstructs those bytes from checked instructions and constant-pool loads; it
does not pretend to have read initialized native BSS memory. It also verifies
the virtual device factory slot, the constructed layout's stream-binding slot,
the descriptor-copy wrapper and its `_memcpy` import.

The format setter calls `attributes`, `objectAtIndexedSubscript:`, `setFormat:`,
`setOffset:` and `setBufferIndex:` through checked Objective-C stubs. The
Mach-O binding stream resolves the class reference to
`_OBJC_CLASS_$_MTLVertexDescriptor` in Metal.framework and the common message
pointer to `_objc_msgSend` in libobjc. The allocation stub resolves to
`_objc_opt_new`. The bounded decoder checks the frozen 11,360-byte binding stream
and its 2,297 entries. Valid 64-bit wrapped address deltas occur in this stream;
the decoder handles them while rejecting out-of-range bindings and malformed
integers or opcodes.

Apple's public [Metal C++ archive](https://developer.apple.com/metal/cpp/files/metal-cpp_macOS15_iOS18.zip)
provides the ABI enum mapping. The producer checks the archive and header hashes
and verifies Float3=30, UChar4Normalized=9, Half4=27 and Half2=25. It also checks
the distinct BGRA format value 42. Value 9 normalizes byte lanes without that
BGRA format's channel reorder; the separately pinned default quad shader applies
its own BGRA swizzle. The Apple header is a public ABI reference, not evidence
that this SDK or compiler built the native client.

This establishes the normalized-byte and half input formats for the first
layout when selected. It does not establish live shader selection, native
color-space, blend, texture sampling or output-target state, or resolve the ray
builder's prepared-record producers. No application behavior or asset changes
in this checkpoint, and missing historical LLVM archives remain unresolved.

```sh
python3 tools/assets/native_particle_vertex_format.py --check
python3 tools/assets/test-native-particle-vertex-format.py
```

The producer requires the restored native executable, existing witness pins and
the cached Apple archive. It performs no download. The archive is 195,223 bytes
with SHA-256 `0433df1e0ab13c2b0becbd78665071e3fa28381e9714a3fce28a497892b8a184`.
All sixteen new guard cases pass, including offline replay, altered native
spans/words/constants/slots/selectors, SDK corruption and malformed binding
streams. Normal/optimized replays and the inherited application certificate are
retained in the [verification ledger](reference/native-particle-vertex-format-verification.json).
