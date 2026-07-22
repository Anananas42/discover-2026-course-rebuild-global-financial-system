// The financial system API contract: every procedure the frontend can call, defined
// once, here. This file is the single source of truth — the client's
// types are inferred from `AppRouter`, so a frontend call that drifts
// from the server is a compile error, and procedure inputs are declared
// as zod schemas, so invalid input fails loudly at runtime instead of
// being trusted. (See DESIGN.md: set up for LLM-assisted development.)
//
// Money crosses the wire as fixed-decimal strings in major units, both
// ways — never floats, never Big instances (they would lie in the
// inferred types). The `debug` procedures bypass the domain deliberately:
// they power the Database view, its reset button, and the revert to the
// last balanced state, which must stay truthful even when the domain
// code is broken.
//
// GREENFIELD: the domestic stack (curriculum stages 1–8)
// is complete; the international operations arrive with the
// interbank design.

import path from 'node:path';

import { initTRPC } from '@trpc/server';
import Big from 'big.js';
import { Effect } from 'effect';
import { z } from 'zod';

import {
  CentralBank,
  parseAmount,
} from '@banks/central-bank/central-bank-service.ts';
import { CURRENCY } from '@banks/central-bank/currency.ts';
import { CommercialBanks } from '@banks/commercial-bank/commercial-bank-service.ts';
import { bicFor, ibanFor } from '@banks/commercial-bank/iban.ts';
import { connect } from '@banks/db/database.ts';

import { readCourseConfig } from '../shared/course-config.ts';
import { scanTaskStatus } from '../shared/task-status.ts';
import { dbApiReference } from './db-api-reference.ts';
import { runEffect } from './effect-runner.ts';
import { classifyOutcome } from './error-outcome.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

const db = await connect();
const centralBank = new CentralBank(db);
const commercialBanks = new CommercialBanks(db, centralBank);

/** Money leaves the API as a fixed-decimal string in major units. */
function money(amount: Big): string {
  return amount.toFixed(CURRENCY.decimals);
}

const t = initTRPC.create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        outcome: classifyOutcome(error.cause, error.message),
      },
    };
  },
});

/** True when every institution's sheet balances — the same comparisons
 *  the screens' conservation bars make, computed from the same books. */
async function systemBalanced(): Promise<boolean> {
  const central = await runEffect(centralBank.balanceSheet());
  if (!central.totalClaims.eq(central.totalReserves.plus(central.equity))) {
    return false;
  }
  const zero = new Big(0);
  const banks = await db.banks.list();
  for (const bank of banks) {
    const books = await runEffect(
      commercialBanks.balanceSheet({ bankId: bank.id })
    );
    const reserves =
      central.reserveAccounts.find(account => account.owner === bank.name)
        ?.balance ?? zero;
    const owed =
      central.claims.find(claim => claim.borrower === bank.name)?.amount ??
      zero;
    const assets = reserves.plus(books.totalLoans);
    if (!assets.eq(books.totalDeposits.plus(owed).plus(books.equity))) {
      return false;
    }
  }
  return true;
}

/** Overwrites the snapshot slot whenever the whole system balances — the
 *  state `debug.revertToBalanced` returns to after a debug action breaks
 *  the books. While the books stay broken, the slot stays untouched. */
async function captureBalancedState(): Promise<void> {
  try {
    if (await systemBalanced()) await db.saveSnapshot();
  } catch {
    // Broken or unimplemented domain code must not fail the operation
    // that triggered the capture; the previous snapshot stays.
  }
}

// Every mutation runs through the capture, so the snapshot is never more
// than one operation behind the last balanced state. Queries pass free.
const procedure = t.procedure.use(async ({ type, next }) => {
  const result = await next();
  if (type === 'mutation' && result.ok) await captureBalancedState();
  return result;
});

// Watch mode restarts the server on save; capturing on boot also covers
// balanced states reached outside the API (tests, the playground).
await captureBalancedState();

