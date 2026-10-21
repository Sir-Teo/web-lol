/** Existing source-rig center attachment, chosen locally for W cast layers.
 * No W animation event establishes native attachment or script dispatch. */
export const GAREN_W_CAST_PARTICLE_BONE = 'C_Buffbone_GLB_Center_Loc';

/** Matching joints exist in the frozen rig. Dispatch at W activation and full
 * shoulder-frame inheritance are local policies, awaiting native comparison. */
export const GAREN_W_PARTICLE_BONES: Readonly<Record<string, string | undefined>> = {
  cast: GAREN_W_CAST_PARTICLE_BONE,
  deflect: GAREN_W_CAST_PARTICLE_BONE,
  'shoulder-left': 'L_Shoulder',
  'shoulder-right': 'R_Shoulder',
};
