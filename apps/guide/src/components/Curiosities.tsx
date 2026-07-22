import { Check, Lightbulb } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

import { Button } from '@banks/shared/browser/Button.tsx';
import { TASK } from '@banks/shared/curriculum.ts';

// The curiosities: real-world consequences of what a task's code just
// made true — optional depth behind a disclosure, never needed to finish
// the task. Each card follows the concept-explainer idiom (mark-as-read,
// nothing gates on it), with a lightbulb marking it as an aside rather
// than a lesson. Read-state is a display preference like the theme — per
// browser, in localStorage, never in course.json.

const STORAGE_KEY = 'guide-curiosities-read';

type CuriosityId =
  | 'ledgersFirst'
  | 'moneyRole'
  | 'cashFromLedger'
  | 'loanPrints'
  | 'systemStretches'
  | 'rateSteering'
  | 'reserveVanishing'
  | 'onUsPayments'
  | 'settlementGap'
  | 'interestFlow'
  | 'ibanChecksum'
  | 'bankRun'
  | 'lendingMyth'
  | 'defaultCreates'
  | 'repayDestroys';

/** Which curiosities appear on which task's card, in order. */
export const CURIOSITIES_BY_TASK: Record<string, CuriosityId[]> = {
  [TASK.openBank]: ['ledgersFirst'],
  [TASK.becomeClient]: ['cashFromLedger'],
  [TASK.lendToBank]: ['loanPrints'],
  // Money-as-a-role sits where repaid money first stops existing: the
  // frame that makes destruction unmysterious.
  [TASK.receiveRepayment]: ['moneyRole'],
  [TASK.writeOffBankDebt]: ['systemStretches'],
  [TASK.setPolicyRate]: ['rateSteering'],
  [TASK.internalTransfer]: ['onUsPayments'],
  [TASK.interbankTransfer]: ['settlementGap'],
  [TASK.payFromBank]: ['interestFlow'],
  [TASK.openAccount]: ['ibanChecksum'],
  [TASK.sendMoney]: ['bankRun'],
  // The reserve-requirement curiosity rides the lending task now that
  // the dial itself is prebuilt.
  [TASK.lendToClient]: ['lendingMyth', 'reserveVanishing'],
  [TASK.writeOffLoan]: ['defaultCreates'],
  [TASK.repayLoan]: ['repayDestroys'],
};

