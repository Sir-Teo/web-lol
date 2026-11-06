import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { passiveAudioExpiry } from '../src/simulation/ahri-passive-audio';

function setup(champion = true, visible = true, x = 400) {
  let revealed = visible;
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => revealed,
    inBrush: () => false,
    lineWalkable: () => true,
    reachable: (p) => ({ ...p }),
    findPath: (_a, b) => [{ ...b }],
  });
  w.nextWaveTick = 1e9;
  Object.assign(w.hero, { x: -3000, y: -3000, previous: { x: -3000, y: -3000 }, ai: false });
  const ahri = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'ahri');
  Object.assign(ahri, { ai: false, hp: 100 });
  for (let i = 0; i < (champion ? 1 : 9); i++) {
    const v = w.spawn(
      champion ? 'champion' : 'melee',
      'red',
      { x, y: 0 },
      champion ? 'lux' : undefined
    );
    Object.assign(v, { ai: false, experienceBounty: 0, goldBounty: 0 });
    w.damage(ahri, v, 1e6, 'true');
  }
  return {
    w,
    ahri,
    reveal: () => {
      revealed = true;
      const observer = w.spawn('champion', 'red', { x: 800, y: 0 }, 'lux');
      observer.ai = false;
    },
  };
}
function restore(w: World) {
  const save = w.snapshot(),
    copy = World.fromSnapshot(save, w.battlefield);
  expect(copy.snapshot()).toBe(save);
  return copy;
}
test('both Essence kinds restore every flight, contact and finite-tail frame exactly', () => {
  for (const champion of [false, true]) {
    const { w } = setup(champion);
    for (let t = 0; t < 180; t++) {
      const copy = restore(w);
      w.step();
      copy.step();
      expect(copy.snapshot(), `champion=${champion} tick=${t}`).toBe(w.snapshot());
    }
    expect(w.ahriPassiveAudio).toEqual([]);
    expect(JSON.parse(w.snapshot())).not.toHaveProperty('ahriPassiveAudio');
  }
});
test('birth and consumption retain independent visibility, even with no actual healing', () => {
  const { w, ahri, reveal } = setup(true, false);
  ahri.hp = ahri.maxHp;
  expect(w.ahriPassiveAudio[0].audience).toEqual(['blue']);
  reveal();
  w.step(30);
  expect(w.ahriEssences[0].healed).toBe(0);
  expect(w.ahriPassiveAudio[0].audience).toEqual(['blue']);
  expect(w.ahriPassiveAudio[0].end).toMatchObject({
    reason: 'consumed',
    audience: ['blue', 'red'],
  });
  restore(w);
});
test('immediate death saves close flight without creating an arrival cue', () => {
  const { w, ahri } = setup();
  w.damage(w.hero, ahri, 1e6, 'true');
  expect(w.ahriPassiveAudio[0].end).toMatchObject({ tick: 0, reason: 'death' });
  restore(w);
  w.step(110);
  expect(w.ahriPassiveAudio).toEqual([]);
});
test('audio contact survives the existing gameplay history pruning', () => {
  const { w } = setup();
  w.step(60);
  expect(w.ahriEssences).toEqual([]);
  expect(w.ahriPassiveAudio[0].end?.reason).toBe('consumed');
  expect(passiveAudioExpiry(w.ahriPassiveAudio[0])).toBeGreaterThan(w.tick);
  restore(w);
});
test('terminal settlement closes active flight and preserves existing contact tails', () => {
  for (const delay of [0, 1, 30, 60]) {
    const { w } = setup();
    w.step(delay);
    const before = w.ahriPassiveAudio[0].end;
    const nexus = w.spawn('nexus', 'red', { x: 1500, y: 1500 });
    w.damage(w.hero, nexus, 1e6, 'true');
    expect(w.winner).toBe('blue');
    expect(w.ahriEssences).toEqual([]);
    expect(w.ahriPassiveAudio[0].end?.reason).toBe(before?.reason ?? 'match-end');
    restore(w);
    const saved = w.snapshot();
    w.step(300);
    expect(w.snapshot()).toBe(saved);
  }
});
test('malformed active and pruned-contact records are rejected', () => {
  for (const elapsed of [0, 60]) {
    const { w } = setup();
    w.step(elapsed);
    const changes = [
      (s: any) => {
        s.ahriPassiveAudio[0].sourceId = w.hero.id;
      },
      (s: any) => {
        s.ahriPassiveAudio[0].startTick = s.tick + 1;
      },
      (s: any) => {
        s.ahriPassiveAudio[0].audience = ['red', 'blue'];
      },
      (s: any) => {
        s.ahriPassiveAudio[0].currentPoint.x = 1e6;
      },
      (s: any) => {
        s.ahriPassiveAudio.push(s.ahriPassiveAudio[0]);
      },
      (s: any) => {
        s.ahriPassiveAudio[0].id = s.nextId;
      },
    ];
    for (const change of changes) {
      const raw = JSON.parse(w.snapshot());
      change(raw);
      expect(() => World.fromSnapshot(JSON.stringify(raw), w.battlefield)).toThrow();
    }
  }
  const { w } = setup();
  const raw = JSON.parse(w.snapshot());
  delete raw.ahriPassiveAudio;
  expect(() => World.fromSnapshot(JSON.stringify(raw), w.battlefield)).toThrow(/passive audio/);
});

test('pursuit deadline closes silent old launches without retaining nonexistent arrival tails', () => {
  const { w, ahri } = setup(true, true, 1000);
  for (let t = 0; t < 485; t++) {
    ahri.x -= 100;
    w.step();
    if (t % 15 === 0 || t >= 478) restore(w);
  }
  expect(w.ahriEssences[0].stopReason).toBe('expired');
  expect(w.ahriPassiveAudio).toEqual([]);
});
