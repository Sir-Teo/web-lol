import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { MASTER_YI_W } from '../src/content/masteryi-w';
import { experienceToNextLevel } from '../src/simulation/progression';
import { meditateReduction, MEDITATE_LINGER_TICKS } from '../src/simulation/masteryi-meditate';
import { MOBILE_CLIP_DURATIONS } from '../src/content/mobile-clip-durations';
import { mobilePose } from '../src/render/mobile-pose';

function fixture(wRank = 1, eRank = 0) {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    lineOfSight: () => true,
    inBrush: () => false,
    lineWalkable: () => true,
    reachable: (p) => ({ x: p.x, y: p.y }),
    findPath: (_a, b) => [{ x: b.x, y: b.y }],
  });
  w.nextWaveTick = Infinity;
  const yi = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'masteryi');
  yi.ai = false;
  const state = w.championState(yi.id)!;
  const requiredLevel = Math.max(1, wRank + eRank, 1 + 2 * (Math.max(wRank, eRank) - 1));
  while (state.level < requiredLevel) w.gainExperience(experienceToNextLevel(state.level), yi.id);
  for (let i = 0; i < wRank; i++) expect(w.learnSpell('w', yi.id)).toBeNull();
  for (let i = 0; i < eRank; i++) expect(w.learnSpell('e', yi.id)).toBeNull();
  const target = w.spawn('dummy', 'red', { x: 150, y: 0 });
  target.hp = target.maxHp = 1e6;
  target.armor = 0;
  const cast = (ability: 'w' | 'e' = 'w') => {
    w.enqueue({ type: 'cast', unit: yi.id, ability, point: yi });
    w.step();
  };
  const primary = () => {
    w.setOrder(yi, { type: 'attack', target: target.id });
    w.step(Math.max(1, yi.nextAttackTick - w.tick + 1));
    w.step(yi.releaseTick! - w.tick);
    w.setOrder(yi, { type: 'idle' });
  };
  const resume = (ticks = 300) => {
    const saved = w.snapshot(),
      copy = World.fromSnapshot(saved, w.battlefield);
    expect(copy.snapshot()).toBe(saved);
    w.step(ticks);
    copy.step(ticks);
    expect(copy.snapshot()).toBe(w.snapshot());
  };
  return { w, yi, state, target, cast, primary, resume };
}

test('Meditate retains exact standard heal/defense ranks, explicit cooldown/stat omissions and source body sequence', () => {
  const source = JSON.parse(readFileSync('docs/reference/masteryi/character.json', 'utf8')).records;
  const spell = source[MASTER_YI_W.declaration].mSpell;
  expect(MASTER_YI_W.baseHealByRank).toEqual([120, 200, 280, 360, 440]);
  expect(MASTER_YI_W.sourceCooldownSeconds).toBeNull();
  expect(MASTER_YI_W.sourceHealStatId).toBeNull();
  expect(spell.cooldownTime).toBeUndefined();
  expect(MASTER_YI_W.publicCooldownSecondsByRank).toEqual([10, 10, 10, 10, 10]);
  expect(spell.mSpellTags).toContain('Trait_AttackReset');
  expect(MASTER_YI_W.graphSequence).toEqual(['Spell2_Loop']);
  expect(MASTER_YI_W.healTickSeconds).toBe(0.5);
  expect(MASTER_YI_W.damageReductionByRank).toEqual(spell.DataValues[4].values.slice(1, 6));
});

test('learning W uses own ranks and resources while Q and Hawkshot capabilities remain unavailable', () => {
  const f = fixture(0);
  expect(f.w.learnSpell('w', f.yi.id)).toBeNull();
  expect(f.state.spellRanks).toEqual({ q: 0, w: 1, e: 0, r: 0 });
  expect(f.w.abilitySpec('w', f.yi.id)).toMatchObject({
    name: 'Meditate',
    cost: 40,
    cooldown: 10,
    range: 0,
  });
  expect(f.state.eCharges).toBe(0);
  for (const ability of ['q'] as const)
    expect(f.w.learnSpell(ability, f.yi.id)).toMatch(/not implemented/);
  expect(World.fromSnapshot(f.w.snapshot(), f.w.battlefield).snapshot()).toBe(f.w.snapshot());
});

