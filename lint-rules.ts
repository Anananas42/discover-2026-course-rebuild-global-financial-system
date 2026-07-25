// The course's own lint rules, loaded by .oxlintrc.json as an oxlint JS
// plugin — so they run in `pnpm lint` and in the guide's per-task lint
// alike (apps/guide/server.ts maps findings back onto task regions).
//
// A rule belongs here when a mistake is invisible to both the type
// checker and the tests: the code compiles, every scenario passes, and
// it is still wrong. Those are the mistakes a student cannot debug,
// because nothing they can run says anything is amiss.

interface Node {
  type: string;
  start: number;
  end: number;
  parent?: Node;
  [key: string]: unknown;
}

interface Report {
  node: Node;
  message: string;
}

interface Context {
  report(report: Report): void;
}

const FUNCTIONS = new Set([
  'ArrowFunctionExpression',
  'FunctionExpression',
  'FunctionDeclaration',
]);

/** The name a database handle is reached by, for the handles that appear
 *  as the object of a `.transaction(...)` call: `centralBankDb`,
 *  `this.centralBankDb`, `commercialBankDbFor(bankId)`. Anything else
 *  has no name to watch for, so the rule stays quiet. */
function handleName(node: Node | undefined): string | null {
  if (!node) return null;
  if (node.type === 'Identifier') return node.name as string;
  if (node.type === 'MemberExpression' && node.computed !== true) {
    return handleName(node.property as Node);
  }
  if (node.type === 'CallExpression') return handleName(node.callee as Node);
  return null;
}

/** The `tx => ...` callback of a `<handle>.transaction(callback)` call,
 *  when `node` is that callback — plus the handle it was called on. */
function transactionCallback(
  node: Node
): { handle: string; parameter: string } | null {
  const call = node.parent;
  if (
    !call ||
    call.type !== 'CallExpression' ||
    !FUNCTIONS.has(node.type) ||
    (call.arguments as Node[])[0] !== node
  ) {
    return null;
  }
  const callee = call.callee as Node | undefined;
  if (
    !callee ||
    callee.type !== 'MemberExpression' ||
    callee.computed === true ||
    (callee.property as Node).name !== 'transaction'
  ) {
    return null;
  }
  const handle = handleName(callee.object as Node);
  const first = (node.params as Node[])[0];
  if (handle === null || first?.type !== 'Identifier') return null;
  return { handle, parameter: first.name as string };
}

const transactionWritesUseTx = {
  create(context: Context): Record<string, (node: Node) => void> {
    return {
      Identifier(node: Node): void {
        // A reference to the handle is only wrong *inside* the callback,
        // so walk out from it and check every transaction it sits in —
        // the call's own `centralBankDb.transaction` never matches,
        // because it is outside the callback it opens.
        for (let step = node.parent; step; step = step.parent) {
          const block = transactionCallback(step);
          if (block && block.handle === node.name) {
            context.report({
              node,
              message: `Inside a transaction, reach the database through the handle it hands you (${block.parameter}) — a call through ${block.handle} lands outside the transaction and will not roll back with it.`,
            });
            return;
          }
        }
      },
    };
  },
};

export default {
  meta: { name: 'course' },
  rules: { 'transaction-writes-use-tx': transactionWritesUseTx },
};
