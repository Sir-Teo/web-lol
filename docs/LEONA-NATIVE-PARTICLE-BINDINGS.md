# Native particle binding observations

The matching 16.18.8175716 Mac executable now supplies bounded static evidence for generic particle resource fallbacks, material descriptor fields and a conditional Metal backend. It does not establish that Leona's enabled, unnamed-base Activate record reaches these paths or the resulting native frame. The later [emitter-default reading](LEONA-NATIVE-EMITTER-DEFAULTS.md) identifies constructor defaults and registered field offsets.

The durable pin is [leona-native-particle-bindings.json](reference/leona-native-particle-bindings.json). Its whole executable and arm64 slice identities are tied to [leona-native-matching.json](reference/leona-native-matching.json), which retains the official RMAN/chunk provenance. Full raw Hopper responses, exact installed REA 6.4.0 helper/package bytes and SDK headers are retained in `.cache/leona-native-particle-bindings-v1-20261024`. The package excludes bootstrap contents, capability/token, mutable stdin clients, process credentials and live sockets.

All provider responses in this package are **raw direct owned Hopper bridge observations, not REA MCP Evidence**. Assembly and original file bytes are primary; the large duplicated-CFG pseudocode is not used to establish instruction order. No native game, shader or GPU execution was performed.

The initial REA startup waited 120 seconds and timed out while the Hopper demo prompt and full-analysis startup deferred bridge bootstrap. Saving the demo document was blocked. The operator reported all 11 analysis passes completed in 6m13s, followed by reuse of the existing owned authenticated bridge. No target, path, profile or lease was changed, and no bootstrap replay, relaunch or shutdown forgery was used. These are recovery-context reports, not facts authenticated by the static verifier.

## Generic material and resource facts

`1018c2d28` receives a slot and asset identity. After resource loading fails, nil input or the empty sentinel selects manager `+0xa8` for slot zero and `+0xa0` for other slots. A nonempty failed name selects `+0xa8`. The slot-name table at `10247f428` identifies slot zero as `TEXTURE`, slot three as `NORMAL_MAP`, and the other retained lookup, multiplier, palette, reflection and FOW names. Slot numbers in this generic table do not independently establish native shader texture indices.

The manager initializer `101970ad4` supplies source word `0xffffffff` to the `+0xa0` resource and source word zero to `+0xa8`. Both use the same pointer-list helper and backend virtual slot `+0x108`, with arguments `(2,1,1,1,0,pointerList)`. Resource creation can fail and produce a null wrapper. The empty sentinel's initializer derives from a terminated empty string at `102230369`; the separate missing-resource identity derives from the exact literal `doesnotexist.dds` at `102277d39`.

Consequently, **if** Activate uses this generic path with a nil/empty slot-zero input and the resources initialize successfully, it selects the zero-word resource. That condition has not been connected to an actual Leona CPU callsite or BIN-loader/default-material decision.

The newer generic material caller reads a pointer at definition `+0xe8`, loads its first float, and uploads `[scalar,0,0,0]` under `DistortionPower` at `1018c13b4–13dc`. There is no strength conversion in this caller; a null pointer skips the upload. The analogous older caller uses definition `+0x50`. The later [field-registration reading](LEONA-NATIVE-EMITTER-DEFAULTS.md) ties both pointers to `distortionDefinition` and its child FLOAT `distortion` at zero; BIN loading and actual Leona overrides/dispatch remain unobserved. This is not evidence for changing local source strength units.

The alpha setter at `1018c26cc–2718` enables `ALPHA_TEST` for a nonzero byte at definition `+0x11` and uploads that byte divided by 255 as `AlphaTestReferenceValue`. This setter does not establish a native default byte of five, the chosen Leona variant, or pixel-shader alpha-test ordering.

## Conditional Metal texture interpretation

The constructor `101a85e00` publishes vtable `102497568`; its `+0x108` entry points to `101a86bc0`. That factory forwards format argument two to descriptor constructor `101a8e398`. The immutable format table maps index two to 80; the retained SDK identifies 80 as `MTLPixelFormatBGRA8Unorm`. Type index zero maps to Metal type two, `MTLTextureType2D`. Width, height, depth and mip count for the retained initializer are each one.

The factory copies the supplied pixel bytes with `memcpy` and records a Metal buffer-to-texture blit. No channel conversion occurs in those instructions. **On this Metal implementation, with successful resource creation/upload**, source word zero represents sampled RGBA `(0,0,0,0)` and `0xffffffff` represents `(1,1,1,1)`. The getter's actual selected backend and successful runtime upload have not been observed.

## Generic sampler propagation

The generic material lookup `101951e58` walks 32-byte records. The kind-seven branch at `1018c17c8–1844` writes bytes `+0x10/+0x11/+0x12` to one for `DIFFUSE_MAP`, `FALLOFF_TEXTURE` and `PARTICLE_COLOR_TEXTURE`.

Those three bytes are three independent **address axes** in the traced generic route. They are not minification, magnification and mip-filter bytes:

- `101954898` copies material `+0x10/+0x11/+0x12` into 40-byte RHI records at `+0x18/+0x19/+0x1a` (`101954ec4–ed8`).
- Its virtual dispatch at `+0x88` maps, for the published Metal vtable, to `101a866f4`, then `101a83444`. That constructor invokes `101a83aa8` twice.
- `101a83aa8` traverses the 40-byte records with a cursor at `record+0x23`; loads at cursor `-0xb/-0xa/-9` pass the three address values independently to `101a83d54` as S/T/R.
- The immutable address table at `1021346d0` is `[2,0,3,5]`. Retained SDK definitions label these Repeat, ClampToEdge, MirrorRepeat and ClampToBorderColor. Thus value one maps to ClampToEdge on all three axes in this route.

A different consumer, `101a8e23c`, uses object byte `+0x10` for all three axes, `+0x11` for both min/mag, and `+0x12` for mip filtering. Another sampler object, consumed by `101a8a8e8`, has separate axis bytes `+8/+9/+A`. These layouts must not be interchanged.

The generic descriptor-to-Metal sampler-state construction chain also reaches a static binding callsite. Constructor `101a83444` places its second sampler array at object `+0x88`. Consumer `101a85204` reads that array/count, traverses 16-byte entries, and passes each state and index to `setFragmentSamplerState:atIndex:` at `101a85970`. The verifier independently decodes that BL target, Objective-C stub selector reference and terminated selector string from the original file.

Actual Leona dispatch, selected backend, resource creation/upload success, invocation at a particular draw/native frame and native GPU behavior remain gates. The companion [Solar Flare sampler correction](LEONA-R-NATIVE-SAMPLERS.md) uses this generic address policy locally; it does not establish actual native Leona dispatch.

## Offline verification

Run:

```sh
python3 tools/assets/verify-leona-native-particle-bindings.py --check
```

The standard-library verifier reads hashes, Mach-O headers/section mappings, selected instruction bytes and ARM64 masks, branch targets, immutable pointer/value tables, slot-name/literal bytes and retained SDK enums. It does not connect to a bridge, import or execute provider helpers, run an analyzer/compiler, access the network, write outputs or execute the target. The earlier native-matching verifier remains responsible for the full official-CDN chunk reconstruction.

Native Leona CPU dispatch, application of constructor defaults during BIN loading, full frame/render-state behavior, native GPU observation, SCB normal generation and ordinary reflection CPU bindings remain unresolved.