test('activation charges base mana, resets a recovering ordinary attack and starts a four-second own channel', () => {
  const f = fixture();
  f.primary();
  expect(f.yi.nextAttackTick).toBeGreaterThan(f.w.tick);
  const mana = f.yi.mana;
  f.cast();
  expect(f.yi.nextAttackTick).toBe(f.w.tick);
  expect(f.yi.releaseTick).toBeNull();
  expect(f.yi.attackCycle).toBeNull();
  expect(f.yi.order).toEqual({ type: 'idle' });
  expect(mana - f.yi.mana).toBeCloseTo(40 - 1.4500000476837158 / 60, 6);
  expect(f.state.cooldowns.w - f.w.tick).toBe(600);
  expect(f.state.meditate).toMatchObject({
    startTick: f.w.tick,
    endTick: f.w.tick + 240,
    nextHealTick: f.w.tick + 30,
    nextStackTick: f.w.tick + 60,
    stopTick: null,
  });
  expect(f.state.castAnimation).toBeNull();
  expect(f.state.pendingCast).toBeNull();
});

test('activation cancels an unreleased ready primary without consuming its passive counter', () => {
  const f = fixture();
  for (let i = 0; i < 3; i++) f.primary();
  const hp = f.target.hp;
  f.w.setOrder(f.yi, { type: 'attack', target: f.target.id });
  f.w.step(f.yi.nextAttackTick - f.w.tick + 5);
  expect(f.yi.releaseTick).not.toBeNull();
  f.cast();
  f.w.step(30);
  expect(f.yi.releaseTick).toBeNull();
  expect(f.target.hp).toBe(hp);
  expect(f.state.doubleStrike?.stacks).toBe(3);
  expect(f.state.doubleStrike?.strike).toBeNull();
  f.resume(10);
});

test.each(['mana', 'unlearned', 'stun', 'silence', 'death'] as const)(
  '%s rejects channel activation without a cooldown',
  (reason) => {
    const f = fixture(reason === 'unlearned' ? 0 : 1);
    if (reason === 'mana') f.yi.mana = 39;
    if (reason === 'stun') f.w.applyStun(f.yi, 60);
    if (reason === 'silence') f.w.applySilence(f.yi, 60);
    if (reason === 'death') f.w.damage(f.target, f.yi, 1e9, 'true');
    f.cast();
    expect(f.state.meditate).toBeNull();
    expect(f.state.cooldowns.w).toBe(0);
  }
);

test('the first heal lands at half a second and increases with current missing health', () => {
  const f = fixture();
  f.yi.hp = 320;
  f.cast();
  f.w.step(29);
  expect(f.yi.hp).toBeCloseTo(320.75, 7);
  expect(f.w.events.filter((e) => e.type === 'heal' && e.unit === f.yi.id)).toEqual([]);
  f.w.step();
  const event = f.w.events.find((e) => e.type === 'heal' && e.unit === f.yi.id)!;
  expect(event.value).toBeCloseTo(22.482421875, 6);
  expect(f.yi.hp).toBeCloseTo(343.257421875, 6);
});

test.each([1, 2, 3, 4, 5])(
  'rank %i uses own heal and defense values and retains its accepted rank',
  (rank) => {
    const f = fixture(rank);
    f.yi.hp = f.yi.maxHp / 2;
    f.cast();
    expect(f.state.meditate?.rank).toBe(rank);
    expect(meditateReduction(f.state, f.w.tick + 30, false)).toBe(
      MASTER_YI_W.damageReductionByRank[rank - 1]
    );
    f.w.step(30);
    const heal = f.w.events.find((e) => e.type === 'heal' && e.unit === f.yi.id)!.value!;
    expect(heal).toBeGreaterThan(MASTER_YI_W.baseHealByRank[rank - 1] / 8);
    expect(heal).toBeLessThan(MASTER_YI_W.baseHealByRank[rank - 1] / 4);
    f.resume(10);
  }
);

