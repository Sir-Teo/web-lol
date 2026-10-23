import { ImpactAttachments } from './impact-attachments';
import names from '../content/lux-hit-bones.json';
import type { TargetPoseSampler } from './target-pose-sampler';
import type { Vec2 } from '../simulation/math';
/** Lux retains its source normal/critical attachment selection. */
export class LuxImpactAttachments extends ImpactAttachments {
  constructor(sampler: TargetPoseSampler | null, ground: (p: Vec2) => number) {
    super(sampler, ground, (critical) => (critical ? names.critical : names.normal));
  }
}
