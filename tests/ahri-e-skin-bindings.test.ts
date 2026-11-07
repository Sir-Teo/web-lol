import { expect, test } from 'vitest';
import data from '../src/content/ahri-e-particles.json';
import { AHRI_E_SKIN_BINDINGS } from '../src/render/ahri-e-skin-bindings';

test('E cast skin selects only the checked Tails draw and keeps the unmatched selector', () => {
  const cast = AHRI_E_SKIN_BINDINGS.find((p) => p.system === 'Ahri_E_cas')!;
  expect(cast.selectorPolicy).toBe('explicit-native-matches');
  expect(cast.matchedSubmeshes).toEqual(['Tails']);
  expect(cast.unmatchedSelectors).toEqual(['{62579b4c}']);
  expect(cast.fresnelSource).toBe(0.15000000596046448);
  expect(cast.fresnelPower).toBe(0.8350000381469727);
});
test('E buff omitted selectors remain unresolved rather than selecting an invented body mesh', () => {
  const buff = AHRI_E_SKIN_BINDINGS.find((p) => p.system === 'Ahri_E_buf')!;
  expect(buff.selectorPolicy).toBe('unresolved-omission');
  expect(buff.matchedSubmeshes).toEqual([]);
  expect(buff.unmatchedSelectors).toEqual([]);
  expect(Object.hasOwn(data.profiles[buff.profileIndex].attached!, 'mSubmeshesToDraw')).toBe(false);
  expect(buff.fresnelSource).toBe(0.05000000074505806);
  expect(buff.fresnelPower).toBe(0.3449999988079071);
});