test('AP is captured at activation while later healing still samples the changing missing-health fraction', () => {
  const f = fixture();
  f.state.inventory = ['chapter'];
  const power = f.w.abilityPower(f.yi);
  expect(power).toBeGreaterThan(0);
  f.yi.hp = 100;
  f.cast();
  expect(f.state.meditate?.power).toBe(power);
  f.state.inventory = [];
  f.w.step(30);
  const first = f.w.events.find((e) => e.type === 'heal' && e.unit === f.yi.id)!.value!;
  f.w.step(30);
  const second = f.w.events.find(
    (e) => e.type === 'heal' && e.unit === f.yi.id && e.tick === f.w.tick
  )!.value!;
  expect(second).toBeLessThan(first);
  expect(f.state.meditate?.power).toBe(power);
});

test('continuous mana drain adds six percent max mana per second to the base payment, with ordinary regeneration independent', () => {
  const f = fixture();
  f.cast();
  const mana = f.yi.mana;
  f.w.step(60);
  expect(mana - f.yi.mana + 1.4500000476837158).toBeCloseTo(15.059999663382769, 6);
  expect(f.state.meditate?.stopTick).toBeNull();
});

test('insufficient upkeep mana stops before healing or extending E and retains only finite damage-reduction linger', () => {
  const f = fixture();
  f.yi.mana = 40;
  f.cast();
  f.w.step();
  expect(f.state.meditate).toMatchObject({ stopTick: f.w.tick, stopReason: 'mana' });
  expect(f.yi.mana).toBeLessThan(0.1);
  expect(f.state.doubleStrike?.stacks).toBe(0);
  f.resume(31);
  expect(f.state.meditate).toBeNull();
});

test('normal completion processes eight heals and four stack pulses without attacks, projectiles or random draws', () => {
  const f = fixture();
  f.yi.hp = 100;
  const random = f.w.random.state,
    id = f.w.nextId;
  f.cast();
  const heals: number[] = [];
  for (let n = 0; n < 8; n++) {
    f.w.step(30);
    const heal = f.w.events.find(
      (e) => e.type === 'heal' && e.unit === f.yi.id && e.tick === f.w.tick
    );
    expect(heal).toBeDefined();
    heals.push(heal!.value!);
  }
  expect(heals).toHaveLength(8);
  expect(f.state.meditate).toMatchObject({
    stopTick: f.w.tick,
    stopReason: 'complete',
    nextHealTick: f.w.tick + 30,
    nextStackTick: f.w.tick + 60,
  });
  expect(f.state.doubleStrike?.stacks).toBe(3);
  expect(f.state.doubleStrike?.strike).toBeNull();
  expect(f.w.random.state).toBe(random);
  // The common event allocator assigns one ID to cast feedback and eight heals.
  // The controller/stack counter creates no additional entities or effect IDs.
  expect(f.w.nextId).toBe(id + 9);
  expect(f.w.projectiles).toEqual([]);
  f.w.step(MEDITATE_LINGER_TICKS - 1);
  expect(f.state.meditate).not.toBeNull();
  f.w.step();
  expect(f.state.meditate).toBeNull();
});

test('full-health pulses cap healing without stopping the channel or its mana/stack clocks', () => {
  const f = fixture();
  f.yi.hp = f.yi.maxHp - 1;
  f.cast();
  f.w.step(120);
  expect(f.yi.hp).toBe(f.yi.maxHp);
  expect(f.state.meditate?.stopTick).toBeNull();
  expect(f.state.doubleStrike?.stacks).toBe(2);
  expect(f.yi.mana).toBeLessThan(f.yi.maxMana - 40);
});

