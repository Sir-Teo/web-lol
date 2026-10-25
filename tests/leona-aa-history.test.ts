import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
function fixture() {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    lineWalkable: () => true,
    reachable: (p) => ({ ...p }),
    findPath: (_a, b) => [{ ...b }],
  });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -3000;
  const u = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'leona'),
    target = w.spawn('dummy', 'red', { x: 150, y: 0 });
  target.hp = target.maxHp = 100000;
  const s = w.championState(u.id)!;
  return {
    w,
    u,
    target,
    s,
    attack: () => {
      w.setOrder(u, { type: 'attack', target: target.id });
      w.step();
    },
  };
}
test('ordinary Leona contact preserves its resolved attempt, independent audience and exact saved future', () => {
  const f = fixture();
  f.attack();
  const id = f.w.nextId,
    rng = f.w.random.state;
  const records = f.s.leonaAAVisuals;
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({
    startTick: 1,
    releaseTick: f.u.releaseTick,
    targetId: f.target.id,
    cancelTick: null,
    impact: null,
  });
  const copy = World.fromSnapshot(f.w.snapshot(), f.w.battlefield);
  f.w.step(30);
  copy.step(30);
  expect(copy.snapshot()).toBe(f.w.snapshot());
  expect(records[0].impact).toMatchObject({ tick: 23, material: 'Flesh' });
  expect(f.w.nextId).toBe(id + 2);
  expect(f.w.random.state).toBe(rng);
});
test('canceling a Leona swing preserves the attempt without inventing contact', () => {
  const f = fixture();
  f.attack();
  f.w.step(3);
  f.w.setOrder(f.u, { type: 'move', point: { x: 0, y: 500 } });
  f.w.step();
  const r = f.s.leonaAAVisuals[0];
  expect(r).toMatchObject({
    startTick: 1,
    cancelTick: 4,
    stopTick: 4,
    endReason: 'order',
    impact: null,
  });
  expect(() => World.fromSnapshot(f.w.snapshot(), f.w.battlefield)).not.toThrow();
});

test('critical and Eclipse choices stay fixed at start while Q creates its separate history', () => {
  for (const mode of ['critical', 'eclipse', 'q'] as const) {
    const f = fixture();
    if (mode === 'critical')
      f.s.inventory.push('agility', 'agility', 'agility', 'agility', 'agility', 'infinity-edge');
    else {
      f.w.learnSpell(mode === 'q' ? 'q' : 'w', f.u.id);
      f.w.enqueue({ type: 'cast', unit: f.u.id, ability: mode === 'q' ? 'q' : 'w', point: f.u });
      f.w.step();
    }
    f.attack();
    if (mode === 'q') {
      expect(f.s.leonaAAVisuals).toEqual([]);
      expect(f.s.leonaQVisuals[0].attackStarts).toHaveLength(1);
      continue;
    }
    const r = f.s.leonaAAVisuals[0];
    expect(r.kind).toBe(mode === 'critical' ? 'crit' : 'spell2_attack');
    expect(r.critical).toBe(mode === 'critical');
    expect(r.eclipse).toBe(mode === 'eclipse');
    f.s.inventory = [];
    const copy = World.fromSnapshot(f.w.snapshot(), f.w.battlefield);
    f.w.step(30);
    copy.step(30);
    expect(copy.snapshot()).toBe(f.w.snapshot());
    expect(f.s.leonaAAVisuals[0].kind).toBe(r.kind);
  }
});

test('target loss and a Q reset retain canceled ordinary starts without a later invented contact', () => {
  for (const mode of ['target-lost', 'q-reset'] as const) {
    const f = fixture();
    f.attack();
    if (mode === 'target-lost') {
      f.w.damage(f.w.hero, f.target, 1e9, 'true');
      f.w.step();
    } else {
      f.w.learnSpell('q', f.u.id);
      f.w.enqueue({ type: 'cast', unit: f.u.id, ability: 'q', point: f.u });
      f.w.step();
    }
    const r = f.s.leonaAAVisuals[0];
    expect(r.cancelTick).toBe(f.w.tick);
    expect(r.endReason).toBe(mode === 'target-lost' ? 'target-lost' : 'action');
    expect(r.impact).toBeNull();
    const copy = World.fromSnapshot(f.w.snapshot(), f.w.battlefield);
    f.w.step(50);
    copy.step(50);
    expect(copy.snapshot()).toBe(f.w.snapshot());
    expect(r.impact).toBeNull();
  }
});

