// Submits your code for evaluation.
// 1. Put your name in course.json ("student") — once.
// 2. Run `pnpm submit`.
// One-off overrides: `pnpm submit --name Adam --country Kometia`.
// The code is sent to the course server, which runs the full test suite —
// including hidden scenarios stricter than the local `pnpm test` — and
// reports which scenarios fail. Hidden test code is not disclosed; your own
// test files are not submitted.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';

import { readCourseConfig } from './apps/shared/course-config.ts';
import type {
  SubmissionRequest,
  SubmissionResponse,
} from './apps/shared/submission.ts';

const ROOT = import.meta.dirname;

const { values: args } = parseArgs({
  options: {
    name: { type: 'string' },
    country: { type: 'string' },
  },
});

const config = readCourseConfig(ROOT);
const student = (args.name ?? process.env.STUDENT ?? config.student).trim();
const country = (args.country ?? process.env.COUNTRY ?? config.country).trim();
const currency = config.currency.trim();
if (!student) {
  console.error(
    'Missing name. Fill in your name at the top of the guide first.'
  );
  process.exit(1);
}
// Tolerate a trailing slash in the address — `${dashboard}/api/submit`
// with a double slash misses the dev server's /api proxy prefix.
const dashboard = config.dashboard.trim().replace(/\/+$/, '');
if (!dashboard) {
  console.error(
    'Missing course server address. Ask the teacher for it and fill it in at the top of the guide.'
  );
  process.exit(1);
}

// Collect implementation sources. Test files stay local.
const files: Record<string, string> = {};
const packagesDir = path.join(ROOT, 'packages');
const entries = await readdir(packagesDir, {
  recursive: true,
  withFileTypes: true,
});
for (const entry of entries) {
  if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;
  if (entry.name.endsWith('.test.ts')) continue;
  if (entry.parentPath.includes('node_modules')) continue;
  const abs = path.join(entry.parentPath, entry.name);
  const rel = path.relative(ROOT, abs).replaceAll(path.sep, '/');
  files[rel] = await readFile(abs, 'utf8');
}

console.log(`Submitting ${Object.keys(files).length} files as: ${student}`);

const request: SubmissionRequest = { student, country, currency, files };
let response: SubmissionResponse;
try {
  const res = await fetch(`${dashboard}/api/submit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`server responded with ${res.status}`);
  response = (await res.json()) as SubmissionResponse;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Could not reach the server (${dashboard}): ${message}`);
  console.error('Check the course server address at the top of the guide.');
  process.exit(1);
}

const tasks = Object.entries(response.tasks).sort(([a], [b]) =>
  a.localeCompare(b, undefined, { numeric: true })
);
const done = tasks.filter(([, t]) => t.passed === t.total).length;
const local = scanLocalTasks(files);

console.log(`\nResult: ${done}/${tasks.length} tasks passing\n`);
const notStarted: string[] = [];
for (const [id, t] of tasks) {
  const info = local.get(id);
  // An untouched task fails everything by definition — naming its
  // scenarios is noise; one line at the end covers them all.
  if (info && !info.started && t.passed !== t.total) {
    notStarted.push(id);
    continue;
  }
  const title = info?.title ? ` ${info.title}` : '';
  if (t.passed === t.total) {
    console.log(`  ✓ ${id}${title} (${t.passed}/${t.total})`);
  } else {
    console.log(`  ✗ ${id}${title} (${t.passed}/${t.total}) — failing:`);
    for (const scenario of t.failing) {
      console.log(`      - ${scenario}`);
    }
  }
}
if (notStarted.length > 0) {
  console.log(`  · not started: ${notStarted.join(', ')}`);
}

/** TASK regions found in the submitted sources: the marker's title, and
 *  whether the stub was touched — an untouched region still contains its
 *  NotImplementedError throw (the same rule the guide uses). */
function scanLocalTasks(
  sources: Record<string, string>
): Map<string, { title: string; started: boolean }> {
  const found = new Map<string, { title: string; started: boolean }>();
  for (const source of Object.values(sources)) {
    let current: { id: string; title: string; body: string } | null = null;
    for (const line of source.split('\n')) {
      const start = /^\s*\/\/ TASK ([^\s:]+): (.+)$/.exec(line);
      if (start?.[1] && start[2]) {
        current = { id: start[1], title: start[2].trim(), body: '' };
      } else if (current && line.trim() === `// ENDTASK ${current.id}`) {
        found.set(current.id, {
          title: current.title,
          started: !current.body.includes(
            `NotImplementedError('${current.id}')`
          ),
        });
        current = null;
      } else if (current) {
        current.body += `${line}\n`;
      }
    }
  }
  return found;
}
