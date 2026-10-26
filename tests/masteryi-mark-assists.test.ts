import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { ASSIST_WINDOW_SECONDS } from '../src/content/assist-window';
import type { Unit } from '../src/simulation/types';
function fixture() {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    lineOfSight: () => true,
    inBrush: () => false,
    reachable: (p) => ({ x: p.x, y: p.y }),
    findPath: (_a, b) => [{ x: b.x, y: b.y }],
  });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -5000;
  const yi = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'masteryi');
  const victim = w.spawn('champion', 'red', { x: 300, y: 0 }, 'lux');
  const state = w.championState(yi.id)!;
  w.learnSpell('q', yi.id);
  const cast = (target: Unit = victim) => {
    w.enqueue({ type: 'cast', unit: yi.id, ability: 'q', point: target, targetId: target.id });
    w.step();
  };
  return { w, yi, victim, state, victimState: w.championState(victim.id)!, cast };
}
test('a pending first mark qualifies Yi for an assist before any Q damage', () => {
  const f = fixture();
  f.cast();
  f.w.step(14);
  expect(f.state.alphaStrike!.marks[0].result).toBe('pending');
  expect(f.victim.hp).toBe(f.victim.maxHp);
  expect(f.victimState.damageContributors).toEqual([]);
  f.w.damage(f.w.hero, f.victim, 1e6, 'true');
  expect(f.w.player.kills).toBe(1);
  expect(f.state.kills).toBe(0);
  expect(f.state.assists).toBe(1);
});

test('a target killed before the first mark grants no Q assist', () => {
  const f = fixture();
  f.cast();
  f.w.step(13);
  expect(f.state.alphaStrike!.marks).toEqual([]);
  expect(f.victimState.alphaMarkContributors).toEqual([]);
  f.w.damage(f.w.hero, f.victim, 1e6, 'true');
  expect(f.state.assists).toBe(0);
});

test('marks refresh one source entry, and later damage does not award a second assist', () => {
  const f = fixture();
  f.cast();
  f.w.step(14);
  expect(f.victimState.alphaMarkContributors).toEqual([
    { sourceId: f.yi.id, lastMarkTick: f.w.tick },
  ]);
  f.w.step(14);
  expect(f.victimState.alphaMarkContributors).toEqual([
    { sourceId: f.yi.id, lastMarkTick: f.w.tick },
  ]);
  expect(f.victimState.damageContributors).toEqual([
    { sourceId: f.yi.id, lastDamageTick: f.w.tick },
  ]);
  f.w.damage(f.w.hero, f.victim, 1e6, 'true');
  expect(f.state.assists).toBe(1);
});

test('two Yi casters qualify independently before either first contact deals damage', () => {
  const f = fixture();
  const second = f.w.spawn('champion', 'blue', { x: 0, y: 100 }, 'masteryi');
  f.w.learnSpell('q', second.id);
  f.cast();
  f.w.enqueue({
    type: 'cast',
    unit: second.id,
    ability: 'q',
    point: f.victim,
    targetId: f.victim.id,
  });
  f.w.step(15);
  expect(f.victimState.alphaMarkContributors.map((c) => c.sourceId)).toEqual([f.yi.id, second.id]);
  expect(f.victim.hp).toBe(f.victim.maxHp);
  expect(f.victimState.damageContributors).toEqual([]);
  f.w.damage(f.w.hero, f.victim, 1e6, 'true');
  expect(f.state.assists).toBe(1);
  expect(f.w.championState(second.id)!.assists).toBe(1);
});

test.each([0, 1])(
  'mark-only credit uses the inclusive standard assist deadline plus %i ticks',
  (extra) => {
    const f = fixture();
    f.cast();
    f.w.step(14);
    // Death stops the pending Q before it can deal damage; its marker remains.
    f.w.damage(f.victim, f.yi, 1e6, 'true');
    f.w.step(ASSIST_WINDOW_SECONDS * 60 + extra);
    expect(World.fromSnapshot(f.w.snapshot(), f.w.battlefield).snapshot()).toBe(f.w.snapshot());
    expect(f.victimState.damageContributors).toEqual([]);
    f.w.damage(f.w.hero, f.victim, 1e6, 'true');
    expect(f.state.assists).toBe(extra === 0 ? 1 : 0);
  }
);

