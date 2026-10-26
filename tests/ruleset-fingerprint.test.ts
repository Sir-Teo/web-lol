import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import {
  affectsRuleset,
  collectRulesetFiles,
  rulesetFiles,
  rulesetFingerprint,
  rulesetModuleRoots,
} from '../tools/ruleset-fingerprint';

const temporary: string[] = [];
afterEach(() => {
  for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'rift-ruleset-'));
  temporary.push(root);
  const put = (file: string, value: string) => {
    const target = join(root, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, value);
  };
  // Give a tiny isolated project the same non-module compatibility pins.
  for (const file of rulesetFiles.filter((file) => !file.endsWith('.ts'))) put(file, '{}');
  for (const file of rulesetModuleRoots) put(file, '// isolated presentation root\n');
  put('tools/ruleset-fingerprint.ts', '// fingerprint policy\n');
  put(
    'tsconfig.json',
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        resolveJsonModule: true,
        verbatimModuleSyntax: true,
      },
      include: ['src'],
    })
  );
  put('src/simulation/world.ts', 'export const tick = 0;');
  put('src/content/rules.ts', 'export const tickRate = 60;');
  return { root, put };
}

const formerlyMissing = [
  'src/render/mobile-pose.ts',
  'src/render/recall-animation.ts',
  'src/render/structure-pose.ts',
  'src/content/mobile-clip-durations.json',
  'src/content/champion-clip-durations.json',
  'src/content/structure-animation-profiles.json',
  'src/content/lux-attack-origin.json',
  'src/content/lux-attack-origin-2.json',
  'src/content/lux-ground-layers.json',
];

test('real saved-pose dependencies are covered and watched; unrelated rendering stays outside', () => {
  for (const file of formerlyMissing) {
    expect(rulesetFiles, file).toContain(file);
    expect(affectsRuleset(resolve(file)), file).toBe(true);
  }
  for (const file of ['src/render/scene.ts', 'src/audio/audio.ts', 'src/ui/hud.ts']) {
    expect(rulesetFiles).not.toContain(file);
    expect(affectsRuleset(resolve(file))).toBe(false);
  }
  expect(affectsRuleset(resolve('src/content/new-rule.ts'))).toBe(true);
  expect(affectsRuleset(resolve('src/simulation/new-rule.ts'))).toBe(true);
  expect(affectsRuleset(resolve('src/simulation-other/new-rule.ts'))).toBe(false);
  expect(rulesetFiles).toEqual([...new Set(rulesetFiles)].sort());
});

test('Garen particle clock inputs remain explicitly pinned without a simulation module edge', () => {
  const file = 'src/content/garen-aa-particles.json';
  expect(rulesetFiles).toContain(file);
  expect(affectsRuleset(resolve(file))).toBe(true);
  const { root, put } = fixture(),
    before = rulesetFingerprint(root);
  put(file, '{"profiles":[{"life":0.5}]}');
  expect(rulesetFingerprint(root)).not.toBe(before);
});

test('saved Alpha Strike contacts cover source profiles, sampling, materials and mip decoding', () => {
  const files = [
    'src/render/masteryi-q-contact-particles.ts',
    'src/render/masteryi-q-contacts.ts',
    'src/render/authored-mip-texture.ts',
    'src/render/particle-color-product.ts',
    'src/content/masteryi-q-contact-particles.json',
    'src/content/masteryi-q-contact-timing.ts',
  ];
  for (const file of files) {
    expect(rulesetFiles, file).toContain(file);
    expect(affectsRuleset(resolve(file)), file).toBe(true);
  }
  const { root, put } = fixture();
  for (const file of files)
    put(file, file.endsWith('.json') ? '{"profiles":[]}' : 'export const value = 1;');
  put(
    'src/render/masteryi-q-contacts.ts',
    "import './masteryi-q-contact-particles'; import './authored-mip-texture'; import './particle-color-product'; import '../content/masteryi-q-contact-particles.json'; import '../content/masteryi-q-contact-timing';"
  );
  const before = rulesetFingerprint(root);
  for (const file of files) {
    const original = readFileSync(join(root, file), 'utf8');
    put(file, original + (file.endsWith('.json') ? ' ' : '\n// changed contact interpretation\n'));
    expect(rulesetFingerprint(root), file).not.toBe(before);
    put(file, original);
    expect(rulesetFingerprint(root)).toBe(before);
  }
});

