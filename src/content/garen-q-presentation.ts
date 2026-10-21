import { GAREN_Q } from './garen-q';

/** Source Spell1 landing event is frame 9. The pose's frame-10-to-release map
 * remains provisional. Round only the event dispatch to a simulation update. */
export function garenQLandingTick(attack: { startTick: number; releaseTick: number }) {
  return Math.ceil(
    attack.startTick +
      ((attack.releaseTick - attack.startTick) * 9) / GAREN_Q.attackTiming.animationCastFrame -
      1e-5
  );
}
