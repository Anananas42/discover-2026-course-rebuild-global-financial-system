// Which tasks does the financial system reveal? A task's UI unlocks
// once the task before it (curriculum order) passes its tests in the
// last recorded run — the guide writes that run to .test-results.json —
// or once the student starts the task's own code (its stub no longer
// throws, task-status.ts): following the curriculum and jumping ahead
// both reveal the surface. The first task needs no predecessor. An
// unlocked-but-unimplemented operation fails loudly through the blocked
// envelope, which is the feedback loop we want.
//
// Node-only (filesystem access) — imported by servers, never by browser
// code; the browser sees the result over the API.

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { ALL_TASK_IDS } from './curriculum.ts';
import { scanTaskStatus } from './task-status.ts';

/** Task id → its UI is revealed in the financial system. */
export type UnlockedTasks = Record<string, boolean>;

/** The guide's record of the last test run, relative to the repo root. */
export const RESULTS_FILE_NAME = '.test-results.json';

/** The relevant subset of the recorded run: per task, its scenarios —
 *  either directly (the pre-timestamp format) or under `scenarios`. */
type RecordedScenarios = { status: string }[];
interface RecordedRun {
  tasks?: Record<string, RecordedScenarios | { scenarios?: RecordedScenarios }>;
}

/** The ids whose scenarios all passed in the last recorded run. No run
 *  recorded (or an unreadable file) means nothing has passed yet. */
async function passingTasks(root: string): Promise<Set<string>> {
  let run: RecordedRun;
  try {
    const raw = await readFile(path.join(root, RESULTS_FILE_NAME), 'utf8');
    run = JSON.parse(raw) as RecordedRun;
  } catch {
    return new Set();
  }
  const passing = new Set<string>();
  for (const [id, entry] of Object.entries(run.tasks ?? {})) {
    const scenarios = (Array.isArray(entry) ? entry : entry.scenarios) ?? [];
    if (scenarios.length > 0 && scenarios.every(s => s.status === 'passed')) {
      passing.add(id);
    }
  }
  return passing;
}

export async function unlockedTasks(root: string): Promise<UnlockedTasks> {
  const [passing, started] = await Promise.all([
    passingTasks(root),
    scanTaskStatus(root),
  ]);
  const unlocked: UnlockedTasks = {};
  ALL_TASK_IDS.forEach((id, index) => {
    const previous = ALL_TASK_IDS[index - 1];
    unlocked[id] =
      previous === undefined || passing.has(previous) || started[id] === true;
  });
  return unlocked;
}
