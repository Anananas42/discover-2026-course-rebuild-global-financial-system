import { RotateCw } from 'lucide-react';

import type { CallLogEntry } from '../call-log.ts';

// One call-log entry: time, procedure with input, outcome line, and — on
// failed entries — the retry that re-runs the recorded input. Used by the
// Log tab and by the per-screen log sections.

function OutcomeLine({ entry }: { entry: CallLogEntry }) {
  const ms = `${entry.durationMs.toFixed(0)} ms`;
  switch (entry.outcome.kind) {
    case 'ok':
      return (
        <div className="mt-0.5 text-[13px] text-muted">
          <span className="mr-1 text-ok">✓</span>done ·{' '}
          <span className="tabular-nums">{ms}</span>
        </div>
      );
    case 'domain':
      return (
        <div className="mt-0.5 text-[13px]">
          <span className="mr-1.5 font-mono text-xs font-semibold text-warn">
            {entry.outcome.tag}
          </span>
          {entry.outcome.message}
        </div>
      );
    case 'blocked':
      return (
        <div className="mt-0.5 text-[13px] text-muted">
          {entry.outcome.message}
        </div>
      );
    case 'defect':
      return (
        <div className="mt-0.5 text-[13px]">
          <span className="mr-1.5 font-mono text-xs font-semibold text-danger">
            Defect
          </span>
          {entry.outcome.message} — a bug in the code, not a rule of the system.
        </div>
      );
  }
}

export function LogEntryRow({
  entry,
  unread,
}: {
  entry: CallLogEntry;
  /** Marks an entry that was unread when this list opened. */
  unread?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-2.5">
      {/* Always rendered so read and unread rows stay aligned; centered
          on the first text line (2px padding + half of the 16px line,
          minus half the 6px dot). */}
      <span
        className={`mt-[7px] size-1.5 shrink-0 rounded-full ${unread ? 'bg-accent' : ''}`}
        aria-hidden
      />
      <span className="pt-0.5 font-mono text-xs text-muted tabular-nums">
        {entry.at.toTimeString().slice(0, 8)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-xs break-all">
          <span className="font-semibold">{entry.path}</span>{' '}
          <span className="text-muted">{JSON.stringify(entry.input)}</span>
        </div>
        <OutcomeLine entry={entry} />
      </div>
      {entry.outcome.kind !== 'ok' && (
        <button
          className="cursor-pointer self-start rounded-md border border-line p-1.5 text-muted hover:border-accent hover:text-accent"
          title="Retry with the same input"
          aria-label="Retry with the same input"
          onClick={entry.retry}
        >
          <RotateCw size={14} />
        </button>
      )}
    </div>
  );
}
