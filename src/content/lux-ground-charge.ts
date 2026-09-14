import profiles from './lux-ground-layers.json';
export const LUX_GROUND_CHARGE = profiles.filter(
  (p) => p.geometry.kind === 'arbitraryQuad' && p.delay === 0
);
