// The workbench's tab bar: three persona screens — who you are acting as
// — and, set apart on the right, the tool surfaces that no real
// stakeholder has: the interbank wire, the raw database, and the call
// log. Which tabs exist follows the curriculum: a gated tab appears
// once any of its tasks is unlocked (see gating.ts) — the caller
// passes the visible set.

import {
  ArrowLeftRight,
  Building2,
  Database,
  Landmark,
  ScrollText,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type TabId =
  | 'central-bank'
  | 'commercial-bank'
  | 'people'
  | 'interbank-api'
  | 'database'
  | 'log';

/** Every tab in display order. A tab's id is also its URL path
 *  (`/database`), so views can be deep-linked — the guide does. */
export const TAB_IDS: TabId[] = [
  'central-bank',
  'commercial-bank',
  'people',
  'interbank-api',
  'database',
  'log',
];

const PERSONAS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'central-bank', label: 'Central Bank', icon: Landmark },
  { id: 'commercial-bank', label: 'Commercial Bank', icon: Building2 },
  { id: 'people', label: 'People', icon: Users },
];

const TOOLS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'interbank-api', label: 'Interbank API', icon: ArrowLeftRight },
  { id: 'database', label: 'Database', icon: Database },
  { id: 'log', label: 'Log', icon: ScrollText },
];

export function TabBar({
  active,
  visible,
  onChange,
}: {
  active: TabId;
  /** The tabs to show, from gating.ts — others render nothing. */
  visible: TabId[];
  onChange: (tab: TabId) => void;
}) {
  const tabClass = (id: TabId, tool: boolean) =>
    `inline-flex cursor-pointer items-center gap-1.5 border-b-2 px-3.5 pt-3 pb-2.5 ${tool ? 'text-[13px]' : 'text-sm'} ${
      active === id
        ? 'border-accent font-semibold text-ink'
        : 'border-transparent text-muted hover:text-ink'
    }`;

  return (
    <nav className="border-b border-line" aria-label="Screens">
      <div className="mx-auto flex max-w-6xl items-stretch gap-1 px-6">
        {PERSONAS.filter(tab => visible.includes(tab.id)).map(tab => (
          <button
            key={tab.id}
            className={tabClass(tab.id, false)}
            aria-selected={active === tab.id}
            role="tab"
            onClick={() => onChange(tab.id)}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
        <span className="flex-1" />
        {TOOLS.filter(tab => visible.includes(tab.id)).map(tab => (
          <button
            key={tab.id}
            className={tabClass(tab.id, true)}
            aria-selected={active === tab.id}
            role="tab"
            onClick={() => onChange(tab.id)}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
