import type { SourceValueDefinition } from './source-value';
export const AHRI_R_PALETTE_POLICY = {
  field: '{143f06d1}',
  spelling: 'palleteSrcMixColor',
  missingCount: 1,
  missingSelector: 0,
  constructorPolicy: 'explicit local defaults matching the pinned external reader',
  nativeConstructorVerified: false,
} as const;
interface Profile {
  system: string;
  index: number;
  name: string;
  palette: {
    texture: string | null;
    count: number | null;
    selector: SourceValueDefinition;
    sourceMix: unknown;
    unresolvedFields: Readonly<Record<string, unknown>>;
  } | null;
}
/** Bind only the checked constant ValueColor closure. Keep authored omissions
 * visible; dynamic mixer curves and other unknown fields require another reading. */
export function rPaletteBinding(profile: Profile) {
  if (profile.system !== 'Ahri_R_mis_02' || profile.index !== 8 || profile.name !== 'Ribbon_1')
    return null;
  const p = profile.palette;
  const value = p?.unresolvedFields[AHRI_R_PALETTE_POLICY.field] as
    Record<string, unknown> | undefined;
  const mix = value?.constantValue;
  if (
    !p?.texture ||
    p.sourceMix !== null ||
    Object.keys(p.unresolvedFields).length !== 1 ||
    !value ||
    Object.keys(value).sort().join(',') !== '__type,constantValue' ||
    value.__type !== 'ValueColor' ||
    !Array.isArray(mix) ||
    mix.length !== 4 ||
    !mix.every(
      (v) => typeof v === 'number' && Number.isFinite(v) && Number.isFinite(Math.fround(v))
    ) ||
    p.selector.sourceType !== null ||
    p.selector.authoredKeyCount !== 0 ||
    p.selector.constant.length !== 3 ||
    p.selector.constant.some((v) => v !== 0) ||
    p.selector.times.length !== 1 ||
    p.selector.times[0] !== 0 ||
    p.selector.values.length !== 1 ||
    p.selector.values[0].length !== 3 ||
    p.selector.values[0].some((v) => v !== 0) ||
    p.selector.probabilities.length !== 0 ||
    (p.count !== null && (!Number.isSafeInteger(p.count) || p.count <= 0))
  )
    throw Error('Unsupported R palette mixer declaration');
  const count = p.count ?? AHRI_R_PALETTE_POLICY.missingCount;
  return {
    texture: p.texture,
    sourceMix: [...mix] as [number, number, number, number],
    row: (AHRI_R_PALETTE_POLICY.missingSelector + 0.5) / count,
    count,
    countOmitted: p.count === null,
    selectorOmitted: p.selector.sourceType === null,
    nativeConstructorVerified: false,
  };
}
