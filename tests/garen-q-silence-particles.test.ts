import { expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import profile from '../src/content/garen-q-silence-particles.json';
import source from '../docs/reference/garen-q-particles.json';
import audit from '../docs/reference/garen-q-particle-profiles.json';
import { garenQSilenceParticles } from '../src/render/garen-q-silence-particles';
import { World } from '../src/simulation/world';
import { SNAPSHOT_VERSION } from '../src/simulation/snapshot';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import type { ChampionState } from '../src/simulation/types';

const record: ChampionState['garenQVisuals'][number] = {
  startTick: 100,
  rank: 1,
  stopTick: 129,
  endReason: 'consumed',
  attacks: [
    {
      startTick: 110,
      releaseTick: 129,
      endTick: 205,
      targetId: 2,
      origin: { x: 0, y: 0 },
      facing: 1,
      stopTick: null,
      endReason: null,
      landing: { tick: 128, point: { x: 0, y: 0 }, facing: 1 },
      impact: { tick: 129, point: { x: 100, y: 0 }, facing: 1 },
      silenceEndTick: 219,
    },
  ],
};
const sample = (tick: number) => garenQSilenceParticles([{ id: 1, records: [record] }], tick);
function setup(targetKind: 'champion' | 'dummy' | 'turret' | 'nexus' = 'dummy') {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [] }, 'garen');
  w.nextWaveTick = Infinity;
  Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
  w.learnSpell('q');
  const target = w.spawn(
    targetKind,
    'red',
    { x: 100, y: 0 },
    targetKind === 'champion' ? 'garen' : undefined
  );
  target.nextThink = Infinity;
  const cast = () => {
    w.player.cooldowns.q = 0;
    w.setOrder(w.hero, { type: 'attack', target: target.id });
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: w.hero });
    w.step();
  };
  const hit = () => {
    w.step(w.hero.releaseTick! - w.tick);
    return w.player.garenQVisuals.at(-1)!.attacks.at(-1)!;
  };
  const sources = () => [{ id: w.hero.id, records: w.player.garenQVisuals }];
  return { w, target, cast, hit, sources };
}
test('silence retains every frozen field, absent frame-count defaults and unresolved Flex sizing without inventing a bound-size formula', () => {
  const e = source.resources.Garen_Q_Silence.definition.complexEmitterDefinitionData[0];
  expect(createHash('sha256').update(readFileSync(audit.silenceOutput.path)).digest('hex')).toBe(
    audit.silenceOutput.sha256
  );
  expect(profile.explicitFields).toEqual(Object.keys(e).sort());
  expect(profile.flexShape).toEqual(e.FlexShapeDefinition);
  expect(audit.silenceFlexApplied).toBe(false);
  expect(profile.offset).toEqual(e.SpawnShape.emitOffset);
  expect(profile.size).toEqual(e.birthScale0.constantValue);
  expect(profile.life).toBe(10);
  expect(profile.emitterLife).toBeNull();
  expect(profile.bindWeight).toBe(1);
  expect(profile.atlas).toEqual({ grid: [2, 2], frames: 1, start: 0, random: false });
  expect(audit.implemented).toHaveLength(22);
  expect(audit.deferred).toHaveLength(9);
});
test('silence uses its ten-second source appearance, first-update birth and actual application deadline instead of stretching life to CC', () => {
  expect(sample(129)).toEqual([]);
  expect(sample(130)).toHaveLength(1);
  expect(sample(130)[0].scale).toEqual([0, 0, 0]);
  expect(sample(136)[0].scale[0]).toBeCloseTo(60, 4);
  expect(sample(142)[0].scale[0]).toBeCloseTo(40, 4);
  expect(sample(148)[0].scale[0]).toBeCloseTo(50, 4);
  expect(sample(218.99)).toHaveLength(1);
  expect(sample(219)).toEqual([]);
  expect(sample(500)).toEqual([]);
  expect(sample(NaN)).toEqual([]);
  const noStatus = structuredClone(record);
  noStatus.attacks[0].silenceEndTick = null;
  expect(garenQSilenceParticles([{ id: 1, records: [noStatus] }], 140)).toEqual([]);
});
test('overlapping Q applications coalesce per recipient with stable ownership and seek/restore, handing off at the original deadlines', () => {
  const later = structuredClone(record);
  later.startTick = 110;
  later.attacks[0].impact!.tick = 140;
  later.attacks[0].silenceEndTick = 230;
  const sources = [
    { id: 3, records: [later] },
    { id: 1, records: [record] },
  ];
  expect(garenQSilenceParticles(sources, 150)).toEqual(sample(150));
  expect(garenQSilenceParticles(sources, 219)[0]).toMatchObject({
    sourceId: 3,
    startTick: 140,
    endTick: 230,
  });
  expect(garenQSilenceParticles(sources, 219)[0].age).toBe(78 / 60);
  expect(garenQSilenceParticles(sources, 230)).toEqual([]);
  expect(garenQSilenceParticles([...sources].reverse(), 150)).toEqual(sample(150));
  const tie = garenQSilenceParticles(
    [
      { id: 3, records: [record] },
      { id: 1, records: [record] },
    ],
    150
  );
  expect(tie).toHaveLength(1);
  expect(tie[0].sourceId).toBe(1);
  expect(garenQSilenceParticles(JSON.parse(JSON.stringify(sources)), 150)).toEqual(sample(150));
});
test('only an accepted living nonstructure Q contact owns silence; generic silence, planned swings, lethal hits and structures do not', () => {
  const { w, target, cast, hit } = setup();
  w.applySilence(target, 120);
  expect(
    garenQSilenceParticles([{ id: w.hero.id, records: w.player.garenQVisuals }], w.tick + 1)
  ).toEqual([]);
  cast();
  expect(w.player.garenQVisuals[0].attacks[0].silenceEndTick).toBeNull();
  expect(hit().silenceEndTick).toBe(w.tick + 90);
  for (const kind of ['dummy', 'turret', 'nexus'] as const) {
    const s = setup(kind);
    if (kind === 'dummy' || kind === 'nexus') s.target.hp = 1;
    s.cast();
    const a = s.hit();
    expect(a.impact).not.toBeNull();
    expect(a.silenceEndTick).toBeNull();
    expect(World.fromSnapshot(s.w.snapshot(), s.w.battlefield).snapshot()).toBe(s.w.snapshot());
  }
});
test('Courage tenacity is captured at contact and neither a longer generic deadline nor later W expiry can extend Q presentation', () => {
  const s = setup('champion');
  s.w.learnSpell('w', s.target.id);
  s.w.enqueue({ type: 'cast', unit: s.target.id, ability: 'w', point: s.target });
  s.cast();
  const a = s.hit();
  expect(a.silenceEndTick).toBe(s.w.tick + 36);
  s.w.applySilence(s.target, 200);
  const shared = s.target.silenceUntil;
  const restored = World.fromSnapshot(s.w.snapshot(), s.w.battlefield);
  s.w.step(36);
  restored.step(36);
  expect(s.target.silenceUntil).toBe(shared);
  expect(shared).toBeGreaterThan(s.w.tick);
  expect(garenQSilenceParticles(s.sources(), s.w.tick)).toEqual([]);
  expect(restored.snapshot()).toBe(s.w.snapshot());
});
test('late armed expiry and multiple Garen sources retain accepted control through a real checkpoint', () => {
  const s = setup();
  s.w.enqueue({ type: 'cast', unit: s.w.hero.id, ability: 'q', point: s.w.hero });
  s.w.step();
  const expiry = s.w.player.garenQ!.attackUntil;
  s.w.step(expiry - 2 - s.w.tick);
  const ally = s.w.spawn('champion', 'blue', { x: 0, y: 80 }, 'garen');
  ally.ai = false;
  s.w.learnSpell('q', ally.id);
  for (const u of [s.w.hero, ally]) s.w.setOrder(u, { type: 'attack', target: s.target.id });
  s.w.enqueue({ type: 'cast', unit: ally.id, ability: 'q', point: ally });
  s.w.step();
  const release = s.w.hero.releaseTick!;
  expect(release).toBeGreaterThan(expiry);
  s.w.step(release - s.w.tick);
  expect(s.w.player.garenQ).toBeNull();
  expect(s.w.player.garenQVisuals[0].endReason).toBe('expired');
  for (const u of [s.w.hero, ally]) {
    expect(s.w.championState(u.id)!.garenQVisuals[0].attacks[0].silenceEndTick).toBe(release + 90);
    s.w.setOrder(u, { type: 'idle' });
  }
  const sources = (w: World) =>
    w.units
      .filter((u) => u.champion === 'garen')
      .map((u) => ({ id: u.id, records: w.championState(u.id)!.garenQVisuals }));
  s.w.damage(s.target, s.w.hero, 1e6, 'true');
  const restored = World.fromSnapshot(s.w.snapshot(), s.w.battlefield);
  s.w.step(5);
  restored.step(5);
  expect(restored.snapshot()).toBe(s.w.snapshot());
  const icons = garenQSilenceParticles(sources(s.w), s.w.tick);
  expect(icons).toHaveLength(1);
  expect(icons[0].sourceId).toBe(s.w.hero.id);
  expect(garenQSilenceParticles(sources(restored), restored.tick)).toEqual(icons);
});