test('saved Alpha Strike sound compatibility includes state, voice policy and exact float loading', () => {
  for (const file of [
    'src/audio/masteryi-q-state.ts',
    'src/audio/masteryi-q.ts',
    'src/audio/float-source-wav.ts',
    'src/content/masteryi-q-audio.ts',
    'src/content/masteryi-q-audio-timing.ts',
    'src/simulation/masteryi-q-audio.ts',
  ]) {
    expect(rulesetFiles, file).toContain(file);
    expect(affectsRuleset(resolve(file)), file).toBe(true);
  }
  const { root, put } = fixture();
  put('src/audio/masteryi-q.ts', "import './masteryi-q-state'; import './float-source-wav';");
  put('src/audio/masteryi-q-state.ts', 'export const phase=1;');
  put('src/audio/float-source-wav.ts', 'export const preserveFloat=true;');
  const before = rulesetFingerprint(root);
  put('src/audio/masteryi-q-state.ts', 'export const phase=2;');
  expect(rulesetFingerprint(root)).not.toBe(before);
  put('src/audio/masteryi-q-state.ts', 'export const phase=1;');
  expect(rulesetFingerprint(root)).toBe(before);
  put('src/audio/float-source-wav.ts', 'export const preserveFloat=false;');
  expect(rulesetFingerprint(root)).not.toBe(before);
});

test('saved Yi attack audio includes applied pitch, voice policy and float loading', () => {
  const files = [
    'src/audio/masteryi-aa-state.ts',
    'src/audio/masteryi-aa.ts',
    'src/audio/float-source-wav.ts',
    'src/content/masteryi-aa-audio.ts',
    'src/content/masteryi-aa-audio-timing.ts',
  ];
  for (const file of files) {
    expect(rulesetFiles, file).toContain(file);
    expect(affectsRuleset(resolve(file)), file).toBe(true);
  }
  const { root, put } = fixture();
  put('src/audio/masteryi-aa.ts', "import './masteryi-aa-state'; import './float-source-wav';");
  put('src/audio/masteryi-aa-state.ts', 'export const appliedRate=1;');
  put('src/audio/float-source-wav.ts', 'export const preserveFloat=true;');
  const before = rulesetFingerprint(root);
  for (const file of files.slice(0, 3)) {
    const original = readFileSync(join(root, file), 'utf8');
    put(file, original + '\n// changed saved sound interpretation\n');
    expect(rulesetFingerprint(root), file).not.toBe(before);
    put(file, original);
    expect(rulesetFingerprint(root)).toBe(before);
  }
});

test('Ahri and Master Yi saved-pose compatibility includes fetched rig inputs without importing binary modules', () => {
  const { root, put } = fixture();
  const before = rulesetFingerprint(root);
  for (const file of [
    'public/assets/models/ahri-base.glb',
    'public/assets/models/ahri-base.json',
    'public/assets/models/masteryi-base.glb',
    'public/assets/models/masteryi-base.json',
  ]) {
    expect(rulesetFiles).toContain(file);
    expect(affectsRuleset(resolve(file))).toBe(true);
    const original = readFileSync(join(root, file), 'utf8');
    put(file, original + ' changed');
    expect(rulesetFingerprint(root)).not.toBe(before);
    put(file, original);
    expect(rulesetFingerprint(root)).toBe(before);
  }
});

