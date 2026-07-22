import { Undo2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@banks/shared/browser/Button.tsx';

import { api } from '../api.ts';
import { outcomeOf } from '../outcome-of.ts';
import { toastOutcome, toastSuccess } from '../toasts.tsx';

// The conservation bar under a balance sheet, shown only while the sheet
// does not balance. The screen passes the sentence naming its own totals;
// the way back is shared: the server remembers the state after every
// operation that left every sheet balanced, and the revert restores it —
// so debug experiments never corrupt the state irreversibly.

export function UnbalancedBar({ children }: { children: ReactNode }) {
  const revert = async () => {
    const warning =
      'Revert to the last balanced state? Every change made since then is lost.';
    if (!confirm(warning)) return;
    try {
      await api.debug.revertToBalanced.mutate();
      toastSuccess('The last balanced state is restored.');
    } catch (error) {
      toastOutcome(outcomeOf(error));
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-line bg-danger/10 px-4 py-2.5 text-sm text-danger">
      <p className="min-w-64 flex-1">{children}</p>
      <Button onClick={() => void revert()}>
        <Undo2 size={16} /> Revert to the last balanced state
      </Button>
    </div>
  );
}
