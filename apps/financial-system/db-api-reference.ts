// The database API, parsed from the source at request time so the
// reference the workbench shows can never drift from the real code —
// the same no-second-source rule the tRPC router follows. One section
// per institution handle — `centralBankDb` and `commercialBankDb`, the
// variables a task binds — listing the repositories the handle carries
// (one file each under packages/db/src/repos/, so each repo name links
// to its file) plus the handle's own `transaction`. The handles' other
// methods (createDatabase — prebuilt plumbing) are left out; students
// never call them. Repo methods take one input object; the parser
// expands its fields so the client can syntax-highlight the signature
// and build a copy-ready call, `centralBankDb.accounts.create({ ... })`.

import { readdirSync, readFileSync } from 'node:fs';
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

export interface DbApiRepo {
  /** The field on the handle, e.g. `accounts` — a call is written
   *  `<handle>.<name>.<method>(...)`. */
  name: string;
  /** The repo's own source file, repo-root-relative — for display. */
  path: string;
  /** Absolute path — powers the vscode:// link on the repo's name. */
  abs: string;
  methods: DbApiMethod[];
}

export interface DbApiHandle {
  /** The bound variable a task uses: `centralBankDb` or
   *  `commercialBankDb`. */
  handle: string;
  path: string;
  abs: string;
  /** The repositories the handle carries, in declaration order. */
  repos: DbApiRepo[];
  /** The handle's own transaction method. */
  transaction: DbApiMethod | null;
}

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const DB_SRC = path.join(REPO_ROOT, 'packages/db/src');
const REPOS_DIR = path.join(DB_SRC, 'repos');
/** The institution handles, in teaching order. */
const HANDLE_FILES = ['central-bank-db.ts', 'commercial-bank-db.ts'];

// `export class AccountRepo extends Repo {` → a repository class.
const REPO_CLASS_RE = /^export class (\w+Repo) extends Repo \{$/;
// `export class CentralBankDb implements ... {` → an institution handle.
const HANDLE_CLASS_RE = /^export class (\w+Db) /;
// `  readonly accounts: AccountRepo;` → a repo field on a handle.
const REPO_FIELD_RE = /^ {2}readonly (\w+): (\w+Repo);$/;
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

/** One file's classes matching `classRe`, with their public methods. */
function parseClasses(
  abs: string,
  classRe: RegExp
): { className: string; methods: DbApiMethod[] }[] {
  const lines = readFileSync(abs, 'utf8').split('\n');
  const classes: { className: string; methods: DbApiMethod[] }[] = [];
  let current: { className: string; methods: DbApiMethod[] } | null = null;
  let doc: string[] | null = null; // accumulating a JSDoc block
  let lastDoc: string | null = null; // the finished block above a method

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';

    const klass = classRe.exec(line);
    if (klass?.[1]) {
      current = { className: klass[1], methods: [] };
      classes.push(current);
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
          .join('\n')
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
      current.methods.push(parseSignature(sig, lastDoc));
      lastDoc = null;
      i = j;
      continue;
    }

    if (line.trim() !== '') lastDoc = null; // doc must sit right above
  }

  return classes;
}

/** A handle class's repo fields, in declaration order. */
function parseRepoFields(abs: string): { field: string; className: string }[] {
  const fields: { field: string; className: string }[] = [];
  for (const line of readFileSync(abs, 'utf8').split('\n')) {
    const match = REPO_FIELD_RE.exec(line);
    if (match?.[1] && match[2]) {
      fields.push({ field: match[1], className: match[2] });
    }
  }
  return fields;
}

function relative(abs: string): string {
  return path.relative(REPO_ROOT, abs).replaceAll(path.sep, '/');
}

/** Parse the institution handles and the repositories they carry. */
export function dbApiReference(): DbApiHandle[] {
  const repoByClass = new Map<
    string,
    { path: string; abs: string; methods: DbApiMethod[] }
  >();
  for (const name of readdirSync(REPOS_DIR)
    .filter(file => file.endsWith('.ts'))
    .sort()) {
    const abs = path.join(REPOS_DIR, name);
    for (const parsed of parseClasses(abs, REPO_CLASS_RE)) {
      repoByClass.set(parsed.className, {
        path: relative(abs),
        abs,
        methods: parsed.methods,
      });
    }
  }
  const handles: DbApiHandle[] = [];
  for (const name of HANDLE_FILES) {
    const abs = path.join(DB_SRC, name);
    const parsed = parseClasses(abs, HANDLE_CLASS_RE)[0];
    if (!parsed) continue;
    const repos: DbApiRepo[] = [];
    for (const { field, className } of parseRepoFields(abs)) {
      const repo = repoByClass.get(className);
      if (repo) repos.push({ name: field, ...repo });
    }
    handles.push({
      handle: `${parsed.className.charAt(0).toLowerCase()}${parsed.className.slice(1)}`,
      path: relative(abs),
      abs,
      repos,
      // Of the handle's own methods, only `transaction` is for tasks —
      // createDatabase is prebuilt plumbing.
      transaction: parsed.methods.find(m => m.name === 'transaction') ?? null,
    });
  }
  return handles;
}
