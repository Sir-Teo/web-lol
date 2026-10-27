# Owned animation timeline capture

Historical hit attachments need a snapshot of the target's animation timeline.
`capturePoseFrame` now uses `cloneAnimationTimeline` instead of the generic
structured-clone serializer. The copier retains every scalar field, property
order and number while allocating a separate primary pose, transition, outgoing
array and outgoing layers for each captured history. It handles null timelines,
interrupted fades, empty outgoing arrays and signed zero without quantization.

This is a copy of the known timeline schema. Primary poses and outgoing layers
contain scalar fields. Adding a nested mutable field requires reviewing this
copier and its ownership checks. Histories share no mutable timeline objects
with live units or sibling captures.

The focused tests compare against `structuredClone`, mutate copies independently,
and retain exact saved futures across Yi, Lux, Garen and Leona histories. The
benchmark accepts either a raw saved match object or a browser audit containing
`before.saved` and `before.future` snapshot strings:

```sh
node --experimental-strip-types tools/qa/benchmark-pose-history.mjs \
  --input path/to/saved-match.json \
  --output .cache/fresh-pose-copy-result.json
```

The command refuses existing output and records producer/helper/input hashes,
runtime, raw trial timings and value/ownership checks. Seven warmed trials
alternate measurement order and retain results in a ring. The six-shape saved
corpus includes a transition. The corpus and every raw timing sample are retained with the measurements.
These figures measure copying alone; they do not imply a game FPS or full-world
throughput improvement.

Validation and final Node/browser measurements are archived in the
[verification ledger](reference/pose-history-capture-verification.json).
The saved schema remains 163; the ruleset fingerprint changes with the copier.
Public assets and particle profiles remain those of the accepted
[primary hit integration](MASTER-YI-PRIMARY-HITS.md).

Final measurements on that corpus:

| Runtime | Generic clone median | Owned copy median | Copy-time ratio |
| --- | ---: | ---: | ---: |
| Node 24.19.0 | 245.6 ms | 4.7 ms | 52.8× |
| Chromium 154 | 350.3 ms | 5.6 ms | 62.6× |

Each row measures 100,000 copies per trial. The browser probe starts on an empty
document and loads no game assets. These are copy microbenchmarks with explicit
limits, not a full-match performance certificate.

All 86 focused cases pass. The full suite records 3,070 passing tests out of
3,073 across 388 files, with the same three documented baseline failures. The
original wave deadline passes. Node QA passes all six cases. The real browser
menu Save/reload restores exact target attachments, all 93 authored GPU mips and
the next 130 simulation ticks. All fourteen prior primary-hit export outputs
retain identical bytes and modification times.

The rebuilt strict production subpath probe passes with 32 recordings, eight
fresh screenshots and zero private-effect preloads. The offline pack retains
1,200 files and grows by 148 bytes. No public asset is changed.
