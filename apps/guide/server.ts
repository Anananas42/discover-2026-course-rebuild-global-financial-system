// The guide API, started via `pnpm start` under `node --watch`. The React
// frontend in ./src runs on the Vite dev server (port 4322 — the page
// `pnpm start` opens) and proxies /api here.
//
// Serves the data behind the guide: the task list with live status (not
// started / in progress / passing), public test results, the identity in
// course.json, and the actions (run tests, submit). Task status is derived
// from the `// TASK x.y: title` markers: an untouched stub still contains
// its NotImplementedError throw.

import { spawn } from 'node:child_process';
import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { childEnv } from '../shared/child-env.ts';
import { readCourseConfig } from '../shared/course-config.ts';
import type { CourseConfig } from '../shared/course-config.ts';
import { CURRICULUM, taskById } from '../shared/curriculum.ts';
import { createJsonServer, readBody, sendJson } from '../shared/http.ts';
import { PORTS } from '../shared/ports.ts';
import { isLiveStub } from '../shared/task-status.ts';
import type {
  FileLink,
  GuideState,
  GuideTask,
  LintFinding,
  Scenario,
  TaskResult,
  TaskStatus,
  TestRun,
} from './guide-contract.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const PORT = Number(process.env.PORT ?? PORTS.guideApi);

/** A `// TASK x.y: title` region found in the sources. */
interface TaskMarker {
  id: string;
  title: string;
  file: string;
  absFile: string;
  line: number;
  body: string;
}

/** The relevant subset of oxlint's JSON output. */
interface OxlintReport {
  diagnostics?: {
    message: string;
    code: string;
    filename?: string;
    labels?: { span: { line: number } }[];
  }[];
}

/** The relevant subset of vitest's JSON reporter output. */
interface VitestReport {
  testResults?: {
    name?: string;
    assertionResults?: {
      fullName: string;
      title: string;
      status: string;
      failureMessages?: string[];
    }[];
  }[];
}

// Last test run. Persisted so results survive watch-mode restarts and
// `pnpm start` runs.
const RESULTS_FILE = path.join(ROOT, '.test-results.json');
let lastRun: TestRun | null = null;
if (existsSync(RESULTS_FILE)) {
  try {
    const parsed = JSON.parse(await readFile(RESULTS_FILE, 'utf8')) as {
      at: number;
      tasks: Record<string, TaskResult | Scenario[]>;
    };
    // Migrate the pre-timestamp format (plain scenario arrays).
    lastRun = {
      at: parsed.at,
      tasks: Object.fromEntries(
        Object.entries(parsed.tasks).map(([id, entry]) => [
          id,
          Array.isArray(entry) ? { at: parsed.at, scenarios: entry } : entry,
        ])
      ),
    };
  } catch {
    lastRun = null;
  }
}

// Test runs go one after another: they share the test database and the
// report file. The chain never rejects — each run's errors surface in
// its own request.
let testQueue: Promise<unknown> = Promise.resolve();

createJsonServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/run') {
    const raw = await readBody(req);
    const taskId = raw
      ? (JSON.parse(raw) as { taskId?: string }).taskId
      : undefined;
    const run = testQueue.then(() => runPublicTests(taskId));
    testQueue = run.catch(() => {});
    const fresh = await run;
    // A one-task run only re-tests that task — keep the other tasks'
    // last results instead of dropping them.
    lastRun =
      taskId === undefined
        ? fresh
        : { at: fresh.at, tasks: { ...lastRun?.tasks, ...fresh.tasks } };
    await writeFile(RESULTS_FILE, JSON.stringify(lastRun));
    return sendJson(res, 200, lastRun);
  }
  if (req.method === 'POST' && req.url === '/api/course') {
    const body = JSON.parse(await readBody(req)) as Partial<CourseConfig>;
    const config = readCourseConfig(ROOT);
    const decimals = Number(body.decimals ?? config.decimals);
    const updated: CourseConfig = {
      student: String(body.student ?? config.student).trim(),
      country: String(body.country ?? config.country).trim(),
      currency: String(body.currency ?? config.currency)
        .trim()
        .toUpperCase(),
      decimals: Number.isInteger(decimals) && decimals >= 0 ? decimals : 2,
      dashboard: String(body.dashboard ?? config.dashboard).trim(),
    };
    await writeFile(
      path.join(ROOT, 'course.json'),
      `${JSON.stringify(updated, null, 2)}\n`
    );
    return sendJson(res, 200, { course: updated });
  }
  if (req.method === 'POST' && req.url === '/api/submit') {
    const result = await runChild([path.join(ROOT, 'submit.ts')], 180_000);
    return sendJson(res, 200, {
      ok: result.status === 0,
      output: `${result.stdout}${result.stderr}`.trim(),
    });
  }
  if (req.url === '/api/state') {
    // A task is "not started" exactly while its generated stub still
    // throws — the moment the student replaces the
    // NotImplementedError, they have started, wherever the task sits
    // in the curriculum.
    const drafts = [];
    for (const marker of await scanTasks()) {
      const result = lastRun?.tasks[marker.id];
      const scenarios = result?.scenarios ?? [];
      drafts.push({
        marker,
        scenarios,
        ranAt: result?.at ?? null,
        // Task ids are `<stage>.<n>` (see apps/shared/curriculum.ts).
        stage: Number(marker.id.split('.')[0]),
        passing:
          scenarios.length > 0 && scenarios.every(s => s.status === 'passed'),
        replaced: !marker.body
          .split('\n')
          .some(line => isLiveStub(line, marker.id)),
      });
    }
    const tasks: GuideTask[] = [];
    for (const draft of drafts) {
      const status: TaskStatus = draft.passing
        ? 'passing'
        : draft.replaced
          ? 'in-progress'
          : 'not-started';
      tasks.push({
        id: draft.marker.id,
        title: draft.marker.title,
        story: taskById(draft.marker.id)?.story ?? '',
        steps: taskById(draft.marker.id)?.steps ?? [],
        stage: draft.stage,
        scenarios: draft.scenarios,
        lint: lastRun?.tasks[draft.marker.id]?.lint ?? [],
        ranAt: draft.ranAt,
        status,
        ...(await taskFiles(draft.marker)),
      });
    }
    const state: GuideState = {
      stages: CURRICULUM,
      tasks,
      lastRunAt: lastRun?.at ?? null,
      course: readCourseConfig(ROOT),
      financialSystemUrl: `http://localhost:${PORTS.financialSystem}`,
    };
    return sendJson(res, 200, state);
  }
  sendJson(res, 404, { error: 'Unknown endpoint.' });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Guide API running at http://localhost:${PORT}`);
});

/**
 * What a file is about: the first sentence of its top comment block —
 * every source here opens with one, so the description can never drift
 * from the file (there is no second registry of blurbs).
 */
async function fileBrief(abs: string): Promise<string | undefined> {
  const lines = (await readFile(abs, 'utf8')).split('\n');
  const comment: string[] = [];
  for (const line of lines) {
    if (!line.startsWith('//')) break;
    comment.push(line.replace(/^\/\/ ?/, ''));
  }
  const text = comment.join(' ').trim();
  if (!text) return undefined;
  const period = text.indexOf('. ');
  return period === -1 ? text : text.slice(0, period + 1);
}

/** Scan TASK regions: id, title, file, line, and region body. */
async function scanTasks(): Promise<TaskMarker[]> {
  const dir = path.join(ROOT, 'packages');
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  const tasks: TaskMarker[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;
    if (entry.name.endsWith('.test.ts')) continue;
    if (entry.parentPath.includes('node_modules')) continue;
    const abs = path.join(entry.parentPath, entry.name);
    const lines = (await readFile(abs, 'utf8')).split('\n');
    let current: TaskMarker | null = null;
    for (const [i, line] of lines.entries()) {
      const start = /^\s*\/\/ TASK ([^\s:]+): (.+)$/.exec(line);
      if (start?.[1] && start[2]) {
        current = {
          id: start[1],
          title: start[2].trim(),
          file: path.relative(ROOT, abs).replaceAll(path.sep, '/'),
          absFile: abs,
          line: i + 1,
          body: '',
        };
        continue;
      }
      if (current && line.trim() === `// ENDTASK ${current.id}`) {
        tasks.push(current);
        current = null;
      } else if (current) {
        current.body += `${line}\n`;
      }
    }
  }
  return tasks.sort((a, b) =>
    a.id.localeCompare(b.id, undefined, { numeric: true })
  );
}

/**
 * The public test files, passed to vitest as file filters — hidden
 * files never make the list, however the config includes them. With a
 * task id, only the files holding that task's scenarios: a one-task run
 * then only collects those instead of the whole suite, which is most of
 * a small run's duration.
 */
async function publicTestFiles(taskId?: string): Promise<string[]> {
  const dir = path.join(ROOT, 'packages');
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.test.ts')) continue;
    if (entry.name.endsWith('.hidden.test.ts')) continue;
    if (entry.parentPath.includes('node_modules')) continue;
    const abs = path.join(entry.parentPath, entry.name);
    if (taskId !== undefined) {
      const source = await readFile(abs, 'utf8');
      if (!source.includes(`task ${taskId}:`)) continue;
    }
    files.push(path.relative(ROOT, abs).replaceAll(path.sep, '/'));
  }
  return files;
}

