import Big from 'big.js';
import { useEffect, useState } from 'react';

import { TASK } from '@banks/shared/curriculum.ts';

import { api } from '../api.ts';
import { formatMoney } from '../format.ts';
import { anyUnlocked, isUnlocked } from '../gating.ts';
import { ActionGroup } from './ActionGroup.tsx';
import { Amount } from './Amount.tsx';
import { DatabaseSection } from './DatabaseSection.tsx';
import { LendToBankDialog } from './LendToBankDialog.tsx';
import { LogSection } from './LogSection.tsx';
import { OpenBankDialog } from './OpenBankDialog.tsx';
import { PayBankDialog } from './PayBankDialog.tsx';
import { Explain } from '@banks/shared/browser/ui/tooltip.tsx';

import { SetPolicyRateDialog } from './SetPolicyRateDialog.tsx';
import { SetReserveRatioDialog } from './SetReserveRatioDialog.tsx';
import { TransferReservesDialog } from './TransferReservesDialog.tsx';
import { UnbalancedBar } from './UnbalancedBar.tsx';
import { WriteOffBankDebtDialog } from './WriteOffBankDebtDialog.tsx';

// The central banker's screen: the balance sheet as the whole state view
// — assets (claims on banks) beside liabilities (reserve accounts) plus
// the central bank's own account, its interest income (equity) — and
// the operations this role initiates. The conservation check below the
// sheet is silent while true and loud when broken: it is computed here,
// from the same numbers the sheet renders, so it keeps working precisely
// when the domain code is wrong.

type CentralBankBalanceSheet = Awaited<
  ReturnType<typeof api.centralBank.balanceSheet.query>
>;
type Bank = Awaited<ReturnType<typeof api.banks.list.query>>[number];

interface Config {
  country: string;
  currency: string;
  decimals: number;
  /** The policy rate, as a ratio string ('0.05' = 5%). */
  policyRate: string;
  /** The reserve requirement, as a ratio string ('0.10' = 10%). */
  reserveRatio: string;
  /** Task id → unlocked; operations reveal per task (gating.ts). */
  tasks: Record<string, boolean>;
}

