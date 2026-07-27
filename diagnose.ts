// One-paste diagnosis of a broken installation (`pnpm diagnose`): prints
// the environment, the repository state, what the task scan sees on this
// machine, and what the running servers answer. Read-only — it changes
// nothing and starts nothing; run it while `pnpm start` is up and send
// the whole output to the teacher.

import { spawnSync } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { ALL_TASK_IDS } from './apps/shared/curriculum.ts';
import { PORTS } from './apps/shared/ports.ts';
import { readTaskRegions } from './apps/shared/task-markers.ts';
import { tsSources } from './apps/shared/ts-sources.ts';

const ROOT = import.meta.dirname;
const PACKAGES = path.join(ROOT, 'packages');
const MARKER = /^\s*\/\/ TASK ([^\s:]+):/gm;

await section('environment', () => {
  console.log(`node ${process.version} on ${process.platform} ${os.release()}`);
  console.log(`repo: ${ROOT}`);
  // OneDrive keeps synced files as reparse-point placeholders, which
  // several Windows bugs trace back to — flag any sign of it.
  const oneDriveEnv = Object.entries(process.env).filter(([key]) =>
    key.toLowerCase().includes('onedrive')
  );
  const inOneDrive =
    ROOT.toLowerCase().includes('onedrive') ||
    oneDriveEnv.some(([, value]) => !!value && ROOT.startsWith(value));
  console.log(
    `onedrive env: ${
      oneDriveEnv.map(([key, value]) => `${key}=${value ?? ''}`).join(', ') ||
      '(none)'
    }`
  );
  console.log(`repo under OneDrive: ${inOneDrive ? 'YES' : 'no'}`);
});

await section('git', () => {
  const log = spawnSync('git', ['log', '--oneline', '-3'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  console.log(log.stdout?.trim() || `git failed: ${log.stderr?.trim()}`);
});

await section('raw directory listing of packages/', async () => {
  // The pre-fix scans trusted these entry types; the counts show what
  // this machine's filesystem reports them as.
  const entries = await readdir(PACKAGES, {
    recursive: true,
    withFileTypes: true,
  });
  const ts = entries.filter(
    e => e.name.endsWith('.ts') && !e.parentPath.includes('node_modules')
  );
  console.log(
    `entries: ${entries.length}, .ts outside node_modules: ${ts.length}, ` +
      `of those isFile: ${ts.filter(e => e.isFile()).length}, ` +
      `isSymbolicLink: ${ts.filter(e => e.isSymbolicLink()).length}, ` +
      `isDirectory: ${ts.filter(e => e.isDirectory()).length}`
  );
});

await section('task regions (what the guide server sees)', async () => {
  const { regions, faults } = await readTaskRegions(ROOT);
  console.log(`regions: ${regions.length} of ${ALL_TASK_IDS.length} expected`);
  for (const fault of faults) {
    console.log(`FAULT ${fault.id}: ${fault.reason} (${fault.file})`);
  }
  if (faults.length === 0) console.log('no faults');
});

await section('full-tree walk cross-check', async () => {
  const files = await tsSources(PACKAGES);
  const found = new Set<string>();
  for (const file of files) {
    if (file.endsWith('.test.ts')) continue;
    for (const match of (await readFile(file, 'utf8')).matchAll(MARKER)) {
      if (match[1]) found.add(match[1]);
    }
  }
  const missing = ALL_TASK_IDS.filter(id => !found.has(id));
  console.log(`.ts files walked: ${files.length}, marker ids: ${found.size}`);
  console.log(
    missing.length === 0
      ? 'all expected markers present'
      : `MISSING markers: ${missing.join(', ')}`
  );
});

await section('sample marker file', async () => {
  const sample = path.join(PACKAGES, 'warmup', 'src', 'warmup-exercises.ts');
  const rel = path.relative(ROOT, sample);
  const info = await stat(sample);
  const source = await readFile(sample, 'utf8');
  console.log(
    `${rel}: ${info.size} bytes, ` +
      `BOM: ${source.charCodeAt(0) === 0xfeff ? 'YES' : 'no'}, ` +
      `line endings: ${source.includes('\r\n') ? 'CRLF' : 'LF'}, ` +
      `markers: ${[...source.matchAll(MARKER)].length}`
  );
});

await section('servers', async () => {
  const probes = [
    ['guide page (proxy)', `http://localhost:${PORTS.guide}/api/state`],
    ['guide API (direct)', `http://localhost:${PORTS.guideApi}/api/state`],
  ] as const;
  for (const [label, url] of probes) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
      const body = await response.text();
      let note = `status ${response.status}, ${body.length} bytes`;
      const state: unknown = JSON.parse(body);
      if (
        typeof state === 'object' &&
        state !== null &&
        'tasks' in state &&
        Array.isArray(state.tasks)
      ) {
        const ids = state.tasks
          .map(task => (task as { id?: string }).id ?? '?')
          .join(' ');
        note += `, tasks: ${state.tasks.length} [${ids}]`;
      }
      console.log(`${label}: ${note}`);
    } catch (error) {
      console.log(`${label}: unreachable (${describe(error)})`);
    }
  }
});

await section('who holds the ports', () => {
  // Raw listing on purpose — on Windows it also reveals the system
  // language netstat prints its states in, which the port takeover in
  // apps/guide/start.ts depends on.
  const listing =
    process.platform === 'win32'
      ? spawnSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8' })
      : spawnSync('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN'], {
          encoding: 'utf8',
        });
  const lines = (listing.stdout ?? '').split('\n');
  for (const port of [PORTS.guide, PORTS.guideApi, PORTS.db]) {
    const matching = lines.filter(line => line.includes(`:${port} `));
    console.log(
      matching.length > 0
        ? matching.map(line => line.trim()).join('\n')
        : `port ${port}: nothing listening`
    );
  }
});

async function section(
  title: string,
  run: () => void | Promise<void>
): Promise<void> {
  console.log(`\n== ${title}`);
  try {
    await run();
  } catch (error) {
    console.log(`failed: ${describe(error)}`);
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
