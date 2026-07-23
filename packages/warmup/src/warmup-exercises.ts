/* oxlint-disable no-unused-vars -- imports here may be used only by the task bodies you will write. */
import { NotImplementedError } from '../../central-bank/src/bank-errors.ts';
// The mission briefing: seven tiny exercises, one concept each, before
// any banking.
// Each one is a single instance of a pattern that every later task uses:
// making a test pass, computing with Big, handing back another program's
// answer, the bare Effect frame, waiting for a Promise, saying no with
// Effect.fail, and grouping writes in a transaction. Nothing here
// touches the real database or the financial system — the point is the
// loop and the grammar, not the domain.

import Big from 'big.js';
import { Effect } from 'effect';

import { NegativeAmountError } from './warmup-errors.ts';

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
 * The database is a separate program, and prebuilt repositories read it
 * for your code. This one is a stand-in: ask it for the central bank's
 * own account balance and hand back exactly what it gives you. Its
 * answer is a Promise — a later task explains what that means.
 */
export function readBalance(centralBankRepo: {
  ownAccountBalance(): Promise<Big>;
}): Promise<Big> {
  // TASK 0.3: Read a balance
  // TODO: implement task 0.3.
  throw new NotImplementedError('0.3');
  // ENDTASK 0.3
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
    // TASK 0.4: Relay the status
    // TODO: implement task 0.4.
    throw new NotImplementedError('0.4');
    // ENDTASK 0.4
  });
}

/**
 * The instructions arrive later — this time, wait for them inside the
 * Effect frame and return the instructions themselves.
 */
export function readInstructions(headquarters: {
  instructions(): Promise<string>;
}): Effect.Effect<string> {
  return Effect.gen(function* () {
    // TASK 0.5: Wait for the instructions
    // TODO: implement task 0.5.
    throw new NotImplementedError('0.5');
    // ENDTASK 0.5
  });
}

/**
 * Checks a proposed amount: a negative one is refused with
 * NegativeAmountError, anything else comes back unchanged. The signature
 * already promises both outcomes.
 */
export function requireNonNegativeAmount(
  amount: Big
): Effect.Effect<Big, NegativeAmountError> {
  return Effect.gen(function* () {
    // TASK 0.6: Refuse a negative amount
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
 * Prebuilt, not a task: the shape of the real database's `transaction`
 * method, played here by a stand-in. Every write made through `tx` lands
 * together — if anything inside throws, none of them do.
 */
export interface StandInDb {
  transaction<T>(
    fn: (tx: {
      setBalance(input: { account: string; balance: Big }): Promise<void>;
    }) => Promise<T>
  ): Promise<T>;
}

/**
 * Moves an amount between two accounts — two balance writes that must
 * never land alone: the sender's balance minus the amount, the
 * receiver's plus it. Wrap both in one `db.transaction(...)` call: if
 * the power dies between them, both balances must read as if the move
 * never started.
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
