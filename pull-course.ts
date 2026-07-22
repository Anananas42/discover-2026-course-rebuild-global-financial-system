// Pulls the latest course update (`pnpm pull-course`): merges what the
// course repository published into your copy, whatever your remotes are
// named. Commit your work first — the README's update section shows the
// full sequence.

import { execFileSync, spawnSync } from 'node:child_process';
import process from 'node:process';

const ROOT = import.meta.dirname;
const COURSE_REPO =
  'Anananas42/discover-2026-course-rebuild-global-financial-system';

// After `pnpm setup-personal-repo` the course repository is `upstream`;
// in a plain clone it is still `origin`.
const remote = ['upstream', 'origin'].find(name =>
  capture('git', ['remote', 'get-url', name])?.includes(COURSE_REPO)
);
if (remote === undefined) {
  fail('No remote points at the course repository — nothing to pull from.');
}

if (capture('git', ['status', '--porcelain']) !== '') {
  fail(
    'You have unsaved work — save it first, then pull again:\n' +
      '  git add -A\n' +
      '  git commit -m "my progress"'
  );
}

// --no-rebase: merge, explicitly — a first divergent pull would
// otherwise stop and ask how to reconcile.
const pull = spawnSync('git', ['pull', '--no-rebase', remote, 'main'], {
  cwd: ROOT,
  stdio: 'inherit',
});
if (pull.status !== 0) {
  fail(
    '\nThe update did not merge cleanly. If Git printed CONFLICT, the ' +
      'same lines were edited on both sides — bring it to class to ' +
      'resolve together in a minute.'
  );
}
console.log('\nCourse update merged.');

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
