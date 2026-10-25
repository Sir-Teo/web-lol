import { AHRI_PASSIVE } from '../content/ahri-passive';
import { AHRI_PASSIVE_POLICY as POLICY } from '../content/ahri-passive-policy';
import { acceleratingMotion } from './ahri-orb-motion';
import {
  essenceHeal,
  essenceTravelStep,
  type EssenceCounter,
  type AhriEssence,
} from './ahri-essences';
import { distance } from './math';
import { isLaneMinionKind, type Unit } from './types';

type Owner = { id: number; level: number };
export function validateEssences(
  counters: readonly EssenceCounter[],
  essences: readonly AhriEssence[],
  units: readonly Unit[],
  owners: readonly Owner[],
  tick: number,
  nextId: number,
  winner: unknown,
  nonUnitIds: readonly number[]
): void {
  const fail = () => {
    throw Error('Saved match contains invalid Essence Theft state.');
  };
  const sources = new Set<number>();
  for (const counter of counters) {
    const source = units.find((u) => u.id === counter.sourceId);
    if (
      !source ||
      source.champion !== 'ahri' ||
      sources.has(source.id) ||
      (counter.lastKillTick === null && counter.stacks !== 0) ||
      (counter.lastKillTick !== null &&
        (counter.lastKillTick > tick ||
          (source.deadAt !== null && counter.lastKillTick > source.deadAt)))
    )
      fail();
    sources.add(counter.sourceId);
  }
  if (units.some((u) => u.champion === 'ahri' && !sources.has(u.id))) fail();
  for (const e of essences) {
    const source = units.find((u) => u.id === e.sourceId),
      owner = owners.find((o) => o.id === e.sourceId),
      victim = units.find((u) => u.id === e.victimId),
      at = e.stopTick ?? tick,
      age = (at - e.startTick + 1) / 60;
    if (
      winner !== null ||
      !source ||
      source.champion !== 'ahri' ||
      source.team !== e.team ||
      !owner ||
      e.level > owner.level ||
      !sources.has(e.sourceId) ||
      e.victimId >= nextId ||
      e.victimId === e.sourceId ||
      nonUnitIds.includes(e.victimId) ||
      (victim &&
        (victim.team === e.team ||
          (e.kind === 'champion'
            ? victim.kind !== 'champion'
            : !isLaneMinionKind(victim.kind) && victim.kind !== 'monster'))) ||
      e.startTick > tick ||
      e.lastTick !== at ||
      e.heal !== essenceHeal(e.kind, e.level, e.power) ||
      (e.stopTick === null) !== (e.stopReason === null) ||
      (e.stopTick === null) !== (e.healed === null) ||
      (e.stopTick === null &&
        (source.hp <= 0 || tick - e.startTick >= POLICY.maximumPursuitTicks)) ||
      (e.stopTick !== null &&
        (e.stopTick < e.startTick ||
          e.stopTick > tick ||
          tick >= e.stopTick + POLICY.historyTicks ||
          e.stopTick - e.startTick > POLICY.maximumPursuitTicks)) ||
      (e.stopReason === 'death' && (source.hp > 0 || source.deadAt !== e.stopTick)) ||
      (e.stopReason === 'expired' && e.stopTick !== e.startTick + POLICY.maximumPursuitTicks) ||
      (e.stopReason !== 'consumed' && e.healed !== null && e.healed !== 0) ||
      (e.healed !== null && e.healed > e.heal) ||
      distance(e.position, e.previous) > essenceTravelStep(e.startTick, at) + 1e-6 ||
      distance(e.position, e.origin) > acceleratingMotion(age, AHRI_PASSIVE.missile).distance + 1e-6
    )
      fail();
  }
}
