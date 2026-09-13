// Parent spell values and conflicting child metadata retained in docs/reference/lux-r.json.
export const LUX_R = {
  baseDamage: [300, 400, 500],
  abilityPowerRatio: 1.2,
  mana: 100,
  cooldownSeconds: [60, 50, 40],
  // Approximate observed windup; geometry still requires controlled native comparison.
  castSeconds: 1,
  range: 3340,
  halfWidth: 95,
  presentationSeconds: 0.3,
} as const;
