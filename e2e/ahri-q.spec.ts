import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('NPC Q casts, turns and hits both legs through the real development map renderer', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=fixture&npc=ahri');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const cast = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    const ahri = w.units.find((unit: any) => unit.champion === 'ahri');
    w.units = [w.hero, ahri];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    for (const unit of w.units) unit.ai = false;
    w.learnSpell('q', ahri.id);
    for (const offset of [200, 500, 800]) {
      const target = w.spawn('dummy', 'red', { x: ahri.x + offset, y: ahri.y });
      target.hp = target.maxHp = 10000;
      target.magicResist = 0;
    }
    v.zoom = 0.6;
    v.recenter({ x: ahri.x + 400, y: ahri.y });
    w.enqueue({ type: 'cast', unit: ahri.id, ability: 'q', point: { x: ahri.x + 10, y: ahri.y } });
    w.step();
    v.render(w, 1, v.previousElapsed);
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.step(300);
    return {
      clip: v.models.get(ahri.id).actionName,
      spellName: w.abilitySpec('q', ahri.id).name,
      windup: w.championState(ahri.id).pendingCast,
      future: copy.snapshot(),
    };
  });
  expect(cast.clip).toBe('spell1');
  expect(cast.spellName).toBe('Orb of Deception');
  expect(cast.windup.releaseTick - cast.windup.startTick).toBe(15);
  const outward = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    w.step(30);
    v.render(w, 1, v.previousElapsed);
    const orb = w.ahriOrbs[0],
      saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.step(270);
    return {
      orb,
      marker: v.projectileModels.get(orb.id).name,
      exactSave: copy.constructor.fromSnapshot(saved, w.battlefield).snapshot() === saved,
      future: copy.snapshot(),
    };
  });
  expect(outward.marker).toBe('Ahri Q development orb');
  expect(outward.orb.outwardHits.length).toBeGreaterThan(0);
  expect(outward.orb.returnHits).toEqual([]);
  expect(outward.exactSave).toBe(true);
  expect(outward.future).toBe(cast.future);
  await page.screenshot({ path: info.outputPath('ahri-q-outward.png') });
  const returning = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    w.step(59);
    v.render(w, 1, v.previousElapsed);
    const orb = w.ahriOrbs[0],
      saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.step(211);
    return { orb, future: copy.snapshot() };
  });
  expect(returning.orb.returnHits.length).toBeGreaterThan(0);
  expect(returning.future).toBe(cast.future);
  await page.screenshot({ path: info.outputPath('ahri-q-return.png') });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.step(211);
    return {
      saved: w.snapshot(),
      orbs: w.ahriOrbs.length,
      damage: w.units
        .filter((unit: any) => unit.kind === 'dummy')
        .map((unit: any) => unit.maxHp - unit.hp),
      focus: w.championState(w.units.find((unit: any) => unit.champion === 'ahri').id).qStacks,
    };
  });
  expect(result.saved).toBe(cast.future);
  expect(result.orbs).toBe(0);
  expect(result.damage).toEqual([70, 70, 70]);
  expect(result.focus).toBe(0);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('ahri-q.json'),
    JSON.stringify({ cast, outward, returning, result }, null, 2)
  );
});

for (const [phase, age] of [
  ['windup', 5],
  ['outward', 30],
  ['return', 80],
] as const) {
  test(`Q ${phase} survives real Save and reload with 300 identical future ticks`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    await page.goto('/?scene=fixture&npc=ahri');
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    const expected = await page.evaluate(
      ({ phase, age }) => {
        const g = (window as any).__GAME__,
          w = g.world;
        g.setPaused(true);
        w.pendingSpawns = [];
        w.nextWaveTick = Infinity;
        for (const unit of w.units) unit.ai = false;
        const ahri = w.units.find((unit: any) => unit.champion === 'ahri');
        w.learnSpell('q', ahri.id);
        const target = w.spawn('dummy', 'red', { x: ahri.x + 500, y: ahri.y });
        target.hp = target.maxHp = 10000;
        target.magicResist = 0;
        w.enqueue({
          type: 'cast',
          unit: ahri.id,
          ability: 'q',
          point: { x: ahri.x + 10, y: ahri.y },
        });
        w.step(age);
        if (phase === 'return') w.damage(target, ahri, 1e6, 'true');
        const saved = w.snapshot(),
          copy = w.constructor.fromSnapshot(saved, w.battlefield);
        copy.step(300);
        return {
          saved,
          future: copy.snapshot(),
          sourceId: ahri.id,
          pending: w.championState(ahri.id).pendingCast !== null,
          orbs: w.ahriOrbs.length,
        };
      },
      { phase, age }
    );
    expect(expected.pending).toBe(phase === 'windup');
    expect(expected.orbs).toBe(phase === 'windup' ? 0 : 1);
    await page.locator('#pause-button').click();
    await page.getByRole('button', { name: 'Save match', exact: true }).click();
    await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
    await page.reload();
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    const result = await page.evaluate((sourceId) => {
      const g = (window as any).__GAME__,
        w = g.world;
      g.view.render(w, 1, g.view.previousElapsed);
      const saved = w.snapshot(),
        dead = w.unit(sourceId).deadAt !== null;
      const markers = w.ahriOrbs.map((orb: any) => g.view.projectileModels.get(orb.id)?.name);
      w.step(300);
      return { saved, future: w.snapshot(), paused: g.hud.paused, dead, markers };
    }, expected.sourceId);
    expect(result.paused).toBe(true);
    expect(result.saved).toBe(expected.saved);
    expect(result.future).toBe(expected.future);
    expect(result.dead).toBe(phase === 'return');
    expect(result.markers).toEqual(phase === 'windup' ? [] : ['Ahri Q development orb']);
    writeFileSync(
      info.outputPath(`ahri-q-${phase}-reload.json`),
      JSON.stringify({ phase, age, expected, result }, null, 2)
    );
  });
}