function loadRead(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

// Read-state as a tiny external store: the task and stage headers show a
// lightbulb that must react to a card being marked read, so every reader
// shares one subscribable snapshot.
let snapshot: ReadonlySet<string> = loadRead();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function storeRead(id: string, read: boolean): void {
  const set = loadRead();
  if (read) set.add(id);
  else set.delete(id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  snapshot = set;
  for (const listener of listeners) listener();
}

/** The set of read curiosity ids, updating live across components. */
export function useReadCuriosities(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => snapshot);
}

/** Whether every curiosity of the given tasks is read — null when the
 *  tasks have none, so callers can skip their indicator entirely. */
export function allCuriositiesRead(
  taskIds: string[],
  read: ReadonlySet<string>
): boolean | null {
  const ids = taskIds.flatMap(taskId => CURIOSITIES_BY_TASK[taskId] ?? []);
  if (ids.length === 0) return null;
  return ids.every(id => read.has(id));
}

const CURIOSITIES: Record<CuriosityId, { title: string; body: ReactNode }> = {
  ledgersFirst: {
    title: 'Your money is already a ledger entry',
    body: (
      <>
        <p>
          A coin is a thing you hold and hand over. But the money in your bank
          account is not like that: it is an entry in the bank's database, and
          paying someone means the entries change. You have been using ledger
          money all along.
        </p>
        <p>
          The ledger came first. The oldest writing we have includes
          Mesopotamian clay tablets recording who owes whom — thousands of years
          before the first coin was struck.
        </p>
        <p>
          Ever since, the two have run side by side: parallel worlds of money.
          Cash is the world of things — it works between strangers, needs no
          records, and pays without anyone's permission. The database world is
          where most money lives today.
        </p>
        <p>
          An ATM is the border crossing between the worlds: an entry shrinks in
          the database, and the same value appears in your hand as a thing. In
          this course you rebuild the database world.
        </p>
        <p>
          If money is just entries, what stops a bank — or a whole country —
          from typing itself more? Nothing physical: what stops it is law —
          adopted rules, courts, and the politics of what happens to those who
          break them. A country can, in theory — it just does not end well. And
          countries do, in effect, print money — but inside rules they adopted
          and are held to. The same is true of cash: paper is easy to print, and
          law is why counterfeiting stays rare.
        </p>
      </>
    ),
  },
  moneyRole: {
    title: 'Money is a role, not a substance',
    body: (
      <>
        <p>
          A graphics card is valuable. A painting is valuable. Neither is money:
          you cannot pay rent with them, split them into units, or check their
          worth at a glance. Money is a job a thing does, and the job has
          requirements — everyone accepts it, it divides cleanly, prices are
          quoted in it.
        </p>
        <p>
          Circumstances decide what gets the job. In prisoner-of-war camps,
          cigarettes became money. When a currency collapses, people flee it and
          other things start doing money's job again — badly.
        </p>
        <p>
          Official money holds the job in a different way: it is pre-programmed
          by law. What an entry represents — the power to settle taxes, debts,
          and wages — is defined by the legal and political system, and courts
          stand behind every settlement. The database keeps the entries; the law
          says what they mean.
        </p>
        <p>
          That is why the money in a repayment can simply stop existing: the
          entry stops playing the role, and there was never a substance to
          dispose of.
        </p>
      </>
    ),
  },
  cashFromLedger: {
    title: 'Cash is born from the ledger',
    body: (
      <>
        <p>
          It feels like account money must be backed by "real" cash in a vault
          somewhere. It is the other way around: banknotes enter the world when
          a commercial bank buys them from the central bank, paid by lowering
          its reserve entry. Cash is a ledger entry, printed.
        </p>
        <p>
          A banknote is that entry made portable — payable to whoever holds the
          paper, no name attached. British notes still say "I promise to pay the
          bearer on demand".
        </p>
        <p>
          Withdrawing repeats this one level down: your balance shrinks and the
          same value crosses into your hand as a thing. The world of cash is
          supplied entirely from the world of entries.
        </p>
      </>
    ),
  },
  loanPrints: {
    title: 'A loan prints money while it lives',
    body: (
      <>
        <p>
          The money your loan just created spends at full strength from day one.
          Repayment is a promise about the future; the new money is a fact about
          today.
        </p>
        <p>
          Scale makes this vivid: if a central bank lent someone 100 trillion
          dollars, repayable in 50 years, the consequences would arrive this
          week. A loan is money printing for as long as it is outstanding.
        </p>
        <p>
          And if new lending always outgrows repayment, the destruction never
          catches up. Two things hold lending back: borrowing costs interest,
          and a loan that fails costs the lender its own money.
        </p>
      </>
    ),
  },
  systemStretches: {
    title: 'The rescue always sits one level up',
    body: (
      <>
        <p>
          Your write-off just moved a loss up the ladder: the bank's debt is
          gone, the money it spent stays in the world, and the central bank's
          own account absorbed the difference.
        </p>
        <p>
          The system handles failure this way at every level. A client's failed
          loan is absorbed by their bank's own money. A failed bank can be
          absorbed one level up: in 2008, central banks and governments rescued
          failing banks with freshly created money rather than let the losses
          fall through to everyone's accounts.
        </p>
        <p>
          The ladder can end this way because of what sits at the top.
          Everywhere else, a balance below zero triggers a rule written in law:
          the payment is refused, the bank is declared insolvent. For the
          central bank's own account, no such rule exists. Nothing is printed to
          cover its losses — the negative number simply sits in its database,
          and the central bank carries on.
        </p>
        <p>
          Rescues are meant to be rare, and expensive for the rescued. The
          standard case is the boring one: debts repaid, money destroyed on
          schedule.
        </p>
      </>
    ),
  },
  rateSteering: {
    title: 'The most watched number in the world',
    body: (
      <>
        <p>
          You just implemented the number the whole world watches. When a
          central bank announces a change, mortgage rates, business loans and
          savings accounts across the country move — everything priced on top of
          what borrowing from the central bank costs.
        </p>
        <p>
          It cuts both ways. In 1980 the American central bank pushed its rate
          near 20% to break an inflation: borrowing became so expensive that
          spending collapsed, and the inflation died with it, at the price of a
          recession.
        </p>
        <p>
          And the dial can lose. Today's Russia holds its rate near that same
          20%, yet inflation stays high: the state pours war spending into the
          economy faster than expensive borrowing can cool it. The brake works
          on those who must borrow. A state at war spends anyway.
        </p>
        <p>
          The dial also turns further than intuition suggests. After 2008, with
          spending frozen and prices threatening to fall, Japan and the euro
          area pushed below zero: banks were charged for keeping money parked,
          to push them to lend it instead.
        </p>
        <p>
          It got stranger. In 2019 a Danish bank offered ten-year mortgages at
          -0.5% a year: borrow 100, and a year later you owe 99.5. The bank was
          not the one losing — in Denmark, mortgage money comes from investors,
          mostly pension funds; the bank passes the borrower's repayments
          through to them and lives on a fixed fee from the borrower. The
          missing 0.5 came out of the pension funds. They accepted the loss
          because their money had nowhere cheaper to sit: parking it at the
          Danish central bank cost 0.75% a year. Losing half a percent was the
          good deal.
        </p>
        <p>
          Yet there is a floor, and it is made of paper. Banknotes pay exactly
          zero, minus the cost of vaults, guards and insurance — push accounts
          much below that and everyone flees into cash. That is why "below zero"
          in practice meant tenths of a percent, never -5. Your slider reaches
          further than reality dared.
        </p>
      </>
    ),
  },
  reserveVanishing: {
    title: 'The reserve requirement is disappearing',
    body: (
      <>
        <p>
          The rule you just implemented is on its way out of the real world. The
          United States set its reserve requirement to zero in March 2020;
          Britain, Canada and Australia run without one entirely.
        </p>
        <p>
          Czechia still has one — banks must keep 2% of client deposits at the
          central bank — but it is a leftover, not the brake. What actually
          limits Czech banks is a set of other dials.
        </p>
        <p>
          The main one is capital — a different rule from the one you just
          implemented, though the two sound alike. Side by side:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            the reserve requirement: for every 100 CZK of client deposits, the
            commercial bank must keep 2 CZK as reserves at the central bank (the
            Czech rate: 2%)
          </li>
          <li>
            the capital rule: for every 100 CZK the commercial bank has lent,
            roughly 8 CZK must be its own equity (the international floor: 8%) —
            the same equity you watched absorb a write-off
          </li>
        </ul>
        <p>
          When loans fail, the losses eat the owners' 8 CZK first — client
          deposits are touched only after the owners have lost everything.
        </p>
        <p>
          And equity does sink below the line: every write-off pushes it down in
          real time. The response escalates. First the bank loses its freedoms —
          no dividends, no bonuses, a plan to raise equity or shrink its
          lending. If it keeps sinking, the supervisor does not wait for zero:
          the bank is seized and sold or wound down, its owners wiped, its
          deposits protected. In this course an insolvent bank sits at negative
          equity, honestly reported; in reality it would be taken over while its
          equity was still positive.
        </p>
        <p>
          Equity cannot be borrowed: borrowing adds as much debt as it adds
          money. Client deposits are borrowing too — every balance is money the
          bank owes its client — so taking deposits moves equity by exactly
          zero.
        </p>
        <p>
          Equity grows two ways: profit kept in the bank instead of paid out,
          and owners paying money in — the bank selling brand-new shares. Buying
          existing shares on an exchange grows nothing here: that money goes to
          the share's previous owner, and the bank never sees it.
        </p>
        <p>
          The Czech central bank moves this dial with the weather: when lending
          runs hot it demands more own money behind every loan, and in a crisis
          it lowers the demand, so banks absorb the losses and keep lending
          instead of freezing.
        </p>
        <p>
          Other dials sit on the loans themselves: a Czech mortgage may cover at
          most about 80% of the home's price, so when prices fall, the loss eats
          the buyer's share before it reaches the bank.
        </p>
        <p>
          This course keeps the requirement because it makes a lending limit
          concrete and countable. Reality kept the limit and spread it across
          many dials.
        </p>
      </>
    ),
  },
  onUsPayments: {
    title: 'Payments that never leave the bank',
    body: (
      <>
        <p>
          Your transfer already contains a real-world curiosity: when both
          accounts are at the same bank, no reserves move. A bank whose reserve
          account is empty can still carry payments between its own clients,
          without limit.
        </p>
        <p>
          Reality works the same way. Pay by card in a shop that has its account
          at the same bank as you, and the payment settles entirely inside that
          bank's database. The bigger the bank, the more of its payments stay
          internal — one reason big banks need less central bank money for the
          business they do.
        </p>
        <p>
          When Greece limited money leaving its banks in 2015, this was the
          mechanism that kept everyday payments inside the country running.
        </p>
      </>
    ),
  },
  settlementGap: {
    title: 'A payment between banks crosses two machines',
    body: (
      <>
        <p>
          Your transfer commits two transactions, on purpose. The warm-up taught
          that writes belonging together land together — but here the reserves
          settle at the central bank first, through the central bank's own
          operation (the one you built in stage 3), and only then do the client
          balances move. That mirrors reality: the central bank's ledger is a
          separate computer, and a bank cannot write into it — it can only ask.
        </p>
        <p>
          Two transactions means a gap between them. If the power died there,
          the settlement would stand and no client money would have moved —
          exactly the unbalanced sheets you made by hand with the Debug lever.
          The order is the protection: settling first means a crash can strand
          reserves, but can never move client money that was not settled, and
          can never create or destroy money.
        </p>
        <p>
          The danger is old enough to have a name. In 1974 the German bank
          Herstatt was shut down at the end of the Frankfurt day — after taking
          in marks from currency trades, but before paying out the dollars in
          New York, where the morning had barely started. Its counterparties
          were left holding half-finished payments, and "Herstatt risk" has
          meant settlement risk ever since.
        </p>
        <p>
          Your payments table is the first half of how real systems handle this:
          record first, advance a status behind every step. The second half is
          reconciliation — systems and whole back-office teams that hunt for
          payments stuck between statuses and drive them to an end. Here a stuck
          payment simply stays visible: the row says what happened, the balance
          sheet shows the hole, and Reset starts the world over.
        </p>
      </>
    ),
  },
  interestFlow: {
    title: 'Where the money to pay interest comes from',
    body: (
      <>
        <p>
          Count the money in a fresh country. The central bank lends a bank 100
          at 10% interest: the country now holds exactly 100, and the bank owes
          110. Repaying is not hard — it is impossible. The missing 10 does not
          exist anywhere.
        </p>
        <p>
          Only two things can close the gap: someone borrows more, or the lender
          spends. When the central bank pays a bank, or a bank pays salaries,
          dividends and rent, interest income flows back into circulation, and
          the missing 10 finally exists in someone's account.
        </p>
        <p>
          So a lender that only collects makes its own loans unrepayable. This
          task is the way out: a bank spending its own money into the country.
        </p>
        <p>
          If this feels like it should break the real world, notice that it is
          quietly solved every day: lenders spend without pause, and the same 10
          — spent, collected as interest, spent again — pays many debts as it
          circulates. The impossibility only surfaces when the spending stalls,
          and then it has a familiar name: a debt crisis.
        </p>
        <p>
          The most famous case was predicted before it happened. After World War
          I the winners demanded enormous payments from Germany while refusing
          to buy German goods — collecting without spending back. The economist
          John Maynard Keynes wrote in 1919 that such a debt could never be
          paid, and that forcing it would end in catastrophe. He was right.
        </p>
        <p>
          This is also one reason the central bank interest rate can go below
          zero: a negative rate runs the problem backwards — the debt shrinks by
          itself instead of demanding money that does not exist.
        </p>
      </>
    ),
  },
  ibanChecksum: {
    title: 'An IBAN checks itself',
    body: (
      <>
        <p>
          The two digits after the country code are a checksum computed from the
          whole number. Mistype a single character and the IBAN fails the check
          — the payment is refused instead of sent to a stranger.
        </p>
        <p>
          That is why a bank can reject a wrong IBAN instantly, before any money
          moves.
        </p>
      </>
    ),
  },
  bankRun: {
    title: 'A bank run at the speed of an app',
    body: (
      <>
        <p>
          Every transfer out of a bank drains its reserves — and a bank's
          reserves are far smaller than the balances its clients could ask to
          move. If everyone tries to leave at once, the bank cannot settle them.
        </p>
        <p>
          Once you suspect others are running, running first is the rational
          move. That is why runs feed themselves — and why governments insure
          deposits: not to pay savers back, but to remove the reason to run.
        </p>
        <p>
          In 2023, clients of Silicon Valley Bank tried to withdraw 42 billion
          dollars in a single day, by phone, no queues anywhere. The mechanics
          you just built are the same ones that let a bank die in an afternoon.
        </p>
      </>
    ),
  },
  lendingMyth: {
    title: 'Banks do not lend out deposits',
    body: (
      <>
        <p>
          Look at what your code just did: it created a deposit and recorded a
          claim. It moved no reserves and touched nobody else's account. The
          loan did not hand over existing money — it made new money.
        </p>
        <p>
          The popular picture — a bank collecting savings and lending them
          onward — is wrong, and you have now personally implemented the proof.
          Reserves only limit lending; they are never its raw material.
        </p>
        <p>
          In 2014 the Bank of England published a paper, "Money creation in the
          modern economy", saying it plainly: commercial banks making loans
          create most of the money in existence, and the picture of banks
          lending out savings is wrong. What made the paper famous is who said
          it — the institution at the center of the system, correcting the
          textbooks in public. Many textbooks still teach the old picture.
        </p>
      </>
    ),
  },
  defaultCreates: {
    title: 'Default creates money',
    body: (
      <>
        <p>
          The written-off borrower's deposits survive. Money they spent will
          never be earned back and never destroyed — the write-off effectively
          created it, permanently.
        </p>
        <p>
          Someone still pays: the loss lands on the bank's own money. A bank
          that lends carelessly is spending its own equity — that is what keeps
          banks careful about who they lend to.
        </p>
      </>
    ),
  },
  repayDestroys: {
    title: 'Repaying a loan destroys money',
    body: (
      <>
        <p>
          Repaying shrinks your balance and the debt together: the money the
          loan created is destroyed — the exact reverse of its birth.
        </p>
        <p>
          Nearly all money is like this. In modern economies only a few percent
          of money is physical cash; the rest is bank deposits, born from loans
          — every mortgage payment in the world quietly shrinks the money
          supply.
        </p>
        <p>
          If everyone somehow repaid every debt at once, most money would simply
          vanish.
        </p>
        <p>
          The opposite ending exists too. When a loan fails, its money stays
          alive as long as the commercial bank that made it can bear the loss.
          When failures outgrow that bank's own money, the bank itself dies —
          and before rescues and deposit insurance existed, its clients'
          balances died with it. In the Great Depression, thousands of American
          commercial banks failed this way, and roughly a third of the country's
          money vanished in four years.
        </p>
        <p>
          There is also a third ending: the central bank bears the loss, and the
          money the failed loans created stays in the world — which can lead to
          hyperinflation. In Weimar Germany, Zimbabwe, and Venezuela,
          governments borrowed endlessly from their own central banks with no
          real prospect of repaying. The permanent ending became the country's
          main source of new money, and prices ran away. The 2008 rescues caused
          nothing like it: that new money replaced money the crash was
          destroying, and the two roughly cancelled.
        </p>
        <p>So money born from loans has three possible endings:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>destroyed on schedule, by repayment</li>
          <li>destroyed all at once, with a dying commercial bank</li>
          <li>
            made permanent, when the central bank bears the loss and the money
            stays in the system
          </li>
        </ul>
        <p>
          The rules around banking exist to make the first ending the standard
          one.
        </p>
      </>
    ),
  },
};

export function Curiosity({ id }: { id: CuriosityId }) {
  const read = useReadCuriosities().has(id);
  const curiosity = CURIOSITIES[id];

  const toggle = () => storeRead(id, !read);

  return (
    // The card sets itself apart from the task card it sits on by its
    // edges, not its area: the border leans toward the lightbulb's warn
    // and a soft shadow lifts it — the reading surface itself stays the
    // plain page color.
    <div className="rounded-lg border border-warn/25 px-5 py-4 shadow-xs">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h4 className="flex items-center gap-2 text-[15px] font-semibold">
          <Lightbulb size={16} className="shrink-0 text-warn" aria-hidden />
          {curiosity.title}
        </h4>
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
              <Lightbulb size={15} aria-hidden /> Mark as read
            </>
          )}
        </Button>
      </div>
      <div className="space-y-2.5 text-[15px] leading-relaxed">
        {curiosity.body}
      </div>
    </div>
  );
}