test.each(['death', 'match-end'] as const)(
  'pending %s closes a swing and preserves a finite saved tail',
  (mode) => {
    const f = fixture();
    f.attack();
    f.w.step(3);
    if (mode === 'death') f.w.damage(f.target, f.u, 1e9, 'true');
    else {
      const inhibitor = f.w.spawn('inhibitor', 'red', { x: 1000, y: 1000 });
      f.w.damage(f.w.hero, inhibitor, 1e9, 'true');
      const nexus = f.w.spawn('nexus', 'red', { x: 1500, y: 1500 });
      f.w.damage(f.w.hero, nexus, 1e9, 'true');
    }
    const r = f.s.leonaAAVisuals[0];
    expect(r.endReason).toBe(mode);
    expect(r.cancelTick).toBe(f.w.tick);
    expect(r.impact).toBeNull();
    const saved = f.w.snapshot(),
      copy = World.fromSnapshot(saved, f.w.battlefield);
    f.w.step(30);
    copy.step(30);
    expect(copy.snapshot()).toBe(f.w.snapshot());
    if (mode === 'match-end') expect(f.w.snapshot()).toBe(saved);
    else
      expect(r.frames.slice(4).every((p) => p.x === r.frames[3].x && p.y === r.frames[3].y)).toBe(
        true
      );
  }
);

test.each(['Flesh', 'Stone', 'Metal', 'Wood'] as const)(
  'contact retains %s material and exact target poses',
  (material) => {
    const f = fixture();
    f.w.units = f.w.units.filter((u) => u.id !== f.target.id);
    const actual =
      material === 'Flesh'
        ? f.w.spawn('champion', 'red', { x: 150, y: 0 }, 'leona')
        : material === 'Stone'
          ? f.w.spawn('turret', 'red', { x: 150, y: 0 })
          : material === 'Metal'
            ? f.w.spawn('siege', 'red', { x: 150, y: 0 })
            : f.w.spawnMonster({ x: 150, y: 0 }, null, 'red');
    actual.ai = false;
    actual.hp = actual.maxHp = 100000;
    f.w.setOrder(f.u, { type: 'attack', target: actual.id });
    f.w.step();
    const release = f.u.releaseTick!;
    f.w.step(release - f.w.tick);
    const r = f.s.leonaAAVisuals[0];
    expect(r.impact!.material).toBe(material);
    expect(r.impact!.frames[0].x).toBe(actual.x);
    const copy = World.fromSnapshot(f.w.snapshot(), f.w.battlefield);
    f.w.step(5);
    copy.step(5);
    expect(copy.snapshot()).toBe(f.w.snapshot());
  }
);

test('strict history rejects missing ownership, kind/clock/phase/material and pose contradictions', () => {
  const f = fixture();
  f.attack();
  const forge = (mutate: (r: any, s: any) => void) => {
    const s = JSON.parse(f.w.snapshot()),
      o = s.otherChampions.find((o: any) => o.id === f.u.id),
      r = o.leonaAAVisuals[0];
    mutate(r, s);
    expect(() => World.fromSnapshot(JSON.stringify(s), f.w.battlefield)).toThrow();
  };
  forge((_r, s) => delete s.otherChampions.find((o: any) => o.id === f.u.id).leonaAAVisuals);
  forge((_r, s) => (s.otherChampions.find((o: any) => o.id === f.u.id).leonaAAVisuals = []));
  forge((_r, s) => (s.version = 127));
  forge((r) => (r.kind = 'attack3'));
  forge((r) => (r.eclipse = true));
  forge((r) => r.releaseTick++);
  forge((r) => {
    r.stopTick = 1;
    r.endReason = 'order';
  });
  f.w.step(22);
  forge((r) => (r.impact.material = 'Metal'));
  forge((r) => r.impact.tick++);
  forge((r) => r.impact.frames.pop());
  forge((r) => {
    r.stopTick = 1;
    r.endReason = 'order';
  });
  forge((r) => (r.impact.targetTransform = Array(16).fill(0)));
  expect(() => World.fromSnapshot(f.w.snapshot(), f.w.battlefield)).not.toThrow();
});

