import type { ReactNode } from 'react';

import { PORTS } from '@banks/shared/ports.ts';

// Curriculum text (apps/shared/curriculum.ts) is plain strings, but the
// financial system's tabs are URLs — so a story, requirement, or step
// can point straight at a view with a markdown-style link on the `fs:`
// scheme: `[Database tab](fs:/database)`. This renderer turns those into
// real links that open the financial system in a new tab; every other
// character passes through verbatim.
//
// A step that names the code it is about fences it the markdown way,
// and it renders as the same block the concept explainers use. Fences
// belong in steps only: those render inside a list item, where a block
// is valid, while stories and requirements render inside a paragraph.

const FS_LINK = /\[([^\]]+)\]\(fs:(\/[\w-]*)\)/g;
const FENCE = /```\n?([\s\S]*?)```/g;

const CODE_BLOCK =
  'my-2 overflow-x-auto rounded-lg border border-line bg-faint p-3 font-mono text-[13px] leading-relaxed';

/** A view in the financial system, by path — '/database' its god view. */
export function financialSystemHref(path = ''): string {
  return `http://localhost:${PORTS.financialSystem}${path}`;
}

/** An inline link into the financial system, for JSX prose (the
 *  explainers); curriculum strings get the same via CurriculumText. */
export function FinancialSystemLink({
  path,
  children,
}: {
  path: string;
  children: ReactNode;
}) {
  return (
    <a
      href={financialSystemHref(path)}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-accent hover:underline"
    >
      {children}
    </a>
  );
}

/** The prose runs: `fs:` links become links, everything else is
 *  verbatim. */
function prose(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(FS_LINK)) {
    parts.push(text.slice(last, match.index));
    parts.push(
      <FinancialSystemLink
        key={`${keyPrefix}-${match.index}`}
        path={match[2] ?? ''}
      >
        {match[1]}
      </FinancialSystemLink>
    );
    last = match.index + match[0].length;
  }
  parts.push(text.slice(last));
  return parts;
}

export function CurriculumText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(FENCE)) {
    parts.push(...prose(text.slice(last, match.index), `p${match.index}`));
    parts.push(
      <pre key={`c${match.index}`} className={CODE_BLOCK}>
        {(match[1] ?? '').trim()}
      </pre>
    );
    last = match.index + match[0].length;
  }
  parts.push(...prose(text.slice(last), 'p-end'));
  return <>{parts}</>;
}
