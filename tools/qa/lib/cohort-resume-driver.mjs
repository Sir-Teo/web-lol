/** Internal driver: flock stays held while the canonical supervisor runs. */
import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { writeFileSync } from 'node:fs';
import { prepareRecovery } from './cohort-resume.mjs';

try {
  const { values } = parseArgs({
    options: {
      output: { type: 'string' },
      project: { type: 'string' },
      'recovery-id': { type: 'string' },
      ready: { type: 'string' },
    },
  });
  const prepared = prepareRecovery({
    output: values.output,
    project: values.project,
    recoveryId: values['recovery-id'],
    readyFile: values.ready,
  });
  const child = spawn(process.execPath, [prepared.controller, '--output', prepared.root], {
    cwd: prepared.project,
    stdio: 'inherit',
  });
  const outcome = await new Promise((yes, no) => {
    child.once('error', no);
    child.once('close', (code, signal) => yes({ code, signal }));
  });
  writeFileSync(
    prepared.recovery + '/supervisor-exit.json',
    JSON.stringify(outcome, null, 2) + '\n'
  );
  if (outcome.code !== 0) process.exitCode = 1;
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
