import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';

for (const ability of ['w', 'e', 'r'] as const) {
  const count = ability === 'w' ? 7 : 1;
  const type = ability === 'w' ? 'volley' : ability === 'e' ? 'hawkshot' : 'ultimate';
  function start() {
    const w = new World(false);
    w.nextWaveTick = Infinity;
    const origin = { x: w.hero.x, y: w.hero.y };
    w.enqueue({
      type: 'cast',
      unit: w.hero.id,
      ability,
      point: { x: origin.x + 1200, y: origin.y },
    });
    w.step();
    return { w, origin };
  }

  test(`${ability} locks movement until release, pays once and resumes a deferred order`, () => {
    const { w, origin } = start();
    const mana = w.hero.mana,
      cooldown = w.player.cooldowns[ability];
    expect(w.player.pendingCast!.releaseTick).toBe(16);
    expect(w.projectiles).toHaveLength(0);
    w.enqueue({
      type: 'order',
      unit: w.hero.id,
      order: { type: 'move', point: { x: origin.x, y: origin.y + 200 } },
    });
    w.step(14);
    expect({ x: w.hero.x, y: w.hero.y }).toEqual(origin);
    expect(w.projectiles).toHaveLength(0);
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    for (const world of [w, restored]) {
      world.step();
      expect(world.player.pendingCast).toBeNull();
      expect(world.player.castAnimation).toBeNull();
      expect(world.projectiles).toHaveLength(count);
      expect(world.projectiles[Math.floor(count / 2)].previous).toEqual(origin);
      expect(world.projectiles[Math.floor(count / 2)].direction).toEqual({ x: 1, y: 0 });
      expect(world.projectiles[Math.floor(count / 2)].remaining).toBeCloseTo(
        ability === 'w'
          ? 1175
          : ability === 'e'
            ? 1200 - 1400 / 60
            : 25000 - (1500 / 60 + 100 / 3600)
      );
      expect(world.hero.y).not.toBe(origin.y);
      expect(world.hero.mana).toBeGreaterThanOrEqual(mana);
      expect(world.player.cooldowns[ability]).toBe(cooldown);
      if (ability === 'e') {
        expect(world.player.eCharges).toBe(1);
        expect(world.player.eRechargeTick).toBe(5401);
        expect(world.projectiles[0].launchTick).toBe(16);
      }
    }
    expect(restored.snapshot()).toBe(w.snapshot());
  });

  test(`${ability} replaces an attack windup and survives stun, but death cancels release`, () => {
    for (const dying of [false, true]) {
      const w = new World(false);
      w.nextWaveTick = Infinity;
      const target = w.spawn('dummy', 'red', { x: w.hero.x + 600, y: w.hero.y });
      w.setOrder(w.hero, { type: 'attack', target: target.id });
      w.step();
      expect(w.hero.releaseTick).not.toBeNull();
      w.enqueue({ type: 'cast', unit: w.hero.id, ability, point: target });
      w.step();
      expect(w.hero.releaseTick).toBeNull();
      expect(w.hero.attackCycle).toBeNull();
      if (dying) w.damage(target, w.hero, 1e6, 'true');
      else w.hero.stunUntil = 100;
      w.step(15);
      expect(w.projectiles.filter((p) => p.type === type)).toHaveLength(dying ? 0 : count);
      expect(w.projectiles.some((p) => p.type === 'attack')).toBe(false);
      expect(w.player.pendingCast).toBeNull();
      if (ability === 'e') {
        expect(w.player.eCharges).toBe(1);
        expect(w.player.eRechargeTick).toBe(5402);
      }
    }
  });

  test(`${ability} rejects additional ability casts and recall while allowing Heal`, () => {
    const { w } = start();
    const pending = structuredClone(w.player.pendingCast);
    w.player.qStacks = 4;
    w.player.qStackExpiry = 240;
    w.hero.hp = 100;
    for (const ability of ['q', 'w', 'e', 'r', 'd', 'f'] as const)
      w.enqueue({
        type: 'cast',
        unit: w.hero.id,
        ability,
        point: { x: w.hero.x + 100, y: w.hero.y },
      });
    w.enqueue({ type: 'recall', unit: w.hero.id });
    w.step();
    expect(w.player.pendingCast).toEqual(pending);
    expect(w.player.recallEnd).toBeNull();
    expect(w.hero.hp).toBeGreaterThan(100);
    expect(w.player.cooldowns.f).toBeGreaterThan(0);
    for (const other of ['q', 'w', 'e', 'r', 'd'] as const)
      if (other !== ability) expect(w.player.cooldowns[other]).toBe(0);
  });

  test(`${ability} snapshots reject wrong duration, future starts and expired release`, () => {
    const { w } = start();
    for (const patch of [
      { releaseTick: 15 },
      { startTick: 2, releaseTick: 17 },
      { startTick: 0, releaseTick: 15, ability: 'q' },
    ]) {
      const saved = JSON.parse(w.snapshot());
      Object.assign(saved.player.pendingCast, patch);
      expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow();
    }
    const saved = JSON.parse(w.snapshot());
    saved.tick = 16;
    expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow();
  });
}

