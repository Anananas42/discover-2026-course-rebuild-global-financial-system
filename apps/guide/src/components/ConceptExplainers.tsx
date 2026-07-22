import { BookOpen, Check } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { Button } from '@banks/shared/browser/Button.tsx';

// The onramp explainers: the seven concepts task 1.1 would otherwise
// need all at once, each taught as a card inside the stage-0 task that
// applies it — introduced and instantly used, never a wall of theory
// upfront. Every card carries a mark-as-read button (the task-test
// idiom: quiet until clicked, green after) — the click changes nothing
// but is a conscious act of having read. Read-state is a display
// preference like the theme — per browser, in localStorage, never in
// course.json.

const STORAGE_KEY = 'guide-concepts-read';

type ConceptId =
  'loop' | 'big' | 'effect' | 'errors' | 'promises' | 'db' | 'transactions';

/** Which explainers appear on which stage-0 task's card, in order. */
export const CONCEPTS_BY_TASK: Record<string, ConceptId[]> = {
  '0.1': ['loop'],
  '0.2': ['big'],
  '0.3': ['db'],
  '0.4': ['effect'],
  '0.5': ['promises'],
  '0.6': ['errors'],
  '0.7': ['transactions'],
};

function loadRead(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function storeRead(id: string, read: boolean): void {
  const set = loadRead();
  if (read) set.add(id);
  else set.delete(id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-faint px-1">{children}</code>;
}

const EXPLAINERS: Record<ConceptId, { title: string; body: ReactNode }> = {
  loop: {
    title: 'How to finish a task',
    body: (
      <p>
        The two buttons below do the work. "Implement" opens your editor at the
        right place; write the code there, come back, and click "Run the tests".
        When the code is right, everything turns green.
      </p>
    ),
  },
  big: {
    title: 'Money is never a plain number',
    body: (
      <p>
        Ordinary computer numbers cannot store 0.1 exactly — a bank cannot be
        almost right. So amounts are <Code>Big</Code> values, and they do their
        own math: <Code>amount.plus(interest)</Code>,{' '}
        <Code>balance.minus(amount)</Code>, <Code>balance.lt(amount)</Code> ("is
        less than"), <Code>debt.eq(0)</Code> ("equals"). Never a plain{' '}
        <Code>+</Code>.
      </p>
    ),
  },
  effect: {
    title: 'The Effect frame',
    body: (
      <>
        <p>Every bank method is built on this frame:</p>
        <pre className="overflow-x-auto rounded-lg border border-line bg-faint p-3 font-mono text-[13px] leading-relaxed">
          {`return Effect.gen(function* () {

  const answer = yield* someCall();

  // ...the rest of your code, one step after another

});`}
        </pre>
        <p>
          It is boilerplate — copy it exactly; you don't need to understand its
          syntax. The same goes for <Code>yield*</Code>: write it in front of
          every call, every time, without thinking. It runs the call and hands
          back the answer.
        </p>
      </>
    ),
  },
  errors: {
    title: 'Errors are answers, not crashes',
    body: (
      <>
        <p>
          A method refuses by handing a named error to <Code>Effect.fail</Code>:
        </p>
        <pre className="overflow-x-auto rounded-lg border border-line bg-faint p-3 font-mono text-[13px] leading-relaxed">
          {`return yield* Effect.fail(
  new NegativeAmountError({ amount: amount.toString() })
);`}
        </pre>
        <p>
          Nothing crashes: the error is the method's answer, and the tests check
          for exactly it.
        </p>
      </>
    ),
  },
  promises: {
    title: 'Promises — answers that arrive later',
    body: (
      <p>
        When you call <Code>headquarters.instructions()</Code>, the answer is
        not ready yet — it lives in another program. The call does not stop and
        wait: it immediately hands you a <Code>Promise</Code> — a box the answer
        will arrive in — and your code keeps running. Only when you need the
        instructions themselves do you wait, with one pattern, always the same:{' '}
        <Code>yield* Effect.promise(() =&gt; headquarters.instructions())</Code>
        .
      </p>
    ),
  },
  db: {
    title: 'Reading and writing the database',
    body: (
      <p>
        Your country's banks, accounts, and balances will live in a real
        database. Your code never talks to it directly — prebuilt repositories
        read and write it, one per table: <Code>bankRepo.get(...)</Code>,{' '}
        <Code>accountRepo.setBalance(...)</Code>. In this task a stand-in plays
        that role: ask it for one balance, hand back its answer.
      </p>
    ),
  },
  transactions: {
    title: 'A transaction: all writes, or none',
    body: (
      <>
        <p>
          A payment is two writes — take from one account, give to another. If
          the program dies between them, money has vanished: one balance already
          went down, the other never went up. So writes that belong together
          travel in one transaction:
        </p>
        <pre className="overflow-x-auto rounded-lg border border-line bg-faint p-3 font-mono text-[13px] leading-relaxed">
          {`db.transaction(async tx => {
  await tx.setBalance({
    account: from.name,
    balance: from.balance.minus(amount),
  });
  // <-- the program could die right here — e.g. due to a power outage
  await tx.setBalance({
    account: to.name,
    balance: to.balance.plus(amount),
  });
});`}
        </pre>
        <p>
          The database promises that everything inside lands together — or, if
          anything throws, nothing does. The call hands back a Promise, so it is
          waited for like any other:{' '}
          <Code>yield* Effect.promise(() =&gt; db.transaction(...))</Code>. One
          write alone needs no transaction; two or more belong in one.
        </p>
      </>
    ),
  },
};

export function ConceptExplainer({ id }: { id: ConceptId }) {
  const [read, setRead] = useState(() => loadRead().has(id));
  const explainer = EXPLAINERS[id];

  const toggle = () => {
    storeRead(id, !read);
    setRead(!read);
  };

  return (
    <div className="rounded-lg border border-line px-5 py-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h4 className="text-[15px] font-semibold">{explainer.title}</h4>
        {/* The verdict button, same idiom as a task's test button: quiet
            while unread, green once read — clicking toggles either way.
            Reading is a conscious act even though nothing gates on it. */}
        <Button
          onClick={toggle}
          className={read ? 'text-ok' : 'text-muted hover:text-ink'}
        >
          {read ? (
            <>
              <Check size={15} aria-hidden /> Read
            </>
          ) : (
            <>
              <BookOpen size={15} aria-hidden /> Mark as read
            </>
          )}
        </Button>
      </div>
      <div className="space-y-2.5 text-[15px] leading-relaxed">
        {explainer.body}
      </div>
    </div>
  );
}
