/** Selected crescentwhite fields from the binary-verified Lux basic attack. */
export const LUX_BASIC_CRESCENT = {
  rate: 20.0,
  particleLife: 0.6000000238418579,
  emitterLife: 0.30000001192092896,
  velocity: {
    times: [0.0, 1.0],
    values: [
      [0.0, 0.0, 0.0],
      [0.0, 400.0, 0.0],
    ],
  },
  drag: [0.0, 2.0, 0.0],
  bind: {
    times: [0.0, 1.0],
    values: [0.800000011920929, 0.0],
  },
  offset: [0.0, -50.0, 0.0],
  rotationDegrees: [0.0, 0.0, 180.0],
  birthScale: [2.0, 3.0, 3.0],
  scale: {
    times: [0.0, 0.5, 1.0],
    values: [
      [0.5, 6.0, 0.10000000149011612],
      [1.5, 1.0, 0.25],
      [0.0, 1.0, 0.5],
    ],
  },
  lookupScales: [0.5, 1.0],
  lookupOffsets: [0.6000000238418579, 0.0],
} as const;
