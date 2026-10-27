# Legacy particle fallback DDS resources

The two literal fallback paths supplied by the
[legacy emitter loader](NATIVE-LEGACY-PRIMITIVE-TYPES.md) resolve in the frozen
26.18 `DATA/FINAL/DATA.wad.client` archive. This resource checkpoint verifies
what those files contain; it does not establish live Gromp shader binding.

| Resource                                      | DDS bytes | Format   | Base size | Declared mips |
| --------------------------------------------- | --------: | -------- | --------- | ------------: |
| `DATA/Particles/DefaultColorOverLifetime.dds` |       136 | BC1/DXT1 | 4×4       |             1 |
| `DATA/Particles/DefaultFalloff.dds`           |     2,192 | BC3/DXT5 | 256×1     |             9 |

The color fallback is opaque white at every texel. This supports the existing
white substitution for that resource's sampled color, conditional on matching
binding and sampling. It introduces no lifetime gradient.

The falloff base has opaque alpha and 30 nonwhite RGB texels at its end,
reaching black. Its smaller declared mips have materially different RGB and
alpha values; the record preserves every level's dimensions, byte extent,
channel extrema and decoded hash. No inference about the native selected mip,
filtering, UV routing or use follows from these decoded bytes.

The original Gromp pin already binds the WAD header chunks and the color DDS
chunk. The falloff required one newly observed 453-byte RMAN chunk. Its range is
bound by the same SHA256-verified manifest. Its decompressed WAD payload matches
the xxh3 checksum in the already verified WAD header; the newly observed RMAN
chunk is then frozen by SHA256. It is not added to or represented as part of the
older Gromp certificate. Original response framing and source receipts are
retained in the verification evidence.

A bounded independent BC1/BC3 decoder agrees with Pillow on all ten declared
mips. Thirteen negative guards reject altered chunk bytes, wrong chunk binding,
malformed headers, unsupported dimensions/formats, missing mip data and trailing
payload. Three known-block checks cover RGB565 endpoints, BC1 transparency and
BC3 alpha interpolation. Normal and optimized Python checks run offline with
socket creation and subprocess execution blocked.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/legacy_particle_default_textures.py --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/test-legacy-particle-default-textures.py
```

`--restore` can retrieve missing chunks using frozen SHA256 values and bounded
HTTP range validation. The default check uses local caches. It writes no game
assets and does not execute native game code or Metal shaders. The application
retains the accepted [Gromp packet checkpoint](GROMP-RAY-PACKETS.md).

The [resource record](reference/legacy-particle-default-textures.json) and
[verification ledger](reference/legacy-particle-default-textures-verification.json)
retain the inputs and replay evidence.
