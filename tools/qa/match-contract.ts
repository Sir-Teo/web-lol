import type { World } from '../../src/simulation/world';
import type { Unit } from '../../src/simulation/types';

/** Independent QA contract; never calls World.vulnerable to judge structure gates. */
export function structureExposed(target: Unit, units: readonly Unit[]): boolean {
  if (!target.structure) return true;
  const peers = units.filter((unit) => unit.team === target.team && unit.structure);
  const living = (role: string, lane = target.structure!.lane) =>
    peers.some(
      (unit) => unit.structure!.role === role && unit.structure!.lane === lane && unit.hp > 0
    );
  const openInhibitor = () => peers.some((unit) => unit.kind === 'inhibitor' && unit.hp === 0);
  switch (target.structure.role) {
    case 'outer-turret':
      return true;
    case 'inner-turret':
      return !living('outer-turret');
    case 'inhibitor-turret':
      return !living('outer-turret') && !living('inner-turret');
    case 'inhibitor':
      return !living('outer-turret') && !living('inner-turret') && !living('inhibitor-turret');
    case 'nexus-turret':
      return openInhibitor();
    case 'nexus':
      return openInhibitor() && !living('nexus-turret', null);
  }
}

export function assertMatchResources(world: World): void {
  for (const unit of world.units) {
    if (
      ![unit.x, unit.y, unit.hp, unit.maxHp, unit.mana, unit.maxMana].every(Number.isFinite) ||
      unit.maxHp <= 0 ||
      unit.hp < 0 ||
      unit.hp > unit.maxHp ||
      unit.maxMana < 0 ||
      unit.mana < 0 ||
      unit.mana > unit.maxMana
    )
      throw new Error(`Invalid resources for unit ${unit.id} at tick ${world.tick}`);
  }
  const champions = world.units.filter((unit) => unit.kind === 'champion');
  if (champions.length !== 10 || new Set(champions.map((unit) => unit.id)).size !== 10)
    throw new Error(`Invalid champion roster at tick ${world.tick}`);
  for (const unit of champions) {
    const state = world.championState(unit.id);
    if (
      !state ||
      !Number.isFinite(state.gold) ||
      state.gold < 0 ||
      !Number.isInteger(state.level) ||
      state.level < 1 ||
      state.level > 18
    )
      throw new Error(`Invalid champion economy for unit ${unit.id} at tick ${world.tick}`);
  }
}

export function assertMatchVictory(world: World): void {
  const dead = world.units.filter((unit) => unit.kind === 'nexus' && unit.hp === 0);
  if (!world.winner) {
    if (dead.length) throw new Error('Destroyed Nexus without a declared winner');
    return;
  }
  const loser = world.winner === 'blue' ? 'red' : 'blue';
  if (dead.length !== 1 || dead[0].team !== loser)
    throw new Error('Winner does not match the destroyed Nexus');
  const base = world.units.filter((unit) => unit.team === loser && unit.structure);
  if (
    base.filter((unit) => unit.structure!.role === 'nexus-turret' && unit.hp === 0).length !== 2 ||
    !base.some((unit) => unit.kind === 'inhibitor' && unit.hp === 0)
  )
    throw new Error('Structurally impossible victory');
}

export function observeStructureDamage(
  world: World,
  accepted: (unit: Unit, amount: number) => void
): void {
  const original = world.damage.bind(world);
  world.damage = (...args: Parameters<World['damage']>) => {
    const target = args[1],
      before = target.hp;
    const exposed = structureExposed(target, world.units);
    const result = original(...args);
    if (target.structure && target.hp < before) {
      if (!exposed)
        throw new Error(`Protected structure ${target.id} lost health at tick ${world.tick}`);
      accepted(target, before - target.hp);
    }
    return result;
  };
}
