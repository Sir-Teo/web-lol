import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('native Web Audio preserves full, late, early-stop and truncated source envelopes', async ({
  page,
}, info) => {
  await page.route('**/envelope-fixture.html', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Source envelope rendering</title>',
    })
  );
  await page.goto('/envelope-fixture.html');
  const results = await page.evaluate(async () => {
    const { sourceEnvelopeEvents } = await import('/src/audio/source-envelope.ts' as string);
    const results = [];
    for (const stopCurve of [2, 4, 6])
      for (const timing of [
        { age: 0, stopAge: 0.25, endAge: 1 },
        { age: 0.6, stopAge: 0.25, endAge: 1 },
        { age: 0, stopAge: 0.025, endAge: 0.775 },
        { age: 0, stopAge: 0.25, endAge: 0.4 },
      ]) {
        const state = { ...timing, stopCurve, stopFadeSeconds: 0.75, fadeInSeconds: 0.05 };
        const span = state.endAge - state.age;
        const context = new OfflineAudioContext(1, Math.ceil(span * 44100) + 128, 44100);
        const source = context.createConstantSource(),
          gain = context.createGain();
        source.connect(gain).connect(context.destination);
        source.start(0);
        source.stop(span);
        for (const event of sourceEnvelopeEvents(state)) {
          const time = event.age - state.age;
          if (event.kind === 'set') gain.gain.setValueAtTime(event.value, time);
          else gain.gain.linearRampToValueAtTime(event.value, time);
        }
        const pcm = (await context.startRendering()).getChannelData(0);
        let maximumError = 0,
          afterEndPeak = 0;
        for (let i = 0; i < Math.floor(span * 44100); i++) {
          const age = state.age + i / 44100;
          const t = Math.max(0, Math.min(1, (age - state.stopAge) / state.stopFadeSeconds));
          const level = Math.min(1, state.stopAge / state.fadeInSeconds);
          const fraction =
            stopCurve === 4 ? t : stopCurve === 6 ? ((t + 1) * t) / 2 : ((3 - t) * t) / 2;
          const expected =
            age < state.stopAge ? Math.min(1, age / state.fadeInSeconds) : level * (1 - fraction);
          maximumError = Math.max(maximumError, Math.abs(pcm[i] - expected));
        }
        for (let i = Math.ceil(span * 44100); i < pcm.length; i++)
          afterEndPeak = Math.max(afterEndPeak, Math.abs(pcm[i]));
        results.push({ ...state, maximumError, afterEndPeak });
      }
    return results;
  });
  expect(results).toHaveLength(12);
  for (const result of results) {
    expect(result.maximumError).toBeLessThan(0.00001);
    expect(result.afterEndPeak).toBe(0);
  }
  await writeFile(
    info.outputPath('source-envelope-evidence.json'),
    JSON.stringify(results, null, 2) + '\n'
  );
});
