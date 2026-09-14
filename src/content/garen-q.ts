// Generated from pinned GarenQ named values; full attack state machine remains separate.
export const GAREN_Q = {
  baseDamageByRank: [30.0, 60.0, 90.0, 120.0, 150.0],
  movementSecondsByRank: [
    1.399999976158142, 1.9500000476837158, 2.5, 3.049999952316284, 3.5999999046325684,
  ],
  silenceSeconds: 1.5,
  movementSpeedBonus: 0.3499999940395355,
  attackWindowSeconds: 4.5,
  totalAttackDamageRatio: 1.5,
  cooldownSeconds: 8.0,
  attackReset: true,
  attackCannotCancelWindup: true,
  attackCanCastWhileDisabled: true,
} as const;