test('moving caster tails and lethal target endpoints remain bounded and retire after the slowest material pitch', () => {
  const f = fixture();
  f.target.hp = 10;
  f.attack();
  f.w.step(22);
  const r = f.s.leonaAAVisuals[0];
  expect(r.impact!.detachedTick).toBe(23);
  f.w.setOrder(f.u, { type: 'move', point: { x: 0, y: 1000 } });
  const copy = World.fromSnapshot(f.w.snapshot(), f.w.battlefield);
  f.w.step(79);
  copy.step(79);
  expect(f.w.tick).toBe(102);
  expect(r.frames).toHaveLength(30);
  expect(r.frames.at(-1)!.y).toBeGreaterThan(r.frames[22].y);
  expect(r.impact!.frames).toHaveLength(80);
  expect(
    r.impact!.frames.every((p) => p.x === r.impact!.point.x && p.y === r.impact!.point.y)
  ).toBe(true);
  expect(copy.snapshot()).toBe(f.w.snapshot());
  f.w.step();
  copy.step();
  expect(f.s.leonaAAVisuals).toEqual([]);
  expect(copy.snapshot()).toBe(f.w.snapshot());
});

test('a later reveal cannot rewrite an enemy attempt audience while contact gets its own observed audience', () => {
  const f = fixture();
  f.w.units = f.w.units.filter((u) => u.id !== f.u.id && u.id !== f.target.id);
  const u = f.w.spawn('champion', 'red', { x: 0, y: 0 }, 'leona'),
    target = f.w.spawnMonster({ x: 150, y: 0 });
  target.hp = target.maxHp = 100000;
  target.ai = false;
  f.w.setOrder(u, { type: 'attack', target: target.id });
  f.w.step();
  const r = f.w.championState(u.id)!.leonaAAVisuals[0];
  expect(r.castAudience).toEqual(['red']);
  f.w.hero.x = 0;
  f.w.hero.y = 500;
  f.w.hero.previous = { x: 0, y: 500 };
  f.w.step(22);
  expect(r.castAudience).toEqual(['red']);
  expect(r.impact!.audience).toContain('blue');
  expect(() => World.fromSnapshot(f.w.snapshot(), f.w.battlefield)).not.toThrow();
});

test('generated pose bounds cover source cast delays and the slowest authored hit pitch for every master', async () => {
  const { LEONA_AA_AUDIO: P } = await import('../src/content/leona-aa-audio');
  const { LEONA_AA_CAST_TICKS, LEONA_AA_HIT_TICKS } =
    await import('../src/content/leona-aa-audio-timing');
  const casts = P.events
    .filter((e) => e.name.endsWith('_OnCast'))
    .flatMap((e) =>
      P.containers
        .filter((c) => c.id === e.targetId)
        .flatMap((c) =>
          c.variants.map((v) => Math.ceil((e.delaySeconds + v.frames / v.sampleRate) * 60))
        )
    );
  const hits = P.containers
    .filter((c) => ![2419, 2425].includes(c.id))
    .flatMap((c) =>
      c.variants.map((v) =>
        Math.ceil(
          ((v.frames / v.sampleRate) * 60) /
            (c.parentId === P.hitSwitch.id
              ? 2 ** (P.hitSwitch.authoredProperties.ranges.Pitch.min / 1200)
              : 1)
        )
      )
    );
  expect(LEONA_AA_CAST_TICKS).toBe(Math.max(...casts));
  expect(LEONA_AA_HIT_TICKS).toBe(Math.max(...hits));
});