test('mark-only contact never replaces the actual attacker for turret execution credit', () => {
  const f = fixture();
  f.w.damage(f.w.hero, f.victim, 1, 'true');
  f.cast();
  f.w.step(14);
  expect(f.victimState.damageContributors.map((c) => c.sourceId)).toEqual([f.w.hero.id]);
  const turret = f.w.spawn('turret', 'blue', { x: 600, y: 0 });
  f.w.damage(turret, f.victim, 1e6, 'true');
  expect(f.w.player.kills).toBe(1);
  expect(f.state.kills).toBe(0);
  expect(f.state.assists).toBe(1);
});

test('a pure marker cannot turn an otherwise uncredited turret execution into a Yi kill', () => {
  const f = fixture();
  f.cast();
  f.w.step(14);
  const turret = f.w.spawn('turret', 'blue', { x: 600, y: 0 });
  f.w.damage(turret, f.victim, 1e6, 'true');
  expect(f.state.kills).toBe(0);
  expect(f.state.assists).toBe(0);
  expect(f.w.player.kills).toBe(0);
});

test('a nonchampion mark does not create an incoming champion assist entry', () => {
  const f = fixture();
  const dummy = f.w.spawn('dummy', 'red', { x: 250, y: 0 });
  f.cast(dummy);
  f.w.step(14);
  expect(f.state.alphaStrike!.marks[0].targetId).toBe(dummy.id);
  expect(f.victimState.alphaMarkContributors).toEqual([]);
});

function learnR(f: ReturnType<typeof fixture>) {
  f.w.gainExperience(1e6, f.yi.id);
  for (const a of ['w', 'e', 'r'] as const) expect(f.w.learnSpell(a, f.yi.id)).toBeNull();
}
test('an active-R mark-only assist extends once and refunds current Q/W/E cooldowns', () => {
  const f = fixture();
  learnR(f);
  f.w.enqueue({ type: 'cast', unit: f.yi.id, ability: 'r', point: f.yi });
  f.w.step();
  f.cast();
  f.w.step(14);
  f.state.cooldowns.w = f.state.cooldowns.e = f.w.tick + 1000;
  const end = f.state.highlander!.endTick;
  const q = f.state.cooldowns.q - f.w.tick;
  const r = f.state.cooldowns.r;
  f.w.damage(f.w.hero, f.victim, 1e6, 'true');
  expect(f.state.assists).toBe(1);
  expect(f.state.highlander!.extensionCount).toBe(1);
  expect(f.state.highlander!.endTick).toBe(end + 420);
  expect(f.state.cooldowns.w - f.w.tick).toBe(301);
  expect(f.state.cooldowns.e - f.w.tick).toBe(301);
  expect(f.state.cooldowns.q - f.w.tick).toBe(Math.ceil(q * (1 - 0.699999988079071)));
  expect(f.state.cooldowns.r).toBe(r);
  expect(World.fromSnapshot(f.w.snapshot(), f.w.battlefield).snapshot()).toBe(f.w.snapshot());
});

test('posthumous mark credit retains R passive refunds without restoring a dead active buff', () => {
  const f = fixture();
  learnR(f);
  f.w.enqueue({ type: 'cast', unit: f.yi.id, ability: 'r', point: f.yi });
  f.w.step();
  f.cast();
  f.w.step(14);
  f.state.cooldowns.w = f.state.cooldowns.e = f.w.tick + 1000;
  f.w.damage(f.victim, f.yi, 1e6, 'true');
  expect(f.state.alphaStrike).toBeNull();
  expect(World.fromSnapshot(f.w.snapshot(), f.w.battlefield).snapshot()).toBe(f.w.snapshot());
  f.w.damage(f.w.hero, f.victim, 1e6, 'true');
  expect(f.yi.hp).toBe(0);
  expect(f.state.assists).toBe(1);
  expect(f.state.cooldowns.w - f.w.tick).toBe(301);
  expect(f.state.highlander).toBeNull();
});

