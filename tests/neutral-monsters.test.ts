import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { World } from '../src/simulation/world';
import { createGrompEncounter } from '../src/simulation/gromp-encounter';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { GROMP, GROMP_POLICY } from '../src/content/gromp';
import type { Team, Unit } from '../src/simulation/types';

const encounter = () => createGrompEncounter(PRACTICE_FIXTURE);
const monster = (world: World) => world.units.find((u) => u.kind === 'monster')!;

test('the runtime Gromp profile retains exact Root scalars and source ranged-attack values', () => {
  const raw = readFileSync('docs/reference/jungle-character-source.json');
  const pin = JSON.parse(raw.toString());
  expect(GROMP.sourcePinSha256).toBe(createHash('sha256').update(raw).digest('hex'));
  const records = pin.records['data/characters/sru_gromp/sru_gromp.bin'];
  const root = records['Characters/SRU_Gromp/CharacterRecords/Root'];
  expect(GROMP.stats.maxHp).toBe(root.baseHPModifiable.baseValue);
  expect(GROMP.stats.attackSpeed).toBe(root.attackSpeedModifiable.baseValue);
  expect(GROMP.radius).toBe(root.overrideGameplayCollisionRadius);
  expect(GROMP.pathfindingRadius).toBe(root.pathfindingCollisionRadius);
  const attack = Object.values(records).find(
    (v: any) => v.mScriptName === 'SRU_GrompBasicAttack'
  ) as any;
  expect(GROMP.missileSpeed).toBe(attack.mSpell.missileSpeed);
  expect(GROMP.castFrame).toBe(attack.mSpell.castFrame);
});

test('runtime clip aliases retain original converted animation identity and duration', () => {
  const manifest = JSON.parse(readFileSync('public/assets/models/sru-gromp-base.json', 'utf8'));
  expect(GROMP.modelSha256).toBe(manifest.output.sha256);
  for (const [alias, clip] of Object.entries(GROMP.clips)) {
    const source = manifest.clips.find((c: any) => c.name === clip.name);
    expect(source.source.endsWith(`_${alias}.anm`)).toBe(true);
    expect(clip.durationSeconds).toBe(source.durationSeconds);
  }
});

test('neutral Gromp preserves root stats and independent home coordinates without an invented team', () => {
  const world = encounter(),
    target = monster(world);
  expect(target.team).toBe('neutral');
  expect(target).toMatchObject({
    hp: 2050,
    damage: 70,
    armor: 42,
    magicResist: 42,
    range: 150,
    speed: 330,
    radius: 120,
    missileSpeed: 1800,
    attackPeriod: GROMP_POLICY.attackPeriodTicks,
  });
  const other = world.spawnMonster(world.hero);
  expect(other.monster.home).toEqual({ x: 0, y: 0 });
  world.hero.x = 20;
  expect(other.monster.home.x).toBe(0);
  world.enqueue({
    type: 'order',
    unit: target.id,
    order: { type: 'move', point: { x: 1000, y: 0 } },
  });
  world.step(20);
  expect(target.hp).toBe(target.maxHp);
  expect(target.monster.phase).toBe('idle');
  expect(target.order).toEqual({ type: 'idle' });
  expect(target.x).toBe(450);
});

test('neutral units supply neither blue/red sight nor pooled neutral sight', () => {
  const world = encounter(),
    target = monster(world);
  Object.assign(world.hero, { x: -3000, y: -2000 });
  world.spawnMonster({ x: 550, y: 0 });
  expect(world.visionSources('neutral')).toEqual([]);
  expect(world.visible(target, 'neutral')).toBe(false);
  expect(world.visible(target, 'blue')).toBe(false);
  expect(world.visible(target, 'red')).toBe(false);
  const red = world.spawn('champion', 'red', { x: 300, y: 0 });
  expect(world.visible(target, 'red')).toBe(true);
  expect(world.visible(target, 'blue')).toBe(false);
  world.damage(red, target, 10, 'true');
  expect(world.events.filter((e) => e.type === 'damage').at(-1)?.audience).toEqual(['red']);
});

for (const team of ['blue', 'red'] as Team[]) {
  test(`${team} can engage Gromp and receive its retaliation without neutral team vision`, () => {
    const world = encounter(),
      target = monster(world);
    const attacker = team === 'blue' ? world.hero : world.spawn('champion', team, { x: 0, y: 0 });
    if (team === 'red') Object.assign(world.hero, { x: -3000, y: -2000 });
    attacker.hp = attacker.maxHp = 10000;
    world.enqueue({
      type: 'order',
      unit: attacker.id,
      order: { type: 'attack', target: target.id },
    });
    world.step(180);
    expect(target.hp).toBeLessThan(target.maxHp);
    expect(target.monster.phase).toBe('engaged');
    expect(target.monster.targetId).toBe(attacker.id);
    expect(attacker.hp).toBeLessThan(attacker.maxHp);
    expect(world.visionSources('neutral')).toEqual([]);
  });
  test(`${team} last hit receives Root rewards and four CS without first blood or shared champion XP`, () => {
    const world = encounter(),
      target = monster(world);
    const attacker = team === 'blue' ? world.hero : world.spawn('champion', team, { x: 0, y: 0 });
    const state = world.championState(attacker.id)!;
    const before = { gold: state.gold, xp: state.xp, cs: state.cs };
    const other = world.spawn('champion', team === 'blue' ? 'red' : 'blue', { x: 20, y: 0 });
    world.damage(attacker, target, 99999, 'true');
    expect(state.gold - before.gold).toBe(GROMP.gold);
    expect(state.xp - before.xp).toBe(GROMP.experience);
    expect(state.cs - before.cs).toBe(4);
    expect(world.championState(other.id)!.xp).toBe(0);
    expect(world.firstBloodClaimed).toBe(false);
    expect(state.kills).toBe(0);
    expect(target.respawnTick).toBeNull();
    expect(World.fromSnapshot(world.snapshot(), world.battlefield).snapshot()).toBe(
      world.snapshot()
    );
  });
}

