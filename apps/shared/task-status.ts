// Which tasks has the student started? Reads the TASK regions the
// curriculum points at (task-markers.ts) and reports, per task id,
// whether the region still contains its generated stub — `throw new NotImplementedError('<id>')`, the same
// contract the generator writes and the guide reads (DESIGN.md: course
// machinery). Starting a task is half of the unlock rule the financial
// system reveals UI by (unlocked-tasks.ts); in the reference repo no
// stubs exist, so everything reads as started.
//
// Node-only (filesystem access) — imported by servers, never by browser
// code; the browser sees the result over the API.

import { readTaskRegions } from './task-markers.ts';

/** Task id → true when the stub is replaced by real code. */
export type TaskStatusMap = Record<string, boolean>;

/**
 * True when the line still throws the generated stub for `id` as live
 * code. A commented-out throw is not the stub anymore — the student
 * touched it, which is exactly what "started" means.
 */
export function isLiveStub(line: string, id: string): boolean {
  const at = line.indexOf(`NotImplementedError('${id}')`);
  if (at === -1) return false;
  const comment = line.indexOf('//');
  return comment === -1 || comment > at;
}

export async function scanTaskStatus(root: string): Promise<TaskStatusMap> {
  const status: TaskStatusMap = {};
  // Faulted tasks stay out of the map on purpose — an unreadable region
  // reads as "not started", never as "started", so a broken file cannot
  // unlock anything. The guide is where the fault itself is reported.
  const { regions } = await readTaskRegions(root);
  for (const region of regions) {
    status[region.id] = !region.body
      .split('\n')
      .some(line => isLiveStub(line, region.id));
  }
  return status;
}