test('pending mark credit saves exactly and preserves the same later takedown and simulation', () => {
  const f = fixture();
  f.cast();
  f.w.step(14);
  const saved = f.w.snapshot();
  const copy = World.fromSnapshot(saved, f.w.battlefield);
  expect(copy.snapshot()).toBe(saved);
  f.w.damage(f.w.hero, f.victim, 1e6, 'true');
  copy.damage(copy.hero, copy.unit(f.victim.id)!, 1e6, 'true');
  expect(copy.snapshot()).toBe(f.w.snapshot());
  f.w.step(300);
  copy.step(300);
  expect(copy.snapshot()).toBe(f.w.snapshot());
});

test('victim respawn clears incoming mark history alongside damage and support history', () => {
  const f = fixture();
  f.cast();
  f.w.step(14);
  f.w.damage(f.w.hero, f.victim, 1e6, 'true');
  expect(f.victimState.alphaMarkContributors).toHaveLength(1);
  f.w.step(f.victim.respawnTick! - f.w.tick);
  expect(f.w.alive(f.victim)).toBe(true);
  expect(f.victimState.alphaMarkContributors).toEqual([]);
  expect(World.fromSnapshot(f.w.snapshot(), f.w.battlefield).snapshot()).toBe(f.w.snapshot());
});

test.each(['duplicate', 'foreign', 'allied', 'unknown', 'future', 'fractional', 'negative'])(
  'decoder rejects a forged %s mark contributor',
  (kind) => {
    const f = fixture();
    f.cast();
    f.w.step(14);
    const ally = f.w.spawn('champion', 'red', { x: 500, y: 0 }, 'masteryi');
    f.w.learnSpell('q', ally.id);
    const raw = JSON.parse(f.w.snapshot());
    const owner = raw.otherChampions.find((s: any) => s.id === f.victim.id);
    const entry = owner.alphaMarkContributors[0];
    if (kind === 'duplicate') owner.alphaMarkContributors.push({ ...entry });
    if (kind === 'foreign') entry.sourceId = f.w.hero.id;
    if (kind === 'allied') entry.sourceId = ally.id;
    if (kind === 'unknown') entry.sourceId = raw.nextId;
    if (kind === 'future') entry.lastMarkTick = raw.tick + 1;
    if (kind === 'fractional') entry.lastMarkTick = raw.tick - 0.5;
    if (kind === 'negative') entry.lastMarkTick = -1;
    expect(() => World.fromSnapshot(JSON.stringify(raw), f.w.battlefield)).toThrow();
  }
);

test('decoder rejects a contributor recorded after the victim died', () => {
  const f = fixture();
  f.cast();
  f.w.step(14);
  f.w.damage(f.w.hero, f.victim, 1e6, 'true');
  f.w.step();
  const raw = JSON.parse(f.w.snapshot());
  raw.otherChampions.find((s: any) => s.id === f.victim.id).alphaMarkContributors[0].lastMarkTick =
    raw.tick;
  expect(() => World.fromSnapshot(JSON.stringify(raw), f.w.battlefield)).toThrow(
    /assist contributions/
  );
});

test('schema 145 requires the new history even when empty and rejects the earlier version', () => {
  const f = fixture();
  const old = JSON.parse(f.w.snapshot());
  old.version = 144;
  expect(() => World.fromSnapshot(JSON.stringify(old), f.w.battlefield)).toThrow();
  const missing = JSON.parse(f.w.snapshot());
  delete missing.player.alphaMarkContributors;
  expect(() => World.fromSnapshot(JSON.stringify(missing), f.w.battlefield)).toThrow();
});

test('decoder rejects a marker attributed to Yi without a learned Q', () => {
  const f = fixture();
  f.cast();
  f.w.step(14);
  f.w.damage(f.victim, f.yi, 1e6, 'true');
  const raw = JSON.parse(f.w.snapshot());
  const source = raw.otherChampions.find((s: any) => s.id === f.yi.id);
  source.spellRanks.q = 0;
  source.cooldowns.q = 0;
  source.skillPoints++;
  // Isolate the forged incoming marker from independently validated finite
  // audio/particle cast histories that survive their caster's death.
  source.alphaAudio = [];
  source.alphaCastVisuals = [];
  expect(() => World.fromSnapshot(JSON.stringify(raw), f.w.battlefield)).toThrow(
    /assist contributions/
  );
});
