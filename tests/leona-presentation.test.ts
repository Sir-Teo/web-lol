import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import durations from '../src/content/champion-clip-durations.json';
import { mobilePose } from '../src/render/mobile-pose';
import { recallAnimationPose } from '../src/render/recall-animation';
import { LEONA_RECALL_CLIPS, leonaAttackAnimation } from '../src/content/leona-presentation';

function fixture() {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    lineWalkable: () => true,
    findPath: (_a, b) => [{ ...b }],
    reachable: (p) => ({ x: p.x, y: p.y }),
  });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -3000;
  const leona = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'leona');
  w.gainExperience(2400, leona.id);
  const state = w.championState(leona.id)!;
  for (const key of ['q', 'w', 'e', 'r'] as const) w.learnSpell(key, leona.id);
  const target = w.spawn('dummy', 'red', { x: 150, y: 0 });
  const pose = () => mobilePose(leona, state, w.tick, 1, durations.leona);
  const cast = (ability: 'q' | 'w' | 'e' | 'r') => {
    w.enqueue({ type: 'cast', unit: leona.id, ability, point: { x: 800, y: 0 } });
    w.step();
  };
  const restore = () => World.fromSnapshot(w.snapshot(), w.battlefield);
  return { w, leona, state, target, pose, cast, restore };
}

test('retained rig bytes, source normals, weights and all 23 clip endpoints match canonical pins', async () => {
  const raw = readFileSync('public/assets/models/leona-base.glb');
  expect(createHash('sha256').update(raw).digest('hex')).toBe(
    '5b845c3ba98ca15fdf61bb3eb549d54b858709c051c3c03f1cb26f76c890e5a9'
  );
  const doc = await new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .read('public/assets/models/leona-base.glb');
  expect(doc.getRoot().listSkins()[0].listJoints()).toHaveLength(81);
  const clips = doc.getRoot().listAnimations();
  expect(clips).toHaveLength(23);
  for (const clip of clips) {
    const end = Math.max(...clip.listSamplers().map((s) => Math.max(...s.getInput()!.getArray()!)));
    expect(durations.leona[clip.getName() as keyof typeof durations.leona]).toBe(end);
  }
  for (const mesh of doc.getRoot().listMeshes())
    for (const p of mesh.listPrimitives()) {
      expect(p.getAttribute('NORMAL')?.getCount()).toBe(p.getAttribute('POSITION')!.getCount());
      expect(p.getAttribute('JOINTS_0')!.getElementSize()).toBe(4);
      expect(p.getAttribute('WEIGHTS_0')!.getElementSize()).toBe(4);
    }
});

test('attack policy uses the two nonzero source slots and captured critical or Eclipse variants', () => {
  const source = JSON.parse(readFileSync('docs/reference/leona/character.json', 'utf8')).records[
    'Characters/Leona/CharacterRecords/Root'
  ];
  expect([
    source.basicAttack.mAttackProbability,
    ...source.extraAttacks.map((s: any) => s.mAttackProbability),
  ]).toEqual([0.5, 0.5, 0]);
  const samples = new Set(Array.from({ length: 100 }, (_, i) => leonaAttackAnimation(2, i)));
  expect([...samples].sort()).toEqual(['attack1', 'attack2']);
  expect(leonaAttackAnimation(2, 1, true, true)).toBe('crit');
  expect(leonaAttackAnimation(2, 1, false, true)).toBe('spell2_attack');
});

test('Leona recall follows the retained sequencer and holds its last endpoint without an Ashe clip', () => {
  const source = JSON.parse(readFileSync('docs/reference/leona-model.json', 'utf8')).animations
    .data['Characters/Leona/Animations/Skin0'];
  expect(source.mClipDataMap.Recall.mClipNameList).toEqual(['{b4dcde19}', 'Idle3', 'Idle1']);
  expect(LEONA_RECALL_CLIPS).toEqual(['entry_b4dcde19', 'idle3', 'idle1']);
  expect(recallAnimationPose('leona', 0, durations.leona).clip).toBe('entry_b4dcde19');
  expect(recallAnimationPose('leona', 7, durations.leona).clip).toBe('idle3');
  expect(recallAnimationPose('leona', 100, durations.leona)).toMatchObject({
    clip: 'idle1',
    time: durations.leona.idle1,
  });
});

