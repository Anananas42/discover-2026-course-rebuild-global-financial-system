import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@banks/shared/browser/ui/collapsible.tsx';

// The collapsed-by-default shell for a persona screen's tool slices —
// the same glyph vocabulary as the tool tabs, so "this is the Database
// view, scoped to me" reads at a glance.

export function InspectorSection({
  glyph,
  label,
  open,
  onOpenChange,
  children,
}: {
  glyph: string;
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="rounded-xl border border-line"
    >
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-sm text-muted hover:text-ink">
        <span className="font-mono text-xs">{glyph}</span>
        <span className="font-semibold">{label}</span>
        <ChevronDown
          size={16}
          className={`ml-auto transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-line px-4 py-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
