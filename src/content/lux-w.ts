// Parent and outbound/return children pinned in docs/reference/lux-w.json.
export const LUX_W = {
  castSeconds: 0.25,
  mana: [60, 65, 70, 75, 80],
  cooldownSeconds: [12, 11.5, 11, 10.5, 10],
  baseShield: [40, 55, 70, 85, 100],
  abilityPowerRatio: 0.4,
  shieldSeconds: 2.5,
  // Child flight range/width interpreted provisionally; native geometry pending.
  range: 1175,
  radius: 110,
  outwardSpeed: 2200,
  outwardAcceleration: -2300,
  outwardMinimumSpeed: 500,
  returnSpeed: 50,
  returnAcceleration: 1800,
  returnMaximumSpeed: 2400,
  returnRange: 25000,
} as const;
