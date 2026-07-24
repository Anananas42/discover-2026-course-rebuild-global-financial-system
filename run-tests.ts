// Runs the test suite (`pnpm test`). A scenario that fails only because
// its task is not implemented yet does not fail the run — until you build
// the task, that outcome is expected. Any other failure fails as usual.
// Extra arguments pass through to vitest: `pnpm test packages/warmup`.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const ROOT = import.meta.dirname;
// The documented message of NotImplementedError (see
// packages/central-bank/src/bank-errors.ts) — the marker separating
// "not built yet" from a real failure.
const NOT_IMPLEMENTED = /Task \S+ is not implemented\./;

/** The relevant subset of vitest's JSON reporter output. */
interface VitestReport {
  testResults?: {
    status?: string;
    assertionResults?: {
      status: string;
      failureMessages?: string[];
    }[];
  }[];
}

const reportFile = path.join(os.tmpdir(), `vitest-report-${process.pid}.json`);
const vitest = spawnSync(
  process.execPath,
  [
    path.join(ROOT, 'node_modules/vitest/vitest.mjs'),
    'run',
    '--reporter=default',
    '--reporter=json',
    `--outputFile.json=${reportFile}`,
    ...process.argv.slice(2),
  ],
  { cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit'] }
);
if (vitest.status === 0) process.exit(0);
if (!existsSync(reportFile)) process.exit(vitest.status ?? 1);

const report = JSON.parse(await readFile(reportFile, 'utf8')) as VitestReport;
await rm(reportFile, { force: true });

let unimplemented = 0;
let realFailures = 0;
for (const file of report.testResults ?? []) {
  const failed = (file.assertionResults ?? []).filter(
    test => test.status === 'failed'
  );
  // A file that failed without a single failed scenario broke before its
  // tests could run (a crash while loading, for example) — a real failure.
  if (file.status === 'failed' && failed.length === 0) realFailures++;
  for (const test of failed) {
    const messages = test.failureMessages ?? [];
    if (messages.length > 0 && messages.every(m => NOT_IMPLEMENTED.test(m))) {
      unimplemented++;
    } else {
      realFailures++;
    }
  }
}

if (unimplemented > 0) {
  console.log(
    `\n${unimplemented} scenario(s) fail only because their task is not ` +
      'implemented yet — not counted as failures.'
  );
}
process.exit(
  realFailures > 0 || unimplemented === 0 ? (vitest.status ?? 1) : 0
);