/**
 * Runs a Node script without blocking the server's event loop: the guide
 * keeps answering /api/state while tests or a submission run — a blocked
 * loop looked to the browser like the server being down.
 */
function runChild(
  args: string[],
  timeoutMs: number
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise(resolve => {
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      timeout: timeoutMs,
      env: childEnv(),
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', chunk => (stdout += chunk));
    child.stderr.setEncoding('utf8').on('data', chunk => (stderr += chunk));
    child.on('error', error => {
      stderr += String(error);
      resolve({ status: null, stdout, stderr });
    });
    child.on('close', status => resolve({ status, stdout, stderr }));
  });
}

async function runPublicTests(taskId?: string): Promise<TestRun> {
  const reportFile = path.join(ROOT, '.vitest-report.json');
  const result = await runChild(
    [
      path.join(ROOT, 'node_modules/vitest/vitest.mjs'),
      'run',
      '--reporter=json',
      `--outputFile=${reportFile}`,
      // The guide runs the public tier only, by listing its files — the
      // student repo has no hidden files, and in the reference repo they
      // carry the slow crash probes; the hidden tier is the dashboard's
      // job. One task's scenarios: additionally filter by the
      // `task <id>:` describe name.
      ...(taskId === undefined ? [] : ['-t', `task ${taskId}:`]),
      ...(await publicTestFiles(taskId)),
    ],
    120_000
  );
  if (!existsSync(reportFile)) {
    throw new Error(
      `vitest did not produce a report: ${(result.stderr ?? '').slice(-500)}`
    );
  }
  const report = JSON.parse(await readFile(reportFile, 'utf8')) as VitestReport;
  await rm(reportFile, { force: true });

  const at = Date.now();
  const tasks: Record<string, TaskResult> = {};
  for (const file of report.testResults ?? []) {
    if ((file.name ?? '').includes('.hidden.')) continue;
    for (const test of file.assertionResults ?? []) {
      // A task-filtered run reports every non-matching test in the
      // collected files as skipped. Those tests were not run — recording
      // them would overwrite other tasks' real results in the merge.
      if (test.status !== 'passed' && test.status !== 'failed') continue;
      const match = /task (\d+\.\w+)/i.exec(test.fullName);
      if (!match?.[1]) continue;
      (tasks[match[1]] ??= { at, scenarios: [] }).scenarios.push({
        name: test.title,
        status: test.status,
        error: firstErrorLine(test.failureMessages),
      });
    }
  }
  // The tests are only half the verdict: the repo's own lint rules run
  // over the tested tasks' files too, because they see what vitest and
  // the type checker both miss — above all a Promise started and never
  // waited for. Findings ride on the task results they belong to.
  const lint = await lintTasks(taskId);
  for (const result of Object.values(tasks)) result.lint = [];
  for (const [id, findings] of Object.entries(lint)) {
    (tasks[id] ??= { at, scenarios: [] }).lint = findings;
  }
  return { at, tasks };
}

// oxlint speaks tool ("add void operator to ignore" — never the fix
// here); the rules students actually meet get the course's voice, the
// rest fall back to oxlint's message.
const LINT_MESSAGES: Record<string, string> = {
  'typescript(no-floating-promises)':
    'This code starts a Promise and never waits for it — wrap the call in yield* Effect.promise(() => ...).',
};

/**
 * Lint findings for the students' task code, mapped to the tasks whose
 * regions hold them (findings in prebuilt code, which CI keeps clean,
 * are dropped). The rule set is the repo's own .oxlintrc.json — exactly
 * what `pnpm check` runs. A crashed or unparsable lint run yields no
 * findings rather than blocking the test results.
 */
