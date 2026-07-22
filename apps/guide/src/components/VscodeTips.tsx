import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@banks/shared/browser/ui/collapsible.tsx';

// Editor tips are reference material, not course content, so the page's
// last section speaks in the appendix voice the task cards established:
// a small-caps disclosure label, folded by default, the table on demand.

function Key({ children }: { children: ReactNode }) {
  return (
    <code className="rounded border border-line bg-faint px-1.5 py-0.5 text-xs">
      {children}
    </code>
  );
}

export function VscodeTips() {
  const [open, setOpen] = useState(false);

  return (
    <section className="mt-8 border-t border-line pt-5">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex cursor-pointer items-baseline gap-1 text-left text-xs font-semibold tracking-wider text-muted uppercase hover:text-ink">
          <ChevronRight
            size={13}
            className={`self-center transition-transform ${open ? 'rotate-90' : ''}`}
            aria-hidden
          />
          Finding your way in VS Code
        </CollapsibleTrigger>
        <CollapsibleContent>
          <table className="mt-3 w-full border-collapse text-sm">
            <tbody>
              <tr>
                <td className="w-52 border-b border-line py-2 pr-6 align-top font-medium">
                  See the code behind a name
                </td>
                <td className="border-b border-line py-2 text-muted">
                  Hold <Key>Ctrl</Key> and click any name — a method, a type, an
                  error — to see where it is defined and used.
                </td>
              </tr>
              <tr>
                <td className="w-52 border-b border-line py-2 pr-6 align-top font-medium">
                  See what a method gives back
                </td>
                <td className="border-b border-line py-2 text-muted">
                  Hover a name. Every bank method shows a type like{' '}
                  <code className="rounded bg-faint px-1">
                    Effect.Effect&lt;Transaction, InvalidAmountError |
                    InsufficientFundsError, never&gt;
                  </code>{' '}
                  with up to three parts, in order:
                  <ol className="mt-1 list-decimal space-y-0.5 pl-6">
                    <li>
                      <code className="rounded bg-faint px-1">Transaction</code>{' '}
                      — what you get when the call succeeds,
                    </li>
                    <li>
                      <code className="rounded bg-faint px-1">
                        InvalidAmountError
                      </code>{' '}
                      or{' '}
                      <code className="rounded bg-faint px-1">
                        InsufficientFundsError
                      </code>{' '}
                      — the complete list of ways it can fail; if an error is
                      not in that list, the method cannot fail with it,
                    </li>
                    <li>
                      <code className="rounded bg-faint px-1">never</code> — you
                      can ignore this part. It lists the method's dependencies;{' '}
                      <code className="rounded bg-faint px-1">never</code> means
                      it has none.
                    </li>
                  </ol>
                </td>
              </tr>
              <tr>
                <td className="w-52 border-b border-line py-2 pr-6 align-top font-medium">
                  Open a file by name
                </td>
                <td className="border-b border-line py-2 text-muted">
                  <Key>Ctrl</Key>+<Key>P</Key>, then type part of the file name.
                </td>
              </tr>
              <tr>
                <td className="w-52 border-b border-line py-2 pr-6 align-top font-medium">
                  Find text anywhere in the project
                </td>
                <td className="border-b border-line py-2 text-muted">
                  <Key>Ctrl</Key>+<Key>Shift</Key>+<Key>F</Key>.
                </td>
              </tr>
            </tbody>
          </table>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