for (const ability of ['w', 'e', 'r'] as const) {
  test(`${ability} retains recovery through release and Heal, but actions cancel it permanently`, () => {
    for (const interrupt of [
      'move',
      'idle',
      'attack',
      'recall',
      'stun',
      'death',
      'q',
      'd',
      'spell',
    ] as const) {
      const w = new World(false);
      w.nextWaveTick = Infinity;
      const point = { x: w.hero.x + 400, y: w.hero.y };
      w.enqueue({ type: 'cast', unit: w.hero.id, ability, point });
      w.step(16);
      expect(w.player.pendingCast).toBeNull();
      expect(w.player.castAnimation).toEqual({ ability, startTick: 1 });
      w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'f', point });
      w.step();
      const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
      expect(restored.player.castAnimation).toEqual(w.player.castAnimation);
      if (interrupt === 'move' || interrupt === 'idle')
        w.setOrder(w.hero, interrupt === 'move' ? { type: 'move', point } : { type: 'idle' });
      else if (interrupt === 'attack') {
        const target = w.spawn('dummy', 'red', point);
        w.setOrder(w.hero, { type: 'attack', target: target.id });
      } else if (interrupt === 'recall') w.enqueue({ type: 'recall', unit: w.hero.id });
      else if (interrupt === 'stun') w.hero.stunUntil = w.tick + 2;
      else if (interrupt === 'death') w.damage(w.spawn('dummy', 'red', point), w.hero, 1e6, 'true');
      else {
        w.player.qStacks = 4;
        w.player.qStackExpiry = w.tick + 240;
        w.enqueue({
          type: 'cast',
          unit: w.hero.id,
          ability: interrupt === 'spell' ? (ability === 'w' ? 'e' : 'w') : interrupt,
          point,
        });
      }
      w.step();
      if (interrupt === 'spell') {
        expect(w.player.castAnimation?.ability).not.toBe(ability);
        expect(w.player.castAnimation?.startTick).toBe(w.tick);
      } else {
        expect(w.player.castAnimation).toBeNull();
        w.step(3);
        expect(w.player.castAnimation).toBeNull();
      }
    }
  });
}

test('saved cast presentation rejects missing, mismatched and future timelines', () => {
  const w = new World(false);
  w.enqueue({
    type: 'cast',
    unit: w.hero.id,
    ability: 'w',
    point: { x: w.hero.x + 500, y: w.hero.y },
  });
  w.step();
  for (const animation of [null, { ability: 'e', startTick: 1 }, { ability: 'w', startTick: 2 }]) {
    const saved = JSON.parse(w.snapshot());
    saved.player.castAnimation = animation;
    expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow();
  }
});
