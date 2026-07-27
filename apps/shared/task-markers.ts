// Reads the TASK regions the curriculum points at — the servers' source
// for what each task's code looks like right now. Every code task names
// its file (curriculum.ts `file`), so this reads exactly those files
// instead of walking packages/: a directory walk fails silently — fewer
// results, no error — and one broken walk on a student's machine showed
// an empty task list with nothing to debug. What cannot be read here is
// reported as a fault, never dropped.
//
// Node-only (filesystem access) — imported by servers, never by browser
// code; the browser sees the result over the API.

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { CURRICULUM } from './curriculum.ts';

/** A task's `// TASK <id>: <title>` region, as it stands on disk. */
export interface TaskRegion {
  id: string;
  title: string;
  /** Repo-relative path with forward slashes (the curriculum pointer). */
  file: string;
  absFile: string;
  /** 1-based line of the `// TASK` marker. */
  line: number;
  /** The region's lines between the marker and its `// ENDTASK`. */
  body: string;
}

/** A task whose region could not be loaded, and why: the curriculum
 *  names no file, the file cannot be read, or the file no longer
 *  contains the task's marker (or its `// ENDTASK` line). */
export interface TaskFault {
  id: string;
  file: string;
  reason: 'no-file-in-curriculum' | 'unreadable-file' | 'missing-marker';
}

/**
 * Every code task's region, read from its curriculum-declared file.
 * Complete by construction: each code task lands in `regions` or in
 * `faults` — callers surface faults to the student instead of showing a
 * shorter task list.
 */
export async function readTaskRegions(
  root: string
): Promise<{ regions: TaskRegion[]; faults: TaskFault[] }> {
  const idsByFile = new Map<string, string[]>();
  const faults: TaskFault[] = [];
  for (const stage of CURRICULUM) {
    for (const task of stage.tasks) {
      if (task.codeless) continue;
      if (task.file === undefined) {
        faults.push({ id: task.id, file: '', reason: 'no-file-in-curriculum' });
        continue;
      }
      idsByFile.set(task.file, [...(idsByFile.get(task.file) ?? []), task.id]);
    }
  }
  const regions: TaskRegion[] = [];
  for (const [file, ids] of idsByFile) {
    const absFile = path.join(root, file);
    let source: string;
    try {
      source = await readFile(absFile, 'utf8');
    } catch {
      for (const id of ids)
        faults.push({ id, file, reason: 'unreadable-file' });
      continue;
    }
    const found = regionsIn(source, file, absFile);
    for (const id of ids) {
      const region = found.get(id);
      if (region) regions.push(region);
      else faults.push({ id, file, reason: 'missing-marker' });
    }
  }
  regions.sort((a, b) =>
    a.id.localeCompare(b.id, undefined, { numeric: true })
  );
  return { regions, faults };
}

/** The complete `// TASK` … `// ENDTASK` regions in one source, by id.
 *  A region missing its ENDTASK line is not returned — the caller
 *  reports it as a fault rather than trusting a body that swallowed the
 *  rest of the file. */
function regionsIn(
  source: string,
  file: string,
  absFile: string
): Map<string, TaskRegion> {
  const regions = new Map<string, TaskRegion>();
  let current: TaskRegion | null = null;
  for (const [i, line] of source.split('\n').entries()) {
    const start = /^\s*\/\/ TASK ([^\s:]+): (.+)$/.exec(line);
    if (start?.[1] && start[2]) {
      current = {
        id: start[1],
        title: start[2].trim(),
        file,
        absFile,
        line: i + 1,
        body: '',
      };
      continue;
    }
    if (current && line.trim() === `// ENDTASK ${current.id}`) {
      regions.set(current.id, current);
      current = null;
    } else if (current) {
      current.body += `${line}\n`;
    }
  }
  return regions;
}