test('upfront reduction, its exact transition, turret modifier, shields and true-damage bypass use the shared damage pipeline', () => {
  const f = fixture();
  f.cast();
  let hp = f.yi.hp;
  f.w.damage(f.target, f.yi, 100, 'physical');
  expect(hp - f.yi.hp).toBeCloseTo(22.556392, 5);
  const turret = f.w.spawn('turret', 'red', { x: 300, y: 0 });
  turret.ai = false;
  hp = f.yi.hp;
  f.w.damage(turret, f.yi, 100, 'physical');
  expect(hp - f.yi.hp).toBeCloseTo(48.872181, 5);
  hp = f.yi.hp;
  f.w.damage(f.target, f.yi, 100, 'true');
  expect(hp - f.yi.hp).toBe(100);
  expect(f.state.meditate?.stopTick).toBeNull();
  f.w.step(30);
  hp = f.yi.hp;
  f.w.damage(f.target, f.yi, 100, 'physical');
  expect(hp - f.yi.hp).toBeCloseTo(41.353384, 5);
  f.yi.shields = [{ sourceId: f.w.hero.id, amount: 50, endTick: f.w.tick + 100 }];
  hp = f.yi.hp;
  f.w.damage(f.target, f.yi, 100, 'physical');
  expect(f.yi.hp).toBe(hp);
  expect(f.yi.shields[0].amount).toBeCloseTo(50 - 41.353384, 5);
});

test.each(['move', 'attack', 'idle', 'recall', 'stun', 'silence', 'charm'] as const)(
  '%s interrupts before further channel pulses and retains its own finite linger',
  (action) => {
    const f = fixture();
    f.cast();
    f.w.step(10);
    if (action === 'move') f.w.setOrder(f.yi, { type: 'move', point: { x: -300, y: 0 } });
    if (action === 'attack') f.w.setOrder(f.yi, { type: 'attack', target: f.target.id });
    if (action === 'idle') f.w.setOrder(f.yi, { type: 'idle' });
    if (action === 'recall') {
      f.w.enqueue({ type: 'recall', unit: f.yi.id });
      f.w.step();
    }
    if (action === 'stun') f.w.applyStun(f.yi, 60);
    if (action === 'silence') f.w.applySilence(f.yi, 60);
    if (action === 'charm') {
      const ahri = f.w.spawn('champion', 'red', { x: 300, y: 0 }, 'ahri');
      ahri.ai = false;
      expect(f.w.learnSpell('e', ahri.id)).toBeNull();
      expect(f.w.applyCharm(ahri, f.yi, 1)).toBe(true);
    }
    expect(f.state.meditate?.stopTick).toBe(f.w.tick);
    expect(f.state.meditate?.stopReason).toBe(
      ['stun', 'silence', 'charm'].includes(action) ? 'control' : 'order'
    );
    expect(meditateReduction(f.state, f.w.tick, false)).toBeGreaterThan(0);
    f.resume(31);
    expect(f.state.meditate).toBeNull();
  }
);

test('root and ordinary damage leave the channel active; a rejected spell does not cancel it', () => {
  const f = fixture();
  f.cast();
  f.w.applyRoot(f.yi, 100);
  f.w.damage(f.target, f.yi, 10, 'magic');
  f.w.enqueue({ type: 'cast', unit: f.yi.id, ability: 'q', point: f.target });
  f.w.step(30);
  expect(f.state.meditate?.stopTick).toBeNull();
  expect(f.w.events.some((e) => e.type === 'heal' && e.unit === f.yi.id)).toBe(true);
});

test('an order at a heal boundary cancels before that pulse while retaining the elapsed mana interval', () => {
  const f = fixture();
  f.yi.hp = 100;
  f.cast();
  f.w.step(29);
  const mana = f.yi.mana;
  f.w.enqueue({ type: 'order', unit: f.yi.id, order: { type: 'idle' } });
  f.w.step();
  expect(f.state.meditate?.stopReason).toBe('order');
  expect(f.w.events.some((e) => e.type === 'heal' && e.unit === f.yi.id)).toBe(false);
  expect(f.yi.mana).toBeLessThan(mana);
});

