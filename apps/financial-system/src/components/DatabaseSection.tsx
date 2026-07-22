import { useEffect, useState } from 'react';

import { api } from '../api.ts';
import { InspectorSection } from './InspectorSection.tsx';
import { InstitutionBooks } from './InstitutionBooks.tsx';

// A persona screen's slice of the Database god view: only the schemas
// that are this persona's own books, collapsed by default, fetched only
// while open. The full, unfiltered truth stays on the Database tab.

type Dump = Awaited<ReturnType<typeof api.debug.dump.query>>;

export function DatabaseSection({
  version,
  label,
  schemas,
}: {
  version: number;
  label: string;
  /** Schema names to show, e.g. ['central_bank'] or ['bank_1']. */
  schemas: string[];
}) {
  const [open, setOpen] = useState(false);
  const [dump, setDump] = useState<Dump | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void api.debug.dump
      .query()
      .then(next => {
        if (!cancelled) setDump(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, version]);

  const slice = dump?.filter(institution =>
    schemas.includes(institution.schema)
  );

  return (
    <InspectorSection
      glyph="⌗"
      label={label}
      open={open}
      onOpenChange={setOpen}
    >
      {slice?.length ? (
        slice.map(institution => (
          <InstitutionBooks
            key={institution.schema}
            institution={institution}
          />
        ))
      ) : (
        <p className="text-sm text-muted">Nothing here yet.</p>
      )}
    </InspectorSection>
  );
}
