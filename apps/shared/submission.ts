// The wire contract between `pnpm submit` (submit.ts) and the course
// server (apps/dashboard). This file is the single definition of what
// travels over the classroom network.

/** POST /submit request body. */
export interface SubmissionRequest {
  student: string;
  country: string;
  currency: string;
  /** Implementation sources, repo-relative path -> content. Never tests. */
  files: Record<string, string>;
}

/** Hidden-test outcome of one task. */
export interface TaskResult {
  passed: number;
  total: number;
  /** Names of failing scenarios — never the hidden test code. */
  failing: string[];
}

/** POST /submit response body. */
export interface SubmissionResponse {
  tasks: Record<string, TaskResult>;
}
