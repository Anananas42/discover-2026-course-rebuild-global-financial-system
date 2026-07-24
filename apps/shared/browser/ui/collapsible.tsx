import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import type { ComponentProps } from 'react';

// shadcn-style collapsible on Radix primitives. The trigger and content
// carry their look at the call site, styled with the shared tokens; the
// content adds the one behavior every disclosure shares — a brief height
// ease on open and close (Radix keeps the closing panel mounted until
// its animation ends, so both directions play).

export const Collapsible = CollapsiblePrimitive.Root;
export const CollapsibleTrigger = CollapsiblePrimitive.Trigger;

export function CollapsibleContent({
  className,
  ...props
}: ComponentProps<typeof CollapsiblePrimitive.Content>) {
  return (
    <CollapsiblePrimitive.Content
      className={`overflow-hidden data-[state=closed]:animate-collapsible-close data-[state=open]:animate-collapsible-open motion-reduce:animate-none ${className ?? ''}`}
      {...props}
    />
  );
}
