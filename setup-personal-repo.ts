// Puts the project under your own GitHub account
// (`pnpm setup-personal-repo <name>`): creates a private repository named
// <name> there, makes it this folder's `origin`, and keeps the course
// repository connected as `upstream` — where course updates come from
// (`git pull upstream main`). Safe to run again with the same name: it
// picks up where an earlier run stopped.

import { execFileSync, spawnSync } from 'node:child_process';
import process from 'node:process';
import { parseArgs } from 'node:util';

const ROOT = import.meta.dirname;
const COURSE_REPO =
  'Anananas42/discover-2026-course-rebuild-global-financial-system';

const USAGE =
  'Pass a name for your repository — letters, digits, dots, dashes:\n' +
  '  pnpm setup-personal-repo --name <name>\n' +
  'For example: pnpm setup-personal-repo --name my-financial-system';

let REPO_NAME: string | undefined;
try {
  REPO_NAME = parseArgs({ options: { name: { type: 'string' } } }).values.name;
} catch {
  fail(USAGE);
}
if (REPO_NAME === undefined || !/^[A-Za-z0-9._-]+$/.test(REPO_NAME)) {
  fail(USAGE);
}

const isCourseRepo = (url: string | null): boolean =>
  url !== null && url.includes(COURSE_REPO);

// 1. The GitHub CLI must be installed, and you must be signed in — the
// login flow runs once and opens the browser.
if (capture('gh', ['--version']) === null) {
  fail(
    'The GitHub CLI is not installed — see the README, section 1, GitHub CLI.'
  );
}
if (capture('gh', ['auth', 'status', '--hostname', 'github.com']) === null) {
  console.log('Signing in to GitHub — follow the prompts:');
  run('gh', [
    'auth',
    'login',
    '--hostname',
    'github.com',
    '--git-protocol',
    'ssh',
    '--web',
  ]);
}

// 2. Sort the remotes out. A fresh clone has the course repository as
// `origin`; it becomes `upstream`, freeing `origin` for your own copy.
const origin = capture('git', ['remote', 'get-url', 'origin']);
const upstream = capture('git', ['remote', 'get-url', 'upstream']);
if (upstream === null) {
  if (!isCourseRepo(origin)) {
    fail('This folder is not a clone of the course repository.');
  }
  run('git', ['remote', 'rename', 'origin', 'upstream']);
} else {
  if (!isCourseRepo(upstream)) {
    fail(
      `The upstream remote points to ${upstream} instead of the course ` +
        'repository. Remove it (git remote remove upstream) and run ' +
        'pnpm setup-personal-repo again.'
    );
  }
  if (origin !== null && !isCourseRepo(origin)) {
    console.log(`Already connected — your repository: ${origin}`);
    process.exit(0);
  }
  // A duplicate of upstream — drop it and reconnect below.
  if (origin !== null) run('git', ['remote', 'remove', 'origin']);
}

// 3. Create your private repository and push. If it already exists from
// an earlier run, just reconnect to it.
const login = capture('gh', ['api', 'user', '--jq', '.login']);
if (login === null) fail('Could not read your GitHub username (gh api user).');
if (`${login}/${REPO_NAME}` === COURSE_REPO) {
  fail(
    'This GitHub account owns the course repository itself — connecting would point origin back at it.'
  );
}
const exists =
  capture('gh', ['repo', 'view', `${login}/${REPO_NAME}`, '--json', 'name']) !==
  null;
if (exists) {
  run('git', [
    'remote',
    'add',
    'origin',
    `git@github.com:${login}/${REPO_NAME}.git`,
  ]);
  run('git', ['push', '-u', 'origin', 'main']);
} else {
  run('gh', [
    'repo',
    'create',
    REPO_NAME,
    '--private',
    '--source=.',
    '--remote=origin',
    '--push',
  ]);
}

console.log(
  `\nDone — the project now lives in your GitHub account, visible only ` +
    `to you: https://github.com/${login}/${REPO_NAME}`
);

/** Run a command visibly; a failure ends the script with its exit code. */
function run(cmd: string, args: string[]): void {
  const result = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

/** A command's trimmed stdout, or null if it is missing or fails. */
function capture(cmd: string, args: string[]): string | null {
  try {
    return execFileSync(cmd, args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
