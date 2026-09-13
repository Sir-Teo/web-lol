import { ASHE_W } from './ashe-w';
import { ASHE_E } from './ashe-e';
import { ASHE_R } from './ashe-r';

// E uses declared spellCastTime; W/R agree with their animator-frame values.
export const ASHE_CASTS = { w: ASHE_W, e: ASHE_E, r: ASHE_R } as const;
