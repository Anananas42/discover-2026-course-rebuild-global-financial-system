import { BookOpen, Check } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { Button } from '@banks/shared/browser/Button.tsx';
import { TASK } from '@banks/shared/curriculum.ts';

import { FinancialSystemLink } from './CurriculumText.tsx';

// The onramp explainers: the concepts stage 1 would otherwise need all
// at once, each taught as a card inside the stage-0 task that applies it
// — introduced and instantly used, never a wall of theory upfront. The
// last of them teaches no new piece, only how the earlier ones sit in
// one method, which is the shape every task from stage 1 on has. One
// more card sits on task 1.2: how to work in the financial system,
// taught on the first task that happens there — 1.1 builds a check
// with no screen of its own. Every card carries a
// mark-as-read button (the task-test idiom: quiet until clicked, green
// after) — the click changes nothing but is a conscious act of having
// read. Read-state is a display preference like the theme — per
// browser, in localStorage, never in course.json.

const STORAGE_KEY = 'guide-concepts-read';

type ConceptId =
  | 'loop'
  | 'big'
  | 'effect'
  | 'errors'
  | 'promises'
  | 'db'
  | 'transactions'
  | 'composing'
  | 'workbench';

/** Which explainers appear on which task's card, in order. */
export const CONCEPTS_BY_TASK: Record<string, ConceptId[]> = {
  '0.1': ['loop'],
  '0.2': ['big'],
  '0.3': ['effect'],
  '0.4': ['errors'],
  '0.5': ['db'],
  '0.6': ['promises'],
  '0.7': ['transactions'],
  '0.8': ['composing'],
  [TASK.openBank]: ['workbench'],
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
          It is boilerplate — every task already has it in place, and your code
          goes inside; you don't need to understand its syntax. The one part you
          write yourself is <Code>yield*</Code>, and it goes in front of every
          call that hands back an Effect — every method you write in this
          course, and every one it calls. It runs that call and hands back its
          answer; if the call refuses instead, your method stops there and
          passes the refusal on.
        </p>
      </>
    ),
  },
  errors: {
    title: 'Errors are outcomes, not crashes',
    body: (
      <>
        <p>A method refuses by yielding a named error:</p>
        <pre className="overflow-x-auto rounded-lg border border-line bg-faint p-3 font-mono text-[13px] leading-relaxed">
          {`return yield* Effect.fail(
  new NegativeAmountError({ amount: amount.toString() })
);`}
        </pre>
        <p>
          The <Code>yield*</Code> is what refuses. <Code>Effect.fail</Code> only
          builds the refusal for it to hand back — built and not yielded, it
          does nothing at all.
        </p>
        <p>
          Nothing crashes: refusing is one of the two ways the method can end,
          and the tests check for exactly this error.
        </p>
        <p>
          This is why the course is built on Effect: a method's signature lists
          every error it can refuse with, next to the type it hands back when it
          succeeds. In every task, that list is exactly the errors your code
          must produce.
        </p>
      </>
    ),
  },
  promises: {
    title: 'Promises — answers that arrive later',
    body: (
      <p>
        When you call <Code>repo.licensedBankCount()</Code>, the answer is not
        ready yet — it lives in another program, the database. The call does not
        stop and wait: it immediately hands you a <Code>Promise</Code> — a box
        the answer will arrive in — and your code keeps running. That box is
        what you handed straight back in the task before this one. Here you need
        the number inside it, and waiting has one pattern, always the same:{' '}
        <Code>yield* Effect.promise(() =&gt; repo.licensedBankCount())</Code>.
      </p>
    ),
  },
  db: {
    title: 'Reading and writing the database',
    body: (
      <p>
        Your country's banks, accounts, and balances will live in real databases
        — one per institution, exactly like the real world: the central bank
        cannot see a commercial bank's database, nor the other way around. Your
        code holds its own institution's handle and reads and writes through
        prebuilt repositories, one per table:{' '}
        <Code>centralBankDb.accounts.setBalance(...)</Code>,{' '}
        <Code>commercialBankDb.claims.create(...)</Code>. In this task you read
        from one.
      </p>
    ),
  },
  composing: {
    title: 'Read, check, write — in one method',
    body: (
      <>
        <p>
          Almost every task ahead is the same three steps in the same order:
          read how things stand, refuse if the operation is not allowed, then
          write. You have written each step on its own already — refusing with a
          named error in task 0.4, waiting for a Promise in task 0.6. Here they
          go in one method:
        </p>
        <pre className="overflow-x-auto rounded-lg border border-line bg-faint p-3 font-mono text-[13px] leading-relaxed">
          {`const taken = yield* Effect.promise(() =>
  register.isNameTaken({ legalName })
);
if (taken) {
  return yield* Effect.fail(new DuplicateBankNameError({ legalName }));
}
return yield* Effect.promise(() => register.license({ legalName }));`}
        </pre>
        <p>
          Each call that returns a Promise gets its own{' '}
          <Code>yield* Effect.promise(...)</Code> line, and the <Code>if</Code>{' '}
          sits between them — in your method, not inside either call.
        </p>
        <p>
          It is tempting to reach for one <Code>Effect.promise</Code> instead
          and write ordinary <Code>async</Code> code inside it, where{' '}
          <Code>await</Code> works as usual. That version does not refuse
          anything:
        </p>
        <pre className="overflow-x-auto rounded-lg border border-line bg-faint p-3 font-mono text-[13px] leading-relaxed">
          {`return yield* Effect.promise(async () => {
  if (await register.isNameTaken({ legalName })) {
    // Nothing here says no — read on.
    return Effect.fail(new DuplicateBankNameError({ legalName }));
  }
  return await register.license({ legalName });
});`}
        </pre>
        <p>
          <Code>Effect.fail(...)</Code> does not throw and does not stop the
          method. It <i>builds</i> a refusal, and a refusal only happens when
          your method hands it back with <Code>yield*</Code>. Inside an{' '}
          <Code>async</Code> function you cannot write <Code>yield*</Code> — so
          that refusal becomes an ordinary return value. The Promise finishes
          with it, <Code>Effect.promise</Code> treats it as the answer, and the
          caller is told the bank was licensed.
        </p>
        <p>
          Here TypeScript catches it, because a refusal is not the bank the
          signature promises. Take the red squiggle as the reminder: the check
          belongs in the method, between the two waits.
        </p>
      </>
    ),
  },
  workbench: {
    title: 'Where to look in the financial system',
    body: (
      <>
        <p>
          The financial system starts almost empty: the Central Bank and
          Commercial Bank tabs, and two raw views — Database and Log. Every
          operation you implement adds its button.{' '}
          <b>
            Each button appears at the start of its task — so this task's
            "License a new commercial bank" is already waiting on the Central
            Bank tab.
          </b>
        </p>
        <p>
          The{' '}
          <FinancialSystemLink path="/database">
            Database tab
          </FinancialSystemLink>{' '}
          is where you&apos;ll find what this task needs: which table each piece
          of data lives in, and the repository methods that read and write it.
        </p>
      </>
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
    id: from.id,
    balance: from.balance.minus(amount),
  });
  // <-- the program could die right here — e.g. due to a power outage
  await tx.setBalance({
    id: to.id,
    balance: to.balance.plus(amount),
  });
});`}
        </pre>
        <p>
          The database promises that everything inside lands together — or, if
          anything throws, nothing does. The call hands back a Promise, so it is
          waited for like any other:{' '}
          <Code>yield* Effect.promise(() =&gt; db.transaction(...))</Code>. In
          the mission stages the same call rides your institution's own database
          handle — <Code>commercialBankDb.transaction(...)</Code> — because a
          transaction can never span two institutions' databases.
        </p>
        <p>
          One thing decides whether a write belongs to the transaction: the
          handle it goes through. <Code>tx</Code> is not the same object as{' '}
          <Code>db</Code>, and inside the block both are within reach — so both
          of these compile, and they do not do the same thing:
        </p>
        <pre className="overflow-x-auto rounded-lg border border-line bg-faint p-3 font-mono text-[13px] leading-relaxed">
          {`db.transaction(async tx => {
  await db.setBalance({ ... });   // lands on its own, at once
  await tx.setBalance({ ... });   // lands with the transaction
});`}
        </pre>
        <p>
          When nothing goes wrong, both move the money and look equally right —
          which is exactly why this is worth knowing. The difference appears
          only when something throws, and by then the write made on{' '}
          <Code>db</Code> is already permanent: the transaction has no claim on
          it and cannot take it back. This task's third test cuts the power
          between the two writes to find out which one you wrote.
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
