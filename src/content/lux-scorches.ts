import profiles from './lux-ground-layers.json';
/** Selected ground emitters; projection remains a documented local policy. */
export const LUX_SCORCHES = profiles.filter((p) => p.name === 'Burnt' || p.name === 'Burnt1');
