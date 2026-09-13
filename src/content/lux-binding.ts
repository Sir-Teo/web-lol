// Named parent values and missile fields pinned in docs/reference/lux-binding.json.
export const LUX_BINDING = {
  castSeconds: 0.25,
  mana: 50,
  cooldownSeconds: 10,
  baseDamage: [80, 120, 160, 200, 240],
  abilityPowerRatio: 0.75,
  rootSeconds: 2,
  speed: 1200,
  // Child flight range and missile width used provisionally; native geometry pending.
  range: 1300,
  radius: 70,
  maximumTargets: 2,
} as const;
