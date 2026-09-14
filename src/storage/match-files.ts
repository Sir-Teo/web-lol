import { TICK_RATE } from '../content/rules';
import type { Battlefield } from '../simulation/battlefield';
import { World } from '../simulation/world';

export interface PreparedMatchImport {
  description: string;
  load: () => Promise<void>;
}

// Check bytes before reading the whole file; the snapshot decoder also bounds text length.
export const MAX_MATCH_FILE_BYTES = 16 * 1024 * 1024;

export async function prepareMatchImport(
  file: File,
  battlefield: Battlefield,
  persist: (snapshot: string) => Promise<void>
): Promise<PreparedMatchImport> {
  if (file.size > MAX_MATCH_FILE_BYTES) throw new Error('Match file is too large (maximum 16 MB).');
  const world = World.fromSnapshot(await file.text(), battlefield);
  const snapshot = world.snapshot();
  const seconds = Math.floor(world.tick / TICK_RATE);
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const state = world.winner
    ? `${world.winner === 'blue' ? 'Blue' : 'Red'} team victory`
    : 'Match in progress';
  return {
    description: `${time} · ${state}. Loading replaces the current match and its browser save.`,
    load: () => persist(snapshot),
  };
}

export function downloadMatch(world: World): void {
  const url = URL.createObjectURL(new Blob([world.snapshot()], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `rift-${world.battlefield.id}-tick-${world.tick}.json`;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Keep the URL alive while the browser accepts the download request.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
