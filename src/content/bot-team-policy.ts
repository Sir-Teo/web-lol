/** Local strategic tuning; no native bot implementation is claimed. */
export const BOT_TEAM_POLICY = {
  thinkTicks: 60,
  memoryTicks: 180,
  retargetRatio: 1.2,
  defendRadius: 6500,
  pushRadius: 4500,
  gankRadius: 3500,
  riverRadius: 2800,
  towerMargin: 150,
  advance: {
    minLevel: 6,
    minimumHpFraction: 0.55,
    minimumWaveUnits: 3,
    waveClusterRadius: 650,
    structureRadius: 2400,
    stagingDistance: 350,
    joinRadius: 6500,
    baseJoinRadius: 12000,
  },
} as const;
