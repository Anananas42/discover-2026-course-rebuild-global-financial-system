// Entry point behind `pnpm start`: stops a previously running instance,
// makes sure the database container is up, runs the guide server, the financial system
// API (both in watch mode), and the financial system frontend (Vite dev server with hot
// reload), and opens the guide in the browser.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';

import { COURSE_DEFAULTS } from '../shared/course-config.ts';
import { PORTS } from '../shared/ports.ts';

const URL = `http://localhost:${process.env.PORT ?? PORTS.guide}`;
const APPS = path.resolve(import.meta.dirname, '..');
const ROOT = path.resolve(APPS, '..');
const PIDS_FILE = path.join(ROOT, '.start.pids');
const COURSE_FILE = path.join(ROOT, 'course.json');
const WATCHED_PORTS = [
  PORTS.guide,
  PORTS.guideApi,
  PORTS.financialSystem,
  PORTS.financialSystemApi,
];

// Running `pnpm start` twice should just work: take over instead of
// failing on ports already in use. The pidfile covers a previous
// `pnpm start`; the port takeover covers everything else — a server
// started by hand, an orphaned process — because the ports are fixed and
// owned by this project (see ../shared/ports.ts).
killRecordedPids();
await takeOverPorts(WATCHED_PORTS);

function killRecordedPids(): void {
  if (!existsSync(PIDS_FILE)) return;
  try {
    const pids = JSON.parse(readFileSync(PIDS_FILE, 'utf8')) as number[];
    for (const pid of pids) {
      try {
        process.kill(pid);
      } catch {
        // Already gone.
      }
    }
  } catch {
    // Unreadable pidfile — ignore.
  }
}

/** Pids listening on a local TCP port: lsof on unix, netstat on Windows. */
function pidsOnPort(port: number): number[] {
  const listing =
    process.platform === 'win32'
      ? spawnSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8' })
      : spawnSync('lsof', ['-t', `-iTCP:${port}`, '-sTCP:LISTEN'], {
          encoding: 'utf8',
        });
  if (!listing.stdout) return [];
  const lines = listing.stdout.split('\n');
  const pids =
    process.platform === 'win32'
      ? lines
          .filter(
            line => line.includes(`:${port} `) && line.includes('LISTENING')
          )
          .map(line => Number(line.trim().split(/\s+/).at(-1)))
      : lines.map(Number);
  return [...new Set(pids.filter(pid => Number.isInteger(pid) && pid > 0))];
}

/**
 * Frees the fixed ports whatever holds them: terminate the holders, wait,
 * and force-kill stragglers. Never touches this process itself.
 */
async function takeOverPorts(ports: number[]): Promise<void> {
  for (const signal of ['SIGTERM', 'SIGKILL'] as const) {
    let anyOccupied = false;
    for (const port of ports) {
      if (await portFree(port)) continue;
      anyOccupied = true;
      for (const pid of pidsOnPort(port)) {
        if (pid === process.pid) continue;
        console.log(`Port ${port} is held by process ${pid} — taking it over.`);
        try {
          process.kill(pid, signal);
        } catch {
          // Already gone.
        }
      }
    }
    if (!anyOccupied) return;
    if (await waitForPortsFree(ports, 4000)) return;
  }
  console.error(
    `Ports ${ports.join(', ')} are still in use — another instance may be running.`
  );
}

function portFree(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.listen({ port, host: '127.0.0.1' }, () =>
      probe.close(() => resolve(true))
    );
  });
}

async function waitForPortsFree(
  ports: number[],
  timeoutMs: number
): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const status = await Promise.all(ports.map(portFree));
    if (status.every(Boolean)) return true;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  return false;
}

// Bring the installed libraries up to date — after pulling a course
// update, new or changed dependencies must land before the servers
// start. A quick no-op when nothing changed. pnpm is on PATH (this
// process was started through it); Windows needs a shell because pnpm
// is a .cmd shim there.
console.log('Installing the libraries: pnpm install');
const install = spawnSync('pnpm', ['install'], {
  cwd: ROOT,
  stdio: ['ignore', 'inherit', 'inherit'],
  shell: process.platform === 'win32',
});
if (install.status !== 0) {
  console.error(
    'Could not install the libraries — continuing with what is already ' +
      'there. If something fails to start, run: pnpm install'
  );
}

