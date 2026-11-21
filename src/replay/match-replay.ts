import { z } from 'zod';
import { isBotDifficulty, type BotDifficulty } from '../content/bot-difficulty';
import { championProfile } from '../content/champion-profiles';
import { ITEMS, TICK_RATE } from '../content/rules';
import { TRINKETS, type TrinketKind } from '../content/trinkets';
import {
  IMMEDIATE_PRACTICE_ACTIONS,
  applyImmediatePracticeTool,
  type ImmediatePracticeAction,
} from '../practice/practice-tools';
import type { Battlefield } from '../simulation/battlefield';
import { SNAPSHOT_RULESET, SNAPSHOT_VERSION } from '../simulation/snapshot';
import { swapTrinket } from '../simulation/trinkets';
import type { Ability, ChampionIdentity, Command, Order } from '../simulation/types';
import { World } from '../simulation/world';

export const REPLAY_FORMAT = 1 as const;
export const MAX_REPLAY_BYTES = 16 * 1024 * 1024;
export const REPLAY_SPEEDS = [0.5, 1, 2, 4] as const;
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];

export type ReplayAction =
  | { type: 'enqueue'; command: Command }
  | { type: 'buy'; itemId: string; championId: number }
  | { type: 'sell'; slot: number; championId: number }
  | { type: 'move-item'; from: number; to: number; championId: number }
  | { type: 'undo-shop'; championId: number }
  | { type: 'swap-trinket'; kind: TrinketKind; ownerId: number }
  | { type: 'practice'; action: ImmediatePracticeAction };

export interface ReplayEntry {
  tick: number;
  action: ReplayAction;
}

export interface ReplayCheckpoint {
  tick: number;
  sha256: string;
}

export interface MatchReplayLog {
  format: typeof REPLAY_FORMAT;
  version: number;
  ruleset: string;
  battlefieldId: Battlefield['id'];
  matchMode: 'practice' | 'lanes';
  champion: ChampionIdentity;
  botDifficulty: BotDifficulty;
  startTick: number;
  endTick: number;
  initialSnapshot: string;
  finalSha256: string;
  entries: ReplayEntry[];
  checkpoints: ReplayCheckpoint[];
}

export interface PreparedReplayImport {
  description: string;
  log: MatchReplayLog;
}

const vec2Schema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

const orderSchema: z.ZodType<Order> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('idle') }),
  z.object({ type: z.literal('move'), point: vec2Schema }),
  z.object({ type: z.literal('attackMove'), point: vec2Schema }),
  z.object({ type: z.literal('attack'), target: z.number().int().nonnegative() }),
]);

const abilitySchema: z.ZodType<Ability> = z.enum(['q', 'w', 'e', 'r', 'd', 'f']);

const commandSchema: z.ZodType<Command> = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('order'),
    unit: z.number().int().nonnegative(),
    order: orderSchema,
  }),
  z.object({
    type: z.literal('cast'),
    unit: z.number().int().nonnegative(),
    ability: abilitySchema,
    point: vec2Schema,
    targetId: z.number().int().nonnegative().optional(),
  }),
  z.object({
    type: z.literal('learn'),
    unit: z.number().int().nonnegative(),
    ability: z.enum(['q', 'w', 'e', 'r']),
  }),
  z.object({
    type: z.literal('ward'),
    unit: z.number().int().nonnegative(),
    point: vec2Schema,
  }),
  z.object({
    type: z.literal('oracle'),
    unit: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('farsight'),
    unit: z.number().int().nonnegative(),
    point: vec2Schema,
  }),
  z.object({
    type: z.literal('use-item'),
    unit: z.number().int().nonnegative(),
    slot: z.number().int().min(0).max(6),
    point: vec2Schema.optional(),
  }),
  z.object({
    type: z.literal('recall'),
    unit: z.number().int().nonnegative(),
  }),
]);

const itemIds = new Set<string>(ITEMS.map((item) => item.id));
const trinketKinds = Object.keys(TRINKETS) as [TrinketKind, ...TrinketKind[]];

const replayActionSchema: z.ZodType<ReplayAction> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('enqueue'), command: commandSchema }),
  z.object({
    type: z.literal('buy'),
    itemId: z.string().refine((id) => itemIds.has(id)),
    championId: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('sell'),
    slot: z.number().int().min(0).max(6),
    championId: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('move-item'),
    from: z.number().int().min(0).max(6),
    to: z.number().int().min(0).max(6),
    championId: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('undo-shop'),
    championId: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('swap-trinket'),
    kind: z.enum(trinketKinds),
    ownerId: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('practice'),
    action: z.enum(IMMEDIATE_PRACTICE_ACTIONS),
  }),
]);

