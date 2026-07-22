// The toast vocabulary, one function per outcome kind. Success narrations
// auto-dismiss — the state change is the real confirmation and the log
// keeps the record. Domain errors and defects stay until dismissed: in a
// debugging tool the error text is the payload and must not evaporate
// mid-read. (Blocked outcomes render inline in the operation dialog
// instead — being blocked is a property of the operation, not an event.)

import type { ReactNode } from 'react';
import { toast } from 'sonner';

import type { Outcome } from '../error-outcome.ts';

const KIND_BORDER: Record<'ok' | Outcome['kind'], string> = {
  ok: 'border-l-ok',
  domain: 'border-l-warn',
  blocked: 'border-l-line',
  defect: 'border-l-danger',
};

function show(
  kind: 'ok' | Outcome['kind'],
  content: ReactNode,
  duration: number
): void {
  toast.custom(
    id => (
      <div
        className={`flex w-[560px] max-w-[calc(100vw-2rem)] items-start gap-2 rounded-lg border border-line border-l-4 bg-page px-3.5 py-2.5 text-sm text-ink shadow-lg ${KIND_BORDER[kind]}`}
      >
        <div className="flex-1">{content}</div>
        <button
          className="cursor-pointer text-xs text-muted hover:text-ink"
          aria-label="Dismiss"
          onClick={() => toast.dismiss(id)}
        >
          ✕
        </button>
      </div>
    ),
    { duration }
  );
}

export function toastSuccess(narration: string): void {
  show(
    'ok',
    <span>
      <span className="mr-1 text-ok">✓</span>
      {narration}
    </span>,
    6000
  );
}

export function toastOutcome(outcome: Outcome): void {
  show(
    outcome.kind,
    <span>
      {outcome.kind !== 'blocked' && (
        <span
          className={`mr-1.5 font-mono text-xs font-semibold ${
            outcome.kind === 'domain' ? 'text-warn' : 'text-danger'
          }`}
        >
          {outcome.kind === 'domain' ? outcome.tag : 'Defect'}
        </span>
      )}
      {outcome.message}
    </span>,
    Infinity
  );
}