test('lane minions, turrets and lane bots do not automatically pull neutral monsters', () => {
  const world = encounter(),
    target = monster(world);
  Object.assign(world.hero, { x: -3000, y: -2000 });
  for (const kind of ['melee', 'caster', 'turret', 'champion'] as const) {
    const unit = world.spawn(kind, 'red', { x: 200, y: 0 });
    unit.ai = kind === 'champion';
    unit.order = { type: 'attackMove', point: { x: 700, y: 0 } };
  }
  world.step(150);
  expect(target.hp).toBe(target.maxHp);
  expect(target.monster.phase).toBe('idle');
});

test('a controlled neutral encounter responds to Lux binding and rejects allied champion shields', () => {
  const world = createGrompEncounter(PRACTICE_FIXTURE, 'lux'),
    target = monster(world);
  world.applyShield(world.hero, target, 50, 60);
  expect(target.shields).toEqual([]);
  world.enqueue({ type: 'cast', unit: world.hero.id, ability: 'q', point: target });
  world.step(60);
  expect(target.hp).toBeLessThan(target.maxHp);
  expect(target.rootUntil).toBeGreaterThan(world.tick);
  expect(target.monster.phase).toBe('engaged');
});

test('leash reset cancels an unreleased attack, heals, returns home and rejects damage until idle', () => {
  const world = encounter(),
    target = monster(world);
  world.damage(world.hero, target, 200, 'true');
  world.step(55);
  expect(target.monster.phase).toBe('engaged');
  world.hero.x = -1500;
  world.step();
  expect(target.monster.phase).toBe('returning');
  expect(target.releaseTick).toBeNull();
  const hp = target.hp;
  world.damage(world.hero, target, 9999, 'true');
  expect(target.hp).toBe(hp);
  world.step(360);
  expect(target.monster.phase).toBe('idle');
  expect(target.hp).toBe(target.maxHp);
  expect(Math.hypot(target.x - 450, target.y)).toBeLessThan(3);
});

test('neutral execution uses existing recent champion credit and cannot award an unassisted first blood', () => {
  const world = encounter(),
    target = monster(world);
  world.damage(target, world.hero, 99999, 'true');
  expect(world.player.deaths).toBe(1);
  expect(world.firstBloodClaimed).toBe(false);
  expect(world.player.kills).toBe(0);
});

for (const returning of [false, true])
  test(`saved ${returning ? 'reset' : 'engagement'} continues exactly with a private neutral target`, () => {
    const world = encounter(),
      target = monster(world);
    world.hero.hp = world.hero.maxHp = 10000;
    world.damage(world.hero, target, 20, 'true');
    world.step(60);
    if (returning) {
      world.hero.x = -1500;
      world.step();
    }
    const saved = world.snapshot(),
      restored = World.fromSnapshot(saved, world.battlefield);
    expect(restored.snapshot()).toBe(saved);
    for (let i = 0; i < 160; i++) {
      world.step();
      restored.step();
      if (i % 20 === 0) expect(restored.snapshot()).toBe(world.snapshot());
    }
  });

test('saved monsters reject crossed faction, unsupported species, invalid target, AI and respawn state', () => {
  const world = encounter();
  const saved = JSON.parse(world.snapshot());
  const mutate: ((u: any) => void)[] = [
    (u) => {
      u.team = 'red';
    },
    (u) => {
      u.monster.species = 'unsupported-monster';
    },
    (u) => {
      u.monster.phase = 'engaged';
      u.monster.targetId = 99999;
    },
    (u) => {
      u.ai = true;
    },
    (u) => {
      u.respawnTick = 500;
    },
    (u) => {
      u.monster.home.x = 100000;
    },
    (u) => {
      delete u.monster;
    },
    (u) => {
      u.champion = 'ashe';
    },
    (u) => {
      u.structureTransform = Array(16).fill(0);
    },
    (u) => {
      u.order = { type: 'attack', target: world.hero.id };
    },
    (u) => {
      u.monster.phase = 'returning';
      u.order = { type: 'move', point: { x: 0, y: 0 } };
    },
    (u) => {
      u.releaseTick = 10;
    },
  ];
  for (const apply of mutate) {
    const value = structuredClone(saved);
    apply(value.units.find((u: Unit) => u.kind === 'monster'));
    expect(() => World.fromSnapshot(JSON.stringify(value), world.battlefield)).toThrow();
  }
});

test('cleared controlled encounter saves its identity after the corpse leaves the simulation', () => {
  const world = encounter();
  world.damage(world.hero, monster(world), 99999, 'true');
  world.step(400);
  expect(world.units.some((u) => u.kind === 'monster')).toBe(false);
  const restored = World.fromSnapshot(world.snapshot(), world.battlefield);
  expect(restored.encounter).toBe('gromp');
  expect(restored.snapshot()).toBe(world.snapshot());
});
