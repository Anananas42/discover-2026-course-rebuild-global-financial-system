// The contract of the guide's /api endpoints, imported by both server.ts
// and the React frontend (src/api.ts) — the shapes are typechecked end to
// end, so the two sides cannot drift apart.

import type { CourseConfig } from '../shared/course-config.ts';
import type { CurriculumStage } from '../shared/curriculum.ts';

export type TaskStatus = 'not-started' | 'in-progress' | 'passing';

export interface Scenario {
  name: string;
  status: string;
  error: string | null;
}

/** A lint finding inside a task's region: the repo's own lint rules run
 *  with the tests, because they see what the type checker cannot —
 *  above all a Promise started and never waited for. */
export interface LintFinding {
  message: string;
  path: string;
  abs: string;
  line: number;
}

export interface FileLink {
  path: string;
  abs: string;
  line?: number;
  /** What is in the file — the first sentence of its header comment. */
  description?: string;
}

export interface GuideTask {
  id: string;
  title: string;
  /** The functionality, as a user story (apps/shared/curriculum.ts). */
  story: string;
  /** How to walk the story by hand in the financial system, in order. */
  steps: string[];
  /** The curriculum stage this task belongs to — the id's major part. */
  stage: number;
  scenarios: Scenario[];
  /** Lint findings in this task's region, from its last test run. */
  lint: LintFinding[];
  /** When this task's scenarios last ran — results can age per task. */
  ranAt: number | null;
  status: TaskStatus;
  /** Where the work happens: the TASK region, at its marker line. */
  implement: FileLink;
  /** The public test file to satisfy, at this task's describe. */
  tests: FileLink | null;
  /** Sibling sources this task touches — context, not work. */
  context: FileLink[];
}

/** GET /api/state */
export interface GuideState {
  /** The course's stages in teaching order (apps/shared/curriculum.ts). */
  stages: CurriculumStage[];
  tasks: GuideTask[];
  lastRunAt: number | null;
  course: CourseConfig;
  financialSystemUrl: string;
}

/** One task's last test results. Timestamped per task: a single-task
 *  run refreshes only its own entry, so entries age independently. */
export interface TaskResult {
  at: number;
  scenarios: Scenario[];
  /** Absent in results persisted before the guide linted. */
  lint?: LintFinding[];
}

/** POST /api/run response; also persisted to .test-results.json. */
export interface TestRun {
  at: number;
  tasks: Record<string, TaskResult>;
}

/** POST /api/course response. */
export interface CourseSaved {
  course: CourseConfig;
}

/** POST /api/submit response. */
export interface SubmitOutput {
  /** Whether submit.ts exited cleanly — the server accepted the code. */
  ok: boolean;
  output: string;
}
