import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { ahriLifecycleAudioExpiry } from '../src/simulation/ahri-lifecycle-audio';
import { championDeathTicks } from '../src/simulation/champion-death';
function setup(level18 = false, hidden = false) {
  let revealed = !hidden;
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
  ahri.ai = false;
  if (level18) w.gainExperience(1e6, ahri.id);
  const enemy = w.spawn('champion', 'red', { x: 450, y: 0 }, 'lux');
  Object.assign(enemy, { ai: false, hp: 10000, maxHp: 10000 });
  const kill = () => w.damage(enemy, ahri, 1e6, 'true');
  return {
    w,
    ahri,
    enemy,
    kill,
    reveal: () => {
      revealed = true;
      enemy.x = w.battlefield.spawns.blue.x + 200;
      enemy.y = w.battlefield.spawns.blue.y;
    },
  };
}
function restore(w: World) {
  const saved = w.snapshot(),
    copy = World.fromSnapshot(saved, w.battlefield);
  expect(copy.snapshot()).toBe(saved);
  return copy;
}
test('actual death feedback identity and every dead-wait/respawn/tail frame retain exact futures', () => {
  const { w, ahri, kill } = setup();
  kill();
  const r = w.ahriLifecycleAudio[0],
    event = w.events.find((e) => e.type === 'death' && e.unit === ahri.id)!;
  expect(r.id).toBe(event.id);
  expect(r.audience).toEqual(event.audience);
  expect(ahriLifecycleAudioExpiry(r)).toBe(Infinity);
  const until = r.respawnTick + 294;
  while (w.tick < until) {
    const copy = restore(w);
    w.step();
    copy.step();
    expect(copy.snapshot()).toBe(w.snapshot());
  }
  expect(w.ahriLifecycleAudio).toEqual([]);
  expect(JSON.parse(w.snapshot())).not.toHaveProperty('ahriLifecycleAudio');
});
test('finite death audio history remains silently pending until genuine maximum-level respawn', () => {
  const { w, ahri, kill } = setup(true);
  kill();
  const r = w.ahriLifecycleAudio[0];
  expect(r.levelAtDeath).toBe(18);
  expect(r.respawnTick).toBe(championDeathTicks(18, 0));
  w.step(234);
  expect(r.respawn).toBeNull();
  expect(ahriLifecycleAudioExpiry(r)).toBe(Infinity);
  restore(w);
  while (w.tick < r.respawnTick - 1) {
    w.step(Math.min(97, r.respawnTick - 1 - w.tick));
    restore(w);
  }
  expect(ahri.hp).toBe(0);
  w.step();
  expect(r.respawn?.tick).toBe(w.tick);
  expect(ahri.hp).toBe(ahri.maxHp);
  expect(ahri.mana).toBe(ahri.maxMana);
  expect(r.respawn?.point).toEqual(w.battlefield.spawns.blue);
  restore(w);
});
test('hidden death and visible respawn keep independent immutable audiences', () => {
  const { w, kill, reveal } = setup(false, true);
  kill();
  const r = w.ahriLifecycleAudio[0];
  expect(r.audience).toEqual(['blue']);
  w.step(r.respawnTick - 1);
  reveal();
  w.step();
  expect(r.audience).toEqual(['blue']);
  expect(r.respawn?.audience).toEqual(['blue', 'red']);
  restore(w);
});
test('a second life preserves the first finite respawn tail and captures a new existing death identity', () => {
  const { w, kill } = setup();
  kill();
  const first = w.ahriLifecycleAudio[0];
  w.step(first.respawnTick);
  kill();
  const second = w.ahriLifecycleAudio[1];
  expect(second.id).toBeGreaterThan(first.id);
  expect(second.sourceId).toBe(first.sourceId);
  expect(first.respawn?.tick).toBe(second.startTick);
  expect(second.respawn).toBeNull();
  restore(w);
  w.step(294);
  expect(w.ahriLifecycleAudio).toHaveLength(1);
  expect(w.ahriLifecycleAudio[0].id).toBe(second.id);
  restore(w);
  w.step(second.respawnTick - w.tick);
  expect(second.respawn?.tick).toBe(w.tick);
  restore(w);
});
test('posthumous level progression does not rewrite the captured death timer', () => {
  const { w, ahri, kill } = setup();
  kill();
  const r = w.ahriLifecycleAudio[0],
    deadline = r.respawnTick;
  w.gainExperience(1e6, ahri.id);
  expect(w.championState(ahri.id)!.level).toBe(18);
  expect(ahri.hp).toBe(0);
  expect(r.levelAtDeath).toBe(1);
  expect(r.respawnTick).toBe(deadline);
  restore(w);
  w.step(deadline);
  expect(r.respawn?.tick).toBe(deadline);
  expect(ahri.hp).toBe(ahri.maxHp);
  restore(w);
});
test('victory closes pending death waits and preserves finite death or respawn tails without future mutation', () => {
  for (const phase of ['death', 'silent', 'respawn'] as const) {
    const { w, kill } = setup();
    kill();
    const r = w.ahriLifecycleAudio[0];
    if (phase === 'silent') w.step(300);
    if (phase === 'respawn') w.step(r.respawnTick);
    const nexus = w.spawn('nexus', 'red', { x: 1500, y: 1500 });
    w.damage(w.hero, nexus, 1e6, 'true');
    expect(w.winner).toBe('blue');
    if (phase === 'silent') expect(w.ahriLifecycleAudio).toEqual([]);
    else expect(w.ahriLifecycleAudio).toHaveLength(1);
    if (phase === 'death') expect(r.terminalTick).toBe(w.tick);
    if (phase === 'respawn') expect(r.terminalTick).toBeNull();
    restore(w);
    const saved = w.snapshot();
    w.step(1000);
    expect(w.snapshot()).toBe(saved);
  }
});
test('malformed pending deaths and completed respawns cannot forge clocks identity audiences or map spawns', () => {
  for (const respawn of [false, true]) {
    const { w, kill } = setup();
    kill();
    if (respawn) w.step(w.ahriLifecycleAudio[0].respawnTick);
    const changes = [
      (s: any) => {
        s.ahriLifecycleAudio[0].id = w.hero.id;
      },
      (s: any) => {
        s.ahriLifecycleAudio[0].sourceId = w.hero.id;
      },
      (s: any) => {
        s.ahriLifecycleAudio[0].respawnTick++;
      },
      (s: any) => {
        s.ahriLifecycleAudio[0].audience = ['red', 'blue'];
      },
      (s: any) => {
        s.ahriLifecycleAudio.push(s.ahriLifecycleAudio[0]);
      },
      (s: any) => {
        const r = s.ahriLifecycleAudio[0];
        if (r.respawn) r.respawn.point.x++;
        else r.origin.x++;
      },
      (s: any) => {
        const r = s.ahriLifecycleAudio[0];
        if (r.respawn) r.respawn.tick--;
        else r.terminalTick = 0;
      },
    ];
    for (const change of changes) {
      const raw = JSON.parse(w.snapshot());
      change(raw);
      expect(() => World.fromSnapshot(JSON.stringify(raw), w.battlefield)).toThrow();
    }
    if (!respawn) {
      const raw = JSON.parse(w.snapshot());
      delete raw.ahriLifecycleAudio;
      expect(() => World.fromSnapshot(JSON.stringify(raw), w.battlefield)).toThrow(/lifecycle/);
    }
  }
});
