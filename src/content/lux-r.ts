import { LUX_BEAM_LAYERS } from './lux-beam-layers';
const CAST_SECONDS = 1;
// Parent spell values and conflicting child metadata retained in docs/reference/lux-r.json.
export const LUX_R = {
  baseDamage: [300, 400, 500],
  abilityPowerRatio: 1.2,
  mana: 100,
  cooldownSeconds: [60, 50, 40],
  // Approximate observed windup; geometry still requires controlled native comparison.
  castSeconds: CAST_SECONDS,
  range: 3340,
  halfWidth: 95,
  // Retain every selected source layer through its final authored endpoint.
  presentationSeconds:
    Math.max(...LUX_BEAM_LAYERS.map((layer) => layer.delay + layer.life)) - CAST_SECONDS,
} as const;