// Announce before the blocking call and inherit docker's own output:
// if this step is slow or stuck (daemon not running, first-time image
// pull), the user must see where and why — never a silent wait.
console.log('Starting the database: docker compose up -d --wait');
const compose = spawnSync('docker', ['compose', 'up', '-d', '--wait'], {
  cwd: ROOT,
  stdio: ['ignore', 'inherit', 'inherit'],
  timeout: 120_000,
});
if (
  compose.error &&
  'code' in compose.error &&
  compose.error.code === 'ENOENT'
) {
  console.error(
    'Docker is not installed (the `docker` command was not found).'
  );
} else if (compose.signal) {
  console.error('Giving up on the database after 120 s (docker compose hung).');
} else if (compose.status !== 0) {
  console.error('Could not start the database (is Docker running?).');
}
if (compose.status !== 0) {
  console.error(
    'Continuing without the database — anything that needs it will fail ' +
      'until you start it: docker compose up -d'
  );
}

// The financial system also watches course.json: currency and country
// are loaded once at server start (chosen once, by design), so an
// identity change saved in the guide must restart it to apply. The file
// has to exist before the watcher starts — it cannot watch a missing
// path — hence the defaults written above on first run.
if (!existsSync(COURSE_FILE)) {
  writeFileSync(COURSE_FILE, `${JSON.stringify(COURSE_DEFAULTS, null, 2)}\n`);
}

// Plain `--watch` proved to restart only on the entry file here — it does
// not follow the imported module graph with natively-run TypeScript — so
// each server watches its source directories explicitly. The financial
// system server watching `packages/` is the course's core feedback loop:
// a student saves domain code, the API reloads it.
const servers = [
  {
    args: [
      `--watch-path=${path.join(APPS, 'guide')}`,
      `--watch-path=${path.join(APPS, 'shared')}`,
      path.join(APPS, 'guide', 'server.ts'),
    ],
    cwd: ROOT,
  },
  {
    args: [
      `--watch-path=${path.join(ROOT, 'packages')}`,
      `--watch-path=${path.join(APPS, 'financial-system')}`,
      `--watch-path=${path.join(APPS, 'shared')}`,
      `--watch-path=${COURSE_FILE}`,
      path.join(APPS, 'financial-system', 'server.ts'),
    ],
    cwd: ROOT,
  },
  ...['guide', 'financial-system'].map(app => ({
    args: [path.join(APPS, app, 'node_modules', 'vite', 'bin', 'vite.js')],
    cwd: path.join(APPS, app),
  })),
].map(({ args, cwd }) =>
  spawn(process.execPath, args, { cwd, stdio: 'inherit' })
);

writeFileSync(
  PIDS_FILE,
  JSON.stringify(
    [process.pid, ...servers.map(server => server.pid)].filter(
      (pid): pid is number => typeof pid === 'number'
    )
  )
);

setTimeout(() => {
  const [cmd, args]: [string, string[]] =
    process.platform === 'darwin'
      ? ['open', [URL]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', URL]]
        : ['xdg-open', [URL]];
  spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
}, 800);

// One teardown path for every way this process ends. Crucially this
// includes being killed by the next `pnpm start` (killRecordedPids sends
// SIGTERM): without a signal handler, this process would die and orphan
// its children — the watch servers are supervisors that respawn whatever
// takeOverPorts kills, so orphaned generations pile up, fight over the
// fixed ports, and serve the browser a stale bundle (dead theme toggle,
// unstyled page). Reaping the children here is what breaks that cycle.
let shuttingDown = false;
function shutdown(code: number): void {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const server of servers) server.kill();
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
for (const server of servers) {
  server.on('exit', code => shutdown(code ?? 0));
}