test('E at its expiry boundary remains paused for exactly the paid channel intervals, then expires after the remaining tick', () => {
  const f = fixture(1, 1);
  f.cast('e');
  f.w.step(298);
  f.cast();
  const originalEnd = f.state.wujuStyle!.endTick;
  expect(originalEnd - f.w.tick).toBe(1);
  f.w.step(240);
  expect(f.state.wujuStyle).toMatchObject({ pausedTicks: 240, endTick: originalEnd + 240 });
  expect(f.state.meditate?.stopReason).toBe('complete');
  expect(f.state.wujuStyle!.endTick - f.w.tick).toBe(1);
  expect(World.fromSnapshot(f.w.snapshot(), f.w.battlefield).snapshot()).toBe(f.w.snapshot());
  f.w.step();
  expect(f.state.wujuStyle).toBeNull();
});

test('E accepted during a channel starts pausing on the next interval and does not interrupt W', () => {
  const f = fixture(1, 1);
  f.cast();
  f.w.step(10);
  f.cast('e');
  expect(f.state.wujuStyle?.pausedTicks).toBe(0);
  expect(f.state.meditate?.stopTick).toBeNull();
  f.w.step(60);
  expect(f.state.wujuStyle?.pausedTicks).toBe(60);
  f.resume(20);
});

test('Flash stops the channel and its E pause while retaining the accepted finite linger', () => {
  const f = fixture(1, 1);
  f.cast('e');
  f.cast();
  f.w.step(10);
  const x = f.yi.x;
  f.w.enqueue({ type: 'cast', unit: f.yi.id, ability: 'd', point: { x: x + 200, y: f.yi.y } });
  f.w.step();
  expect(f.yi.x).toBe(x + 200);
  expect(f.state.meditate?.stopReason).toBe('order');
  expect(f.state.wujuStyle?.pausedTicks).toBe(11);
  f.w.step(5);
  expect(f.state.wujuStyle?.pausedTicks).toBe(11);
  f.resume(10);
});

test('instant Heal can coexist with the channel and its repeat-Heal penalty is not borrowed by Meditate', () => {
  const f = fixture();
  f.yi.hp = 100;
  f.cast();
  f.w.step(10);
  f.w.enqueue({ type: 'cast', unit: f.yi.id, ability: 'f', point: f.yi });
  f.w.step();
  expect(f.state.meditate?.stopTick).toBeNull();
  expect(f.yi.summonerHealReductionUntil).toBeGreaterThan(f.w.tick);
  const due = f.state.meditate!.nextHealTick;
  f.w.step(due - f.w.tick);
  const pulse = f.w.events.find((e) => e.type === 'heal' && e.unit === f.yi.id && e.tick === due)!;
  expect(pulse.value).toBeGreaterThan(20);
  f.resume(10);
});

test('attack reset permits an earlier new primary while the old child remains pending, with valid independent save and body clocks', () => {
  const f = fixture();
  for (let i = 0; i < 4; i++) f.primary();
  const child = f.state.doubleStrike!.strike!;
  const release = child.releaseTick,
    damage = child.damage;
  f.cast();
  expect(child.poseStopTick).toBe(f.w.tick);
  f.w.gainExperience(1e6, f.yi.id);
  f.w.setOrder(f.yi, { type: 'attack', target: f.target.id });
  f.w.step();
  const primaryRelease = f.yi.releaseTick!;
  expect(primaryRelease).toBeLessThan(release);
  f.w.step(primaryRelease - f.w.tick);
  expect(f.state.doubleStrike?.stacks).toBe(1);
  expect(child.result).toBe('pending');
  const pose = mobilePose(f.yi, f.state, f.w.tick, 1, MOBILE_CLIP_DURATIONS['masteryi-base']);
  expect(pose.clip).not.toBe('entry_85dac0b3');
  const saved = f.w.snapshot(),
    copy = World.fromSnapshot(saved, f.w.battlefield);
  expect(copy.snapshot()).toBe(saved);
  const hp = f.target.hp;
  f.w.step(release - f.w.tick);
  copy.step(release - copy.tick);
  expect(hp - f.target.hp).toBe(damage);
  expect(f.state.doubleStrike?.stacks).toBe(2);
  f.w.step(300);
  copy.step(300);
  expect(copy.snapshot()).toBe(f.w.snapshot());
});

