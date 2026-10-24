import profiles from './leona-sunlight-particles.json';

// All six hit emitters have their only birth on the local first-update tick.
// Type-0 linger caps do not extend these authored natural particle lives.
const life = Math.max(
  ...profiles
    .filter((p) => p.role === 'hit')
    .map((p) => {
      const table = p.life.probabilities?.[0];
      return (
        p.life.value[0] *
        (table ? Math.max(...(table.values.length ? table.values : [table.single])) : 1)
      );
    })
);
export const SUNLIGHT_VISUAL_HISTORY_TICKS = Math.ceil(life * 60) + 2;
// Explicit local attachment until native script dispatch is measured.
export const SUNLIGHT_BONE = 'C_BUFFBONE_GLB_CENTER_LOC';
