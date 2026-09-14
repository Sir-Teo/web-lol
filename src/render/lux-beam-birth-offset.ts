interface BirthOffset {
  readonly value: readonly number[];
  readonly probabilities:
    | readonly {
        readonly times: readonly number[];
        readonly values: readonly number[];
        readonly single?: number;
      }[]
    | null;
}
/** One shared birth chance drives the source per-axis multiplier tables. */
export function luxBeamBirthOffset(profile: BirthOffset, chance: number): number[] {
  if (!Number.isFinite(chance) || chance < 0 || chance > 1)
    throw new RangeError('Invalid birth chance');
  return profile.value.map((value, axis) => {
    if (!profile.probabilities) return value;
    const table = profile.probabilities[axis];
    // An absent table leaves the channel alone; an empty table uses singleValue (default 1).
    if (!table) return value;
    if (table.times.length !== table.values.length) return 0;
    if (!table.times.length) return value * (table.single ?? 1);
    if (chance <= table.times[0]) return value * table.values[0];
    for (let i = 1; i < table.times.length; i++)
      if (chance <= table.times[i]) {
        const f = (chance - table.times[i - 1]) / (table.times[i] - table.times[i - 1]);
        return value * (table.values[i - 1] + f * (table.values[i] - table.values[i - 1]));
      }
    return value * table.values.at(-1)!;
  });
}
