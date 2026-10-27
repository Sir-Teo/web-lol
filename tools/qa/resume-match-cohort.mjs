/** Linux recovery for an interrupted immutable match cohort. */
import { spawn } from 'node:child_process';
import {
  mkdirSync,
  openSync,
  closeSync,
  existsSync,
  readFileSync,
  writeFileSync,
  lstatSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { setTimeout as pause } from 'node:timers/promises';
import { inspectResume } from './lib/cohort-resume.mjs';

try {
  const { values } = parseArgs({
    options: {
      output: { type: 'string' },
      project: { type: 'string', default: process.cwd() },
      check: { type: 'boolean', default: false },
    },
  });
  if (!values.output)
    throw new Error(
      'Pass --output COHORT_ROOT and --project ORIGINAL_CHECKOUT; --check is read-only.'
    );
  if (process.platform !== 'linux')
    throw Object.assign(new Error('Recovery requires Linux /proc and util-linux flock.'), {
      code: 'COHORT_LOCK_UNSUPPORTED',
    });
  const inspected = inspectResume({ output: values.output, project: values.project });
  if (values.check)
    console.log(
      JSON.stringify({
        result: 'ready',
        readOnly: true,
        root: inspected.root,
        completedRetained: inspected.completed.length,
        interrupted: inspected.attempts.map((r) => r.seed),
        pending: inspected.pending,
      })
    );
  else {
    const root = inspected.root,
      lock = resolve(root, '.resume.lock');
    if (existsSync(lock) && (!lstatSync(lock).isFile() || lstatSync(lock).isSymbolicLink()))
      throw new Error('Recovery lock is not a regular file.');
    const id = new Date().toISOString().replace(/[^a-z0-9]/gi, '-') + '-' + randomUUID(),
      request = resolve(root, 'recovery/requests', id);
    mkdirSync(request, { recursive: true });
    const ready = request + '/ready.json',
      log = request + '/supervisor.log',
      fd = openSync(log, 'wx');
    const driver = fileURLToPath(new URL('./lib/cohort-resume-driver.mjs', import.meta.url));
    const child = spawn(
      'flock',
      [
        '--nonblock',
        '--conflict-exit-code',
        '73',
        '--close',
        lock,
        process.execPath,
        driver,
        '--output',
        root,
        '--project',
        inspected.project,
        '--recovery-id',
        id,
        '--ready',
        ready,
      ],
      { detached: true, stdio: ['ignore', fd, fd] }
    );
    closeSync(fd);
    let ended = false,
      exitCode,
      spawnError;
    child.on('error', (error) => {
      spawnError = error;
      ended = true;
    });
    child.on('exit', (code) => {
      exitCode = code;
      ended = true;
    });
    child.unref();
    const deadline = Date.now() + 30000;
    while (!existsSync(ready) && !ended && Date.now() < deadline) await pause(50);
    if (!existsSync(ready)) {
      const message =
        spawnError?.message ??
        (exitCode === 73
          ? 'Another recovery holds the exclusive cohort lock.'
          : `Recovery did not confirm startup; inspect ${log}`);
      writeFileSync(
        request + '/startup-failure.json',
        JSON.stringify({ exitCode, message, log, supervisorMayStillBeStarting: !ended }, null, 2) +
          '\n'
      );
      throw Object.assign(new Error(message), {
        code: exitCode === 73 ? 'COHORT_LOCKED' : 'COHORT_STARTUP_FAILED',
      });
    }
    const launch = JSON.parse(readFileSync(ready, 'utf8'));
    console.log(
      JSON.stringify({
        result: 'started',
        ...launch,
        launcherPid: child.pid,
        log,
        detachedSession: true,
      })
    );
  }
} catch (error) {
  console.error(
    JSON.stringify({
      result: 'refused',
      code: error.code ?? 'COHORT_RECOVERY_ERROR',
      message: error.message,
    })
  );
  process.exitCode = 1;
}
