import { expect, test, vi } from 'vitest';
import { RecoveryCheckpoints } from '../src/storage/recovery-checkpoints';

function fixture() {
  const storage = {
    snapshot: vi.fn(() => 'state'),
    recovery: vi.fn(async (_snapshot: string) => {}),
    manual: vi.fn(async (_snapshot: string | null) => {}),
    failed: vi.fn(),
  };
  return { storage, checkpoints: new RecoveryCheckpoints(100, 1800, storage) };
}
const drain = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

test('backs up after thirty match seconds without touching the manual slot', async () => {
  const { storage, checkpoints } = fixture();
  checkpoints.checkpoint(1899);
  expect(storage.snapshot).not.toHaveBeenCalled();
  checkpoints.checkpoint(1900);
  await drain();
  expect(storage.recovery).toHaveBeenCalledExactlyOnceWith('state');
  expect(storage.manual).not.toHaveBeenCalled();
  checkpoints.checkpoint(1900, true);
  await drain();
  expect(storage.recovery).toHaveBeenCalledTimes(1);
});

test('interruption captures new progress before the periodic interval', async () => {
  const { storage, checkpoints } = fixture();
  checkpoints.checkpoint(101, true);
  await drain();
  expect(storage.recovery).toHaveBeenCalledExactlyOnceWith('state');
  checkpoints.checkpoint(100, true);
  checkpoints.checkpoint(101, true);
  await drain();
  expect(storage.recovery).toHaveBeenCalledTimes(1);
});

test('a slow backup cannot accumulate queued snapshots', async () => {
  const { storage, checkpoints } = fixture();
  let finish!: () => void;
  storage.recovery.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
  checkpoints.checkpoint(1900);
  await drain();
  for (let tick = 2000; tick < 10000; tick++) checkpoints.checkpoint(tick, true);
  expect(storage.snapshot).toHaveBeenCalledTimes(1);
  finish();
  await drain();
  checkpoints.checkpoint(10000);
  await drain();
  expect(storage.recovery).toHaveBeenCalledTimes(2);
  finish();
  await drain();
});

test('a manual replacement waits for the backup and suppresses later automatic writes', async () => {
  const { storage, checkpoints } = fixture(),
    order: string[] = [];
  let finishBackup!: () => void, finishManual!: () => void;
  storage.recovery.mockImplementation(async () => {
    order.push('backup');
    await new Promise<void>((resolve) => (finishBackup = resolve));
    order.push('backup-finished');
  });
  storage.manual.mockImplementation(async (snapshot) => {
    order.push(`manual:${snapshot}`);
    await new Promise<void>((resolve) => (finishManual = resolve));
  });
  checkpoints.checkpoint(1900);
  await drain();
  storage.snapshot.mockReturnValue('replacement');
  const saved = checkpoints.save('replacement', 2000);
  checkpoints.checkpoint(5000, true);
  expect(order).toEqual(['backup']);
  finishBackup();
  await drain();
  expect(order).toEqual(['backup', 'backup-finished', 'manual:replacement']);
  checkpoints.checkpoint(6000, true);
  expect(storage.snapshot).toHaveBeenCalledTimes(1);
  finishManual();
  await saved;
  checkpoints.checkpoint(2000, true);
  await drain();
  expect(storage.recovery).toHaveBeenCalledTimes(1);
});

test('backup failures are contained, rate-limited and recover without blocking manual saves', async () => {
  const { storage, checkpoints } = fixture(),
    quota = new Error('quota');
  storage.recovery.mockRejectedValue(quota);
  for (const tick of [1900, 3700, 5500]) {
    checkpoints.checkpoint(tick);
    await drain();
  }
  expect(storage.failed).toHaveBeenCalledExactlyOnceWith(quota);
  await checkpoints.save('manual', 5500);
  expect(storage.manual).toHaveBeenCalledWith('manual');
  storage.recovery.mockResolvedValue(undefined);
  checkpoints.checkpoint(7300);
  await drain();
  storage.recovery.mockRejectedValue(quota);
  checkpoints.checkpoint(9100);
  await drain();
  expect(storage.failed).toHaveBeenCalledTimes(2);
});

test('a snapshot failure leaves both slots untouched and retries later', async () => {
  const { storage, checkpoints } = fixture();
  storage.snapshot.mockImplementationOnce(() => {
    throw new Error('cannot serialize');
  });
  checkpoints.checkpoint(1900);
  expect(storage.failed).toHaveBeenCalledTimes(1);
  expect(storage.recovery).not.toHaveBeenCalled();
  expect(storage.manual).not.toHaveBeenCalled();
  checkpoints.checkpoint(3700);
  await drain();
  expect(storage.recovery).toHaveBeenCalledExactlyOnceWith('state');
});

test('failed manual writes reject to their caller and permit a later save', async () => {
  const { storage, checkpoints } = fixture();
  storage.manual.mockRejectedValueOnce(new Error('manual quota'));
  await expect(checkpoints.save('first', 1900)).rejects.toThrow('manual quota');
  await checkpoints.save('second', 2000);
  checkpoints.checkpoint(3800);
  await drain();
  expect(storage.recovery).toHaveBeenCalledExactlyOnceWith('state');
  expect(storage.manual.mock.calls).toEqual([['first'], ['second']]);
});

test('concurrent manual save and restart requests retain their request order', async () => {
  const { storage, checkpoints } = fixture();
  await Promise.all([checkpoints.save('saved', 2000), checkpoints.save(null, 2000)]);
  expect(storage.manual.mock.calls).toEqual([['saved'], [null]]);
});

test('a newly accepted command at the same tick survives an interruption checkpoint', async () => {
  const { storage, checkpoints } = fixture();
  checkpoints.checkpoint(101, true);
  await drain();
  storage.snapshot.mockReturnValue('same-tick-command');
  checkpoints.checkpoint(101, true);
  await drain();
  checkpoints.checkpoint(101, true);
  await drain();
  expect(storage.recovery.mock.calls).toEqual([['state'], ['same-tick-command']]);
});

test('initial paused paints preserve the existing backup until the current world changes', async () => {
  const { storage } = fixture(),
    checkpoints = new RecoveryCheckpoints(100, 1800, storage, 'state');
  checkpoints.checkpoint(100, true);
  await drain();
  expect(storage.recovery).not.toHaveBeenCalled();
  storage.snapshot.mockReturnValue('accepted-command');
  checkpoints.checkpoint(100, true);
  await drain();
  expect(storage.recovery).toHaveBeenCalledExactlyOnceWith('accepted-command');
});

test('a successful replacement suppresses outgoing backups until reload', async () => {
  const { storage, checkpoints } = fixture();
  await checkpoints.replace('new-match', 100);
  checkpoints.checkpoint(101, true);
  checkpoints.checkpoint(5000);
  await drain();
  expect(storage.manual).toHaveBeenCalledExactlyOnceWith('new-match');
  expect(storage.recovery).not.toHaveBeenCalled();
});

test('a failed replacement leaves the current world eligible for recovery', async () => {
  const { storage, checkpoints } = fixture();
  storage.manual.mockRejectedValueOnce(new Error('quota'));
  await expect(checkpoints.replace('new-match', 100)).rejects.toThrow('quota');
  checkpoints.checkpoint(101, true);
  await drain();
  expect(storage.recovery).toHaveBeenCalledExactlyOnceWith('state');
});
