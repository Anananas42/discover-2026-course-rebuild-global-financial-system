// The call log: a tRPC client link that records every mutation — the
// operations — with its input, duration, and classified outcome. Queries
// pass through unrecorded; they are how the UI looks, not what the user
// did. The log is append-only (a retry adds a new entry, it never rewrites
// history) and doubles as the refetch trigger: after any mutation settles,
// every screen refetches, so staleness is never a debugging variable.
//
// The log persists in localStorage — the operator's trace is a browser
// concern like the theme, never domain state (a bank's statements would
// be a transactions table in its books; the log also holds what no book
// would: failed attempts, blocked calls, resets). Reset clears it: a new
// world starts with a new trace, and stale entries would otherwise match
// recycled bank and account ids.

import type { TRPCLink } from '@trpc/client';
import { observable } from '@trpc/server/observable';

import type { Outcome } from '../error-outcome.ts';
import type { AppRouter } from '../router.ts';
import { outcomeOf } from './outcome-of.ts';

export interface CallLogEntry {
  id: number;
  at: Date;
  path: string;
  input: unknown;
  durationMs: number;
  outcome: { kind: 'ok' } | Outcome;
  /** Re-runs the call with the same input; the run logs itself. */
  retry: () => void;
}

const STORAGE_KEY = 'call-log';
const MAX_ENTRIES = 500;

interface StoredEntry extends Omit<CallLogEntry, 'at' | 'retry'> {
  at: string;
}

function loadEntries(): CallLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const stored = JSON.parse(raw) as StoredEntry[];
    return stored.map(entry => ({
      ...entry,
      at: new Date(entry.at),
      retry: () => retryRunner(entry.path, entry.input),
    }));
  } catch {
    return [];
  }
}

function persistEntries(): void {
  const stored: StoredEntry[] = entries
    .slice(0, MAX_ENTRIES)
    .map(({ retry: _retry, at, ...rest }) => ({
      ...rest,
      at: at.toISOString(),
    }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

let entries: CallLogEntry[] = loadEntries();
let nextId = (entries[0]?.id ?? 0) + 1;
const logListeners = new Set<() => void>();
const mutationListeners = new Set<() => void>();

// Read state: an entry is unread until it has been displayed in some log
// view. Persisted beside the log; pruned to entries that still exist.
const READ_KEY = 'call-log-read';

function loadReadIds(): Set<number> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (!raw) return new Set();
    const stored = JSON.parse(raw) as number[];
    return new Set(stored.filter(id => entries.some(entry => entry.id === id)));
  } catch {
    return new Set();
  }
}

const readIds = loadReadIds();

export function isUnread(id: number): boolean {
  return !readIds.has(id);
}

/** Marks entries as displayed; consumers re-render via a fresh snapshot. */
export function markRead(ids: number[]): void {
  const unseen = ids.filter(id => !readIds.has(id));
  if (unseen.length === 0) return;
  for (const id of unseen) readIds.add(id);
  localStorage.setItem(READ_KEY, JSON.stringify([...readIds]));
  entries = [...entries];
  for (const listener of logListeners) listener();
}

/** For useSyncExternalStore: the entries, newest first. */
export function getCallLog(): CallLogEntry[] {
  return entries;
}

export function subscribeCallLog(listener: () => void): () => void {
  logListeners.add(listener);
  return () => logListeners.delete(listener);
}

/** Fires after any mutation settles — the screens' refetch signal. */
export function subscribeMutations(listener: () => void): () => void {
  mutationListeners.add(listener);
  return () => mutationListeners.delete(listener);
}

// Injected by api.ts after the client exists — avoids an import cycle.
let retryRunner: (path: string, input: unknown) => void = () => {};

export function setRetryRunner(
  runner: (path: string, input: unknown) => void
): void {
  retryRunner = runner;
}

function record(
  path: string,
  input: unknown,
  durationMs: number,
  outcome: CallLogEntry['outcome']
): void {
  entries = [
    {
      id: nextId++,
      at: new Date(),
      path,
      input,
      durationMs,
      outcome,
      retry: () => retryRunner(path, input),
    },
    ...entries,
  ];
  persistEntries();
  for (const listener of logListeners) listener();
  for (const listener of mutationListeners) listener();
}

/** Empties the log — called when the financial system is reset. */
export function clearCallLog(): void {
  entries = [];
  readIds.clear();
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(READ_KEY);
  for (const listener of logListeners) listener();
}

export const callLogLink: TRPCLink<AppRouter> =
  () =>
  ({ next, op }) => {
    if (op.type !== 'mutation') return next(op);
    return observable(observer => {
      const started = performance.now();
      return next(op).subscribe({
        next(value) {
          record(op.path, op.input, performance.now() - started, {
            kind: 'ok',
          });
          observer.next(value);
        },
        error(error) {
          record(
            op.path,
            op.input,
            performance.now() - started,
            outcomeOf(error)
          );
          observer.error(error);
        },
        complete() {
          observer.complete();
        },
      });
    });
  };