test('saved Zenith sword interpretation includes source normals and the complete surface dependency graph', () => {
  for (const file of [
    'src/render/leona-zenith-surfaces.ts',
    'src/render/leona-zenith-sword-material.ts',
    'src/render/leona-zenith-sword-normals.ts',
    'src/render/particle-mesh-reflection-material.ts',
    'src/content/leona-e-sword-material.json',
    'src/content/leona-e-sword-normals.json',
    'public/assets/models/leona-e-sword-normals.bin',
  ]) {
    expect(rulesetFiles, file).toContain(file);
    expect(affectsRuleset(resolve(file)), file).toBe(true);
  }
  const { root, put } = fixture(),
    before = rulesetFingerprint(root);
  put('public/assets/models/leona-e-sword-normals.bin', 'different derived stream');
  expect(rulesetFingerprint(root)).not.toBe(before);
});

test('each missed pose/table changes the hash independently; paths, raw bytes and lockfiles matter', () => {
  const { root, put } = fixture();
  put(
    'src/simulation/world.ts',
    formerlyMissing.map((file) => `import '${join('..', '..', file)}';`).join('\n')
  );
  for (const file of formerlyMissing)
    put(file, file.endsWith('.json') ? '{"duration":1}' : 'export const pose = 1;');
  const baseline = rulesetFingerprint(root);
  for (const file of formerlyMissing.concat([
    'package-lock.json',
    'tsconfig.json',
    'tools/ruleset-fingerprint.ts',
  ])) {
    const original = readFileSync(join(root, file), 'utf8');
    put(file, `${original}\n `);
    expect(rulesetFingerprint(root), file).not.toBe(baseline);
    put(file, original);
    expect(rulesetFingerprint(root)).toBe(baseline);
  }
  put('src/render/unused.ts', 'export const color = 0;');
  expect(rulesetFingerprint(root)).toBe(baseline);
  put('src/render/renamed.ts', readFileSync(join(root, formerlyMissing[0]), 'utf8'));
  put(
    'src/simulation/world.ts',
    readFileSync(join(root, 'src/simulation/world.ts'), 'utf8').replace('mobile-pose', 'renamed')
  );
  expect(rulesetFingerprint(root)).not.toBe(baseline);
});

test('follows runtime re-exports, side effects, literal dynamic imports, mixed imports and cycles', () => {
  const { root, put } = fixture();
  put(
    'src/simulation/world.ts',
    `
    export { pose } from '../render/barrel';
    import '../render/setup';
    export const later = () => import('../render/later');
    import { value, type Pose } from '../render/mixed';
    import type { Hidden } from '../render/types';
    export type { Other } from '../render/other-types';
    import { type OnlyType } from '../render/only-type';
    export const state = value;
  `
  );
  put('src/render/barrel.ts', "export { pose } from './pose';");
  put('src/render/pose.ts', "import '../simulation/world'; export const pose = 1;");
  put('src/render/setup.ts', "import data from './data.json'; console.log(data);");
  put('src/render/data.json', '{"duration":2}');
  put('src/render/later.ts', 'export const loaded = true;');
  put('src/render/mixed.ts', 'export const value = 1; export type Pose = {};');
  put('src/render/types.ts', "import './must-not-load'; export type Hidden = {};");
  put('src/render/other-types.ts', "import './must-not-load'; export type Other = {};");
  // verbatimModuleSyntax retains `import { type X }` as an empty runtime
  // import, so its module's side effects must still be fingerprinted.
  put('src/render/only-type.ts', "import './side-effect'; export type OnlyType = {};");
  put('src/render/side-effect.ts', 'console.log(1);');
  const files = collectRulesetFiles(root);
  expect(files.filter((f) => f.startsWith('src/render/'))).toEqual(
    [
      ...rulesetModuleRoots.filter((file) => file.startsWith('src/render/')),
      'src/render/barrel.ts',
      'src/render/data.json',
      'src/render/later.ts',
      'src/render/mixed.ts',
      'src/render/only-type.ts',
      'src/render/pose.ts',
      'src/render/setup.ts',
      'src/render/side-effect.ts',
    ].sort()
  );
  expect(new Set(files).size).toBe(files.length);
});

