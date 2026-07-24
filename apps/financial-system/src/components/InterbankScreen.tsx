import { Check, ChevronRight, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@banks/shared/browser/ui/collapsible.tsx';
import { vscodeHref } from '@banks/shared/browser/vscode-link.ts';

import { api } from '../api.ts';

// The messaging layer, made visible: institutions cannot reach into each
// other's databases, so everything between them travels as messages and
// calls — and this tab is where that traffic lives. Two halves, mirroring
// the Database tab's design: the contract (every message shape and every
// call, parsed live from the source so it can never drift — names link
// to the files), and the wire itself — a live feed of the messages that
// actually traveled, so an operation clicked on another tab shows up
// here as the notice or payment message it sent. Sections collapse and
// their headers pin while scrolling, like the Database tab's.

type Contract = Awaited<ReturnType<typeof api.interbank.contract.query>>;
type Section = Contract[number];
type Member = Section['interfaces'][number]['members'][number];
type WireMessages = Awaited<ReturnType<typeof api.interbank.messages.query>>;

const CHANNEL_LABEL: Record<WireMessages[number]['channel'], string> = {
  notice: 'notice',
  license: 'license',
  payment: 'payment message',
};

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

/** The pinned, click-to-toggle header row every section here shares —
 *  the Database tab's handle-header idiom. */
function SectionHeader({
  open,
  onOpenChange,
  ariaLabel,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-10 -mt-3 bg-page pt-3">
      <div className="border-b border-line pb-1">
        <div
          className="-mx-2 flex cursor-pointer items-baseline gap-2 rounded-md px-2 py-1.5 hover:bg-faint"
          onClick={rowToggle(() => onOpenChange(!open))}
        >
          <CollapsibleTrigger
            className="-m-1 cursor-pointer self-center rounded-md p-1"
            aria-label={ariaLabel}
          >
            <ChevronRight
              size={15}
              className={`text-muted transition-transform ${open ? 'rotate-90' : ''}`}
              aria-hidden
            />
          </CollapsibleTrigger>
          {children}
        </div>
      </div>
    </div>
  );
}

/** `commercialBanks.connectBank({ bankId, name })` — the call with
 *  parameter names only, ready to paste. An inline input object shows
 *  its field names; a named message parameter stays a name. */
function callText(prefix: string | null, member: Member): string {
  const inline = /\{([^}]*)\}/.exec(member.detail)?.[1];
  const args =
    inline === undefined
      ? (member.detail.split(':')[0]?.trim() ?? '')
      : `{ ${inline
          .split(';')
          .map(field => field.split(':')[0]?.trim() ?? '')
          .filter(name => name !== '')
          .join(', ')} }`;
  return `${prefix ? `${prefix}.` : ''}${member.name}(${args})`;
}

/** One call, written exactly the way task code writes it — a click
 *  copies it, like the Database tab's method rows. Calls with no
 *  binding to show (a sender reaches receivePayment only through the
 *  prebuilt deliverPayment) render bare. */
