# Ahri W rendering preparation

This branch starts from the verified schema 178 W visual history. The primary
work branch still runs the accepted Q projectile renderer. W particle assets
remain private and W source rendering is not yet connected to the scene.

The history adapter dispatches only orbit, flight and genuine hit groups. Cast
and weapon resources remain unjoined. Orbit placement ends at the saved dispatch
anchor; flight begins from that anchor and follows actual moved samples. Impact
placement retains the terminal heading. Enemy unbound samples require visibility
at both interpolation neighbours; an exact visible sample can enter sight.

Phase paths cache cumulative source-unit distance between immutable history
updates. Binary searches support seeks in either direction, and weak fire keys
release replaced histories. New samples, dispatch/end anchors and refreshed birth
visibility invalidate the cached path. Five focused adapter tests and TypeScript
checking pass. These are placement preparations, not visual acceptance.

## Staged public assets

The [publication ledger](reference/ahri/w-publication.json) stages all 30 profiles,
35 textures / 292 mips and two native-coordinate GLBs. Twenty-nine PNGs and two
GLBs add 31 files / 1,776,675 bytes. Three textures borrow Q cast ownership and
three borrow Q projectile ownership after complete native identity, mip and PNG
byte comparisons. No duplicate shared texture is published.

The whole output closure is checked before any file is written. Normal and
optimized guards reproduce the package from committed transports, reject eight
changed input pins, corrupt borrowed assets and symlinks, and prevent partial
publication on a final-ledger conflict. Three asset tests verify exact public
bytes, ownership and preserved missing/signed source fields. All 30 authored
profiles remain available; the scene will consume only the 23 joined orbit,
flight and hit profiles. No W source rendering is connected yet.

## Joined asset loader

The lazy page-owned loader selects the 23 joined profiles: 30 texture references
and the sharp flight mesh. It loads 24 W textures, borrows three textures from
each Q owner, and excludes the five cast-only textures and swirls geometry.
Failed mesh loads can retry without discarding verified textures. Concurrent
calls share one promise; owned mesh coordinates convert once to metres while
native normalized RGBA and absent normals remain preserved. The BGRA shader
attribute derives directly from the retained source colors.

The loader test uses the actual GLB and verifies every position/color component,
retry behavior, address-mode sampler caching, borrowed ownership and excluded
cast-only requests. It does not attach the renderer to the scene.

## Native flag types

The [native type reading](reference/ahri/w-native-types.json) retains all 65
ordinary emitter field names (the 66th projected field is the struct type),
including 82 authored FLAG fields across all 30 emitters. It reparses the pinned
original BINs after the existing complete-native verification. Normal and
optimized checks reproduce the same reading.

`ParticlesShareRandomValue` is native FLAG `0x87`, payload `1`. CDTB serializes
that payload as an integer; the type reading keeps its native flag identity
separate from the raw JSON. Rotation, direction and single-particle controls
also use FLAG tags. This evidence does not certify a native random stream.
Rechecking the type reading requires the retained native source and decoder;
the portable CI source checks do not claim to reparse those private inputs.
