// Machinery test: the curriculum and the TASK markers are two views of
// the same task list, and this test is what keeps them from drifting
// apart (like the generator's test locks the stub format). It scans the
// real package sources — no database, no mocks.

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ALL_TASK_IDS, CURRICULUM } from './curriculum.ts';
import { tsSources } from './ts-sources.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const PACKAGES = path.join(ROOT, 'packages');

/** Every `// TASK <id>:` marker found under packages/ — a full-tree
 *  walk on purpose: the servers read only the curriculum-declared files
 *  (task-markers.ts), so this sweep is what proves no marker lives
 *  anywhere else. Repo-relative paths with forward slashes. */
async function markers(): Promise<{ id: string; file: string }[]> {
  const found: { id: string; file: string }[] = [];
  for (const abs of await tsSources(PACKAGES)) {
    if (abs.endsWith('.test.ts')) continue;
    const source = await readFile(abs, 'utf8');
    for (const match of source.matchAll(/^\s*\/\/ TASK ([^\s:]+):/gm)) {
      if (match[1]) {
        found.push({
          id: match[1],
          file: path.relative(ROOT, abs).replaceAll(path.sep, '/'),
        });
      }
    }
  }
  return found;
}

describe('curriculum', () => {
  it('lists exactly the TASK markers that exist in packages/', async () => {
    const ids = (await markers()).map(marker => marker.id);
    expect([...ids].sort()).toEqual([...ALL_TASK_IDS].sort());
    // No id is claimed by two markers.
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('points every code task at the file holding its marker', async () => {
    const fileById = new Map(
      (await markers()).map(marker => [marker.id, marker.file])
    );
    for (const stage of CURRICULUM) {
      for (const task of stage.tasks) {
        if (task.codeless) {
          expect(task.file, `codeless task ${task.id}`).toBeUndefined();
        } else {
          expect(task.file, `task ${task.id}`).toBe(fileById.get(task.id));
        }
      }
    }
  });

  it('numbers every task id after its stage', () => {
    for (const stage of CURRICULUM) {
      for (const task of stage.tasks) {
        expect(task.id.startsWith(`${stage.stage}.`)).toBe(true);
      }
    }
  });

  it('lists every task in exactly one stage', () => {
    expect(new Set(ALL_TASK_IDS).size).toBe(ALL_TASK_IDS.length);
  });
});