function CallRow({
  prefix,
  member,
}: {
  prefix: string | null;
  member: Member;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = () => {
    void navigator.clipboard?.writeText(callText(prefix, member));
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
        <code className="font-mono text-[13px]">
          {prefix && <span className="text-muted">{prefix}.</span>}
          <span className="text-accent">{member.name}</span>
          <span className="text-muted">(</span>
          {member.detail}
          <span className="text-muted">): {member.returnType}</span>
        </code>
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
      {member.doc && (
        <div className="px-2 text-xs text-muted">{member.doc}</div>
      )}
    </div>
  );
}

function ContractSection({
  section,
  open,
  onOpenChange,
}: {
  section: Section;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Two different things live in a contract file, and they read
  // differently: the calls (shown call-site first,
  // `commercialBanks.connectBank(...)`) and the message shapes those
  // calls carry (shown as the interface, verbatim) — never two
  // look-alike headers for different kinds.
  const calls = section.interfaces.flatMap(shape =>
    shape.members.filter(member => member.kind === 'method')
  );
  const shapes = section.interfaces.filter(shape =>
    shape.members.every(member => member.kind === 'field')
  );
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="mb-4">
      <SectionHeader
        open={open}
        onOpenChange={onOpenChange}
        ariaLabel={`Toggle ${section.title}`}
      >
        <a
          href={vscodeHref(section.abs)}
          title="Open this contract's file in VS Code"
          className="text-[15px] font-semibold hover:text-accent hover:underline"
        >
          {section.title}
        </a>
        <span className="ml-auto hidden font-mono text-[11px] text-muted sm:inline">
          {section.path}
        </span>
      </SectionHeader>
      <CollapsibleContent>
        <div className="ml-[6.5px] border-l-2 border-line/60 pl-5">
          {section.blurb && (
            <p className="mt-1.5 text-sm text-muted">{section.blurb}</p>
          )}
          {calls.length > 0 && (
            <div className="mt-2">
              <div className="text-xs font-semibold tracking-wider text-muted uppercase">
                The calls
              </div>
              <div className="mt-1 ml-1 rounded-r-lg border-l border-line bg-surface py-1 pr-2 pl-3">
                {calls.map(member => (
                  <CallRow
                    key={member.name}
                    prefix={section.callPrefix}
                    member={member}
                  />
                ))}
              </div>
            </div>
          )}
          {shapes.map(shape => (
            <div key={shape.name} className="mt-2">
              <div className="text-xs font-semibold tracking-wider text-muted uppercase">
                What a message carries
              </div>
              {shape.doc && (
                <div className="text-xs text-muted">{shape.doc}</div>
              )}
              {/* The shape as students meet it in the editor: the
                  interface, verbatim, with each field's doc right under
                  its line. */}
              <div className="mt-1 ml-1 rounded-r-lg border-l border-line bg-surface py-1.5 pr-2 pl-3">
                <code className="block px-2 font-mono text-[13px]">
                  <span className="text-muted">interface </span>
                  <span className="font-semibold">{shape.name}</span>
                  <span className="text-muted"> {'{'}</span>
                </code>
                {shape.members.map(member => (
                  <div key={member.name} className="py-0.5 pl-4">
                    <code className="block px-2 font-mono text-[13px]">
                      <span className="text-accent">{member.name}</span>
                      <span className="text-muted">: {member.detail};</span>
                    </code>
                    {member.doc && (
                      <div className="px-2 text-xs text-muted">
                        {member.doc}
                      </div>
                    )}
                  </div>
                ))}
                <code className="block px-2 font-mono text-[13px] text-muted">
                  {'}'}
                </code>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** One traveled message: time, channel, route, and its fields verbatim. */
function WireRow({ message }: { message: WireMessages[number] }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-line px-3 py-1.5 text-sm last:border-b-0">
      <span className="font-mono text-xs text-muted tabular-nums">
        {new Date(message.at).toLocaleTimeString()}
      </span>
      <span className="rounded-full border border-line px-2 py-0.5 text-xs whitespace-nowrap text-muted">
        {CHANNEL_LABEL[message.channel]}
      </span>
      <span className="whitespace-nowrap">
        {message.from} <span className="text-muted">→</span> {message.to}
      </span>
      <code className="font-mono text-xs text-muted">
        {Object.entries(message.fields)
          .map(([key, value]) => `${key}: ${value}`)
          .join('  ')}
      </code>
    </div>
  );
}

export function InterbankScreen({ version }: { version: number }) {
  const [contract, setContract] = useState<Contract | null>(null);
  const [messages, setMessages] = useState<WireMessages>([]);
  // Which sections are open — all of them, until the student folds some.
  const [opens, setOpens] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    void api.interbank.contract
      .query()
      .then(next => {
        if (!cancelled) setContract(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void api.interbank.messages
      .query()
      .then(next => {
        if (!cancelled) setMessages(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [version]);

  const feedOpen = opens['feed'] ?? true;
  const setFeedOpen = (next: boolean) =>
    setOpens(prev => ({ ...prev, feed: next }));

  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold">Interbank API</h2>
      <p className="mb-5 text-sm text-muted">
        Every institution keeps its own database, and none can write into
        another's. To make something happen at another institution, your code
        sends it a standardized message through the messaging layer every bank
        is connected to, or calls its API — the short list of things it lets
        others ask for. All of them are below. See actual message logs at the
        bottom of this page.
      </p>

      {contract?.map(section => (
        <ContractSection
          key={section.title}
          section={section}
          open={opens[section.title] ?? true}
          onOpenChange={next =>
            setOpens(prev => ({ ...prev, [section.title]: next }))
          }
        />
      ))}

      <Collapsible open={feedOpen} onOpenChange={setFeedOpen} className="mb-6">
        <SectionHeader
          open={feedOpen}
          onOpenChange={setFeedOpen}
          ariaLabel="Toggle the message log"
        >
          <span className="text-[15px] font-semibold">Message log</span>
        </SectionHeader>
        <CollapsibleContent>
          <div className="ml-[6.5px] border-l-2 border-line/60 pl-5">
            {messages.length === 0 ? (
              <p className="mt-2 text-sm text-muted">
                Nothing has been sent yet — the first notices appear with stage
                2, payment messages with stage 4.
              </p>
            ) : (
              <div className="mt-2 overflow-x-auto rounded-lg border border-line bg-surface">
                {/* Newest first: the message just sent is the one being
                    looked for. */}
                {[...messages].reverse().map(message => (
                  <WireRow key={message.seq} message={message} />
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
