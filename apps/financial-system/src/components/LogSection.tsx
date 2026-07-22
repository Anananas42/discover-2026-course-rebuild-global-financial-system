import { useState, useSyncExternalStore } from 'react';

import { getCallLog, subscribeCallLog } from '../call-log.ts';
import { InspectorSection } from './InspectorSection.tsx';
import { LogEntries } from './LogEntries.tsx';

// A persona screen's slice of the call log: the operations this persona
// initiates (the same initiator rule that places the action buttons),
// filtered by procedure path. The full trace stays on the Log tab.

export function LogSection({
  label,
  pathPrefixes,
}: {
  label: string;
  /** Procedure path prefixes this persona initiates, e.g. ['centralBank.']. */
  pathPrefixes: string[];
}) {
  const [open, setOpen] = useState(false);
  const entries = useSyncExternalStore(subscribeCallLog, getCallLog);
  const slice = entries.filter(entry =>
    pathPrefixes.some(prefix => entry.path.startsWith(prefix))
  );

  return (
    <InspectorSection
      glyph="≡"
      label={label}
      open={open}
      onOpenChange={setOpen}
    >
      {slice.length === 0 ? (
        <p className="text-sm text-muted">
          No operations yet — the ones run from this screen appear here, newest
          first.
        </p>
      ) : (
        <LogEntries
          entries={slice}
          className="divide-y divide-line rounded-lg border border-line"
        />
      )}
    </InspectorSection>
  );
}
