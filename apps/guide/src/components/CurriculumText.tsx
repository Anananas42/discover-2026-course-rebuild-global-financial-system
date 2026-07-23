import type { ReactNode } from 'react';

import { PORTS } from '@banks/shared/ports.ts';

// Curriculum text (apps/shared/curriculum.ts) is plain strings, but the
// financial system's tabs are URLs — so a story, requirement, or step
// can point straight at a view with a markdown-style link on the `fs:`
// scheme: `[Database tab](fs:/database)`. This renderer turns those into
// real links that open the financial system in a new tab; every other
// character passes through verbatim.

const FS_LINK = /\[([^\]]+)\]\(fs:(\/[\w-]*)\)/g;

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

export function CurriculumText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(FS_LINK)) {
    parts.push(text.slice(last, match.index));
    parts.push(
      <FinancialSystemLink key={match.index} path={match[2] ?? ''}>
        {match[1]}
      </FinancialSystemLink>
    );
    last = match.index + match[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}
