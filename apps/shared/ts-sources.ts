// The one recursive walk behind every task and test scan: all `.ts`
// sources under a directory, `node_modules` subtrees excluded. Hand-rolled
// instead of `readdir({ recursive: true })` on purpose — recursive readdir
// trusts each directory entry's reported type, and on Windows anything
// carrying an NTFS reparse point reports as a link, not a file. OneDrive
// keeps synced files as reparse-point placeholders, so on a repo under a
// OneDrive folder an `isFile()` filter drops every source: the guide
// showed no tasks at all. Ambiguous entries are resolved with stat, which
// follows the reparse point to the real thing.

import type { Dirent } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

/** Absolute paths of every `.ts` file under `dir`, sorted;
 *  `node_modules` subtrees are skipped before descending. */
export async function tsSources(dir: string): Promise<string[]> {
  const files: string[] = [];
  await walk(dir, files);
  return files.sort();
}

async function walk(dir: string, files: string[]): Promise<void> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    // Skipping node_modules by name also keeps the walk out of the
    // workspace links (packages/*/node_modules/@banks/* point back into
    // packages/), so following resolved types below cannot cycle.
    if (entry.name === 'node_modules') continue;
    const abs = path.join(dir, entry.name);
    const kind = await kindOf(entry, abs);
    if (kind === 'directory') await walk(abs, files);
    else if (kind === 'file' && entry.name.endsWith('.ts')) files.push(abs);
  }
}

async function kindOf(
  entry: Dirent,
  abs: string
): Promise<'directory' | 'file' | 'none'> {
  if (entry.isDirectory()) return 'directory';
  if (entry.isFile()) return 'file';
  try {
    return (await stat(abs)).isDirectory() ? 'directory' : 'file';
  } catch {
    // A broken link or an entry gone mid-walk — the callers read every
    // path returned, so listing it would turn one dead entry into a
    // failed scan.
    return 'none';
  }
}
