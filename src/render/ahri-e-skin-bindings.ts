import data from '../content/ahri-e-particles.json';
import reading from '../../docs/reference/ahri/e-attached-bindings.json';
import fresnel from '../content/leona-w-skin-fresnel.json';

/** Only explicit native selectors with verified native/transport matches bind
 * geometry. An omitted selector list is distinct from an explicit empty list. */
export const AHRI_E_SKIN_BINDINGS = data.profiles.flatMap((profile, profileIndex) => {
  if (profile.kind !== 'skin') return [];
  const source = reading.attachedMeshes.find(
    (row) => row.resourceKey === profile.system && row.emitterIndex === profile.index
  );
  if (!source || !profile.attached || !profile.reflection)
    throw Error('Missing checked E attached-skin reading');
  const powers = new Set(
    fresnel.profiles.filter((p) => p.source === profile.reflection!.fresnel).map((p) => p.power)
  );
  if (powers.size !== 1) throw Error('Missing checked E skin Fresnel input');
  const selectors = profile.attached.mSubmeshesToDraw;
  if (
    source.selectorsPresent !== Object.hasOwn(profile.attached, 'mSubmeshesToDraw') ||
    (selectors && selectors.join() !== source.candidates.map((row) => row.selector).join())
  )
    throw Error('Changed E attached-skin selectors');
  const matched = source.candidates.filter(
    (row) => row.nativeDraws.length === 1 && row.transportDraws.length === 1
  );
  if (matched.some((row) => row.nativeDraws[0].indices !== row.transportDraws[0].indexCount))
    throw Error('Changed E attached-skin transport draw');
  return [
    {
      profileIndex,
      system: profile.system,
      selectorPolicy: source.selectorsPresent ? 'explicit-native-matches' : 'unresolved-omission',
      matchedSubmeshes: matched.map((row) => row.nativeDraws[0].name),
      unmatchedSelectors: source.candidates
        .filter((row) => !matched.includes(row))
        .map((row) => row.selector),
      fresnelSource: profile.reflection.fresnel,
      fresnelPower: [...powers][0],
    },
  ];
});
if (AHRI_E_SKIN_BINDINGS.length !== 2) throw Error('E attached-skin closure differs');