async function lintTasks(
  taskId?: string
): Promise<Record<string, LintFinding[]>> {
  const markers = (await scanTasks()).filter(
    marker => taskId === undefined || marker.id === taskId
  );
  const files = [...new Set(markers.map(marker => marker.absFile))];
  if (files.length === 0) return {};
  const result = await runChild(
    [
      path.join(ROOT, 'node_modules/oxlint/bin/oxlint'),
      '--type-aware',
      '--format',
      'json',
      ...files,
    ],
    60_000
  );
  let report: OxlintReport;
  try {
    report = JSON.parse(result.stdout) as OxlintReport;
  } catch {
    return {};
  }
  const findings: Record<string, LintFinding[]> = {};
  for (const diagnostic of report.diagnostics ?? []) {
    const line = diagnostic.labels?.[0]?.span.line;
    if (line === undefined || !diagnostic.filename) continue;
    const abs = path.resolve(ROOT, diagnostic.filename);
    const marker = markers.find(
      each =>
        each.absFile === abs &&
        line > each.line &&
        // The body's trailing newline makes its split one longer than
        // its line count — the region's last line falls out exactly.
        line < each.line + each.body.split('\n').length
    );
    if (!marker) continue;
    (findings[marker.id] ??= []).push({
      message: LINT_MESSAGES[diagnostic.code] ?? diagnostic.message,
      path: path.relative(ROOT, abs).replaceAll(path.sep, '/'),
      abs,
      line,
    });
  }
  return findings;
}

function firstErrorLine(messages: string[] | undefined): string | null {
  const text = messages?.[0];
  if (!text) return null;
  // Strip ANSI colors; keep the first meaningful line.
  // oxlint-disable-next-line no-control-regex -- the ESC escape is the point: this strips ANSI colors
  const plain = text.replaceAll(/\u001b?\[[0-9;]*m/g, '');
  return plain.split('\n').find(l => l.trim()) ?? null;
}

/**
 * A task's files, structured the way the work actually is: one goto file
 * (the TASK region, at its marker), one test file to satisfy (found by
 * its `task <id>` describe, linked at that line), and as context the
 * sibling sources this task actually touches. A sibling is context when
 * one of its exported names appears in the task's visible material —
 * its test block, the doc comment and signature above its marker, or
 * the code currently in its region — so the list follows the work as
 * the student writes it. A file a solution needs must therefore be
 * named by the task's docs or tests, never by a hand-kept list.
 * Absolute paths power vscode:// links.
 */
async function taskFiles(
  marker: TaskMarker
): Promise<Pick<GuideTask, 'implement' | 'tests' | 'context'>> {
  const srcDir = path.dirname(marker.absFile);
  let tests: FileLink | null = null;
  let testBlock = '';
  const siblings: FileLink[] = [];
  for (const name of (await readdir(srcDir)).sort()) {
    if (!name.endsWith('.ts')) continue;
    if (name.endsWith('.hidden.test.ts')) continue;
    const abs = path.join(srcDir, name);
    if (abs === marker.absFile) continue;
    const link: FileLink = {
      path: path.relative(ROOT, abs).replaceAll(path.sep, '/'),
      abs,
    };
    if (!name.endsWith('.test.ts')) {
      siblings.push(link);
      continue;
    }
    // The task's test file is the one whose describe names the task;
    // the block under that describe (up to the next top-level one) is
    // part of the task's visible material.
    const lines = (await readFile(abs, 'utf8')).split('\n');
    const at = lines.findIndex(line => line.includes(`task ${marker.id}:`));
    if (at === -1) continue;
    tests = { ...link, line: at + 1 };
    const end = lines.findIndex(
      (line, i) => i > at && line.startsWith('describe(')
    );
    testBlock = lines.slice(at, end === -1 ? lines.length : end).join('\n');
  }
  const visible = `${testBlock}\n${await taskSurround(marker)}\n${marker.body}`;
  const context: FileLink[] = [];
  for (const link of siblings) {
    const exported = [
      ...(await readFile(link.abs, 'utf8')).matchAll(
        /^export (?:abstract )?(?:const|class|function|interface|type|enum) (\w+)/gm
      ),
    ].map(match => match[1] ?? '');
    if (!exported.some(name => new RegExp(`\\b${name}\\b`).test(visible))) {
      continue;
    }
    context.push({ ...link, description: await fileBrief(link.abs) });
  }
  return {
    implement: {
      path: marker.file,
      abs: marker.absFile,
      line: marker.line,
    },
    tests,
    context,
  };
}

/**
 * What a student reads around a task before writing anything: the lines
 * from the doc comment above the marker's enclosing declaration down to
 * the marker itself — doc, signature, and the prepared preamble. Never
 * reaches past a previous task's ENDTASK.
 */
async function taskSurround(marker: TaskMarker): Promise<string> {
  const lines = (await readFile(marker.absFile, 'utf8')).split('\n');
  const surround: string[] = [];
  for (let i = marker.line - 2; i >= 0; i--) {
    const line = lines[i] ?? '';
    if (/^\s*\/\/ ENDTASK /.test(line)) break;
    surround.push(line);
    if (/^\s*\/\*\*/.test(line)) break;
  }
  return surround.reverse().join('\n');
}
