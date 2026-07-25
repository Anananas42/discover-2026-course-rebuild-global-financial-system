/* oxlint-disable no-unused-vars -- imports here may be used only by the task bodies you will write. */
import { NotImplementedError } from '../../central-bank/src/bank-errors.ts';
// The mission briefing: eight tiny exercises before any banking, in four
// blocks that each finish a subject before the next one starts.
//
// - The loop and the values (0.1, 0.2): make a test pass, compute with Big.
// - Effect, on its own (0.3, 0.4): the frame, and refusing with a named
//   error. Nothing here waits for anything, so the grammar is the only
//   new thing.
// - The database (0.5, 0.6, 0.7): a repository and the Promise it hands
//   back, waiting for one inside the frame, and grouping writes in a
//   transaction. One stand-in repository runs through the first two.
// - Everything at once (0.8): read, check, write — the shape every real
//   task has, and the first time the pieces meet in one method.
//
// Nothing here touches the real database or the financial system — the
// point is the loop and the grammar, not the domain.

import Big from 'big.js';
import { Effect } from 'effect';

import { AccountExistsError, NegativeAmountError } from './warmup-errors.ts';

/**
 * Your first task exists to run the loop once: read the test, write the
 * line, watch the test pass. So this one time, the solution is right
 * here — the body should be exactly:
 *
 *   return 'ready';
 */
export function statusReport(): string {
  // TASK 0.1: Send the status report
  // TODO: implement task 0.1.
  throw new NotImplementedError('0.1');
  // ENDTASK 0.1
}

/**
 * What a borrower owes: the amount plus the interest. Both are money, so
 * both are Big values — Big computes with methods, never with `+`.
 */
export function totalOwed(amount: Big, interest: Big): Big {
  // TASK 0.2: Add two amounts
  // TODO: implement task 0.2.
  throw new NotImplementedError('0.2');
  // ENDTASK 0.2
}

/**
 * Prebuilt, not a task: headquarters' status, already wrapped as an
 * Effect — something for your first frame to call.
 */
export function headquartersStatus(): Effect.Effect<string> {
  return Effect.succeed('All stations report ready.');
}

/**
 * Relay headquarters' status: your first method built on the Effect
 * frame. Inside the frame, call headquartersStatus() with yield* and
 * return its answer.
 */
export function relayStatus(): Effect.Effect<string> {
  return Effect.gen(function* () {
    // TASK 0.3: Relay the status
    // TODO: implement task 0.3.
    throw new NotImplementedError('0.3');
    // ENDTASK 0.3
  });
}

/**
 * Checks a proposed amount: a negative one is refused with
 * NegativeAmountError, anything else comes back unchanged. The signature
 * already promises both outcomes — and every task ahead works the same
 * way: the errors a method's signature lists are exactly the errors your
 * code must produce.
 */
export function requireNonNegativeAmount(
  amount: Big
): Effect.Effect<Big, NegativeAmountError> {
  return Effect.gen(function* () {
    // TASK 0.4: Refuse a negative amount
    // TODO: implement task 0.4.
    throw new NotImplementedError('0.4');
    // ENDTASK 0.4
  });
}

/**
 * Prebuilt, not a task: a repository, the way every task ahead reads and
 * writes. Every answer arrives as a Promise, because the database is a
 * separate program and its reply travels back over a wire.
 */
export interface StandInRepo {
  ownAccountBalance(): Promise<Big>;
  licensedBankCount(): Promise<number>;
}

/**
 * Ask the repository for the central bank's own account balance and hand
 * back exactly what it gives you — which is the Promise itself, not the
 * balance inside it. Waiting for one is the next task.
 */
export function readBalance(repo: StandInRepo): Promise<Big> {
  // TASK 0.5: Read a balance
  // TODO: implement task 0.5.
  throw new NotImplementedError('0.5');
  // ENDTASK 0.5
}

/**
 * How many banks the register holds — this time the number itself, not a
 * Promise of one. The repository still answers later; inside the Effect
 * frame, `Effect.promise` is how you wait for that answer and carry on
 * with the value.
 */
export function countLicensedBanks(repo: StandInRepo): Effect.Effect<number> {
  return Effect.gen(function* () {
    // TASK 0.6: Wait for the register's count
    // TODO: implement task 0.6.
    throw new NotImplementedError('0.6');
    // ENDTASK 0.6
  });
}

/** An account as the stand-in db knows it: a name and what it holds. */
export interface StandInAccount {
  name: string;
  balance: Big;
}

/**
 * Prebuilt, not a task: the shape of the real database, played here by a
 * stand-in. Balances can be written two ways, and the difference is the
 * whole point of the next task:
 *
 * - `db.setBalance(...)` writes on its own. It lands the moment it is
 *   made, and nothing can take it back.
 * - `db.transaction(...)` hands your block a `tx` with the same method
 *   on it. Every write made through that `tx` lands together — and if
 *   anything inside the block throws, none of them land at all.
 *
 * Both are reachable from inside a transaction block, and only one of
 * them is part of it: a write made on `db` in there is still a write on
 * its own, and the transaction cannot roll it back.
 */
export interface StandInDb {
  setBalance(input: { account: string; balance: Big }): Promise<void>;
  transaction<T>(
    fn: (tx: {
      setBalance(input: { account: string; balance: Big }): Promise<void>;
    }) => Promise<T>
  ): Promise<T>;
}

/**
 * Moves an amount between two accounts — two balance writes that must
 * never land alone: the sender's balance minus the amount, the
 * receiver's plus it. Open one `db.transaction(...)` and make both
 * writes through the `tx` it hands you: if the power dies between them,
 * both balances must read as if the move never started.
 */
export function recordTransfer(
  db: StandInDb,
  input: { from: StandInAccount; to: StandInAccount; amount: Big }
): Effect.Effect<void> {
  const { from, to, amount } = input;
  return Effect.gen(function* () {
    // TASK 0.7: Move money in one transaction
    // TODO: implement task 0.7.
    throw new NotImplementedError('0.7');
    // ENDTASK 0.7
  });
}

/**
 * Prebuilt, not a task: the stand-in register of accounts — the same
 * stand-in idea again, one step closer to a real repository. Both of its
 * answers arrive as Promises, as every real one's do.
 */
export interface StandInRegister {
  isNameTaken(input: { name: string }): Promise<boolean>;
  open(input: { name: string }): Promise<StandInAccount>;
}

/**
 * Open an account in the register, unless the name is already taken:
 * ask the register, refuse a taken name with AccountExistsError, and
 * otherwise open the account and return what the register hands back.
 *
 * Read, then check, then write — the shape of nearly every task ahead,
 * and the reason this exercise exists. The three pieces are ones you
 * have already written on their own: refusing with a named error (0.4)
 * and waiting for a Promise (0.6). Here they meet, and the order is the
 * whole exercise: each Promise is waited for on its own line, and the
 * check sits between the two, in this method rather than inside either
 * call. The explainer on the task card shows what goes wrong when it is
 * written the other way round.
 */
export function recordNewAccount(
  register: StandInRegister,
  input: { name: string }
): Effect.Effect<StandInAccount, AccountExistsError> {
  const { name } = input;
  return Effect.gen(function* () {
    // TASK 0.8: Open an account unless the name is taken
    // TODO: implement task 0.8.
    throw new NotImplementedError('0.8');
    // ENDTASK 0.8
  });
}
