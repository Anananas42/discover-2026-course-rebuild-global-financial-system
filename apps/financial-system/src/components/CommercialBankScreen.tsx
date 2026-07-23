import Big from 'big.js';
import { ChevronRight } from 'lucide-react';
import { Fragment, useEffect, useState, useSyncExternalStore } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@banks/shared/browser/ui/select.tsx';

import { TASK } from '@banks/shared/curriculum.ts';

import { ActionGroup } from './ActionGroup.tsx';
import { concernsAccount } from '../account-activity.ts';
import { api } from '../api.ts';
import { anyDone, isDone } from '../gating.ts';
import { getCallLog, isUnread, subscribeCallLog } from '../call-log.ts';
import { formatIban, formatMoney } from '../format.ts';
import { Amount } from './Amount.tsx';
import { CopyIbanButton } from './CopyIbanButton.tsx';
import { DatabaseSection } from './DatabaseSection.tsx';
import { ReceiveNoticeDialog } from './ReceiveNoticeDialog.tsx';
import { ReceivePaymentDialog } from './ReceivePaymentDialog.tsx';
import { LendToClientDialog } from './LendToClientDialog.tsx';
import { LogEntries } from './LogEntries.tsx';
import { LogSection } from './LogSection.tsx';
import { PayFromBankDialog } from './PayFromBankDialog.tsx';
import { RepayCentralBankDialog } from './RepayCentralBankDialog.tsx';
import { SetInterestRateDialog } from './SetInterestRateDialog.tsx';
import { UnbalancedBar } from './UnbalancedBar.tsx';
import { WriteOffLoanDialog } from './WriteOffLoanDialog.tsx';
import { useStoredState } from '../use-stored-state.ts';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@banks/shared/browser/ui/table.tsx';
import { Explain } from '@banks/shared/browser/ui/tooltip.tsx';

// The commercial banker's screen. The identity selector is the screen's
// subject: "commercial bank" is one screen per bank, and switching takes
// one click. Two panels, deliberately separate: the client accounts are
// the ledger the bank operates; the balance sheet is the bank's own
// health — a bank's deposits being a *liability* is the concept the
// separation teaches. The bank's own account — its equity, where interest
// income lands — sits on the sheet's right side: assets must equal
// liabilities plus equity. The conservation bar fires when they stop
// matching, computed here from the same numbers the sheet renders.

type Bank = Awaited<ReturnType<typeof api.banks.list.query>>[number];
type BankBalanceSheet = Awaited<
  ReturnType<typeof api.banks.balanceSheet.query>
>;

interface Config {
  country: string;
  currency: string;
  decimals: number;
  /** Task id → implemented; operations reveal per task (gating.ts). */
  tasks: Record<string, boolean>;
}

