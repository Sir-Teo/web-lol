import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRift } from '../src/content/rift';
import { NavGrid } from '../src/simulation/navgrid';
import { World } from '../src/simulation/world';
const metadata = JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8'));
const bytes = readFileSync('public/assets/maps/rift-nav.bin');
const battlefield = createRift(
  new NavGrid(metadata, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)),
  JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))
);

describe('versioned lane cadence and starting rewards', () => {
  it('runs the full wave clock through both interval transitions without duplicate or delayed waves', () => {
    // The real scheduler runs at every tick; omit lane entities to isolate its clock.
    const w = new World(false, { ...battlefield, lanes: [] });
    const deadlines: number[] = [];
    for (let tick = 0; tick < 1860 * 60; tick++) {
      const previous = w.wave;
      w.step();
      if (w.wave !== previous) {
        expect(w.wave - previous).toBe(1);
        deadlines.push(w.time);
      }
    }
    expect(deadlines.slice(0, 3)).toEqual([30, 60, 90]);
    expect(deadlines.filter((t) => t >= 810 && t <= 890)).toEqual([810, 840, 865, 890]);
    expect(deadlines.filter((t) => t >= 1740)).toEqual([1740, 1765, 1790, 1810, 1830, 1850]);
  });
  it('keeps explicit wave suppression through a timing transition', () => {
    const w = new World(false, battlefield);
    w.nextWaveTick = Infinity;
    w.tick = 840 * 60 - 1;
    w.step();
    expect(w.wave).toBe(0);
    expect(w.nextWaveTick).toBe(Infinity);
    expect(w.pendingSpawns).toHaveLength(0);
  });
  it('preserves cannon/melee alternation after 14 minutes and removes a caster after 30', () => {
    const cannon = battlefield.waveKinds(29, 865);
    expect(cannon.filter((k) => k === 'melee')).toHaveLength(2);
    expect(cannon.filter((k) => k === 'siege')).toHaveLength(1);
    expect(battlefield.waveKinds(30, 890).filter((k) => k === 'melee')).toHaveLength(3);
    expect(battlefield.waveKinds(67, 1810).filter((k) => k === 'caster')).toHaveLength(2);
  });
  it('applies both teams’ source movement upgrades to newly spawned minions and caps them', () => {
    const w = new World(false, battlefield);
    for (const [seconds, speed] of [
      [0, 350],
      [599, 350],
      [600, 375],
      [900, 400],
      [1200, 425],
      [1500, 450],
      [3600, 450],
    ]) {
      w.tick = seconds * 60;
      for (const team of ['blue', 'red'] as const)
        for (const kind of ['melee', 'caster', 'siege', 'super'] as const)
          expect(w.spawn(kind, team, w.hero).speed).toBe(speed);
    }
    expect(w.hero.speed).toBe(325);
  });
  it('grants separate current starting rewards for each lane minion class', () => {
    for (const [kind, gold, xp] of [
      ['melee', 20, 62],
      ['caster', 14, 31],
      ['siege', 50, 75],
      ['super', 50, 75],
    ] as const) {
      const w = new World(false, battlefield);
      const target = w.spawn(kind, 'red', w.hero);
      expect(target.id).not.toBe(w.hero.id);
      expect(target.team).toBe('red');
      expect(target.kind).toBe(kind);
      expect(target.previous).toEqual({ x: w.hero.x, y: w.hero.y });
      const before = w.player.gold;
      w.damage(w.hero, target, 1e6, 'true');
      expect(w.player.gold - before).toBe(gold);
      expect(w.player.xp).toBe(xp);
      expect(w.player.cs).toBe(1);
    }
  });
});
