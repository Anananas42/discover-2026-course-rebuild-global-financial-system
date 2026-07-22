import {
  Check,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@banks/shared/browser/Button.tsx';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@banks/shared/browser/ui/collapsible.tsx';

import { api } from '../api.ts';

// The database API, listed for reference — the repos a task's code calls
// to read and write the books. Parsed live from source on the server
// (db-api-reference.ts), so it can never drift from the real classes.
// One group per repo, folding independently; a click copies a
// ready-to-paste call, `bankRepo.create({ name })`. It sits above the
// live tables as the "how to reach this data" companion to the "what is
// in it" god view.

type Groups = Awaited<ReturnType<typeof api.debug.dbApi.query>>;
type Method = Groups[number]['methods'][number];

/** `bankRepo.name({ param, param })` — the call with parameter names
 *  only; object-input methods (all repo methods) show their braces. */
function callText(repo: string, method: Method): string {
  const names = method.params.map(p => p.name).join(', ');
  const args = method.objectInput ? `{ ${names} }` : names;
  return `${repo}.${method.name}(${args})`;
}

/** A syntax-highlighted signature, using the semantic theme tokens. */
function Signature({ repo, method }: { repo: string; method: Method }) {
  return (
    <code className="font-mono text-[13px]">
      <span className="text-muted">{repo}.</span>
      <span className="text-accent">{method.name}</span>
      <span className="text-muted">({method.objectInput && '{ '}</span>
      {method.params.map((param, i) => (
        <span key={param.name}>
          {param.name}
          <span className="text-muted">: {param.type}</span>
          {i < method.params.length - 1 && (
            <span className="text-muted">, </span>
          )}
        </span>
      ))}
      <span className="text-muted">{method.objectInput && ' }'})</span>
      <span className="text-muted">: {method.returnType}</span>
    </code>
  );
}

function MethodRow({ repo, method }: { repo: string; method: Method }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = () => {
    void navigator.clipboard?.writeText(callText(repo, method));
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="py-1">
      <button
        type="button"
        onClick={copy}
        title="Copy the call"
        className="group flex w-full cursor-pointer items-baseline gap-3 rounded-md px-2 py-1 text-left hover:bg-faint"
      >
        <Signature repo={repo} method={method} />
        <span
          className={`ml-auto flex items-center gap-1 text-xs whitespace-nowrap ${
            copied ? 'text-ok' : 'text-muted opacity-0 group-hover:opacity-100'
          }`}
        >
          {copied ? (
            <>
              <Check size={13} aria-hidden /> Copied
            </>
          ) : (
            <Copy size={13} aria-hidden />
          )}
        </span>
      </button>
      {method.doc && (
        <div className="px-2 text-xs text-muted">{method.doc}</div>
      )}
    </div>
  );
}

function RepoGroup({
  group,
  open,
  onOpenChange,
}: {
  group: Groups[number];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="mt-1">
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-2 py-1.5 text-left">
        <ChevronRight
          size={15}
          className={`text-muted transition-transform ${open ? 'rotate-90' : ''}`}
          aria-hidden
        />
        <span className="font-mono text-[15px] font-semibold">
          {group.repo}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-1 rounded-r-lg border-l border-line bg-surface py-1 pr-2 pl-3">
        {group.methods.map(method => (
          <MethodRow key={method.name} repo={group.repo} method={method} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function DbApiReference() {
  const [groups, setGroups] = useState<Groups | null>(null);
  // Which repos are open — all of them, until the student folds some. The
  // header button collapses everything, or expands everything once all
  // are collapsed.
  const [opens, setOpens] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    void api.debug.dbApi
      .query()
      .then(next => {
        if (!cancelled) setGroups(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!groups) return null;

  const anyOpen = groups.some(group => opens[group.repo] ?? true);

  return (
    <div className="mb-7">
      {/* Titled like an institution block below, so it reads as another
          section of the same page rather than a card apart. */}
      <div className="mb-2 flex items-center justify-between border-b border-line pb-1.5">
        <span className="text-xs font-semibold tracking-wider text-muted uppercase">
          Database API
        </span>
        <Button
          className="mb-1 py-1 text-xs text-muted"
          onClick={() =>
            setOpens(
              Object.fromEntries(groups.map(group => [group.repo, !anyOpen]))
            )
          }
        >
          {anyOpen ? (
            <ChevronsDownUp size={13} aria-hidden />
          ) : (
            <ChevronsUpDown size={13} aria-hidden />
          )}
          {anyOpen ? 'Collapse all' : 'Expand all'}
        </Button>
      </div>
      {groups.map(group => (
        <RepoGroup
          key={group.repo}
          group={group}
          open={opens[group.repo] ?? true}
          onOpenChange={next =>
            setOpens(prev => ({ ...prev, [group.repo]: next }))
          }
        />
      ))}
    </div>
  );
}