export function CentralBankScreen({
  version,
  config,
}: {
  version: number;
  config: Config;
}) {
  const [books, setBooks] = useState<CentralBankBalanceSheet | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);

  useEffect(() => {
    let cancelled = false;
    // Connectivity problems surface in the App-level banner, not here.
    void Promise.all([
      api.centralBank.balanceSheet.query(),
      api.banks.list.query(),
    ])
      .then(([nextBooks, nextBanks]) => {
        if (cancelled) return;
        setBooks(nextBooks);
        setBanks(nextBanks);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [version]);

  const balanced =
    !books || books.totalClaims === books.totalLiabilitiesAndEquity;
  const difference = books
    ? new Big(books.totalClaims)
        .minus(books.totalLiabilitiesAndEquity)
        .abs()
        .toFixed(config.decimals)
    : '';

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-baseline gap-3">
        <h2 className="text-lg font-semibold">
          <Explain
            hint={
              <>
                A public institution — every country or currency area has one:
                the bank where the banks themselves have their accounts.
                <p className="mt-1">
                  Commercial banks hold accounts at the central bank the way
                  people hold accounts at a commercial bank. The money in those
                  accounts is called reserves, and banks settle payments between
                  each other with it.
                </p>
                <p className="mt-1">
                  It alone issues the currency, and the rate at which it lends
                  to banks makes borrowing cheaper or dearer across the whole
                  economy.
                </p>
              </>
            }
          >
            Central Bank{config.country ? ` of ${config.country}` : ''}
          </Explain>
        </h2>
        {/* The gauges: policy dials whose display is the control. Each
            appears with the operation its value prices or limits — the
            reserve dial is prebuilt (the teacher's lever), so it follows
            the client lending it limits. */}
        {isUnlocked(config.tasks, TASK.setPolicyRate) && (
          <SetPolicyRateDialog policyRate={config.policyRate} />
        )}
        {isUnlocked(config.tasks, TASK.lendToClient) && (
          <SetReserveRatioDialog reserveRatio={config.reserveRatio} />
        )}
      </div>

      <div className="mb-5 flex flex-wrap gap-3">
        {/* Licensing is the central bank's authority: the button lives
            here, even though what it creates is a commercial bank. */}
        {isUnlocked(config.tasks, TASK.openBank) && (
          <ActionGroup
            label="New bank"
            hint={
              <>
                A bank begins as an entry in the central bank's database: a
                reserve account opened in its name.
                <p className="mt-1">
                  That account plays the same role for the bank as your account
                  at a commercial bank plays for you: the bank keeps its money
                  there and pays other banks from it.
                </p>
              </>
            }
          >
            <OpenBankDialog />
          </ActionGroup>
        )}
        {isUnlocked(config.tasks, TASK.payBank) && (
          <ActionGroup
            label="Payments"
            hint={
              <>
                Between banks, money moves as reserves: entries in the central
                bank's database.
                <p className="mt-1">
                  When clients of two different banks pay each other, each bank
                  changes its own client entries — and the banks settle the
                  difference by moving reserves.
                </p>
              </>
            }
          >
            <PayBankDialog banks={banks} currency={config.currency} />
          </ActionGroup>
        )}
        {anyUnlocked(config.tasks, [
          TASK.lendToBank,
          TASK.writeOffBankDebt,
        ]) && (
          <ActionGroup
            label="Credit (money creation)"
            hint={
              <>
                Lending to a bank creates money: the bank's reserves grow by an
                amount that did not exist before, and a claim records the debt
                plus interest.
                <p className="mt-1">
                  Repayment destroys those reserves again. A claim that will
                  never be paid is written off: the central bank's equity
                  absorbs the loss.
                </p>
              </>
            }
          >
            {isUnlocked(config.tasks, TASK.lendToBank) && (
              <LendToBankDialog
                banks={banks}
                currency={config.currency}
                policyRate={config.policyRate}
              />
            )}
            {isUnlocked(config.tasks, TASK.writeOffBankDebt) && (
              <WriteOffBankDebtDialog
                banks={banks}
                claims={books?.claims ?? []}
                currency={config.currency}
              />
            )}
          </ActionGroup>
        )}
        {isUnlocked(config.tasks, TASK.transferReserves) && (
          <ActionGroup
            debug
            label="Debug"
            hint={
              <>
                Debug buttons change the system's raw state by hand — good for
                experiments, not something a real central bank does.
                <p className="mt-1">
                  Reserves normally move only to settle a payment. Moved on
                  their own, they leave both banks' balance sheets unbalanced
                  until you move them back.
                </p>
              </>
            }
          >
            <TransferReservesDialog banks={banks} currency={config.currency} />
          </ActionGroup>
        )}
      </div>

      {books && (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="border-b border-line px-4 py-2.5 text-xs font-semibold tracking-wide text-muted uppercase">
            <Explain
              hint={
                <>
                  Every line records a debt: who owes, and who is owed. The
                  sheet shows them all from the central bank's side.
                  <p className="mt-1">
                    Assets are debts owed to the central bank. Liabilities are
                    debts the central bank owes. Equity is the leftover that
                    belongs to the central bank itself once the debts cancel
                    out.
                  </p>
                  <p className="mt-1">
                    That is why it balances: everything the central bank holds
                    is either owed onward to somebody, or its own.
                  </p>
                </>
              }
            >
              Balance sheet
            </Explain>
          </div>
          {books.reserveAccounts.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted">
              No banks are registered yet — license the first one with the
              button above, then lend it reserves.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2">
              <div className="px-4 py-3 sm:border-r sm:border-line">
                <div className="mb-2 text-xs font-semibold text-muted">
                  <Explain
                    hint={
                      <>
                        Promises held as value: each claim is a commercial
                        bank's promise to pay back what it borrowed, plus
                        interest — counted as an asset before any money returns.
                        <p className="mt-1">
                          Each claim is the same debt the borrowing bank lists
                          as "owed to the central bank" — one debt, two sheets,
                          opposite sides.
                        </p>
                        <p className="mt-1">
                          The lending is also what created the reserves: money
                          is born when a loan is made.
                        </p>
                      </>
                    }
                  >
                    Assets
                  </Explain>
                </div>
                <div className="-mx-2 rounded-lg bg-faint px-2 py-1">
                  {books.claims.length === 0 ? (
                    <p className="py-0.5 text-sm text-muted italic">
                      no claims — no bank owes anything
                    </p>
                  ) : (
                    books.claims.map(claim => (
                      <div
                        key={claim.id}
                        className="flex items-baseline justify-between gap-3 py-0.5 text-sm"
                      >
                        <span>{claim.borrower} owes</span>
                        <Amount
                          value={claim.amount}
                          currency={config.currency}
                        />
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-1.5 flex items-baseline justify-between gap-3 border-t border-line pt-1.5 text-sm font-semibold">
                  <span>total claims</span>
                  <Amount
                    value={books.totalClaims}
                    currency={config.currency}
                  />
                </div>
              </div>
              <div className="border-t border-line px-4 py-3 sm:border-t-0">
                <div className="mb-2 text-xs font-semibold text-muted">
                  <Explain hint="The share of the assets that belongs to the central bank itself.">
                    Equity
                  </Explain>
                </div>
                <div className="-mx-2 mb-1.5 rounded-lg border border-line bg-surface px-2 py-1">
                  <div className="flex items-baseline justify-between gap-3 py-0.5 text-sm">
                    <span>
                      <Explain
                        hint={
                          <>
                            The central bank's own money.
                            <ul className="mt-1 list-disc space-y-0.5 pl-4">
                              <li>
                                in: interest from lending to commercial banks
                              </li>
                              <li>
                                out: payments to commercial banks, write-offs
                              </li>
                            </ul>
                            <p className="mt-1">
                              Below zero is fine here, and only here: a central
                              bank cannot run out of money it itself creates.
                              The real Czech central bank ran below zero for a
                              decade.
                            </p>
                          </>
                        }
                      >
                        the central bank's own account (equity)
                      </Explain>
                    </span>
                    <Amount value={books.equity} currency={config.currency} />
                  </div>
                </div>
                <div className="mt-3 mb-2 text-xs font-semibold text-muted">
                  <Explain hint="The rest of the assets belongs to the commercial banks, through their reserve accounts.">
                    Liabilities
                  </Explain>
                </div>
                <div className="-mx-2 rounded-lg bg-faint px-2 py-1">
                  <div className="pt-0.5 pb-1 text-xs text-muted">
                    <Explain
                      hint={
                        <>
                          The commercial banks' money, kept at the central bank.
                          The central bank owes it to them, so here it counts as
                          a liability.
                          <p className="mt-1">
                            Each account is what its bank calls "reserves at the
                            central bank" on its own sheet — one balance, two
                            sheets, opposite sides.
                          </p>
                          <p className="mt-1">
                            A payment from one commercial bank to another moves
                            balance between these accounts.
                          </p>
                        </>
                      }
                    >
                      reserve accounts
                    </Explain>
                  </div>
                  {books.reserveAccounts.map(account => (
                    <div
                      key={account.id}
                      className="flex items-baseline justify-between gap-3 py-0.5 text-sm"
                    >
                      <span>{account.owner}</span>
                      <Amount
                        value={account.balance}
                        currency={config.currency}
                      />
                    </div>
                  ))}
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
          )}
          {!balanced && (
            <UnbalancedBar>
              The balance sheet does not balance: claims{' '}
              {formatMoney(books.totalClaims)} {config.currency}, reserves +
              equity {formatMoney(books.totalLiabilitiesAndEquity)}{' '}
              {config.currency} — off by {formatMoney(difference)}{' '}
              {config.currency}.
            </UnbalancedBar>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        <DatabaseSection
          version={version}
          label="Database — the central bank's own database"
          schemas={['central_bank']}
        />
        <LogSection
          label="Log — central bank operations"
          pathPrefixes={['centralBank.']}
        />
      </div>
    </section>
  );
}
