// Machinery test: readTaskRegions must account for every code task —
// each one lands in `regions` or in `faults`, never nowhere. The silent
// third outcome is the bug this module exists to rule out: a scan that
// quietly returns fewer tasks than the curriculum has.

import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { ALL_TASK_IDS } from './curriculum.ts';
import { readTaskRegions } from './task-markers.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const tmpDirs: string[] = [];

afterAll(async () => {
  for (const dir of tmpDirs) await rm(dir, { recursive: true, force: true });
});

describe('readTaskRegions', () => {
  it('reads every code task region from the reference sources', async () => {
    const { regions, faults } = await readTaskRegions(ROOT);
    expect(faults).toEqual([]);
    expect(regions.map(region => region.id).sort()).toEqual(
      [...ALL_TASK_IDS].sort()
    );
    for (const region of regions) {
      expect(region.title).not.toBe('');
      expect(region.line).toBeGreaterThan(0);
      expect(region.body).toContain('\n');
    }
  });

  it('reports every code task as a fault when its file is unreadable', async () => {
    const empty = await mkdtemp(path.join(os.tmpdir(), 'task-markers-'));
    tmpDirs.push(empty);
    const { regions, faults } = await readTaskRegions(empty);
    expect(regions).toEqual([]);
    expect(faults.map(fault => fault.id).sort()).toEqual(
      [...ALL_TASK_IDS].sort()
    );
    expect(faults.every(fault => fault.reason === 'unreadable-file')).toBe(
      true
    );
  });
});
