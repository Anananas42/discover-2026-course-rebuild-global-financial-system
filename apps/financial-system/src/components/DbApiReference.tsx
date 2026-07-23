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
import { vscodeHref } from '@banks/shared/browser/vscode-link.ts';

import { api } from '../api.ts';

// The database API, listed for reference — one section per institution
// handle, exactly the variable a task binds (`centralBankDb`,
// `commercialBankDb`), each carrying its repositories and its own
// `transaction`. Parsed live from source on the server
// (db-api-reference.ts), so it can never drift from the real classes.
// One section per handle and one group per repo, each folding
// independently; a name opens its own source file in VS Code, and a
// click on a method copies a ready-to-paste call,
// `centralBankDb.accounts.create({ owner })`. It
// sits above the live tables as the "how to reach this data" companion
// to the "what is in it" god view.

type Handles = Awaited<ReturnType<typeof api.debug.dbApi.query>>;
type Handle = Handles[number];
type Repo = Handle['repos'][number];
type Method = Repo['methods'][number];

/** `centralBankDb.accounts.create({ owner, number })` — the call with
 *  parameter names only; object-input methods (all repo methods) show
 *  their braces. */
function callText(prefix: string, method: Method): string {
  const names = method.params.map(p => p.name).join(', ');
  const args = method.objectInput ? `{ ${names} }` : names;
  return `${prefix}.${method.name}(${args})`;
}

