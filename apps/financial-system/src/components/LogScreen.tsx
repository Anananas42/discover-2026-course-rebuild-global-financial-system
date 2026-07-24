import { useSyncExternalStore } from 'react';

import { getCallLog, subscribeCallLog } from '../call-log.ts';
import { LogEntries } from './LogEntries.tsx';

// The call log: every operation, newest first — the trace that explains
// the state, persisted in this browser and cleared by Reset. History is
// append-only; a retry adds a new entry (see LogEntryRow).

export function LogScreen() {
  const entries = useSyncExternalStore(subscribeCallLog, getCallLog);

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">Log</h2>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">
          No operations yet — everything you run appears here, newest first.
        </div>
      ) : (
        <LogEntries
          entries={entries}
          className="divide-y divide-line rounded-xl border border-line"
        />
      )}
    </section>
  );
}
