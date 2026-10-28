interface CheckpointStorage {
  snapshot: () => string;
  recovery: (snapshot: string) => Promise<void>;
  manual: (snapshot: string | null) => Promise<void>;
  failed: (error: unknown) => void;
}

/** One in-flight backup; manual writes wait for it and retire it in the same storage transaction. */
export class RecoveryCheckpoints {
  private pending: Promise<void> = Promise.resolve();
  private backupPending = false;
  private manualPending = 0;
  private warned = false;
  private attemptedTick: number;
  private lastSnapshot: string | undefined;
  private transitions = 0;

  constructor(
    tick: number,
    private interval: number,
    private storage: CheckpointStorage,
    initialSnapshot?: string
  ) {
    this.attemptedTick = tick;
    this.lastSnapshot = initialSnapshot;
  }

  checkpoint(tick: number, force = false): void {
    if (
      this.backupPending ||
      this.manualPending ||
      this.transitions ||
      tick < this.attemptedTick ||
      (!force && tick - this.attemptedTick < this.interval)
    )
      return;
    this.attemptedTick = tick;
    let snapshot: string;
    try {
      snapshot = this.storage.snapshot();
    } catch (error) {
      this.warn(error);
      return;
    }
    // A paused command can change the snapshot without advancing the match clock.
    if (force && snapshot === this.lastSnapshot) return;
    this.backupPending = true;
    this.pending = this.pending
      .then(() => this.storage.recovery(snapshot))
      .then(() => {
        this.warned = false;
        this.lastSnapshot = snapshot;
      })
      .catch((error) => this.warn(error))
      .finally(() => {
        this.backupPending = false;
      });
  }

  save(snapshot: string | null, tick: number): Promise<void> {
    this.manualPending++;
    const result = this.pending
      .then(() => this.storage.manual(snapshot))
      .then(() => {
        this.attemptedTick = tick;
        this.lastSnapshot = snapshot ?? undefined;
      })
      .finally(() => {
        this.manualPending--;
      });
    // A failed manual write is still reported to its caller, but cannot poison later writes.
    this.pending = result.catch(() => {});
    return result;
  }

  /** A successful replacement is followed by reload; never back up its outgoing world again. */
  replace(snapshot: string | null, tick: number): Promise<void> {
    this.transitions++;
    return this.save(snapshot, tick).catch((error) => {
      this.transitions--;
      throw error;
    });
  }

  private warn(error: unknown): void {
    if (this.warned) return;
    this.warned = true;
    this.storage.failed(error);
  }
}
