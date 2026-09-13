import { LUX_E_SOURCE } from './lux-e';
// Explicit provisional geometry/lifecycle choices; see docs/LUX-E.md.
export const LUX_E_POLICY = {
  radius: LUX_E_SOURCE.effectRadiusCandidate,
  exitLingerSeconds: 0.25,
  presentationSeconds: 0.3,
} as const;
