import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { World } from '../src/simulation/world';
import { createRift } from '../src/content/rift';
import { NavGrid } from '../src/simulation/navgrid';
import { grantRedBuff, RED_BUFF_REGEN_TICKS } from '../src/simulation/red-buff';
import { LOST_CHAPTER } from '../src/content/mage-items';
import { TICK_RATE } from '../src/content/rules';
const bytes = readFileSync('public/assets/maps/rift-nav.bin');
const battlefield = createRift(
  new NavGrid(
    JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8')),
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  ),
  JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))
);

function winningAttack() {
  const world = new World(true, {
    ...battlefield,
    initialUnits: battlefield.initialUnits.filter(
      (u) => u.kind !== 'champion' && u.kind !== 'dummy'
    ),
  });
  world.nextWaveTick = Infinity;
  for (const role of ['outer-turret', 'inner-turret', 'inhibitor-turret', 'inhibitor'] as const) {
    const unit = world.units.find(
      (u) => u.team === 'red' && u.structure?.role === role && u.structure.lane === 'mid'
    )!;
    world.damage(world.hero, unit, 1e6, 'true');
  }
  for (const unit of world.units.filter(
    (u) => u.team === 'red' && u.structure?.role === 'nexus-turret'
  ))
    world.damage(world.hero, unit, 1e6, 'true');
  const nexus = world.units.find((u) => u.team === 'red' && u.kind === 'nexus')!;
  nexus.hp = 1;
  world.step(300);
  const attacker = world.spawn('melee', 'blue', { x: nexus.x + 350, y: nexus.y });
  attacker.ai = false;
  world.setOrder(attacker, { type: 'attack', target: nexus.id });
  world.step();
  expect(attacker.releaseTick).not.toBeNull();
  return { world, release: attacker.releaseTick! };
}

for (const effect of ['red', 'enlighten', 'both'] as const)
  test(`winning attack on the ${effect} restoration boundary restores without an extra resource pulse`, () => {
    const { world, release } = winningAttack();
    if (effect !== 'enlighten') grantRedBuff(world.player, release - RED_BUFF_REGEN_TICKS);
    if (effect !== 'red')
      world.player.enlighten = {
        startTick: release - LOST_CHAPTER.durationSeconds * TICK_RATE,
        endTick: release,
        totalMana: world.hero.maxMana * LOST_CHAPTER.manaFraction,
      };
    world.hero.hp = 1;
    world.hero.mana = 0;
    world.step(release - world.tick - 1);
    expect(World.fromSnapshot(world.snapshot(), world.battlefield).snapshot()).toBe(
      world.snapshot()
    );
    const hp = world.hero.hp,
      mana = world.hero.mana;
    world.step();
    expect(world.winner).toBe('blue');
    expect(world.tick).toBe(release);
    expect(world.hero.hp).toBe(hp);
    expect(world.hero.mana).toBe(mana);
    if (effect !== 'enlighten')
      expect(world.player.redBuff!.nextRegenTick).toBe(release + RED_BUFF_REGEN_TICKS);
    if (effect !== 'red') expect(world.player.enlighten).toBeNull();
    const saved = world.snapshot(),
      restored = World.fromSnapshot(saved, world.battlefield);
    restored.step(120);
    expect(restored.snapshot()).toBe(saved);
    if (effect !== 'enlighten') {
      const corrupt = JSON.parse(saved);
      corrupt.player.redBuff.nextRegenTick = release;
      expect(() => World.fromSnapshot(JSON.stringify(corrupt), world.battlefield)).toThrow(
        /Cinders clocks/
      );
    }
  });