test('W cast and idle/run stances use own clocks at base movement speed', () => {
  const f = fixture();
  f.cast('w');
  expect(f.pose().clip).toBe('spell2');
  f.w.step(60);
  expect(f.pose().clip).toBe('spell2_idle');
  f.w.setOrder(f.leona, { type: 'move', point: { x: 0, y: 1000 } });
  f.w.step();
  expect(f.pose().clip).toBe('spell2_run');
  expect(f.pose().rate).toBeCloseTo(1, 10);
  const copy = f.restore();
  f.w.step(20);
  copy.step(20);
  expect(copy.snapshot()).toBe(f.w.snapshot());
});

test('an ordinary Eclipse swing keeps its captured source clip through buff expiry', () => {
  const f = fixture();
  f.cast('w');
  f.w.step(178);
  f.w.setOrder(f.leona, { type: 'attack', target: f.target.id });
  f.w.step();
  expect(f.leona.attackCycle?.leonaEclipse).toBe(true);
  expect(f.pose().clip).toBe('spell2_attack');
  f.w.step();
  expect(f.state.leonaW).not.toBeNull(); // The target extends Eclipse on its burst.
  f.target.x = 2000;
  f.state.leonaW = null; // Capture must remain independent of current buff ownership.
  expect(f.pose().clip).toBe('spell2_attack');
  expect(() => f.restore()).not.toThrow();
});

test('committed Q selects Spell1 at contact and retains deterministic animation futures', () => {
  const f = fixture();
  f.w.setOrder(f.leona, { type: 'attack', target: f.target.id });
  f.cast('q');
  expect(f.pose().clip).toBe('spell1');
  const copy = f.restore(),
    release = f.leona.releaseTick!;
  f.w.step(release - f.w.tick);
  copy.step(release - copy.tick);
  expect(f.pose()).toMatchObject({ kind: 'attack', clip: 'spell1' });
  expect(f.pose().time).toBeCloseTo(0.25, 10);
  expect(copy.snapshot()).toBe(f.w.snapshot());
});

test('E/R cast presentation survives buffered orders, Q/W overlap and Flash through the windup', () => {
  for (const ability of ['e', 'r'] as const) {
    const f = fixture();
    f.cast(ability);
    const clock = f.state.castAnimation!.startTick;
    f.w.setOrder(f.leona, { type: 'move', point: { x: 0, y: 1000 } });
    for (const key of ['q', 'w'] as const)
      f.w.enqueue({ type: 'cast', unit: f.leona.id, ability: key, point: f.leona });
    f.w.enqueue({ type: 'cast', unit: f.leona.id, ability: 'd', point: { x: 0, y: 400 } });
    f.w.step();
    expect(f.state.castAnimation).toEqual({ ability, startTick: clock });
    expect(f.pose().clip).toBe(ability === 'e' ? 'spell3' : 'spell4');
    const copy = f.restore();
    f.w.step(10);
    copy.step(10);
    expect(copy.snapshot()).toBe(f.w.snapshot());
  }
});

test('death playback and strict saved presentation reject borrowed clips and malformed windups', () => {
  const f = fixture();
  f.cast('e');
  const forge = (change: (s: any, o: any) => void) => {
    const s = JSON.parse(f.w.snapshot()),
      o = s.otherChampions.find((o: any) => o.id === f.leona.id);
    change(s, o);
    expect(() => World.fromSnapshot(JSON.stringify(s), f.w.battlefield)).toThrow();
  };
  forge((_s, o) => (o.castAnimation = null));
  forge((_s, o) => (o.castAnimation.ability = 'w'));
  forge(
    (s) => (s.units.find((u: any) => u.id === f.leona.id).animationTimeline.primary.clip = 'idle5')
  );
  f.w.damage(f.target, f.leona, 1e6, 'true');
  f.w.step();
  expect(f.pose().clip).toBe('death');
  expect(() => f.restore()).not.toThrow();
});
