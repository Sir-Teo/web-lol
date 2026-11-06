import type { World } from '../../src/simulation/world';
import type { Battlefield } from '../../src/simulation/battlefield';
export const LIFECYCLE_GAMEPLAY_CASES = [
  'level-one',
  'level-eighteen',
  'death-windup',
  'death-flight',
  'death-orb',
  'death-fox-fire',
  'death-rush',
  'death-essence',
  'two-lives',
  'hidden-death-visible-respawn',
] as const;
export type LifecycleGameplayCase = (typeof LIFECYCLE_GAMEPLAY_CASES)[number];
/** Execute genuine death timers and respawns in current or frozen World.
 * Existing attack/P/R/W/Q/E presentation stays in complete projections. */
export function lifecycleGameplaySamples(
  WorldType: typeof World,
  base: Battlefield,
  scenario: LifecycleGameplayCase
) {
  let revealed = scenario !== 'hidden-death-visible-respawn';
  const w = new WorldType(false, {
    ...base,
    initialUnits: [],
    lineOfSight: () => revealed,
    inBrush: () => false,
    lineWalkable: () => true,
    reachable: (p) => ({ ...p }),
    findPath: (_a, b) => [{ ...b }],
  });
  w.nextWaveTick = 1e9;
  w.random.state = 1;
  Object.assign(w.hero, { x: -3000, y: -3000, previous: { x: -3000, y: -3000 }, ai: false });
  const ahri = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'ahri');
  ahri.ai = false;
  const enemy = w.spawn('champion', 'red', { x: 450, y: 0 }, 'lux');
  Object.assign(enemy, { ai: false, hp: 10000, maxHp: 10000, armor: 0 });
  if (scenario === 'level-eighteen' || scenario === 'death-rush') w.gainExperience(1e6, ahri.id);
  let deathAt = 1;
  if (scenario === 'death-windup' || scenario === 'death-flight') {
    w.setOrder(ahri, { type: 'attack', target: enemy.id });
    deathAt = scenario === 'death-windup' ? 5 : 25;
  }
  if (scenario === 'death-orb' || scenario === 'death-fox-fire' || scenario === 'death-rush') {
    const ability = scenario === 'death-orb' ? 'q' : scenario === 'death-fox-fire' ? 'w' : 'r';
    w.learnSpell(ability, ahri.id);
    w.enqueue({ type: 'cast', unit: ahri.id, ability, point: { x: 900, y: 0 } });
    deathAt = scenario === 'death-orb' ? 20 : 5;
  }
  if (scenario === 'death-essence') {
    for (let i = 0; i < 9; i++) {
      const v = w.spawn('melee', 'red', { x: 1000, y: 0 });
      Object.assign(v, { ai: false, experienceBounty: 0, goldBounty: 0 });
      w.damage(ahri, v, 1e6, 'true');
    }
    deathAt = 2;
  }
  const at = new Set([0, 1, 2, 5, 10, 19, 20, 25, 30, 60]);
  let deaths = 0,
    respawns = 0,
    wasDead = false,
    plannedRespawn = -1,
    finalTick = 8000,
    nextDeath = deathAt;
  const samples: { tick: number; state: string }[] = [];
  while (w.tick <= finalTick) {
    if (wasDead && w.alive(ahri)) {
      respawns++;
      wasDead = false;
      if (
        w.tick !== plannedRespawn ||
        ahri.deadAt !== null ||
        ahri.respawnTick !== null ||
        ahri.hp !== ahri.maxHp ||
        ahri.mana !== ahri.maxMana ||
        ahri.x !== base.spawns.blue.x ||
        ahri.y !== base.spawns.blue.y
      )
        throw Error('Lifecycle actual respawn fixture failed');
      if (scenario === 'two-lives' && deaths === 1) nextDeath = w.tick + 30;
    }
    if (w.tick === nextDeath) {
      if (deaths === 0) {
        if (scenario === 'death-windup' && (!ahri.releaseTick || w.ahriAttackAudio[0]?.launch))
          throw Error('Lifecycle windup fixture failed');
        if (
          scenario === 'death-flight' &&
          !w.projectiles.some((p) => p.source === ahri.id && p.type === 'attack')
        )
          throw Error('Lifecycle released flight fixture failed');
        if (scenario === 'death-orb' && !w.ahriOrbs.length)
          throw Error('Lifecycle orb fixture failed');
        if (scenario === 'death-fox-fire' && !w.ahriFoxFires.length)
          throw Error('Lifecycle Fox-Fire fixture failed');
        if (scenario === 'death-rush' && !w.ahriRushes.length)
          throw Error('Lifecycle rush fixture failed');
        if (scenario === 'death-essence' && !w.ahriEssences.some((e) => e.stopTick === null))
          throw Error('Lifecycle Essence fixture failed');
      }
      w.damage(enemy, ahri, 1e6, 'true');
      deaths++;
      wasDead = true;
      nextDeath = Infinity;
      if (
        ahri.hp !== 0 ||
        ahri.deadAt !== w.tick ||
        ahri.respawnTick === null ||
        ahri.respawnTick <= w.tick
      )
        throw Error('Lifecycle actual death fixture failed');
      plannedRespawn = ahri.respawnTick;
      for (const t of [
        w.tick,
        w.tick + 1,
        w.tick + 30,
        w.tick + 232,
        w.tick + 233,
        w.tick + 234,
        plannedRespawn - 1,
        plannedRespawn,
        plannedRespawn + 1,
        plannedRespawn + 30,
        plannedRespawn + 293,
        plannedRespawn + 294,
        plannedRespawn + 295,
      ])
        at.add(t);
      if (scenario !== 'two-lives' || deaths === 2) finalTick = plannedRespawn + 300;
    }
    if (scenario === 'hidden-death-visible-respawn' && wasDead && w.tick === plannedRespawn - 1) {
      revealed = true;
      enemy.x = base.spawns.blue.x + 200;
      enemy.y = base.spawns.blue.y;
    }
    if (at.has(w.tick)) {
      const state = JSON.parse(w.snapshot());
      delete state.version;
      delete state.ruleset;
      delete state.ahriLifecycleAudio;
      samples.push({ tick: w.tick, state: JSON.stringify(state) });
    }
    if (w.tick === finalTick) break;
    w.step();
    if (w.tick > 8000) throw Error('Lifecycle fixture never completed');
  }
  const expected = scenario === 'two-lives' ? 2 : 1;
  if (deaths !== expected || respawns !== expected || !w.alive(ahri))
    throw Error('Lifecycle fixture did not complete genuine lives');
  return samples;
}