test('newly imported transitive data is discovered without adding a manual pin', () => {
  const { root, put } = fixture();
  const baseline = rulesetFingerprint(root);
  put('src/content/rules.ts', "export { rate } from '../render/new-policy';");
  put(
    'src/render/new-policy.ts',
    "import data from './new-data.json'; export const rate = data.rate;"
  );
  put('src/render/new-data.json', '{"rate":1}');
  const extended = rulesetFingerprint(root);
  expect(extended).not.toBe(baseline);
  expect(collectRulesetFiles(root)).toContain('src/render/new-data.json');
  put('src/render/new-data.json', '{"rate":2}');
  expect(rulesetFingerprint(root)).not.toBe(extended);
});

test('explicit Eclipse module roots include transitive kernels and fail closed on missing runtime imports', () => {
  const { root, put } = fixture(),
    baseline = rulesetFingerprint(root);
  for (const entry of rulesetModuleRoots) expect(collectRulesetFiles(root)).toContain(entry);
  const entry = 'src/render/leona-eclipse-particles.ts';
  expect(rulesetModuleRoots).toContain(entry);
  put(entry, "import './curve-policy';");
  put('src/render/curve-policy.ts', "import curve from './curve-data.json'; export default curve;");
  put('src/render/curve-data.json', '{"rate":1}');
  const changed = rulesetFingerprint(root);
  expect(changed).not.toBe(baseline);
  expect(collectRulesetFiles(root)).toContain('src/render/curve-policy.ts');
  expect(collectRulesetFiles(root)).toContain('src/render/curve-data.json');
  put('src/render/curve-data.json', '{"rate":2}');
  expect(rulesetFingerprint(root)).not.toBe(changed);
  rmSync(join(root, 'src/render/curve-policy.ts'));
  expect(() => rulesetFingerprint(root)).toThrow(/ruleset import/);
});

test('compiler path aliases and extended config files join the dependency set', () => {
  const { root, put } = fixture();
  put('tsconfig.json', JSON.stringify({ extends: './compiler-base.json', include: ['src'] }));
  put(
    'compiler-base.json',
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        resolveJsonModule: true,
        verbatimModuleSyntax: true,
        paths: { '@policy/*': ['./src/policy/*'] },
      },
    })
  );
  put('src/simulation/world.ts', "import { rate } from '@policy/rate'; export const tick = rate;");
  put('src/policy/rate.ts', 'export const rate = 60;');
  const files = collectRulesetFiles(root);
  expect(files).toContain('compiler-base.json');
  expect(files).toContain('src/policy/rate.ts');
});

for (const source of [
  "import '../render/missing';",
  'export const load = (name: string) => import(name);',
  'export const load = (name: string) => require(name);',
  "export const load = import.meta.glob('../render/*.ts');",
])
  test(`fails closed instead of hashing an incomplete graph: ${source}`, () => {
    const { root, put } = fixture();
    put('src/simulation/world.ts', source);
    expect(() => rulesetFingerprint(root)).toThrow(/ruleset import|ruleset glob/i);
  });

test('missing pinned runtime data cannot produce a compatibility identity', () => {
  const { root } = fixture();
  rmSync(join(root, 'public/assets/maps/rift-nav.bin'));
  expect(() => rulesetFingerprint(root)).toThrow(/ENOENT/);
});

test('Daybreak and ordinary Leona audio state rules are saved-clock dependencies', () => {
  const files = ['src/audio/leona-q-state.ts', 'src/audio/leona-aa-state.ts'];
  for (const file of files) {
    expect(rulesetFiles, file).toContain(file);
    expect(affectsRuleset(resolve(file)), file).toBe(true);
  }
  const { root, put } = fixture(),
    baseline = rulesetFingerprint(root);
  for (const file of files) {
    const original = readFileSync(join(root, file), 'utf8');
    put(file, original + '\nexport const changedClock = 1;\n');
    expect(rulesetFingerprint(root), file).not.toBe(baseline);
    put(file, original);
  }
  expect(rulesetFingerprint(root)).toBe(baseline);
});
