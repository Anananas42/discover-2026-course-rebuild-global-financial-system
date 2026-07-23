// The interbank contract, parsed from the source at request time so the
// reference the workbench shows can never drift from the real code —
// the same no-second-source rule the Db API panel follows. One section
// per direction institutions talk in, each backed by one contract file:
// the notice channel (bank-notice.ts, central bank → banks), the central
// bank's ask-API (central-bank-api.ts, banks → central bank), and the
// payment message (payment-message.ts, bank → bank). The section list
// here only names the files; every shape, member, and doc line is read
// from them live.

import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface ContractMember {
  kind: 'field' | 'method';
  name: string;
  /** A field's type, or a method's parameter list, verbatim. */
  detail: string;
  /** A method's return type; null for fields. */
  returnType: string | null;
  doc: string | null;
}

export interface ContractInterface {
  name: string;
  doc: string | null;
  members: ContractMember[];
}

export interface ContractSection {
  /** Display heading — who does what: "A bank asks the central bank". */
  title: string;
  /** The variable task code calls the section's methods on, e.g.
   *  `banks` — so calls render exactly as they are written. Null for
   *  sections that are a message shape only. */
  callPrefix: string | null;
  /** The first sentence of the file's header comment. */
  blurb: string | null;
  /** The contract file, repo-root-relative — for display. */
  path: string;
  /** Absolute path — powers the vscode:// link on the title. */
  abs: string;
  interfaces: ContractInterface[];
}

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

/** The contract files, in teaching order — content is parsed live. */
const SECTIONS = [
  {
    title: 'The central bank notifies a bank',
    callPrefix: 'commercialBanks',
    file: 'packages/central-bank/src/bank-notice.ts',
  },
  {
    title: 'A bank asks the central bank',
    callPrefix: 'centralBank',
    file: 'packages/central-bank/src/central-bank-api.ts',
  },
  {
    title: 'A bank sends a payment to another bank',
    callPrefix: null,
    file: 'packages/commercial-bank/src/payment-message.ts',
  },
];

/** The first sentence of the file's `//` header comment. */
function fileBrief(lines: string[]): string | null {
  const comment: string[] = [];
  for (const line of lines) {
    if (!line.startsWith('//')) break;
    comment.push(line.replace(/^\/\/ ?/, ''));
  }
  const text = comment.join(' ').trim();
  if (!text) return null;
  const period = text.indexOf('. ');
  return period === -1 ? text : text.slice(0, period + 1);
}

/** A finished JSDoc block, flattened to one line. */
function flattenDoc(lines: string[]): string {
  return lines
    .join('\n')
    .replace(/\/\*\*|\*\//g, '')
    .replace(/^\s*\*\s?/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True once every bracket a member opened has closed again. */
function bracketsBalanced(text: string): boolean {
  let depth = 0;
  for (const char of text) {
    if (char === '(' || char === '{' || char === '<') depth++;
    else if (char === ')' || char === '}' || char === '>') depth--;
  }
  return depth === 0;
}

/** The index of the bracket closing the one that opens at `from`. */
function matchingParen(text: string, from: number): number {
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Inline-type punctuation smoothed for display: no trailing `;` inside
 *  braces, no leading `|` after a `<`, no padded angle brackets. */
function tidy(type: string): string {
  return type
    .replace(/;\s*\}/g, ' }')
    .replace(/<\s+/g, '<')
    .replace(/\s+>/g, '>')
    .replace(/,\s*\|\s*/g, ', ')
    .trim();
}

/** One joined member declaration → a field or a method. */
function parseMember(text: string, doc: string | null): ContractMember {
  const declaration = text.trim().replace(/;$/, '');
  const name = /^(\w+)/.exec(declaration)?.[1] ?? declaration;
  if (declaration.startsWith(`${name}(`)) {
    const open = declaration.indexOf('(');
    const close = matchingParen(declaration, open);
    return {
      kind: 'method',
      name,
      detail: tidy(declaration.slice(open + 1, close)),
      returnType: tidy(declaration.slice(close + 1).replace(/^\s*:\s*/, '')),
      doc,
    };
  }
  const at = declaration.indexOf(':');
  return {
    kind: 'field',
    name: declaration.slice(0, at).trim().replace(/\?$/, ''),
    detail: tidy(declaration.slice(at + 1)),
    returnType: null,
    doc,
  };
}

/** Every exported interface in one contract file, with docs. */
function parseInterfaces(lines: string[]): ContractInterface[] {
  const interfaces: ContractInterface[] = [];
  let current: ContractInterface | null = null;
  let doc: string[] | null = null; // accumulating a JSDoc block
  let lastDoc: string | null = null; // the finished block just above

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';

    const opened = /^export interface (\w+) \{$/.exec(line);
    if (opened?.[1]) {
      current = { name: opened[1], doc: lastDoc, members: [] };
      interfaces.push(current);
      lastDoc = null;
      continue;
    }
    if (line === '}') {
      current = null;
      lastDoc = null;
      continue;
    }

    if (doc !== null) {
      doc.push(line);
      if (line.includes('*/')) {
        lastDoc = flattenDoc(doc);
        doc = null;
      }
      continue;
    }
    if (/^\s*\/\*\*/.test(line)) {
      doc = [line];
      if (line.includes('*/')) {
        lastDoc = flattenDoc([line]);
        doc = null;
      }
      continue;
    }

    if (!current) {
      if (line.trim() !== '') lastDoc = null;
      continue;
    }

    const member = /^ {2}\w+[?(:]/.exec(line);
    if (member) {
      // Join the possibly multi-line declaration until it closes with a
      // top-level semicolon.
      let text = line;
      let j = i;
      while (!(bracketsBalanced(text) && text.trimEnd().endsWith(';'))) {
        text += ` ${(lines[++j] ?? '').trim()}`;
      }
      current.members.push(
        parseMember(text.replace(/\s+/g, ' ').trim(), lastDoc)
      );
      lastDoc = null;
      i = j;
      continue;
    }

    if (line.trim() !== '') lastDoc = null; // doc must sit right above
  }

  return interfaces;
}

/** Parse the interbank contract: every section, live from its file. */
export function interbankApiReference(): ContractSection[] {
  return SECTIONS.map(section => {
    const abs = path.join(REPO_ROOT, section.file);
    const lines = readFileSync(abs, 'utf8').split('\n');
    return {
      title: section.title,
      callPrefix: section.callPrefix,
      blurb: fileBrief(lines),
      path: section.file,
      abs,
      interfaces: parseInterfaces(lines),
    };
  });
}
