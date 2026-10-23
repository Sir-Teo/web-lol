import { expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { World } from '../src/simulation/world';
import { createGrompEncounter } from '../src/simulation/gromp-encounter';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import {
  GROMP_ATTACK_PATH_FRAMES,
  GROMP_ATTACK_VISUAL_TAIL_TICKS,
} from '../src/content/gromp-attack-presentation';
import { grompAttackParticles, grompAttackFrame } from '../src/render/gromp-attack-particles';
import source from '../src/content/gromp-attack.json';
import type { GrompAttackVisual } from '../src/simulation/types';

function launch() {
  const w = createGrompEncounter(PRACTICE_FIXTURE),
    gromp = w.units.find((u) => u.kind === 'monster')!;
  Object.assign(gromp, { x: 210, y: 0, previous: { x: 210, y: 0 } });
  w.damage(w.hero, gromp, 1, 'true');
  for (let i = 0; i < 100 && !w.grompAttackVisuals.length; i++) w.step();
  expect(w.grompAttackVisuals).toHaveLength(1);
  return { w, gromp, visual: w.grompAttackVisuals[0] };
}

test('a melee Nexus kill stops an unrelated neutral missile history on the frozen winning tick', () => {
  const { w, visual } = launch();
  const previous = structuredClone(visual.frames.at(-1)!);
  const finisher = w.spawn('melee', 'blue', { x: -500, y: -500 });
  const nexus = w.spawn('nexus', 'red', { x: -450, y: -500 });
  nexus.hp = 1;
  w.setOrder(finisher, { type: 'attack', target: nexus.id });
  finisher.releaseTick = w.tick + 1;
  finisher.attackTarget = nexus.id;
  const hp = w.hero.hp;
  w.step();
  expect(w.winner).toBe('blue');
  expect(visual.stopTick).toBe(w.tick);
  expect(visual.frames.at(-1)).toEqual({ ...previous, tick: w.tick });
  expect(w.hero.hp).toBe(hp);
  const saved = w.snapshot();
  expect(World.fromSnapshot(saved, w.battlefield).snapshot()).toBe(saved);
  w.step(60);
  expect(w.snapshot()).toBe(saved);
});

test('four Gromp missile profiles retain source spell, primitive, lifetime, bind and texture fields', () => {
  const hash = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex'),
    pin = JSON.parse(readFileSync('docs/reference/gromp-effects.json', 'utf8')),
    characters = JSON.parse(readFileSync('docs/reference/jungle-character-source.json', 'utf8'));
  expect(source.sourcePinSha256).toBe(hash('docs/reference/gromp-effects.json'));
  expect(source.characterPinSha256).toBe(hash('docs/reference/jungle-character-source.json'));
  expect(source.spell).toEqual(
    characters.records['data/characters/sru_gromp/sru_gromp.bin']['{e545321f}']
  );
  expect(source.profiles.map((p) => p.name)).toEqual([
    'Mis_orb',
    'black_background',
    'mis_plane',
    'trailorbs',
  ]);
  for (const p of source.profiles) {
    const e = pin.records[p.sourceRecord].decoded.values[p.name];
    expect(p.life).toBe(e['p-life']);
    expect(p.bind).toBe(e['p-bindtoemitter']);
    expect(p.rate).toBe(e['e-rate']);
    expect(p.linger).toBe(e['p-linger']);
    expect(p.blend).toBe(e.rendermode);
    expect(p.priority).toBe(e.pass);
    expect(p.single).toBe(!!e['single-particle']);
    expect(p.emitterLife).toBe(e['e-life'] < 0 ? null : e['e-life']);
    expect(p.kind).toBe(e['p-type'] === 0 ? 'billboard' : 'quad');
    expect(p.texture.split('/').at(-1)).toBe(
      e['p-texture'].split('/').at(-1).toLowerCase().replace('.dds', '.png')
    );
  }
  expect(GROMP_ATTACK_VISUAL_TAIL_TICKS).toBe(
    Math.ceil(Math.max(...source.profiles.map((p) => p.life)) * 60) + 1
  );
});

test('real neutral release records contact endpoints and exact active/post-stop saved continuation', () => {
  const { w, visual } = launch();
  expect(visual.team).toBe('neutral');
  expect(visual.frames[0].tick).toBe(visual.launchTick);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  while (visual.stopTick === null) {
    w.step();
    restored.step();
    expect(restored.snapshot()).toBe(w.snapshot());
  }
  expect(visual.frames.at(-1)!.x).toBeCloseTo(w.hero.x + w.hero.radius + 8);
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
  w.step(GROMP_ATTACK_VISUAL_TAIL_TICKS - 1);
  expect(w.grompAttackVisuals).toHaveLength(1);
  w.step();
  expect(w.grompAttackVisuals).toEqual([]);
});

test('bounded homing history retains turns and freezes at the previous endpoint on target loss', () => {
  const { w, visual } = launch();
  w.projectiles[0].speed = 1;
  w.hero.y = 90;
  w.step(50);
  expect(visual.frames).toHaveLength(GROMP_ATTACK_PATH_FRAMES);
  expect(visual.frames[0].tick).toBe(w.tick - GROMP_ATTACK_PATH_FRAMES + 1);
  expect(visual.frames.at(-1)!.facing).not.toBe(visual.frames[0].facing);
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
  const last = structuredClone(visual.frames.at(-1)!);
  w.damage(
    w.units.find((u) => u.kind === 'monster')!,
    w.hero,
    99999,
    'true'
  );
  w.step();
  expect(visual.stopTick).toBe(w.tick);
  expect(visual.frames.at(-1)).toEqual({ ...last, tick: w.tick });
});

test('invalid missing, duplicate, gapped, conflicting, mismatched and expired Gromp flight histories are rejected', () => {
  const { w } = launch();
  w.step(1);
  const saved = JSON.parse(w.snapshot());
  const edits = [
    (s: any) => {
      s.grompAttackVisuals = [];
    },
    (s: any) => {
      s.grompAttackVisuals.push(s.grompAttackVisuals[0]);
    },
    (s: any) => {
      s.grompAttackVisuals[0].frames[1].tick++;
    },
    (s: any) => {
      s.grompAttackVisuals[0].frames.at(-1).x++;
    },
    (s: any) => {
      s.grompAttackVisuals[0].frames.at(-1).facing += 0.1;
    },
    (s: any) => {
      s.grompAttackVisuals[0].origin.x++;
    },
    (s: any) => {
      s.grompAttackVisuals[0].team = 'blue';
    },
    (s: any) => {
      s.grompAttackVisuals[0].sourceId = s.player.id;
    },
    (s: any) => {
      s.grompAttackVisuals[0].stopTick = s.tick;
    },
    (s: any) => {
      s.grompAttackVisuals[0].id = s.player.id;
    },
  ];
  for (const edit of edits) {
    const bad = structuredClone(saved);
    edit(bad);
    expect(() => World.fromSnapshot(JSON.stringify(bad), w.battlefield)).toThrow();
  }
  while (w.grompAttackVisuals[0].stopTick === null) w.step();
  const stopped = JSON.parse(w.snapshot());
  stopped.tick += GROMP_ATTACK_VISUAL_TAIL_TICKS;
  expect(() => World.fromSnapshot(JSON.stringify(stopped), w.battlefield)).toThrow();
});

const effect = (): GrompAttackVisual => ({
  id: 55,
  sourceId: 7,
  team: 'neutral',
  origin: { x: 0, y: 0 },
  launchTick: 100,
  stopTick: null,
  frames: Array.from({ length: 20 }, (_, i) => ({
    tick: 100 + i,
    x: i * 10,
    y: i * 3,
    facing: 0.4,
  })),
});

test('source first births, stop caps and frozen tails retain original lifetimes and independently bound translation', () => {
  const e = effect();
  expect(grompAttackParticles(e, 100)).toEqual([]);
  expect(grompAttackParticles(e, NaN)).toEqual([]);
  expect(grompAttackParticles(e, 101).map((p) => p.profileIndex)).toEqual([0, 1, 2, 2, 3]);
  const all = grompAttackParticles(e, 108),
    original = structuredClone(all);
  grompAttackParticles(e, 500);
  expect(grompAttackParticles(JSON.parse(JSON.stringify(e)), 108)).toEqual(original);
  const moved = structuredClone(e);
  moved.frames.at(-1)!.x += 100;
  moved.frames.at(-1)!.y += 50;
  for (const p of grompAttackParticles(e, 119)) {
    const translated = grompAttackParticles(moved, 119).find(
      (v) => v.profileIndex === p.profileIndex && v.ordinal === p.ordinal
    )!;
    expect(translated.position[0] - p.position[0]).toBeCloseTo(
      100 * source.profiles[p.profileIndex].bind
    );
    expect(translated.position[2] - p.position[2]).toBeCloseTo(
      50 * source.profiles[p.profileIndex].bind
    );
  }
  e.stopTick = 110;
  e.frames = e.frames.filter((f) => f.tick <= 110);
  const stopped = grompAttackParticles(e, 110);
  expect(stopped.every((p) => p.profileIndex === 1 || p.profileIndex === 3)).toBe(true);
  expect(stopped.some((p) => p.profileIndex === 1)).toBe(true);
  expect(grompAttackParticles(e, 141)).toEqual([]);
  expect(grompAttackFrame(e, 1000)).toEqual(grompAttackFrame(e, 110));
  expect(grompAttackFrame(e, 99)).toBeNull();
});

test('a melee victory on the Gromp release tick retains a complete cancelled birth frame', () => {
  const w = createGrompEncounter(PRACTICE_FIXTURE),
    gromp = w.units.find((u) => u.kind === 'monster')!;
  Object.assign(gromp, { x: 210, y: 0, previous: { x: 210, y: 0 } });
  w.damage(w.hero, gromp, 1, 'true');
  for (let i = 0; i < 100 && gromp.releaseTick === null; i++) w.step();
  const release = gromp.releaseTick!;
  expect(release).toBeGreaterThan(w.tick);
  const finisher = w.spawn('melee', 'blue', { x: -500, y: -500 });
  const nexus = w.spawn('nexus', 'red', { x: -450, y: -500 });
  nexus.hp = 1;
  w.setOrder(finisher, { type: 'attack', target: nexus.id });
  finisher.releaseTick = release;
  finisher.attackTarget = nexus.id;
  const hp = w.hero.hp;
  w.step(release - w.tick);
  expect(w.winner).toBe('blue');
  expect(w.tick).toBe(release);
  expect(w.projectiles).toEqual([]);
  const v = w.grompAttackVisuals[0];
  expect(v.stopTick).toBe(release);
  expect(v.frames).toHaveLength(1);
  expect(v.frames[0]).toEqual({
    tick: release,
    x: gromp.x,
    y: gromp.y,
    facing: Math.atan2(w.hero.x - gromp.x, w.hero.y - gromp.y),
  });
  expect(w.hero.hp).toBe(hp);
  const saved = w.snapshot();
  expect(World.fromSnapshot(saved, w.battlefield).snapshot()).toBe(saved);
  w.step(60);
  expect(w.snapshot()).toBe(saved);
});
