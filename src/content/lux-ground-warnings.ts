import profiles from './lux-ground-layers.json';
export const LUX_GROUND_WARNINGS = profiles.filter((p) => p.geometry.kind === 'beam');
