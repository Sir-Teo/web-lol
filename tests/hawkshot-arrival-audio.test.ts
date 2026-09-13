import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { HAWKSHOT_ARRIVAL_AUDIO as audio } from '../src/content/hawkshot-arrival-audio';

test('arrival event occurs once at landing and is not recreated on checkpoint restore', () => {
  const w = new World(false, { ...PRACTICE_FIXTURE, lineOfSight: () => false });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = 0;
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point: { x: 700, y: 0 } });
  w.step(44);
  expect(w.events.filter((e) => e.type === 'scout-arrival')).toHaveLength(0);
  w.step();
  const arrivals = w.events.filter((e) => e.type === 'scout-arrival');
  expect(arrivals).toHaveLength(1);
  expect(arrivals[0]).toMatchObject({ tick: 45, x: 700, y: 0, team: 'blue', unit: w.hero.id });
  expect(w.eventVisible(arrivals[0])).toBe(true);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  restored.step();
  expect(restored.events.filter((e) => e.type === 'scout-arrival')).toHaveLength(0);
  w.step(30);
  expect(w.events.filter((e) => e.type === 'scout-arrival')).toHaveLength(1);
});

test('an unseen enemy arrival cannot become audible through later vision', () => {
  const w = new World(false, { ...PRACTICE_FIXTURE, lineOfSight: () => false });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = 0;
  w.units = [w.hero];
  const enemy = w.spawn('dummy', 'red', { x: 3000, y: 0 });
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point: { x: 700, y: 0 } });
  w.step(16);
  const flight = w.projectiles.find((p) => p.type === 'hawkshot')!;
  flight.team = 'red';
  flight.source = enemy.id;
  w.step(29);
  const event = w.events.find((e) => e.type === 'scout-arrival')!;
  expect(event.audience).toEqual(['red']);
  w.visionAreas.push({
    kind: 'attack',
    x: 700,
    y: 0,
    radius: 1000,
    team: 'blue',
    endTick: 999,
    unobstructed: true,
  });
  expect(w.pointVisible(event, 'blue')).toBe(true);
  expect(w.eventVisible(event, 'blue')).toBe(false);
});

test('arrival asset preserves the source master and mapped gain', () => {
  const graph = JSON.parse(readFileSync('docs/reference/hawkshot-audio.json', 'utf8'));
  const event = graph.events.find((e: any) => e.id === audio.eventId);
  expect(event.mediaIds).toEqual([audio.mediaId]);
  const fields = graph.nodes.find((n: any) => n.id === 108015836).parameters;
  const pid = fields.find((p: any) => p[0].endsWith('/pID') && p[3]?.includes('[MakeUpGain]'));
  expect(audio.gainDb).toBe(
    Number(fields.find((p: any) => p[0] === pid[0].slice(0, -3) + 'pValue')[2])
  );
  expect(audio.delaySeconds).toBe(0);
  const decoded = JSON.parse(readFileSync('docs/reference/hawkshot-audio-decoded.json', 'utf8'));
  const master = decoded.media.find((m: any) => m.id === audio.mediaId);
  expect(audio.sha256).toBe(master.wavSha256);
  expect(
    createHash('sha256')
      .update(readFileSync(`public${audio.url}`))
      .digest('hex')
  ).toBe(master.wavSha256);
});