export function CommercialBankScreen({
  version,
  config,
}: {
  version: number;
  config: Config;
}) {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedId, setSelectedId] = useStoredState(
    'commercial-bank-identity'
  );
  const [books, setBooks] = useState<BankBalanceSheet | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loansOpen, setLoansOpen] = useState(false);
  const log = useSyncExternalStore(subscribeCallLog, getCallLog);
  const selected =
    banks.find(bank => String(bank.id) === selectedId) ?? banks[0];

  const toggleExpanded = (iban: string) => {
    setExpanded(current => {
      const next = new Set(current);
      if (next.has(iban)) next.delete(iban);
      else next.add(iban);
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    void api.banks.list
      .query()
      .then(next => {
        if (!cancelled) setBanks(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [version]);

  const selectedRef = selected?.id;
  useEffect(() => {
    if (selectedRef === undefined) {
      setBooks(null);
      return;
    }
    let cancelled = false;
    void api.banks.balanceSheet
      .query({ bankId: selectedRef })
      .then(next => {
        if (!cancelled) setBooks(next);
      })
      .catch(() => {
        if (!cancelled) setBooks(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRef, version]);

  // The client list groups accounts under their owner — the mirror of the
  // People tab, which groups one person's accounts under their banks. Rows
  // and groups both sort richest-first.
  const byOwner: {
    personId: string;
    owner: string;
    rows: BankBalanceSheet['accounts'];
  }[] = [];
  for (const account of books?.accounts ?? []) {
    const group = byOwner.find(
      candidate => candidate.personId === account.personId
    );
    if (group) group.rows.push(account);
    else {
      byOwner.push({
        personId: account.personId,
        owner: account.owner,
        rows: [account],
      });
    }
  }
  const balanceOf = (rows: BankBalanceSheet['accounts']) =>
    rows.reduce((sum, row) => sum.plus(row.balance), new Big(0));
  // One total per borrower for the expandable "loans to clients" line —
  // a client with several loans appears once, largest debt first. Loans
  // are keyed by the borrower's personal id; the name resolves through
  // the accounts, the same join the write-off dialog makes.
  const loansByBorrower: { personId: string; owner: string; total: Big }[] = [];
  for (const loan of books?.loans ?? []) {
    const group = loansByBorrower.find(
      candidate => candidate.personId === loan.borrower
    );
    if (group) group.total = group.total.plus(loan.amount);
    else {
      loansByBorrower.push({
        personId: loan.borrower,
        owner:
          books?.accounts.find(account => account.personId === loan.borrower)
            ?.owner ?? loan.borrower,
        total: new Big(loan.amount),
      });
    }
  }
  loansByBorrower.sort((a, b) => b.total.cmp(a.total));
  for (const group of byOwner) {
    group.rows.sort((a, b) => new Big(b.balance).cmp(a.balance));
  }
  byOwner.sort((a, b) => balanceOf(b.rows).cmp(balanceOf(a.rows)));
  // Every account a debug message could address — the bank's own account
  // first among equals, then clients — richest first, like every list.
  const receivable = books
    ? [
        {
          iban: books.ownAccount.iban,
          owner: selected?.name ?? '',
          balance: books.ownAccount.balance,
        },
        ...books.accounts.map(account => ({
          iban: account.iban,
          owner: account.owner,
          balance: account.balance,
        })),
      ].sort((a, b) => new Big(b.balance).cmp(a.balance))
    : [];
  const balanced =
    !books || books.totalAssets === books.totalLiabilitiesAndEquity;
  const difference = books
    ? new Big(books.totalAssets)
        .minus(books.totalLiabilitiesAndEquity)
        .abs()
        .toFixed(config.decimals)
    : '';

  return (
    <section>
      <div className="mb-4">
        <h2 className="mb-1.5 text-lg font-semibold">
          You are{' '}
          <Explain
            hint={
              <>
                A private business — it profits from the interest on what it
                lends.
                <p className="mt-1">
                  The money in client accounts is money the bank owes its
                  clients.
                </p>
              </>
            }
          >
            a commercial bank
          </Explain>
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {banks.length > 0 ? (
            <Select
              value={String(selected?.id ?? '')}
              onValueChange={setSelectedId}
            >
              <SelectTrigger
                className="w-auto font-semibold"
                aria-label="Which bank you are"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {banks.map(bank => (
                  <SelectItem key={bank.id} value={String(bank.id)}>
                    {bank.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-lg font-semibold text-muted">
              no bank yet
            </span>
          )}
          {/* The bank's gauge: its price dial, display and control in one.
              Prebuilt, like the reserve-requirement dial — it appears with
              client lending, the operation it prices. */}
          {isDone(config.tasks, TASK.lendToClient) && selected && books && (
            <SetInterestRateDialog
              bank={selected}
              interestRate={books.interestRate}
            />
          )}
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-3">
        {isDone(config.tasks, TASK.payFromBank) && (
          <ActionGroup
            label="Payments"
            hint={
              <>
                What a payment changes depends on where it goes.
                <p className="mt-1">
                  Between two accounts of this bank, only this bank's database
                  changes: one balance down, one up.
                </p>
                <p className="mt-1">
                  To an account at another bank, the other bank raises its
                  client's balance — and this bank settles with it by moving
                  reserves at the central bank.
                </p>
              </>
            }
          >
            <PayFromBankDialog bank={selected} currency={config.currency} />
          </ActionGroup>
        )}
        {anyDone(config.tasks, [
          TASK.lendToClient,
          TASK.receiveRepayment,
          TASK.writeOffLoan,
        ]) && (
          <ActionGroup
            label="Credit (money creation)"
            hint={
              <>
                A loan is two entries in this bank's database: the client's
                balance grows by a brand-new deposit — money that did not exist
                before — and a claim records what the client owes back, plus
                interest.
                <p className="mt-1">
                  Repayment runs the loan in reverse: balance and claim shrink
                  together, and the deposit is destroyed again.
                </p>
                <p className="mt-1">
                  A loan that will never be repaid is written off: the claim
                  disappears and the bank's equity absorbs the loss.
                </p>
              </>
            }
          >
            {isDone(config.tasks, TASK.lendToClient) && (
              <LendToClientDialog
                bank={selected}
                accounts={books?.accounts ?? []}
                currency={config.currency}
                interestRate={books?.interestRate}
              />
            )}
            {isDone(config.tasks, TASK.receiveRepayment) && (
              <RepayCentralBankDialog
                bank={selected}
                currency={config.currency}
              />
            )}
            {isDone(config.tasks, TASK.writeOffLoan) && (
              <WriteOffLoanDialog
                bank={selected}
                accounts={books?.accounts ?? []}
                loans={books?.loans ?? []}
                currency={config.currency}
              />
            )}
          </ActionGroup>
        )}
        {anyDone(config.tasks, [
          TASK.recordCentralBankNotice,
          TASK.receivePayment,
        ]) &&
          selected && (
            <ActionGroup
              debug
              label="Debug"
              hint={
                <>
                  Debug buttons change the system's raw state by hand — good for
                  experiments, not something a real bank does.
                  <p className="mt-1">
                    A notice or a payment message normally arrives only after a
                    real operation at the other institution. Received bare, it
                    leaves this bank's balance sheet unbalanced: its records
                    changed, and nothing elsewhere explains it.
                  </p>
                </>
              }
            >
              {isDone(config.tasks, TASK.recordCentralBankNotice) && (
                <ReceiveNoticeDialog
                  bank={selected}
                  currency={config.currency}
                />
              )}
              {isDone(config.tasks, TASK.receivePayment) && (
                <ReceivePaymentDialog
                  bank={selected}
                  banks={banks}
                  accounts={receivable}
                  currency={config.currency}
                />
              )}
            </ActionGroup>
          )}
      </div>

      {books && (
        <>
          <div className="mb-4 overflow-hidden rounded-xl border border-line bg-surface">
            <div className="border-b border-line px-4 py-2.5 text-xs font-semibold tracking-wide text-muted uppercase">
              <Explain
                hint={
                  <>
                    Every line records a debt: who owes, and who is owed. The
                    sheet shows them all from this bank's side.
                    <p className="mt-1">
                      Assets are debts owed to the bank. Liabilities are debts
                      the bank owes. Equity is the leftover that belongs to the
                      bank itself once the debts cancel out.
                    </p>
                    <p className="mt-1">
                      That is why it balances: everything the bank holds is
                      either owed onward to somebody, or its own.
                    </p>
                  </>
                }
              >
                Balance sheet
              </Explain>
            </div>
            <div className="grid sm:grid-cols-2">
              <div className="px-4 py-3 sm:border-r sm:border-line">
                <div className="mb-2 text-xs font-semibold text-muted">
                  <Explain
                    hint={
                      <>
                        Everything of value the commercial bank holds:
                        <ul className="mt-1 list-disc space-y-0.5 pl-4">
                          <li>its money at the central bank</li>
                          <li>what borrowers owe to the commercial bank</li>
                        </ul>
                        <p className="mt-1">
                          Every asset belongs to somebody - liabilities and
                          equity list who.
                        </p>
                      </>
                    }
                  >
                    Assets
                  </Explain>
                </div>
                <div className="-mx-2 rounded-lg bg-faint px-2 py-1">
                  <div className="flex items-baseline justify-between gap-3 py-0.5 text-sm">
                    <span>
                      <Explain
                        hint={
                          <>
                            The commercial bank's own account, one level up:
                            money it keeps at the central bank, the way a person
                            keeps money at a commercial bank. The central bank
                            owes it back, so it counts as an asset. Two jobs:
                            <ul className="mt-1 list-disc space-y-0.5 pl-4">
                              <li>pays transfers to other commercial banks</li>
                              <li>limits lending - the reserve requirement</li>
                            </ul>
                          </>
                        }
                      >
                        reserves at the central bank
                      </Explain>
                    </span>
                    <Amount value={books.reserves} currency={config.currency} />
                  </div>
                  <div
                    className={`flex items-baseline justify-between gap-3 py-0.5 text-sm ${
                      loansByBorrower.length > 0
                        ? '-mx-1 cursor-pointer rounded-md px-1 hover:bg-line'
                        : ''
                    }`}
                    onClick={() =>
                      loansByBorrower.length > 0 && setLoansOpen(open => !open)
                    }
                  >
                    <span>
                      {loansByBorrower.length > 0 && (
                        <button
                          className="mr-1 cursor-pointer align-middle text-muted hover:text-ink"
                          title="Show each client's total"
                          aria-label="Show each client's total"
                          aria-expanded={loansOpen}
                          onClick={event => {
                            event.stopPropagation();
                            setLoansOpen(open => !open);
                          }}
                        >
                          <ChevronRight
                            size={14}
                            className={`transition-transform ${loansOpen ? 'rotate-90' : ''}`}
                          />
                        </button>
                      )}
                      <Explain
                        hint={
                          <>
                            Promises held as value: clients' future repayments,
                            plus interest — counted as an asset before any money
                            returns.
                            <p className="mt-1">
                              Each loan created the deposit it paid out: money
                              is born when a loan is made, and destroyed when it
                              is repaid.
                            </p>
                            <p className="mt-1">
                              A promise can fail. A written-off loan leaves this
                              list, and the loss lands on the bank's own
                              account.
                            </p>
                          </>
                        }
                      >
                        loans to clients
                      </Explain>
                    </span>
                    <Amount
                      value={books.totalLoans}
                      currency={config.currency}
                    />
                  </div>
                  {loansOpen &&
                    loansByBorrower.map(loan => (
                      <div
                        key={loan.personId}
                        className="flex items-baseline justify-between gap-3 py-0.5 pl-5 text-sm text-muted"
                      >
                        <span>
                          {loan.owner}
                          <span className="ml-1.5 font-mono text-xs tabular-nums">
                            | {loan.personId}
                          </span>
                        </span>
                        <Amount
                          value={loan.total.toFixed(config.decimals)}
                          currency={config.currency}
                        />
                      </div>
                    ))}
                </div>
                <div className="mt-1.5 flex items-baseline justify-between gap-3 border-t border-line pt-1.5 text-sm font-semibold">
                  <span>total assets</span>
                  <Amount
                    value={books.totalAssets}
                    currency={config.currency}
                  />
                </div>
              </div>
              <div className="border-t border-line px-4 py-3 sm:border-t-0">
                <div className="mb-2 text-xs font-semibold text-muted">
                  <Explain hint="The share of the assets that belongs to the commercial bank itself.">
                    Equity
                  </Explain>
                </div>
                <div className="-mx-2 mb-1.5 rounded-lg border border-line bg-surface px-2 py-1">
                  <div className="flex items-baseline justify-between gap-3 py-0.5 text-sm">
                    <span>
                      <Explain
                        hint={
                          <>
                            The commercial bank's own money - what would remain
                            after paying everyone back. Nobody outside the
                            commercial bank can claim it, so it is not a
                            liability.
                            <ul className="mt-1 list-disc space-y-0.5 pl-4">
                              <li>in: interest earned</li>
                              <li>
                                out: salaries, dividends, written-off loans
                              </li>
                            </ul>
                            <p className="mt-1">
                              Below zero = insolvency, honestly reported.
                            </p>
                          </>
                        }
                      >
                        the bank's own account (equity)
                      </Explain>
                    </span>
                    <Amount
                      value={books.ownAccount.balance}
                      currency={config.currency}
                    />
                  </div>
                  <div className="pb-0.5 font-mono text-xs text-muted tabular-nums">
                    <span className="mr-1.5">
                      {formatIban(books.ownAccount.iban)}
                    </span>
                    <CopyIbanButton iban={books.ownAccount.iban} />
                  </div>
                </div>
                <div className="mt-3 mb-2 text-xs font-semibold text-muted">
                  <Explain
                    hint={
                      <>
                        Who the rest of the assets belongs to:
                        <ul className="mt-1 list-disc space-y-0.5 pl-4">
                          <li>deposits - to the clients</li>
                          <li>debt - to the central bank</li>
                        </ul>
                      </>
                    }
                  >
                    Liabilities
                  </Explain>
                </div>
                <div className="-mx-2 rounded-lg bg-faint px-2 py-1">
                  <div className="flex items-baseline justify-between gap-3 py-0.5 text-sm">
                    <span>
                      <Explain
                        hint={
                          <>
                            The money in clients' accounts. The commercial bank
                            owes every balance to its holder, so deposits count
                            as a liability.
                            <p className="mt-1">
                              A balance is nothing stored — it is the bank's
                              debt to the account owner. A payment inside the
                              bank just changes who the bank owes.
                            </p>
                          </>
                        }
                      >
                        client deposits
                      </Explain>
                    </span>
                    <Amount
                      value={books.totalDeposits}
                      currency={config.currency}
                    />
                  </div>
                  <div className="flex items-baseline justify-between gap-3 py-0.5 text-sm">
                    <span>
                      <Explain
                        hint={
                          <>
                            What this commercial bank borrowed from the central
                            bank, plus interest. The commercial bank owes it, so
                            it counts as a liability.
                            <p className="mt-1">
                              The same debt appears on the central bank's sheet
                              as its claim on this bank — one debt, two sheets,
                              opposite sides.
                            </p>
                          </>
                        }
                      >
                        owed to the central bank
                      </Explain>
                    </span>
                    <Amount
                      value={books.owedToCentralBank}
                      currency={config.currency}
                    />
                  </div>
                </div>
                <div className="mt-1.5 flex items-baseline justify-between gap-3 border-t border-line pt-1.5 text-sm font-semibold">
                  <span>total equity + liabilities</span>
                  <Amount
                    value={books.totalLiabilitiesAndEquity}
                    currency={config.currency}
                  />
                </div>
              </div>
            </div>
            {!balanced && (
              <UnbalancedBar>
                The balance sheet does not balance: assets{' '}
                {formatMoney(books.totalAssets)} {config.currency}, liabilities
                + equity {formatMoney(books.totalLiabilitiesAndEquity)}{' '}
                {config.currency} — off by {formatMoney(difference)}{' '}
                {config.currency}.
              </UnbalancedBar>
            )}
          </div>
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <div className="border-b border-line px-4 py-2.5 text-xs font-semibold tracking-wide text-muted uppercase">
              Client accounts
            </div>
            {books.accounts.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted">
                No clients yet — accounts are opened from the People tab.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">IBAN</TableHead>
                    <TableHead className="pr-4 text-right">balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byOwner.map(group => (
                    <Fragment key={group.personId}>
                      <TableRow className="bg-faint">
                        <TableCell
                          colSpan={2}
                          className="py-1.5 pl-4 text-xs font-semibold tracking-wider text-muted uppercase"
                        >
                          {group.owner}
                          <span className="ml-1.5 font-mono font-normal tracking-normal normal-case tabular-nums">
                            | {group.personId}
                          </span>
                        </TableCell>
                      </TableRow>
                      {group.rows.map(account => {
                        const open = expanded.has(account.iban);
                        const activity = log.filter(entry =>
                          concernsAccount(entry, {
                            bankId: books.bank.id,
                            accountId: account.id,
                            iban: account.iban,
                          })
                        );
                        return (
                          <Fragment key={account.id}>
                            <TableRow
                              className="cursor-pointer hover:bg-faint"
                              onClick={() => toggleExpanded(account.iban)}
                            >
                              <TableCell className="pl-2 font-mono text-xs text-muted tabular-nums">
                                <button
                                  className="mr-1 cursor-pointer align-middle text-muted hover:text-ink"
                                  title="Show this account's activity"
                                  aria-label="Show this account's activity"
                                  aria-expanded={open}
                                  onClick={event => {
                                    event.stopPropagation();
                                    toggleExpanded(account.iban);
                                  }}
                                >
                                  <ChevronRight
                                    size={14}
                                    className={`transition-transform ${open ? 'rotate-90' : ''}`}
                                  />
                                </button>
                                {activity.some(entry => isUnread(entry.id)) && (
                                  <span
                                    className="mr-1.5 inline-block size-1.5 rounded-full bg-accent align-middle"
                                    aria-hidden
                                  />
                                )}
                                <span className="mr-1.5">
                                  {formatIban(account.iban)}
                                </span>
                                <CopyIbanButton iban={account.iban} />
                              </TableCell>
                              <TableCell className="pr-4 text-right">
                                <Amount
                                  value={account.balance}
                                  currency={config.currency}
                                />
                              </TableCell>
                            </TableRow>
                            {open && (
                              <TableRow>
                                <TableCell colSpan={2} className="p-0">
                                  {activity.length === 0 ? (
                                    <p className="px-4 py-2 text-xs text-muted">
                                      No operations touched this account yet.
                                    </p>
                                  ) : (
                                    <LogEntries
                                      entries={activity}
                                      className="divide-y divide-line border-l-2 border-line"
                                    />
                                  )}
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="pl-4">total deposits</TableCell>
                    <TableCell className="pr-4 text-right">
                      <Amount
                        value={books.totalDeposits}
                        currency={config.currency}
                      />
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </div>
        </>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {selected && (
          <DatabaseSection
            version={version}
            label={`Database — ${selected.name}'s own database`}
            schemas={[`bank_${selected.id}`]}
          />
        )}
        <LogSection label="Log — bank operations" pathPrefixes={['banks.']} />
      </div>
    </section>
  );
}
