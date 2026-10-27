# Exact spatial-drag replay with less repeated work

Yi primary-hit particles replay their motion on the existing local 60 Hz grid.
The sampler now calculates fixed birth/field damping factors and the squared
field radius once per call. It saves the previous position only for the final
fractional step, instead of copying it on every whole step. Integer seeks do
not allocate that unused history buffer.

Acceleration, both damping stages, movement and Float32 endpoint stores retain
their original evaluation order. The spatial field still tests the current
position against its hard radius before movement. Fractional positions interpolate
the same two endpoints; returned travel remains the final replayed velocity.
There is no cache, mutable particle clock, force-policy change or new asset.

The previous sampler was frozen from commit `dd3016f`. A direct comparison of
2,340 complete primary-hit samples covers five seeds, three attack families,
three target radii, integer times and fractional times. All values match exactly
for 14,859 particles, including their motion, color, UV and lifetime outputs.
The 12,280 distinct captured motion calls retain their original numeric values
in a V8 serialization. A separate 192-case comparison covers signed zero,
subnormal and very large finite velocities, zero ages and strong drag.
Two added motion unit cases retain exact multi-step field-boundary interpolation and
verify that frozen caller-owned input vectors remain untouched.

| Runtime | Previous median | Updated median | Sampling time reduction |
| --- | ---: | ---: | ---: |
| Node 24.19.0 | 317.7 ms | 282.8 ms | 11.0% |
| Chromium 154 | 184.2 ms | 152.0 ms | 17.5% |

Each row measures 100,000 motion calls per trial over the captured source corpus.
Seven warmed trials alternate order and retain returned results in a ring.
These are motion-sampler measurements, not game FPS or full-match throughput.
The browser probe uses an empty document, with no game startup or asset loading.

The benchmark records reference/helper/producer/input hashes, raw trials, Node
version, exact-value checks and input ownership. It rejects existing output and
a reference hash mismatch. The V8 input format is runtime-dependent; preserve
the recorded version and corpus digest when rerunning it.

```sh
git show dd3016f:src/render/particle-spatial-drag.ts > .cache/spatial-drag-reference.ts
node tools/qa/benchmark-spatial-drag.mjs \
  --input .cache/particle-spatial-drag/motion-inputs.v8 \
  --reference .cache/spatial-drag-reference.ts \
  --reference-sha256 52b35ce02ba9b1fa73529615a218a5b941d7f3bf2b72fda552c0e0c36a571b86 \
  --output .cache/fresh-spatial-drag-result.json
```

The [verification ledger](reference/particle-spatial-drag-replay-verification.json)
retains measurements, complete sampler comparison, full regression results,
browser Save/reload, production subpath acceptance and source snapshots.
The saved schema remains 163; the ruleset fingerprint changes with the sampler.
Authored profiles, public assets and source/native evidence remain unchanged.

Final validation also exposed missing primary-hit fingerprint roots. Both the
renderer and sampler now root their complete runtime import closure, adding
twelve previously omitted dependencies, including motion, target attachments,
rig sampling and the generated primary-hit profiles. A dedicated compatibility
case verifies real coverage/watching and rejects changes to each selected
renderer, helper, attachment, profile and timing input in an isolated project.
The fingerprint changes deliberately; saved schema and authored data stay fixed.

Final acceptance records 53 focused checks and 3,073 passing unit cases out of
3,076 across 388 files. The same three baseline failures remain at this checkpoint;
the original wave deadline passes. Node QA passes all six cases, all four browser
primary-hit cases pass, and real Save/reload retains 93 exact GPU mips and the next
130 simulation ticks. Fourteen accepted runtime exports retain identical bytes
and timestamps. Production passes 32 recordings, eight fresh screenshots and
zero unintended private preloads. Its 1,200-file offline pack grows by 47 bytes.
