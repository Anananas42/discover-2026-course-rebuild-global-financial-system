// Machinery test: the curriculum and the TASK markers are two views of
// the same task list, and this test is what keeps them from drifting
// apart (like the generator's test locks the stub format). It scans the
// real package sources — no database, no mocks.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ALL_TASK_IDS, CURRICULUM } from './curriculum.ts';

const PACKAGES = path.resolve(import.meta.dirname, '../../packages');

/** Every `// TASK <id>:` marker id found under packages/. */
async function markerIds(): Promise<string[]> {
  const entries = await readdir(PACKAGES, {
    recursive: true,
    withFileTypes: true,
  });
  const ids: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;
    if (entry.name.endsWith('.test.ts')) continue;
    if (entry.parentPath.includes('node_modules')) continue;
    const source = await readFile(
      path.join(entry.parentPath, entry.name),
      'utf8'
    );
    for (const match of source.matchAll(/^\s*\/\/ TASK ([^\s:]+):/gm)) {
      if (match[1]) ids.push(match[1]);
    }
  }
  return ids;
}

describe('curriculum', () => {
  it('lists exactly the TASK markers that exist in packages/', async () => {
    const markers = await markerIds();
    expect([...markers].sort()).toEqual([...ALL_TASK_IDS].sort());
    // No id is claimed by two markers.
    expect(new Set(markers).size).toBe(markers.length);
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
