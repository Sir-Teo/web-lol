/** The pinned character has two ordinary attack slots, each weighted 0.5.
 * This stateless visual hash is our replay policy, not the native RNG sequence.
 * It consumes no gameplay randomness and uses only saved unit/cycle identity.
 */
export function luxAttackAnimation(unitId: number, startTick: number): 'attack1' | 'attack2' {
  let value = Math.imul(unitId ^ Math.imul(startTick, 0x85ebca6b), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 16), 0x846ca68b);
  value ^= value >>> 16;
  return value >>> 0 < 0x80000000 ? 'attack1' : 'attack2';
}
