import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('allied commands retain gameplay while personal messages, markers and UI audio stay with the player', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window as any).__GAME__?.ready, null, { timeout: 120000 });
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.hud.closeModal();
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    w.events = [];
    w.hero.ai = false;
    w.setOrder(w.hero, { type: 'idle' });
    const ally = w.spawn('champion', 'blue', { x: w.hero.x + 120, y: w.hero.y + 120 });
    ally.ai = false;
    const heard: any[] = [];
    (window as any).__PERSONAL_AUDIO__ = heard;
    const update = g.audio.update.bind(g.audio);
    g.audio.update = (events: any[], ...rest: any[]) => {
      heard.push(...events.map((e) => ({ id: e.id, type: e.type, unit: e.unit })));
      return update(events, ...rest);
    };
    g.hud.toast('Player status');
    w.enqueue({ type: 'recall', unit: ally.id });
    w.step();
    g.hud.update(60);
    const allyRecall = {
      toast: document.querySelector('#toast')!.textContent,
      active: w.championState(ally.id).recallEnd !== null,
    };
    const allyPoint = w.battlefield.reachable({ x: ally.x + 220, y: ally.y }, ally.radius, 'blue');
    const start = { x: ally.x, y: ally.y };
    w.enqueue({ type: 'order', unit: ally.id, order: { type: 'move', point: allyPoint } });
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    const allyMove = {
      marker: g.view.moveMarker.visible,
      moved: Math.hypot(ally.x - start.x, ally.y - start.y) > 0,
      recalled: w.championState(ally.id).recallEnd !== null,
      event: structuredClone(w.events.filter((e: any) => e.type === 'move').at(-1)),
    };
    const minion = w.spawn('caster', 'red', { x: ally.x + 150, y: ally.y });
    minion.ai = false;
    w.damage(ally, minion, 1e6, 'true');
    w.gainExperience(280, ally.id);
    w.learnSpell('w', ally.id);
    const dummy = w.spawn('dummy', 'red', { x: ally.x + 350, y: ally.y });
    w.enqueue({ type: 'cast', unit: ally.id, ability: 'w', point: { x: dummy.x, y: dummy.y } });
    w.step();
    const ownPoint = w.battlefield.reachable(
      { x: w.hero.x + 250, y: w.hero.y },
      w.hero.radius,
      'blue'
    );
    w.enqueue({ type: 'order', unit: w.hero.id, order: { type: 'move', point: ownPoint } });
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    const ownMove = {
      marker: g.view.moveMarker.visible,
      event: structuredClone(w.events.filter((e: any) => e.type === 'move').at(-1)),
    };
    const ownMinion = w.spawn('caster', 'red', { x: w.hero.x + 150, y: w.hero.y });
    ownMinion.ai = false;
    w.damage(w.hero, ownMinion, 1e6, 'true');
    w.gainExperience(280);
    w.enqueue({ type: 'recall', unit: w.hero.id });
    w.step();
    g.hud.update(60);
    const ownRecall = {
      toast: document.querySelector('#toast')!.textContent,
      active: w.player.recallEnd !== null,
    };
    w.emit('message', w.hero, { text: 'System notice', team: 'blue' });
    g.hud.update(60);
    const systemToast = document.querySelector('#toast')!.textContent;
    const events = w.events.map((e: any) => ({ id: e.id, type: e.type, unit: e.unit }));
    g.repaint();
    return {
      playerId: w.hero.id,
      allyId: ally.id,
      allyRecall,
      allyMove,
      ownMove,
      ownRecall,
      systemToast,
      events,
      playerCs: w.player.cs,
      allyCs: w.championState(ally.id).cs,
    };
  });
  await page.waitForFunction(() => (window as any).__PERSONAL_AUDIO__?.length > 0);
  const audio = await page.evaluate(() => (window as any).__PERSONAL_AUDIO__);
  writeFileSync(
    info.outputPath('personal-feedback.json'),
    JSON.stringify({ result, audio, errors }, null, 2)
  );
  expect(result.allyRecall).toEqual({ toast: 'Player status', active: true });
  expect(result.allyMove).toMatchObject({
    marker: false,
    moved: true,
    recalled: false,
    event: { unit: result.allyId },
  });
  expect(result.ownMove).toMatchObject({ marker: true, event: { unit: result.playerId } });
  expect(result.ownRecall).toEqual({ toast: 'Recalling…', active: true });
  expect(result.systemToast).toBe('System notice');
  expect(result.playerCs).toBe(1);
  expect(result.allyCs).toBe(1);
  expect(result.events.some((e: any) => e.type === 'cast' && e.unit === result.allyId)).toBe(true);
  expect(
    audio.some((e: any) => ['move', 'gold', 'level'].includes(e.type) && e.unit === result.allyId)
  ).toBe(false);
  for (const type of ['move', 'gold', 'level'])
    expect(audio.some((e: any) => e.type === type && e.unit === result.playerId)).toBe(true);
  expect(audio.some((e: any) => e.type === 'cast' && e.unit === result.allyId)).toBe(true);
  expect(errors).toEqual([]);
});
