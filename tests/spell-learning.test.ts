import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';

for (const team of ['blue', 'red'] as const)
  test(`${team} first learning and rank restrictions conserve points without side effects`, () => {
    const w = new World(false);
    const owner = w.spawn('champion', team, { x: 0, y: 0 });
    const state = w.championState(owner.id)!;
    state.spellRanks = { q: 0, w: 0, e: 0, r: 0 };
    state.skillPoints = 1;
    expect(w.learnSpell('r', owner.id)).toBe('Requires champion level 6');
    expect(state.skillPoints).toBe(1);
    expect(w.learnSpell('w', owner.id)).toBeNull();
    expect(state.spellRanks.w).toBe(1);
    expect(state.skillPoints).toBe(0);
    const before = w.snapshot();
    expect(w.learnSpell('q', owner.id)).toBe('No skill points available');
    expect(w.snapshot()).toBe(before);
    w.gainExperience(280, owner.id);
    expect(state.level).toBe(2);
    expect(state.skillPoints).toBe(1);
    expect(w.learnSpell('w', owner.id)).toBe('Requires champion level 3');
    expect(w.learnSpell('q', owner.id)).toBeNull();
    w.gainExperience(1e6, owner.id);
    for (const ability of ['q', 'w', 'e', 'r'] as const)
      while (w.learnSpell(ability, owner.id) === null) {
        /* Spend the remaining legal ranks. */
      }
    expect(state.spellRanks).toEqual({ q: 5, w: 5, e: 5, r: 3 });
    expect(state.skillPoints).toBe(0);
    expect(w.player.spellRanks).toEqual({ q: 1, w: 1, e: 1, r: 1 });
  });

test('every next-rank minimum level rejects one level early and accepts at its threshold', () => {
  for (const ability of ['q', 'w', 'e', 'r'] as const)
    for (let rank = 0; rank < (ability === 'r' ? 3 : 5); rank++) {
      const w = new World(false);
      const minimum = ability === 'r' ? 6 + rank * 5 : 1 + rank * 2;
      w.player.spellRanks[ability] = rank;
      w.player.skillPoints = 1;
      if (minimum > 1) {
        w.player.level = minimum - 1;
        const before = w.snapshot();
        expect(w.learnSpell(ability)).toBe(`Requires champion level ${minimum}`);
        expect(w.snapshot()).toBe(before);
      }
      w.player.level = minimum;
      expect(w.learnSpell(ability)).toBeNull();
      expect(w.player.spellRanks[ability]).toBe(rank + 1);
      expect(w.player.skillPoints).toBe(0);
    }
});

test('queued learning restores and works while dead or stunned without interrupting orders', () => {
  for (const disabled of ['dead', 'stunned'] as const) {
    const w = new World(false);
    w.nextWaveTick = Infinity;
    w.gainExperience(1e6);
    if (disabled === 'dead') w.damage(w.hero, w.hero, 10000, 'true');
    else w.hero.stunUntil = 100;
    const points = w.player.skillPoints;
    w.enqueue({ type: 'learn', unit: w.hero.id, ability: 'w' });
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    for (const world of [w, restored]) {
      world.step();
      expect(world.player.spellRanks.w).toBe(2);
      expect(world.player.skillPoints).toBe(points - 1);
      expect(world.player.cooldowns.w).toBe(0);
      expect(world.player.pendingCast).toBeNull();
    }
    expect(restored.snapshot()).toBe(w.snapshot());
  }
});
