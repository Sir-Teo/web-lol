import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { attackSoundMaterialForRig } from '../src/content/attack-sound-material';

test('later champion material mappings retain frozen skin provenance, including Leona Metal', () => {
  const provenance = JSON.parse(
    readFileSync('docs/reference/champion-attack-materials.json', 'utf8')
  );
  expect(provenance.map((r: any) => [r.rig, r.material])).toEqual([
    ['leona-base', 'Metal'],
    ['ahri-base', 'Flesh'],
    ['masteryi-base', 'Flesh'],
  ]);
  for (const r of provenance) {
    const raw = readFileSync(r.path);
    expect(createHash('sha256').update(raw).digest('hex')).toBe(r.sha256);
    let record = JSON.parse(raw.toString());
    for (const key of r.recordPath) record = record[key];
    expect(attackSoundMaterialForRig(r.rig)).toBe(record.armorMaterial);
  }
  expect(attackSoundMaterialForRig('unmapped-rig')).toBe('Flesh');
});

test.each(['garen', 'leona', 'masteryi'] as const)(
  '%s attacks against every later champion save before and after real contact',
  (attacker) => {
    for (const champion of ['leona', 'ahri', 'masteryi'] as const) {
      const w = new World(false, {
        ...PRACTICE_FIXTURE,
        initialUnits: [],
        lineOfSight: () => true,
      });
      w.nextWaveTick = Infinity;
      const source = w.spawn('champion', 'blue', { x: 0, y: 0 }, attacker),
        target = w.spawn('champion', 'red', { x: 150, y: 0 }, champion);
      source.ai = target.ai = false;
      target.hp = target.maxHp = 100000;
      w.setOrder(source, { type: 'attack', target: target.id });
      w.step();
      const saved = w.snapshot(),
        copy = World.fromSnapshot(saved, w.battlefield);
      expect(copy.snapshot()).toBe(saved);
      const ticks = source.releaseTick! - w.tick;
      w.step(ticks);
      copy.step(ticks);
      expect(copy.snapshot()).toBe(w.snapshot());
      const state = w.championState(source.id)!;
      const r =
        attacker === 'garen'
          ? state.garenAAVisuals[0]
          : attacker === 'leona'
            ? state.leonaAAVisuals[0]
            : state.masterYiAAAudio[0];
      expect(r.impact?.material).toBe(champion === 'leona' ? 'Metal' : 'Flesh');
      expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
    }
  }
);
