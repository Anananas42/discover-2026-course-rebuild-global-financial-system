// Reads course.json — untracked runtime state at the repo root, created
// with defaults by `pnpm start`, filled in by the guide's identity form
// (see DESIGN.md, "Contracts"). Node-only (filesystem); the shape and
// defaults live in course-defaults.ts, which browser code may import.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { COURSE_DEFAULTS, DEFAULT_COURSE_SERVER } from './course-defaults.ts';
import type { CourseConfig } from './course-defaults.ts';

export { COURSE_DEFAULTS, DEFAULT_COURSE_SERVER };
export type { CourseConfig };

/**
 * Reads course.json from the repo root; missing file, unreadable JSON, or
 * missing fields fall back to the defaults.
 */
export function readCourseConfig(root: string): CourseConfig {
  const file = path.join(root, 'course.json');
  if (!existsSync(file)) return { ...COURSE_DEFAULTS };
  try {
    const parsed = JSON.parse(
      readFileSync(file, 'utf8')
    ) as Partial<CourseConfig>;
    const merged = { ...COURSE_DEFAULTS, ...parsed };
    // An address saved as empty falls back to the hosted default.
    if (!merged.dashboard) merged.dashboard = DEFAULT_COURSE_SERVER;
    return merged;
  } catch {
    return { ...COURSE_DEFAULTS };
  }
}
