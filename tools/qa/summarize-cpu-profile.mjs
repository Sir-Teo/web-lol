/** Summarize a Chrome CPU profile; inclusive function times overlap and must not be added. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const path = process.argv[2];
if (!path)
  throw new Error(
    'Usage: node tools/qa/summarize-cpu-profile.mjs profile.cpuprofile [summary.json]'
  );
const bytes = await readFile(path);
const profile = JSON.parse(bytes);
const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
const parents = new Map(
  profile.nodes.flatMap((node) => (node.children ?? []).map((id) => [id, node.id]))
);
const groups = new Map();
const keyFor = (node) => {
  const frame = node.callFrame;
  return JSON.stringify([frame.functionName, frame.url, frame.lineNumber, frame.columnNumber]);
};
for (const node of nodes.values()) {
  const key = keyFor(node);
  if (!groups.has(key))
    groups.set(key, {
      function: node.callFrame.functionName,
      url: node.callFrame.url,
      line: node.callFrame.lineNumber + 1,
      selfMicroseconds: 0,
      inclusiveMicroseconds: 0,
    });
}
if (profile.samples.length !== profile.timeDeltas.length)
  throw new Error('Mismatched CPU samples and time deltas');
for (const [i, id] of profile.samples.entries()) {
  const delta = profile.timeDeltas[i];
  groups.get(keyFor(nodes.get(id))).selfMicroseconds += delta;
  const seen = new Set();
  for (let current = id; current !== undefined; current = parents.get(current)) {
    const key = keyFor(nodes.get(current));
    // Recursive instances of the same function count once per sample in its grouped total.
    if (!seen.has(key)) groups.get(key).inclusiveMicroseconds += delta;
    seen.add(key);
  }
}
const rows = [...groups.values()].map(({ selfMicroseconds, inclusiveMicroseconds, ...frame }) => ({
  ...frame,
  selfMS: selfMicroseconds / 1000,
  inclusiveMS: inclusiveMicroseconds / 1000,
}));
const output = {
  profileSHA256: createHash('sha256').update(bytes).digest('hex'),
  durationMS: (profile.endTime - profile.startTime) / 1000,
  sampledMS: profile.timeDeltas.reduce((a, b) => a + b, 0) / 1000,
  samples: profile.samples.length,
  note: 'Sampled function attribution, not GPU timing. Inclusive times overlap across functions; do not sum them. Idle and program time are retained.',
  self: rows.toSorted((a, b) => b.selfMS - a.selfMS).slice(0, 40),
  inclusive: rows.toSorted((a, b) => b.inclusiveMS - a.inclusiveMS).slice(0, 40),
};
const text = JSON.stringify(output, null, 2) + '\n';
if (process.argv[3]) await writeFile(process.argv[3], text);
else process.stdout.write(text);