const replayEnvelopeSchema = z.object({
  format: z.literal(REPLAY_FORMAT),
  version: z.number().int(),
  ruleset: z.string().min(1),
  battlefieldId: z.enum(['practice-fixture', 'rift']),
  matchMode: z.enum(['practice', 'lanes']),
  champion: z.enum([
    'ashe',
    'lux',
    'garen',
    'leona',
    'ahri',
    'masteryi',
    'darius',
    'vi',
    'ezreal',
    'morgana',
  ]),
  botDifficulty: z.string().refine(isBotDifficulty),
  startTick: z.number().int().nonnegative(),
  endTick: z.number().int().nonnegative(),
  initialSnapshot: z.string().min(2),
  finalSha256: z.string().regex(/^[0-9a-f]{64}$/),
  entries: z.array(
    z.object({
      tick: z.number().int().nonnegative(),
      action: replayActionSchema,
    })
  ),
  checkpoints: z
    .array(
      z.object({
        tick: z.number().int().nonnegative(),
        sha256: z.string().regex(/^[0-9a-f]{64}$/),
      })
    )
    .min(1),
});

export async function digestSnapshotSha256(snapshotText: string): Promise<string> {
  const bytes = new TextEncoder().encode(snapshotText);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function cloneCommand(command: Command): Command {
  if (command.type === 'cast') {
    return {
      type: 'cast',
      unit: command.unit,
      ability: command.ability,
      point: { x: command.point.x, y: command.point.y },
      ...(command.targetId !== undefined ? { targetId: command.targetId } : {}),
    };
  }
  if (command.type === 'order') {
    const order = command.order;
    return {
      type: 'order',
      unit: command.unit,
      order:
        order.type === 'move' || order.type === 'attackMove'
          ? { type: order.type, point: { x: order.point.x, y: order.point.y } }
          : order.type === 'attack'
            ? { type: 'attack', target: order.target }
            : { type: 'idle' },
    };
  }
  if (command.type === 'ward') {
    return {
      type: 'ward',
      unit: command.unit,
      point: { x: command.point.x, y: command.point.y },
    };
  }
  if (command.type === 'learn') {
    return { type: 'learn', unit: command.unit, ability: command.ability };
  }
  if (command.type === 'oracle') {
    return { type: 'oracle', unit: command.unit };
  }
  if (command.type === 'farsight') {
    return {
      type: 'farsight',
      unit: command.unit,
      point: { x: command.point.x, y: command.point.y },
    };
  }
  if (command.type === 'use-item') {
    return {
      type: 'use-item',
      unit: command.unit,
      slot: command.slot,
      ...(command.point ? { point: { x: command.point.x, y: command.point.y } } : {}),
    };
  }
  return { type: 'recall', unit: command.unit };
}

export function applyReplayAction(world: World, action: ReplayAction): void {
  if (action.type === 'enqueue') {
    world.enqueue(action.command);
    return;
  }
  if (action.type === 'buy') {
    const error = world.buy(action.itemId, action.championId);
    if (error) throw new Error(`Replay purchase diverged: ${error}`);
    return;
  }
  if (action.type === 'sell') {
    const error = world.sell(action.slot, action.championId);
    if (error) throw new Error(`Replay item sale diverged: ${error}`);
    return;
  }
  if (action.type === 'move-item') {
    const error = world.moveItem(action.from, action.to, action.championId);
    if (error) throw new Error(`Replay inventory move diverged: ${error}`);
    return;
  }
  if (action.type === 'undo-shop') {
    const error = world.undoShop(action.championId);
    if (error) throw new Error(`Replay shop undo diverged: ${error}`);
    return;
  }
  if (action.type === 'swap-trinket') {
    const error = swapTrinket(world, action.kind, action.ownerId);
    if (error) throw new Error(`Replay trinket swap diverged: ${error}`);
    return;
  }
  applyImmediatePracticeTool(world, action.action);
}

/** Captures external player commands, shop/trinket actions, practice actions, and checkpoint snapshots. */
export class MatchReplayRecorder {
  readonly startTick: number;
  readonly initialSnapshot: string;
  private endTickValue: number;
  private readonly entries: ReplayEntry[] = [];
  private readonly checkpointSnapshots = new Map<number, string>();
  private inStep = false;
  private detached = false;
  private readonly detachHooks: () => void;

  constructor(
    private readonly world: World,
    private readonly checkpointIntervalTicks = 30 * TICK_RATE
  ) {
    this.startTick = world.tick;
    this.endTickValue = world.tick;
    this.initialSnapshot = world.snapshot();
    this.checkpointSnapshots.set(this.startTick, this.initialSnapshot);

    const originalEnqueue = world.enqueue.bind(world);
    const originalBuy = world.buy.bind(world);
    const originalSell = world.sell.bind(world);
    const originalMoveItem = world.moveItem.bind(world);
    const originalUndoShop = world.undoShop.bind(world);

    world.enqueue = (command: Command) => {
      if (!this.detached && !this.inStep) {
        this.entries.push({
          tick: world.tick,
          action: { type: 'enqueue', command: cloneCommand(command) },
        });
      }
      originalEnqueue(command);
    };

    world.buy = (itemId: string, championId = world.player.id) => {
      const error = originalBuy(itemId, championId);
      if (error === null && !this.detached && !this.inStep) {
        this.entries.push({
          tick: world.tick,
          action: { type: 'buy', itemId, championId },
        });
      }
      return error;
    };

    world.sell = (slot: number, championId = world.player.id) => {
      const error = originalSell(slot, championId);
      if (error === null && !this.detached && !this.inStep) {
        this.entries.push({
          tick: world.tick,
          action: { type: 'sell', slot, championId },
        });
      }
      return error;
    };

    world.moveItem = (from: number, to: number, championId = world.player.id) => {
      const error = originalMoveItem(from, to, championId);
      if (error === null && !this.detached && !this.inStep && from !== to) {
        this.entries.push({
          tick: world.tick,
          action: { type: 'move-item', from, to, championId },
        });
      }
      return error;
    };

    world.undoShop = (championId = world.player.id) => {
      const error = originalUndoShop(championId);
      if (error === null && !this.detached && !this.inStep) {
        this.entries.push({
          tick: world.tick,
          action: { type: 'undo-shop', championId },
        });
      }
      return error;
    };

    this.detachHooks = () => {
      if (this.detached) return;
      this.detached = true;
      world.enqueue = originalEnqueue;
      world.buy = originalBuy;
      world.sell = originalSell;
      world.moveItem = originalMoveItem;
      world.undoShop = originalUndoShop;
    };
  }

  get endTick(): number {
    return this.endTickValue;
  }

  get entryCount(): number {
    return this.entries.length;
  }

  recordTrinketSwap(kind: TrinketKind, ownerId = this.world.player.id): void {
    if (this.detached || this.inStep) return;
    this.entries.push({
      tick: this.world.tick,
      action: { type: 'swap-trinket', kind, ownerId },
    });
  }

  recordPractice(action: ImmediatePracticeAction): void {
    if (this.detached || this.inStep) return;
    this.entries.push({
      tick: this.world.tick,
      action: { type: 'practice', action },
    });
  }

  step(count = 1): void {
    this.inStep = true;
    try {
      for (let i = 0; i < count && !this.world.winner; i++) {
        this.world.step(1);
        this.endTickValue = this.world.tick;
        if (
          (this.checkpointIntervalTicks > 0 &&
            (this.world.tick - this.startTick) % this.checkpointIntervalTicks === 0) ||
          this.world.winner !== null
        ) {
          this.checkpointSnapshots.set(this.world.tick, this.world.snapshot());
        }
      }
    } finally {
      this.inStep = false;
    }
  }

  detach(): void {
    this.detachHooks();
  }

  async exportLog(): Promise<MatchReplayLog> {
    this.endTickValue = this.world.tick;
    const ticks = [...this.checkpointSnapshots.keys()].sort((a, b) => a - b);
    const checkpoints: ReplayCheckpoint[] = [];
    for (const tick of ticks) {
      checkpoints.push({
        tick,
        sha256: await digestSnapshotSha256(this.checkpointSnapshots.get(tick)!),
      });
    }
    const finalSha256 = await digestSnapshotSha256(this.world.snapshot());
    return {
      format: REPLAY_FORMAT,
      version: SNAPSHOT_VERSION,
      ruleset: SNAPSHOT_RULESET,
      battlefieldId: this.world.battlefield.id,
      matchMode: this.world.matchMode,
      champion: this.world.hero.champion ?? 'ashe',
      botDifficulty: this.world.botDifficulty,
      startTick: this.startTick,
      endTick: this.endTickValue,
      initialSnapshot: this.initialSnapshot,
      finalSha256,
      entries: structuredClone(this.entries),
      checkpoints,
    };
  }
}

export async function parseMatchReplayLog(
  text: string,
  battlefield: Battlefield
): Promise<MatchReplayLog> {
  if (text.length > MAX_REPLAY_BYTES) throw new Error('Replay file is too large (maximum 16 MB).');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Replay file could not be read.');
  }
  if (raw && typeof raw === 'object') {
    const candidate = raw as Record<string, unknown>;
    if ('version' in candidate && candidate.version !== SNAPSHOT_VERSION)
      throw new Error('Replay file belongs to a different game version.');
    if ('ruleset' in candidate && candidate.ruleset !== SNAPSHOT_RULESET)
      throw new Error('Replay file belongs to a different ruleset.');
    if ('battlefieldId' in candidate && candidate.battlefieldId !== battlefield.id)
      throw new Error('Replay file belongs to a different battlefield.');
  }
  const parsed = replayEnvelopeSchema.safeParse(raw);
  if (!parsed.success)
    throw new Error('Replay file is invalid or belongs to a different game version.', {
      cause: parsed.error,
    });
  const log = parsed.data;
  if (log.endTick < log.startTick) throw new Error('Replay file has an invalid tick range.');
  for (let i = 0; i < log.entries.length; i++) {
    const tick = log.entries[i].tick;
    if (tick < log.startTick || tick > log.endTick)
      throw new Error('Replay file contains an out-of-range action tick.');
    if (i > 0 && tick < log.entries[i - 1].tick)
      throw new Error('Replay file actions are not ordered by tick.');
  }
  for (let i = 0; i < log.checkpoints.length; i++) {
    const tick = log.checkpoints[i].tick;
    if (tick < log.startTick || tick > log.endTick)
      throw new Error('Replay file contains an out-of-range checkpoint tick.');
    if (i > 0 && tick <= log.checkpoints[i - 1].tick)
      throw new Error('Replay file checkpoints must be strictly increasing.');
  }
  if (log.checkpoints[0].tick !== log.startTick)
    throw new Error('Replay file is missing its initial checkpoint.');

  const initialWorld = World.fromSnapshot(log.initialSnapshot, battlefield);
  if (initialWorld.tick !== log.startTick)
    throw new Error('Replay initial snapshot tick does not match startTick.');
  const canonicalInitial = initialWorld.snapshot();
  const initialHash = await digestSnapshotSha256(canonicalInitial);
  if (initialHash !== log.checkpoints[0].sha256)
    throw new Error('Replay initial checkpoint digest does not match initialSnapshot.');

  return log;
}