export const appRouter = t.router({
  /** The country identity — set in the guide, read from course.json —
   *  plus the current rates and the implemented-task map. */
  config: procedure.query(async () => {
    const course = readCourseConfig(REPO_ROOT);
    const [policyRate, reserveRatio, tasks] = await Promise.all([
      runEffect(centralBank.policyRate()),
      runEffect(centralBank.reserveRatio()),
      scanTaskStatus(REPO_ROOT),
    ]);
    return {
      country: course.country,
      currency: CURRENCY.code,
      decimals: CURRENCY.decimals,
      // Rates as plain ratio strings ('0.10' = 10%) — live state from
      // the central bank's books; each bank's own lending rate travels
      // with its books, not here.
      policyRate: policyRate.toString(),
      reserveRatio: reserveRatio.toString(),
      /** Task id → implemented; the workbench reveals UI per task. */
      tasks,
    };
  }),

  banks: t.router({
    list: procedure.query(async () => {
      const banks = await db.banks.list();
      /** Each bank with its BIC — how payment messages name it. */
      return banks.map(bank => ({ ...bank, bic: bicFor(bank.id) }));
    }),
    open: procedure
      .input(z.object({ name: z.string() }))
      .mutation(({ input }) => runEffect(centralBank.registerBank(input))),
    /** A bank's full balance sheet: its own books plus its slice of the
     *  central bank's (reserves held there, debt owed there). */
    balanceSheet: procedure
      .input(z.object({ bankId: z.number().int() }))
      .query(async ({ input }) => {
        const [bankBooks, central] = await Promise.all([
          runEffect(commercialBanks.balanceSheet(input)),
          runEffect(centralBank.balanceSheet()),
        ]);
        const zero = new Big(0);
        const reserves =
          central.reserveAccounts.find(
            account => account.owner === bankBooks.bank.name
          )?.balance ?? zero;
        const owedToCentralBank =
          central.claims.find(claim => claim.borrower === bankBooks.bank.name)
            ?.amount ?? zero;
        return {
          bank: bankBooks.bank,
          accounts: bankBooks.accounts.map(account => ({
            id: account.id,
            owner: account.owner,
            personId: account.personId,
            iban: ibanFor(input.bankId, account.number),
            balance: money(account.balance),
          })),
          /** The bank's own account — its equity, spendable like any
           *  account and addressable by IBAN like any account. */
          ownAccount: {
            id: bankBooks.ownAccount.id,
            iban: ibanFor(input.bankId, bankBooks.ownAccount.number),
            balance: money(bankBooks.equity),
          },
          loans: bankBooks.loans.map(loan => ({
            id: loan.id,
            borrower: loan.borrower,
            amount: money(loan.amount),
          })),
          totalDeposits: money(bankBooks.totalDeposits),
          totalLoans: money(bankBooks.totalLoans),
          /** This bank's lending rate, a ratio string ('0.10' = 10%). */
          interestRate: bankBooks.interestRate.toString(),
          reserves: money(reserves),
          owedToCentralBank: money(owedToCentralBank),
          totalAssets: money(reserves.plus(bankBooks.totalLoans)),
          // Equity sits on the right side of the balance sheet: assets
          // must equal liabilities plus equity.
          totalLiabilitiesAndEquity: money(
            bankBooks.totalDeposits
              .plus(owedToCentralBank)
              .plus(bankBooks.equity)
          ),
        };
      }),
    lendToClient: procedure
      .input(
        z.object({
          bankId: z.number().int(),
          accountId: z.number().int(),
          amount: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const debt = await runEffect(
          parseAmount(input.amount).pipe(
            Effect.flatMap(amount =>
              commercialBanks.lendToClient({ ...input, amount })
            )
          )
        );
        return { totalDebt: money(debt) };
      }),
    /** Debug: hand-delivers a raw payment message to a bank, skipping
     *  acceptance and settlement — the workbench's lever for the
     *  receiving half alone. Money appears with nothing settled behind
     *  it, and the bank's sheet stops balancing on purpose. */
    receivePayment: procedure
      .input(
        z.object({
          fromBic: z.string(),
          fromIban: z.string(),
          toBic: z.string(),
          toIban: z.string(),
          amount: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const credited = await runEffect(
          parseAmount(input.amount).pipe(
            Effect.flatMap(amount =>
              commercialBanks.receivePayment({ ...input, amount })
            )
          )
        );
        return { recipient: credited.owner, balance: money(credited.balance) };
      }),
    /** The bank prices its own loans — in percent. New loans only. */
    setInterestRate: procedure
      .input(z.object({ bankId: z.number().int(), percent: z.string() }))
      .mutation(async ({ input }) => {
        const rate = await runEffect(commercialBanks.setInterestRate(input));
        return { interestRate: rate.toString() };
      }),
    /** A default made official: the claim dies, the bank's equity takes
     *  the loss, the borrower's deposits survive. */
    writeOffLoan: procedure
      .input(z.object({ bankId: z.number().int(), personId: z.string() }))
      .mutation(async ({ input }) => {
        const amount = await runEffect(commercialBanks.writeOffLoan(input));
        return { writtenOff: money(amount) };
      }),
    /** The bank spends from its own account (salaries, dividends) — how
     *  its interest income returns to circulation. */
    pay: procedure
      .input(
        z.object({
          bankId: z.number().int(),
          toIban: z.string(),
          amount: z.string(),
        })
      )
      .mutation(({ input }) =>
        runEffect(
          parseAmount(input.amount).pipe(
            Effect.flatMap(amount =>
              commercialBanks.payFromBankAccount({ ...input, amount })
            )
          )
        )
      ),
    repayCentralBank: procedure
      .input(z.object({ bankId: z.number().int(), amount: z.string() }))
      .mutation(async ({ input }) => {
        const remaining = await runEffect(
          parseAmount(input.amount).pipe(
            Effect.flatMap(amount =>
              centralBank.receiveRepayment({ ...input, amount })
            )
          )
        );
        return { remainingDebt: money(remaining) };
      }),
  }),

  user: t.router({
    /** Every account in the country with its balance and debt — the
     *  person view groups these by owner. */
    list: procedure.query(async () => {
      const clients = await runEffect(commercialBanks.listClients());
      return clients.map(client => ({
        bankId: client.bankId,
        bankName: client.bankName,
        accountId: client.accountId,
        personId: client.personId,
        owner: client.owner,
        iban: ibanFor(client.bankId, client.number),
        balance: money(client.balance),
        debt: money(client.debt),
      }));
    }),
    /** The personal id is the person; the name is a freely colliding
     *  label. Renaming relabels every account the person holds. */
    rename: procedure
      .input(z.object({ personId: z.string(), newName: z.string() }))
      .mutation(async ({ input }) => {
        const renamedAccounts = await runEffect(
          commercialBanks.renamePerson(input)
        );
        return { renamedAccounts };
      }),
    /** A new person: registered under a personal id — the person's
     *  number across all banks, not this bank's — with a first account. */
    becomeClient: procedure
      .input(z.object({ bankId: z.number().int(), name: z.string() }))
      .mutation(async ({ input }) => {
        const account = await runEffect(commercialBanks.becomeClient(input));
        return {
          id: account.id,
          owner: account.owner,
          personId: account.personId,
        };
      }),
    /** An existing person opens another account. */
    openAccount: procedure
      .input(z.object({ bankId: z.number().int(), personId: z.string() }))
      .mutation(async ({ input }) => {
        const account = await runEffect(commercialBanks.openAccount(input));
        return {
          id: account.id,
          owner: account.owner,
          personId: account.personId,
        };
      }),
    sendMoney: procedure
      .input(
        z.object({
          /** The sender — a payment order is honored only from the
           *  account's holder. */
          personId: z.string(),
          fromBankId: z.number().int(),
          fromAccountId: z.number().int(),
          toIban: z.string(),
          amount: z.string(),
        })
      )
      .mutation(({ input }) =>
        runEffect(
          parseAmount(input.amount).pipe(
            Effect.flatMap(amount =>
              commercialBanks.sendMoney({ ...input, amount })
            )
          )
        )
      ),
    repayLoan: procedure
      .input(
        z.object({
          bankId: z.number().int(),
          accountId: z.number().int(),
          amount: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const remaining = await runEffect(
          parseAmount(input.amount).pipe(
            Effect.flatMap(amount =>
              commercialBanks.repayLoan({ ...input, amount })
            )
          )
        );
        return { remainingDebt: money(remaining) };
      }),
  }),

  centralBank: t.router({
    balanceSheet: procedure.query(async () => {
      const books = await runEffect(centralBank.balanceSheet());
      return {
        reserveAccounts: books.reserveAccounts.map(account => ({
          id: account.id,
          owner: account.owner,
          balance: money(account.balance),
        })),
        claims: books.claims.map(claim => ({
          id: claim.id,
          borrower: claim.borrower,
          amount: money(claim.amount),
        })),
        totalReserves: money(books.totalReserves),
        totalClaims: money(books.totalClaims),
        equity: money(books.equity),
        // Equity sits on the right side of the balance sheet: claims
        // (assets) must equal banks' reserves plus the equity.
        totalLiabilitiesAndEquity: money(
          books.totalReserves.plus(books.equity)
        ),
      };
    }),
    lend: procedure
      .input(z.object({ bankId: z.number().int(), amount: z.string() }))
      .mutation(async ({ input }) => {
        const debt = await runEffect(
          parseAmount(input.amount).pipe(
            Effect.flatMap(amount =>
              centralBank.lendToBank({ ...input, amount })
            )
          )
        );
        return { totalDebt: money(debt) };
      }),
    /** The central banker moves the rate — in percent, as announced on
     *  the news. Only new loans carry it. */
    setPolicyRate: procedure
      .input(z.object({ percent: z.string() }))
      .mutation(async ({ input }) => {
        const rate = await runEffect(centralBank.setPolicyRate(input));
        return { policyRate: rate.toString() };
      }),
    /** The central banker moves the reserve requirement — the dial on
     *  how much banks can lend per unit of reserves. */
    setReserveRatio: procedure
      .input(z.object({ percent: z.string() }))
      .mutation(async ({ input }) => {
        const ratio = await runEffect(centralBank.setReserveRatio(input));
        return { reserveRatio: ratio.toString() };
      }),
    /** A bank's default made official: the claim dies, the central
     *  bank's equity takes the loss (possibly below zero — survivable
     *  only here), and the forgiven debt is the bank's gain. */
    writeOffClaim: procedure
      .input(z.object({ bankId: z.number().int() }))
      .mutation(async ({ input }) => {
        const amount = await runEffect(centralBank.writeOffClaim(input));
        return { writtenOff: money(amount) };
      }),
    /** The central bank spends its interest income into a bank —
     *  crediting the bank's reserves and its equity. */
    payBank: procedure
      .input(z.object({ bankId: z.number().int(), amount: z.string() }))
      .mutation(({ input }) =>
        runEffect(
          parseAmount(input.amount).pipe(
            Effect.flatMap(amount =>
              centralBank.payToBank({ ...input, amount })
            )
          )
        )
      ),
    transferReserves: procedure
      .input(
        z.object({
          fromBankId: z.number().int(),
          toBankId: z.number().int(),
          amount: z.string(),
        })
      )
      .mutation(({ input }) =>
        runEffect(
          parseAmount(input.amount).pipe(
            Effect.flatMap(amount =>
              centralBank.transferReserves({ ...input, amount })
            )
          )
        )
      ),
  }),

  debug: t.router({
    /** Every institution's books, verbatim — amounts in minor units. */
    dump: procedure.query(() => db.dump()),
    /** Deletes all financial system data. Tests use a separate database. */
    reset: procedure.mutation(() => db.reset()),
    /** Restores the last state in which every balance sheet balanced —
     *  the undo for debug actions that break the books on purpose. */
    revertToBalanced: procedure.mutation(async () => {
      const restored = await db.restoreSnapshot();
      if (!restored) {
        throw new Error('No balanced state has been remembered yet.');
      }
    }),
    /** The Db's public methods, parsed live from source (never drifts). */
    dbApi: procedure.query(() => dbApiReference()),
  }),
});

export type AppRouter = typeof appRouter;
