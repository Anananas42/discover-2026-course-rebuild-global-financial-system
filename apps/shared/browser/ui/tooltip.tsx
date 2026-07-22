import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { CircleHelp } from 'lucide-react';
import type { ReactNode } from 'react';

// shadcn-style tooltip on Radix primitives, styled with the shared
// tokens. `Explain` is the one shape the apps use: a term whose meaning
// deserves a sentence — dotted-underlined with a small question mark, so
// the explanation is visibly there, shown on hover or keyboard focus.

export function Explain({
  children,
  hint,
}: {
  /** The term being explained — rendered with a dotted underline and a
   *  small question mark. */
  children: ReactNode;
  /** The explanation, a sentence or two. */
  hint: ReactNode;
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={150}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <span className="cursor-help underline decoration-line decoration-dotted underline-offset-3">
            {children}
            <CircleHelp
              size={12}
              className="ml-1 inline align-[-1px] text-muted"
              aria-hidden
            />
          </span>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side="top"
            sideOffset={6}
            className="z-50 max-w-xs rounded-lg border border-line bg-page px-3 py-2 text-sm text-ink shadow-lg"
          >
            {hint}
            <TooltipPrimitive.Arrow className="fill-line" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