/** A syntax-highlighted signature, using the semantic theme tokens. */
function Signature({ prefix, method }: { prefix: string; method: Method }) {
  return (
    <code className="font-mono text-[13px]">
      <span className="text-muted">{prefix}.</span>
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

function MethodRow({ prefix, method }: { prefix: string; method: Method }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = () => {
    void navigator.clipboard?.writeText(callText(prefix, method));
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
        <Signature prefix={prefix} method={method} />
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

/** A click anywhere on a header row toggles its section — except on the
 *  links, which keep their own action, and on the chevron, which is the
 *  real trigger and already toggles. */
function rowToggle(toggle: () => void) {
  return (event: React.MouseEvent) => {
    if (event.target instanceof Element && event.target.closest('a, button'))
      return;
    toggle();
  };
}

function RepoGroup({
  handle,
  repo,
  open,
  onOpenChange,
}: {
  handle: string;
  repo: Repo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="mt-1">
      {/* The name is a link to the repo's own source file — where the
          methods below actually live — so it is carved out of the row's
          click-to-toggle. */}
      {/* The -mx-2/px-2 pair widens the hover pill past the text without
          moving it, like the method rows' own pills. */}
      <div
        className="-mx-2 flex cursor-pointer items-baseline gap-2 rounded-md px-2 py-1.5 hover:bg-faint"
        onClick={rowToggle(() => onOpenChange(!open))}
      >
        <CollapsibleTrigger
          className="-m-1 cursor-pointer self-center rounded-md p-1"
          aria-label={`Toggle ${handle}.${repo.name} methods`}
        >
          <ChevronRight
            size={15}
            className={`text-muted transition-transform ${open ? 'rotate-90' : ''}`}
            aria-hidden
          />
        </CollapsibleTrigger>
        <a
          href={vscodeHref(repo.abs)}
          title="Open this repository's file in VS Code"
          className="font-mono text-[15px] font-semibold hover:text-accent hover:underline"
        >
          <span className="font-normal text-muted">{handle}.</span>
          {repo.name}
        </a>
        <span className="hidden font-mono text-[11px] text-muted sm:inline">
          {repo.path}
        </span>
      </div>
      <CollapsibleContent className="ml-1 rounded-r-lg border-l border-line bg-surface py-1 pr-2 pl-3">
        {repo.methods.map(method => (
          <MethodRow
            key={method.name}
            prefix={`${handle}.${repo.name}`}
            method={method}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function HandleSection({
  handle,
  opens,
  onOpenChange,
}: {
  handle: Handle;
  opens: Record<string, boolean>;
  onOpenChange: (key: string, open: boolean) => void;
}) {
  const open = opens[handle.handle] ?? true;
  return (
    <Collapsible
      open={open}
      onOpenChange={next => onOpenChange(handle.handle, next)}
      // The -mt-3 cancels the sticky wrapper's pt-3 in the static
      // layout. It must live up here: on the sticky element itself a
      // negative margin would shift the stuck position above the
      // viewport, scrolling the opaque strip out of sight.
      className="-mt-3 mb-4"
    >
      {/* The handle line: the exact variable a task binds, linked to the
          file defining it, so the link is carved out of the row's
          click-to-toggle. Pinned while its repos scroll, like the
          institution headers below. The wrapper (not the row) is sticky
          and carries the page background, its pt-3 the opaque strip that
          content slides under; the row reaches back up over the strip
          with its own -mt-3/pt-3, so the hover tint covers the whole
          band, not just the line of text. */}
      <div className="sticky top-0 z-10 bg-page pt-3">
        <div
          className="-mt-3 flex cursor-pointer items-baseline gap-2 rounded-t-md border-b border-line px-2 pt-3 pb-1 hover:bg-faint"
          onClick={rowToggle(() => onOpenChange(handle.handle, !open))}
        >
          <CollapsibleTrigger
            className="-m-1 cursor-pointer self-center rounded-md p-1"
            aria-label={`Toggle ${handle.handle} repositories`}
          >
            <ChevronRight
              size={15}
              className={`text-muted transition-transform ${open ? 'rotate-90' : ''}`}
              aria-hidden
            />
          </CollapsibleTrigger>
          <a
            href={vscodeHref(handle.abs)}
            title="Open this handle's file in VS Code"
            className="font-mono text-[15px] font-semibold hover:text-accent hover:underline"
          >
            {handle.handle}
          </a>
          <span className="hidden font-mono text-[11px] text-muted sm:inline">
            {handle.path}
          </span>
        </div>
      </div>
      <CollapsibleContent>
        {/* The rail, as in the guide's stage list: a vertical line
            dropping from under the handle line's chevron (the line's px-2
            plus half the 15px icon, minus half its own 2px width =
            14.5px), with the repos indented beside it. */}
        <div className="ml-[14.5px] border-l-2 border-line/60 pl-5">
          {handle.repos.map(repo => (
            <RepoGroup
              key={`${handle.handle}.${repo.name}`}
              handle={handle.handle}
              repo={repo}
              open={opens[`${handle.handle}.${repo.name}`] ?? true}
              onOpenChange={next =>
                onOpenChange(`${handle.handle}.${repo.name}`, next)
              }
            />
          ))}
          {handle.transaction && (
            <div className="mt-1 ml-6">
              <MethodRow prefix={handle.handle} method={handle.transaction} />
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function DbApiReference() {
  const [handles, setHandles] = useState<Handles | null>(null);
  // Which handle sections and repo groups are open — all of them, until
  // the student folds some. The header button collapses everything, or
  // expands everything once all are collapsed.
  const [opens, setOpens] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    void api.debug.dbApi
      .query()
      .then(next => {
        if (!cancelled) setHandles(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!handles) return null;

  const keys = handles.flatMap(handle => [
    handle.handle,
    ...handle.repos.map(repo => `${handle.handle}.${repo.name}`),
  ]);
  const anyOpen = keys.some(key => opens[key] ?? true);

  return (
    <div className="mb-7">
      {/* Titled like an institution block below, so it reads as another
          section of the same page rather than a card apart. mb-5 less
          the first handle section's -mt-3 nets the intended mb-2 gap. */}
      <div className="mb-5 flex items-center justify-between border-b border-line pb-1.5">
        <span className="text-xs font-semibold tracking-wider text-muted uppercase">
          Database API
        </span>
        <Button
          className="mb-1 py-1 text-xs text-muted"
          onClick={() =>
            setOpens(Object.fromEntries(keys.map(key => [key, !anyOpen])))
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
      {handles.map(handle => (
        <HandleSection
          key={handle.handle}
          handle={handle}
          opens={opens}
          onOpenChange={(key, next) =>
            setOpens(prev => ({ ...prev, [key]: next }))
          }
        />
      ))}
    </div>
  );
}
