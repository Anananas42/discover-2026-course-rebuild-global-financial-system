import { useEffect, useState } from 'react';

import type { CallLogEntry } from '../call-log.ts';
import { isUnread, markRead } from '../call-log.ts';
import { LogEntryRow } from './LogEntryRow.tsx';

// Every rendered log list goes through here: the dots mark what was
// unread at the moment the list opened, and rendering marks those
// entries read — so unread badges elsewhere clear immediately while the
// dots stay visible for this viewing.

export function LogEntries({
  entries,
  className,
}: {
  entries: CallLogEntry[];
  className?: string;
}) {
  const [unreadAtOpen] = useState(
    () => new Set(entries.filter(entry => isUnread(entry.id)).map(e => e.id))
  );

  useEffect(() => {
    markRead(entries.map(entry => entry.id));
  }, [entries]);

  return (
    <div className={className}>
      {entries.map(entry => (
        <LogEntryRow
          key={entry.id}
          entry={entry}
          unread={unreadAtOpen.has(entry.id)}
        />
      ))}
    </div>
  );
}
