import { LUX_E_SOURCE } from './lux-e';
import { LUX_E_BURST_TICKS } from './lux-e-particle-timing';
// Explicit provisional geometry/lifecycle choices; see docs/LUX-E.md.
export const LUX_E_POLICY = {
  radius: LUX_E_SOURCE.effectRadiusCandidate,
  exitLingerSeconds: 0.25,
  presentationSeconds: LUX_E_BURST_TICKS / 60,
} as const;
