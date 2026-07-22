import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@banks/shared/browser/Button.tsx';

import { api } from '../api.ts';
import { clearCallLog } from '../call-log.ts';
import { outcomeOf } from '../outcome-of.ts';
import { toastOutcome, toastSuccess } from '../toasts.tsx';
import { DbApiReference } from './DbApiReference.tsx';
import { InstitutionBooks } from './InstitutionBooks.tsx';

// The god view: every institution's books, verbatim, straight from the
// database — deliberately bypassing the domain so it stays truthful when
// the domain code is wrong. Amounts render as the raw minor units they
// are stored as; the gap between this tab and every other tab is the
// design. Reset lives here because the god view owns the god action.

type Dump = Awaited<ReturnType<typeof api.debug.dump.query>>;

interface Config {
  country: string;
  currency: string;
  decimals: number;
}

export function DatabaseScreen({
  version,
  config,
}: {
  version: number;
  config: Config;
}) {
  const [dump, setDump] = useState<Dump | null>(null);

  useEffect(() => {
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
  }, [version]);

  const reset = async () => {
    const warning =
      'Delete all financial system data? Tests use a separate database and are unaffected.';
    if (!confirm(warning)) return;
    try {
      await api.debug.reset.mutate();
      // A new world starts with a new trace — stale log entries would
      // match the recycled bank and account ids.
      clearCallLog();
      toastSuccess('The financial system is reset — every table is empty.');
    } catch (error) {
      toastOutcome(outcomeOf(error));
    }
  };

  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold">Database</h2>
      <p className="mb-5 text-sm text-muted">
        {config.decimals > 0
          ? `Amounts are raw minor units: ${String(10 ** config.decimals)} per ${config.currency}.`
          : `Amounts are whole ${config.currency}.`}{' '}
        If a screen and this page disagree, this page is right.
      </p>

      <DbApiReference />

      {dump?.map(institution => (
        <InstitutionBooks key={institution.schema} institution={institution} />
      ))}

      <div className="mt-8 flex flex-wrap items-center gap-4 rounded-xl border border-line px-4 py-3">
        <p className="min-w-64 flex-1 text-sm text-muted">
          Reset deletes every row of every institution and starts the country
          from nothing. Tests use a separate database and are unaffected.
        </p>
        <Button
          className="border-danger text-danger"
          onClick={() => void reset()}
        >
          <Trash2 size={16} /> Reset the financial system
        </Button>
      </div>
    </section>
  );
}
