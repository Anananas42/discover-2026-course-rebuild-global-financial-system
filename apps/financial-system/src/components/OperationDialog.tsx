import { Pencil } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';

import { ActionButton } from '@banks/shared/browser/ActionButton.tsx';
import { Button } from '@banks/shared/browser/Button.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@banks/shared/browser/ui/dialog.tsx';

import type { Outcome } from '../../error-outcome.ts';
import { outcomeOf } from '../outcome-of.ts';
import { toastOutcome, toastSuccess } from '../toasts.tsx';

// The shell every operation shares: a trigger button that opens the form
// as a dialog, a Run button, and one rule per outcome kind — success
// closes the dialog and narrates in a toast (the state change is the real
// confirmation); domain errors and defects toast sticky while the form
// stays open for correction; blocked renders inline, because "the code
// behind this doesn't exist yet" is a property of the operation, not an
// event. Adding an operation to a screen = a small component around this
// shell; see OpenBankDialog for the pattern.
//
// Two trigger shapes, one per kind of thing an operation is: ordinary
// operations get a button — washed with the brand yellow, marking the
// do-something controls apart from the apps' plain chrome buttons; a
// `gauge` operation — a policy dial like the rates — is triggered by the
// pill that displays its current value, so the reading and the knob are
// one control.

interface OperationDialogProps {
  /** Content of the trigger button — usually a label, sometimes an icon. */
  trigger: ReactNode;
  /** Accessible name for the trigger when it is an icon. */
  triggerLabel?: string;
  /** Renders the trigger as a clickable value pill instead of a button —
   *  for policy dials, where the display is the control. */
  gauge?: boolean;
  /** A machinery lever, not an economic operation — the trigger renders
   *  as a plain dashed button without the action wash, quieter than the
   *  do-something buttons and matching its Debug group. */
  debug?: boolean;
  /** When set, the operation is unavailable: the trigger renders
   *  disabled with this reason as its tooltip, and the dialog never
   *  opens — the button says why instead of opening onto an apology. */
  disabledReason?: string;
  title: string;
  /** What the operation does in the domain's terms — one sentence, plus
   *  optionally a worked example as a final `block` span. */
  description: ReactNode;
  runLabel: string;
  /** Runs the operation; resolves to the success narration. */
  onRun: () => Promise<string>;
  /** Widens the dialog — for forms with side-by-side parties. */
  wide?: boolean;
  children: ReactNode;
}

export function OperationDialog({
  trigger,
  triggerLabel,
  gauge,
  debug,
  disabledReason,
  title,
  description,
  runLabel,
  onRun,
  wide,
  children,
}: OperationDialogProps) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [blocked, setBlocked] = useState<Outcome | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setRunning(true);
    try {
      toastSuccess(await onRun());
      setOpen(false);
    } catch (error) {
      const outcome = outcomeOf(error);
      if (outcome.kind === 'blocked') setBlocked(outcome);
      else toastOutcome(outcome);
    } finally {
      setRunning(false);
    }
  };

  const unavailable = disabledReason !== undefined;
  const triggerButton = gauge ? (
    <button
      type="button"
      disabled={unavailable}
      className="flex cursor-pointer items-baseline gap-1.5 rounded-full border border-line bg-surface px-2.5 py-0.5 text-sm hover:bg-faint disabled:cursor-default disabled:opacity-50"
      title={disabledReason ?? triggerLabel}
      aria-label={triggerLabel}
    >
      {trigger}
      <Pencil size={11} className="self-center text-muted" aria-hidden />
    </button>
  ) : debug ? (
    <Button
      disabled={unavailable}
      title={disabledReason ?? triggerLabel}
      aria-label={triggerLabel}
      className="border-dashed shadow-md"
    >
      {trigger}
    </Button>
  ) : (
    <ActionButton
      disabled={unavailable}
      title={disabledReason ?? triggerLabel}
      aria-label={triggerLabel}
    >
      {trigger}
    </ActionButton>
  );

  // Unavailable: the button carries the reason; there is nothing to open.
  if (unavailable) return triggerButton;

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        setOpen(next);
        if (!next) setBlocked(null);
      }}
    >
      <DialogTrigger asChild>{triggerButton}</DialogTrigger>
      <DialogContent className={wide ? '!max-w-3xl' : ''}>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <form onSubmit={submit} className="flex flex-col gap-4">
          {children}
          <div className="mt-1">
            <Button
              type="submit"
              disabled={running}
              className="border-transparent bg-accent-fill font-semibold text-accent-ink"
            >
              {runLabel}
            </Button>
          </div>
        </form>
        {blocked && (
          <div className="mt-4 rounded-md bg-faint px-3 py-2 text-sm text-muted">
            <span className="font-mono text-xs font-semibold">Blocked</span>
            <br />
            {blocked.message} The operation unlocks once that task's code
            exists.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
