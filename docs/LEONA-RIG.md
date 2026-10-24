# Leona source rig in the development browser

The browser now renders Leona NPCs with the retained base-skin model and saved
body animation state. Open `?scene=fixture&npc=leona` in development to create a
level-six NPC with Q/W/E/R learned. Matching development saves also load the rig
without the query. Human selection and normal Rift spawning remain gated.
This is progress toward the complete playable champion; spell effects, source
audio, native rendering/dispatch comparison and support bot integration remain
required. See [the implementation](LEONA.md) for combat policy and gaps.

## Retained asset

`public/assets/models/leona-base.glb` is the exact preserved-key research
candidate: 6,253,628 bytes, SHA-256
`5b845c3ba98ca15fdf61bb3eb549d54b858709c051c3c03f1cb26f76c890e5a9`.
It contains 81 bones, 8,634 triangles, 23 clips, 5,475 animation channels and
608,016 keys. Source normals, skin weights and key times/values are retained
after the declared unit conversion; no quaternion repairs were needed. The
earlier resampled candidate that omitted normals is not used.

The sidecar retains the frozen Riot build 16.18.8175716 manifest/archive/input
pins and conversion policy. `reference/leona-model.json` retains the full source
skin and animation graph export. This increment imports existing audited bytes;
it does not claim a new native extraction or native-client playback comparison.

```sh
node tools/assets/import-leona-model.mjs --check
```

That command checks the canonical asset without writing or requiring research
cache files. Without `--check`, the importer requires the retained research
candidate and its exact key audit. Duration exporters include Leona in both
champion and mobile tables. Ordinary startup only requests Leona's GLB when
the world contains her; it is not added to every game's preload list.

## Body playback and saved state

Idle, locomotion, two ordinary swings, critical hits, death and Q/W/E/R use
Leona's own clips. Attack3 is retained but has zero authored ordinary weight.
The deterministic two-slot selector consumes no gameplay RNG. Eclipse captures
its ordinary swing variant when the attack starts, so expiry cannot replace the
clip mid-swing. Q retimes Spell1 to the existing local fifteen-tick contact and
53-tick automatic cycle. W uses its cast and idle/run/attack variants; E uses
Spell3 through the owned dash; R uses Spell4. Buffered orders and overlapping
Q/W/Flash preserve a committed E/R cast clock.

Recall follows the source sequencer's `{b4dcde19}`, `Idle3`, `Idle1` entries;
the first entry aliases the taunt animation. The game uses an eight-second
recall, so the last stage is retained even though ordinary recall finishes before
reaching it. Death takes priority, and paused renders do not advance pose clocks.

Clip dispatch, W variant choice, rates, timing, Q contact retiming, dash hold and
the shared 80ms fades remain explicit local policies. Native masks, graph
transitions and script dispatch have not been reconstructed. The imported
material uses source diffuse with unlit preview shading. Reflection, gloss and
native lighting remain unfinished. Zenith's unimported projectile effect does
not draw a substitute generic arrow; source spell VFX/audio are separate work.

Schema 121 pins the GLB/sidecar and stores Leona timelines and captured Eclipse
variant. E/R windups require matching cast clocks. Earlier schemas/fingerprints
remain incompatible. See [saved checkpoints](SAVES.md).

## Verification scope

The source-key comparison was repeated against the canonical GLB: all channels,
key times/values, indices and attributes match the converted source after the
declared conversion. glTF validation reports zero errors and warnings. Browser
sampling compares raw and runtime-loaded clips across every clip and six blend
pairs: 225 poses and 1,481,625 vertices, zero displacement and zero vertices
outside the conservative bound. The current constant-track pass removes no
Leona channels. The sphere is conservative, not a performance improvement claim.

Browser tests inspect actual private skeleton matrices and weighted actions
after reconstruction from saved snapshots. They also check NPC save loading,
optional asset requests, visible rig pixels, WebGL loss/recovery, private bone
texture disposal and preservation of shared geometry/materials. Unit tests
check source pins, dispatch, saved futures and strict malformed-pose rejection.
Rendered screenshots were inspected; this is browser evidence, not native pixel
parity. Run artifacts, failed attempts and final verification are retained in
the pinned [verification ledger](reference/leona/rig-verification.json).