test('caster death and practice recasts retain accepted status clocks; target death/respawn cannot create a second application', () => {
  const s = setup();
  s.cast();
  const first = s.hit(),
    deadline = first.silenceEndTick!;
  s.w.setOrder(s.w.hero, { type: 'idle' });
  s.cast();
  expect(first.silenceEndTick).toBe(deadline);
  s.w.damage(s.target, s.w.hero, 1e6, 'true');
  s.w.step(5);
  expect(garenQSilenceParticles(s.sources(), s.w.tick)).toHaveLength(1);
  const restored = World.fromSnapshot(s.w.snapshot(), s.w.battlefield);
  expect(
    garenQSilenceParticles(
      [{ id: restored.hero.id, records: restored.player.garenQVisuals }],
      restored.tick
    )
  ).toEqual(garenQSilenceParticles(s.sources(), s.w.tick));
  s.w.damage(s.w.hero, s.target, 1e6, 'true');
  s.w.step(180);
  expect(s.target.deadAt).toBeNull();
  expect(s.target.silenceUntil).toBe(0);
  expect(garenQSilenceParticles(s.sources(), s.w.tick)).toEqual([]);
});
test('current schema rejects missing, invented, mismatched and contradictory accepted-silence deadlines while permitting expired history', () => {
  const s = setup();
  s.cast();
  const early = JSON.parse(s.w.snapshot()),
    attack = (v: any) => v.player.garenQVisuals[0].attacks[0];
  for (const mutate of [
    (v: any) => delete attack(v).silenceEndTick,
    (v: any) => (attack(v).silenceEndTick = 100),
  ]) {
    const v = structuredClone(early);
    mutate(v);
    expect(() => World.fromSnapshot(JSON.stringify(v), s.w.battlefield)).toThrow();
  }
  s.hit();
  const saved = JSON.parse(s.w.snapshot());
  expect(saved.version).toBe(SNAPSHOT_VERSION);
  for (const mutate of [
    (v: any) => (attack(v).silenceEndTick = null),
    (v: any) => attack(v).silenceEndTick++,
    (v: any) => (attack(v).impact = null),
    (v: any) => (v.units.find((u: any) => u.id === s.target.id).silenceUntil = 0),
  ]) {
    const v = structuredClone(saved);
    mutate(v);
    expect(() => World.fromSnapshot(JSON.stringify(v), s.w.battlefield)).toThrow();
  }
  s.w.step(100);
  expect(World.fromSnapshot(s.w.snapshot(), s.w.battlefield).snapshot()).toBe(s.w.snapshot());
});