export async function prepareReplayImport(
  file: File,
  battlefield: Battlefield
): Promise<PreparedReplayImport> {
  if (file.size > MAX_REPLAY_BYTES) throw new Error('Replay file is too large (maximum 16 MB).');
  const log = await parseMatchReplayLog(await file.text(), battlefield);
  const durationSeconds = Math.floor((log.endTick - log.startTick) / TICK_RATE);
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = String(durationSeconds % 60).padStart(2, '0');
  const modeLabel = log.matchMode === 'lanes' ? '5v5 match' : 'Practice';
  const championName = championProfile(log.champion).name;
  return {
    description: `${modeLabel} replay · ${championName} · ${minutes}:${seconds} (${log.entries.length} actions, ${log.checkpoints.length} checkpoints).`,
    log,
  };
}

export function downloadReplayLog(log: MatchReplayLog): void {
  const payload = JSON.stringify(log);
  const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `rift-replay-${log.battlefieldId}-tick-${log.startTick}-to-${log.endTick}.json`;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

interface ReplayKeyframe {
  tick: number;
  snapshot: string;
  cursor: number;
}

/** Deterministic command-log replay player with keyframe seeking and SHA-256 checkpoint verification. */
export class MatchReplayPlayer {
  world: World;
  playing = true;
  speed: ReplaySpeed = 1;
  verifiedCheckpoints = 1;
  divergenceError: string | null = null;
  private cursor = 0;
  private readonly checkpointByTick: ReadonlyMap<number, string>;
  private readonly keyframes: ReplayKeyframe[] = [];
  private pendingVerification: Promise<void> = Promise.resolve();

  constructor(
    readonly log: MatchReplayLog,
    private readonly battlefield: Battlefield,
    private readonly keyframeIntervalTicks = 10 * TICK_RATE
  ) {
    this.checkpointByTick = new Map(log.checkpoints.map((cp) => [cp.tick, cp.sha256]));
    this.world = World.fromSnapshot(log.initialSnapshot, battlefield);
    this.keyframes.push({
      tick: log.startTick,
      snapshot: log.initialSnapshot,
      cursor: 0,
    });
    this.applyEntriesForCurrentTick();
    if (this.world.tick === log.endTick) {
      this.playing = false;
      this.scheduleCheckpointVerification(this.world.tick, log.finalSha256, this.world.snapshot());
    }
  }

  get atEnd(): boolean {
    return this.world.tick >= this.log.endTick || this.world.winner !== null;
  }

  private applyEntriesForCurrentTick(): void {
    while (
      this.cursor < this.log.entries.length &&
      this.log.entries[this.cursor].tick === this.world.tick
    ) {
      applyReplayAction(this.world, this.log.entries[this.cursor].action);
      this.cursor++;
    }
  }

  private scheduleCheckpointVerification(
    tick: number,
    expectedSha256: string,
    snapshot: string
  ): void {
    this.pendingVerification = this.pendingVerification.then(async () => {
      if (this.divergenceError) return;
      const actual = await digestSnapshotSha256(snapshot);
      if (actual !== expectedSha256) {
        this.divergenceError = `Replay checkpoint mismatch at tick ${tick}.`;
        this.playing = false;
      } else {
        this.verifiedCheckpoints++;
      }
    });
  }

  step(count = 1): number {
    if (this.divergenceError) return 0;
    let stepped = 0;
    for (let i = 0; i < count; i++) {
      this.applyEntriesForCurrentTick();
      if (this.world.tick >= this.log.endTick || this.world.winner !== null) {
        this.playing = false;
        break;
      }
      this.world.step(1);
      stepped++;
      const expectedStepCheckpoint = this.checkpointByTick.get(this.world.tick);
      if (expectedStepCheckpoint !== undefined) {
        this.scheduleCheckpointVerification(
          this.world.tick,
          expectedStepCheckpoint,
          this.world.snapshot()
        );
      }
      if (
        this.keyframeIntervalTicks > 0 &&
        (this.world.tick - this.log.startTick) % this.keyframeIntervalTicks === 0 &&
        !this.keyframes.some((kf) => kf.tick === this.world.tick)
      ) {
        this.keyframes.push({
          tick: this.world.tick,
          snapshot: this.world.snapshot(),
          cursor: this.cursor,
        });
      }
      this.applyEntriesForCurrentTick();
      if (this.world.tick >= this.log.endTick || this.world.winner !== null) {
        this.scheduleCheckpointVerification(
          this.world.tick,
          this.log.finalSha256,
          this.world.snapshot()
        );
        this.playing = false;
      }
    }
    return stepped;
  }

  seek(targetTick: number): void {
    const clamped = Math.max(
      this.log.startTick,
      Math.min(this.log.endTick, Math.round(targetTick))
    );
    let best = this.keyframes[0];
    for (const kf of this.keyframes) {
      if (kf.tick <= clamped && kf.tick >= best.tick) best = kf;
    }
    this.world = World.fromSnapshot(best.snapshot, this.battlefield);
    this.cursor = best.cursor;
    this.divergenceError = null;
    this.applyEntriesForCurrentTick();
    if (clamped > this.world.tick) {
      this.step(clamped - this.world.tick);
    }
  }

  async verifyCompleteDeterminism(): Promise<{
    verifiedCheckpoints: number;
    finalTick: number;
    finalSha256: string;
  }> {
    this.seek(this.log.startTick);
    let verified = 1;
    while (this.world.tick < this.log.endTick && this.world.winner === null) {
      this.applyEntriesForCurrentTick();
      this.world.step(1);
      const expected = this.checkpointByTick.get(this.world.tick);
      if (expected !== undefined) {
        const actual = await digestSnapshotSha256(this.world.snapshot());
        if (actual !== expected)
          throw new Error(`Replay checkpoint mismatch at tick ${this.world.tick}.`);
        verified++;
      }
    }
    this.applyEntriesForCurrentTick();
    const finalSnapshot = this.world.snapshot();
    const finalSha256 = await digestSnapshotSha256(finalSnapshot);
    if (finalSha256 !== this.log.finalSha256)
      throw new Error(`Replay final checkpoint mismatch at tick ${this.world.tick}.`);
    if (this.divergenceError) throw new Error(this.divergenceError);
    return {
      verifiedCheckpoints: verified,
      finalTick: this.world.tick,
      finalSha256,
    };
  }

  async flushVerifications(): Promise<void> {
    await this.pendingVerification;
    if (this.divergenceError) throw new Error(this.divergenceError);
  }
}
