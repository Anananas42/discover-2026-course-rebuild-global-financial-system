// The error envelope: every failed procedure call is classified into
// exactly one of three kinds, attached to the tRPC error as
// `data.outcome`, and rendered by one component on the client. The kinds:
//
// - domain  — a rule of the system said no (an Effect tagged error);
//             the interesting, expected kind.
// - blocked — the code behind the operation is a task stub that is not
//             implemented yet (student repos only; parses the
//             NotImplementedError message, a course-machinery contract).
// - defect  — an unexpected failure: a bug in the code, not a rule.
//
// This file must stay free of server-only imports: the client imports the
// `Outcome` type from here (type-only, so it is erased at runtime).

export type Outcome =
  | { kind: 'domain'; tag: string; message: string }
  | { kind: 'blocked'; task: string; message: string }
  | { kind: 'defect'; message: string };

// The stub message format "Task <id> is not implemented." is shared with
// the generator and the dashboard — see NotImplementedError.
const BLOCKED_PATTERN = /^Task (.+) is not implemented\.$/;

export function classifyOutcome(
  cause: unknown,
  fallbackMessage: string
): Outcome {
  if (cause instanceof Error) {
    const blocked = BLOCKED_PATTERN.exec(cause.message);
    if (blocked?.[1]) {
      return { kind: 'blocked', task: blocked[1], message: cause.message };
    }
    const tag: unknown = (cause as { _tag?: unknown })._tag;
    if (typeof tag === 'string') {
      return { kind: 'domain', tag, message: cause.message };
    }
    return { kind: 'defect', message: cause.message };
  }
  return { kind: 'defect', message: fallbackMessage };
}
