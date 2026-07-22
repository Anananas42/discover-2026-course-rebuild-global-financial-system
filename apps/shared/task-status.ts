// Which tasks has the student implemented? Scans the TASK regions in
// packages/ and reports, per task id, whether the region still contains
// its generated stub — `throw new NotImplementedError('<id>')`, the same
// contract the generator writes and the guide reads (DESIGN.md: course
// machinery). The financial system uses this to reveal each operation's
// UI once its task is implemented; in the reference repo no stubs exist,
// so everything reads as implemented.
//
// Node-only (filesystem access) — imported by servers, never by browser
// code; the browser sees the result over the API.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

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
  const dir = path.join(root, 'packages');
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  const status: TaskStatusMap = {};
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;
    if (entry.name.endsWith('.test.ts')) continue;
    if (entry.parentPath.includes('node_modules')) continue;
    const lines = (
      await readFile(path.join(entry.parentPath, entry.name), 'utf8')
    ).split('\n');
    let current: { id: string; stubbed: boolean } | null = null;
    for (const line of lines) {
      const start = /^\s*\/\/ TASK ([^\s:]+):/.exec(line);
      if (start?.[1]) {
        current = { id: start[1], stubbed: false };
        continue;
      }
      if (!current) continue;
      if (line.trim() === `// ENDTASK ${current.id}`) {
        status[current.id] = !current.stubbed;
        current = null;
      } else if (isLiveStub(line, current.id)) {
        current.stubbed = true;
      }
    }
  }
  return status;
}
