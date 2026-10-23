import profile from './garen-passive-particles.json';
/** Maximum source life, plus first-update and interpolation coverage at 60 Hz. */
export const GAREN_PASSIVE_TAIL_TICKS = Math.ceil(profile.maxLife * 60) + 2;
