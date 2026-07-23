// The database API, parsed from the source at request time so the
// reference the workbench shows can never drift from the real repos —
// the same no-second-source rule the tRPC router follows. One group per
// repository (commercialBankRepo, accountRepo, claimRepo, settingRepo), plus the
// `Db` container's `transaction` under `db`; the container's other
// methods (dump, reset, the snapshot pair, destroy) are left out —
// students never call them. Repo methods take one input object; the parser expands its
// fields so the client can syntax-highlight the signature and build a
// copy-ready call, `commercialBankRepo.create({ name })`.

import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface DbApiParam {
  name: string;
  type: string;
}

export interface DbApiMethod {
  name: string;
  params: DbApiParam[];
  /** True when the params are the fields of one input object — the call
   *  is written `method({ a, b })`, not `method(a, b)`. */
  objectInput: boolean;
  returnType: string;
  doc: string | null;
}

export interface DbApiGroup {
  /** The bound variable a task uses, e.g. `commercialBankRepo`. */
  repo: string;
  methods: DbApiMethod[];
}

const SOURCE = path.resolve(
  import.meta.dirname,
  '../../packages/db/src/bank-db.ts'
);

// `export class CommercialBankRepo extends Repo {` → the
// `commercialBankRepo` a task binds.
const CLASS_RE = /^export class (\w+)Repo extends Repo \{$/;
// The `Db` container itself → the `db` a task binds for `transaction`.
const DB_CLASS_RE = /^export class Db /;
const METHOD_RE = /^ {2}(?:async )?([a-z]\w*)(?:<\w+>)?\(/;

/** Split on `separator` at bracket depth zero — `<>`, `()`, `{}` all
 *  guard their contents. */
function splitTopLevel(list: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of list) {
    if (char === '<' || char === '(' || char === '{') depth++;
    else if (char === '>' || char === ')' || char === '}') depth--;
    if (char === separator && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.map(part => part.trim()).filter(part => part !== '');
}

/** Each `name: type` in a plain (non-object) parameter list. */
function parseParams(list: string): DbApiParam[] {
  return splitTopLevel(list, ',').map(part => {
    const at = part.indexOf(':');
    return { name: part.slice(0, at).trim(), type: part.slice(at + 1).trim() };
  });
}

/** The index of the bracket closing the one that opens at `from`. */
function matchingBracket(text: string, from: number): number {
  const open = text[from];
  const close = open === '{' ? '}' : open === '(' ? ')' : '>';
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    if (text[i] === open) depth++;
    else if (text[i] === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** name(params): returnType → structured method. A destructured object
 *  parameter — `{ a, b }: { a: A; b: B }` — expands into its fields. */
function parseSignature(sig: string, doc: string | null): DbApiMethod {
  const open = sig.indexOf('(');
  const close = matchingBracket(sig, open);
  // A generic marker (`transaction<T>`) is noise in a copy-ready call.
  const name = sig.slice(0, open).replace(/<\w+>$/, '');
  const returnType = sig
    .slice(close + 1)
    .replace(/^\s*:\s*/, '')
    .trim();
  const list = sig.slice(open + 1, close).trim();
  if (list.startsWith('{')) {
    const typeStart = list.indexOf('{', matchingBracket(list, 0) + 1);
    const typeEnd = matchingBracket(list, typeStart);
    const fields = splitTopLevel(list.slice(typeStart + 1, typeEnd), ';').map(
      field => {
        const at = field.indexOf(':');
        return {
          name: field.slice(0, at).trim(),
          type: field.slice(at + 1).trim(),
        };
      }
    );
    return { name, params: fields, objectInput: true, returnType, doc };
  }
  return {
    name,
    params: list === '' ? [] : parseParams(list),
    objectInput: false,
    returnType,
    doc,
  };
}

/** True once the signature's parameter list has opened and closed. */
function parensBalanced(sig: string): boolean {
  let depth = 0;
  let opened = false;
  for (const char of sig) {
    if (char === '(') {
      depth++;
      opened = true;
    } else if (char === ')') {
      depth--;
    }
  }
  return opened && depth === 0;
}

/** Parse the repo classes' public methods, grouped by repo. */
export function dbApiReference(): DbApiGroup[] {
  const lines = readFileSync(SOURCE, 'utf8').split('\n');
  const groups: DbApiGroup[] = [];
  let current: DbApiGroup | null = null;
  let doc: string[] | null = null; // accumulating a JSDoc block
  let lastDoc: string | null = null; // the finished block above a method

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';

    const klass = CLASS_RE.exec(line);
    if (klass?.[1]) {
      const repo = `${klass[1].charAt(0).toLowerCase()}${klass[1].slice(1)}Repo`;
      current = { repo, methods: [] };
      groups.push(current);
      lastDoc = null;
      continue;
    }
    if (DB_CLASS_RE.test(line)) {
      current = { repo: 'db', methods: [] };
      groups.push(current);
      lastDoc = null;
      continue;
    }
    // A non-indented `}` closes the current class.
    if (line === '}') {
      current = null;
      lastDoc = null;
      continue;
    }
    if (!current) continue;

    if (doc !== null) {
      doc.push(line);
      if (line.includes('*/')) {
        lastDoc = doc
          .join(' ')
          .replace(/\/\*\*|\*\//g, '')
          .replace(/^\s*\*\s?/gm, '')
          .replace(/\s+/g, ' ')
          .trim();
        doc = null;
      }
      continue;
    }
    if (/^\s*\/\*\*/.test(line)) {
      doc = [line];
      if (line.includes('*/')) {
        lastDoc = line
          .replace(/\/\*\*|\*\//g, '')
          .replace(/\s+/g, ' ')
          .trim();
        doc = null;
      }
      continue;
    }

    const method = METHOD_RE.exec(line);
    if (method && method[1] !== 'constructor') {
      // Join the possibly multi-line signature until its parameter list
      // closes and the body's `{` follows — parameter objects carry
      // braces of their own, so the paren balance is what decides.
      let sig = line;
      let j = i;
      while (!(parensBalanced(sig) && sig.trimEnd().endsWith('{'))) {
        sig += ` ${(lines[++j] ?? '').trim()}`;
      }
      sig = sig
        .slice(0, sig.lastIndexOf('{'))
        .trim()
        .replace(/^async\s+/, '')
        .replace(/\s+/g, ' ')
        .replace(/\(\s+/g, '(')
        .replace(/\s+\)/g, ')')
        .replace(/,\s*\}/g, ' }')
        .replace(/;\s*\}/g, ' }');
      // Of the `Db` container itself, only `transaction` is for tasks —
      // the debug and lifecycle methods stay out.
      if (current.repo !== 'db' || method[1] === 'transaction') {
        current.methods.push(parseSignature(sig, lastDoc));
      }
      lastDoc = null;
      i = j;
      continue;
    }

    if (line.trim() !== '') lastDoc = null; // doc must sit right above
  }

  return groups.filter(group => group.methods.length > 0);
}
