import type { ReactNode } from 'react';

import { Explain } from '@banks/shared/browser/ui/tooltip.tsx';

// Groups a screen's operation buttons by what the operations do to
// money: 'Credit' creates and destroys it (lend, repay, write off),
// 'Payments' only moves it, and identity or registry actions touch no
// money at all. The captions meet the student where the curriculum is:
// the credit group appears when lending unlocks, so its caption says
// "money creation" and leaves destruction to the repay and write-off
// dialogs that unlock later. A `debug` group sits outside that taxonomy
// — levers that poke the machinery rather than act in the economy — and
// is set apart by a dashed border, as are its buttons.

export function ActionGroup({
  label,
  hint,
  debug,
  children,
}: {
  label: string;
  /** What the group's operations do to the records — the mechanics behind
   *  the buttons, shown as an Explain tooltip on the caption. */
  hint?: ReactNode;
  /** A machinery group, not an economic one — dashed border. */
  debug?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border border-line px-3.5 py-2.5 ${
        debug ? 'border-dashed' : ''
      }`}
    >
      <div className="mb-1.5 text-xs font-semibold tracking-wider text-muted uppercase">
        {hint ? <Explain hint={hint}>{label}</Explain> : label}
      </div>
      <div className="flex flex-wrap gap-2.5">{children}</div>
    </div>
  );
}