test('a committed child still contacts during the channel and receives E while the body stays in its own loop', () => {
  const f = fixture(1, 1);
  for (let i = 0; i < 4; i++) f.primary();
  const child = f.state.doubleStrike!.strike!,
    hp = f.target.hp;
  f.cast('e');
  f.cast();
  f.w.step(child.releaseTick - f.w.tick);
  expect(hp - f.target.hp).toBeCloseTo(child.damage + 20, 5);
  expect(f.state.meditate?.stopTick).toBeNull();
  const pose = mobilePose(f.yi, f.state, f.w.tick, 1, MOBILE_CLIP_DURATIONS['masteryi-base']);
  expect(pose).toMatchObject({ clip: 'spell2_loop', kind: 'cast', loop: true });
  f.resume(30);
});

test.each(['death', 'victory'] as const)(
  '%s clears both active channel and paused empowerment without later healing',
  (reason) => {
    const f = fixture(1, 1);
    f.cast('e');
    f.cast();
    f.w.step(50);
    if (reason === 'death') f.w.damage(f.target, f.yi, 1e9, 'true');
    else f.w.damage(f.yi, f.w.spawn('nexus', 'red', { x: 2000, y: 0 }), 1e9, 'true');
    expect(f.state.meditate).toBeNull();
    expect(f.state.wujuStyle).toBeNull();
    f.resume(50);
  }
);

test.each([0, 29, 30, 60, 180, 239, 240, 250])(
  'channel age %i restores exact bytes and a 300-tick future',
  (age) => {
    const f = fixture(1, 1);
    f.yi.hp = 100;
    f.cast('e');
    f.cast();
    f.w.step(age);
    f.resume();
  }
);

test('decoder rejects foreign phases, forged pulse clocks, impossible E pauses and child pose-stop clocks', () => {
  const f = fixture(1, 1);
  for (let i = 0; i < 4; i++) f.primary();
  f.cast('e');
  f.cast();
  f.w.step(3);
  const saved = JSON.parse(f.w.snapshot());
  const mutations: ((s: any, o: any) => void)[] = [
    (s, o) => {
      s.player.meditate = o.meditate;
    },
    (_s, o) => {
      o.meditate.endTick++;
    },
    (_s, o) => {
      o.meditate.nextHealTick++;
    },
    (_s, o) => {
      o.meditate.nextStackTick = o.meditate.startTick;
    },
    (_s, o) => {
      o.meditate.lastTick--;
    },
    (_s, o) => {
      o.meditate.stopReason = 'order';
    },
    (_s, o) => {
      o.meditate.rank = 2;
    },
    (_s, o) => {
      o.wujuStyle.pausedTicks++;
    },
    (_s, o) => {
      o.wujuStyle.pausedTicks = -1;
    },
    (s, o) => {
      o.doubleStrike.strike.poseStopTick = s.tick + 1;
    },
    (s) => {
      s.version = 140;
    },
  ];
  for (const mutate of mutations) {
    const raw = structuredClone(saved),
      own = raw.otherChampions.find((o: any) => o.id === f.yi.id);
    mutate(raw, own);
    expect(() => World.fromSnapshot(JSON.stringify(raw), f.w.battlefield)).toThrow();
  }
});
