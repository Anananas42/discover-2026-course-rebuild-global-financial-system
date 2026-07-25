// Test harness for atomicity: it wraps the institutions' database
// handles so that one chosen repo write throws mid-operation, simulating
// a crash at exactly that point. An atomicity scenario runs an operation
// against the crashing handles, once per possible crash point, and
// asserts the raw tables afterwards look exactly as the invariant
// demands: within one institution, only an implementation that commits
// its writes in one transaction survives every crash point; across
// institutions, the stranded half must be the explainable one.
//
// This ships with the student repo, because a task whose correctness
// depends on committing in one transaction must be able to say so in a
// scenario the student can run.

import type { CentralBankDb, CentralBankTx } from './central-bank-db.ts';
import type {
  CommercialBankDb,
  CommercialBankTx,
} from './commercial-bank-db.ts';
import type { FinancialSystemDb } from './financial-system-db.ts';

/** A write to crash on: the `call`th invocation of `repo.method`,
 *  counted across every institution's handle, direct calls and
 *  `transaction` blocks alike. */
export interface CrashPoint {
  repo: keyof CentralBankTx;
  method: string;
  /** 1-based: crash on this invocation of the method. */
  call: number;
}

/** One crash point per invocation, for `count` invocations of
 *  `repo.method` — probing every position a write could crash at. */
export function crashPoints(
  repo: keyof CentralBankTx,
  method: string,
  count: number
): CrashPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    repo,
    method,
    call: i + 1,
  }));
}

export interface CrashingSystem {
  /** The central bank's handle, sabotaged. */
  centralBankDb: CentralBankDb;
  /** A bank's handle, sabotaged — same shared call counter. */
  commercialBankDb: (bankId: number) => CommercialBankDb;
  /** Whether the crash was actually hit, so a scenario can skip its
   *  assertions when an implementation makes fewer writes than probed. */
  fired: () => boolean;
}

/**
 * Sabotaged institution handles over one shared counter: the
 * `point.repo`'s `point.method` throws on its `point.call`th invocation
 * anywhere in the system — reached directly or through a `transaction`.
 */
export function crashingSystem(
  system: FinancialSystemDb,
  point: CrashPoint
): CrashingSystem {
  let calls = 0;
  let fired = false;

  // The two handles' repos are deliberately different shapes (the
  // central bank's accounts repo has no person-flavored methods), so a
  // point applies wherever its method exists — but a method no repo in
  // the system has is a test typo, and fails loudly instead of silently
  // never firing.
  const shapes: Record<string, object | undefined>[] = [
    system.centralBank as unknown as Record<string, object>,
    system.commercialBank(0) as unknown as Record<string, object>,
  ];
  const anywhere = shapes.some(handle => {
    const repo = handle[point.repo] as Record<string, unknown> | undefined;
    return typeof repo?.[point.method] === 'function';
  });
  if (!anywhere) {
    throw new Error(`No method ${point.method} on any ${point.repo} repo.`);
  }

  // Shadows only the targeted method; everything else — other methods,
  // the connection fields — resolves through the prototype chain to the
  // real repo. A repo without the method is left untouched: the point
  // simply does not apply to that institution's side.
  const crashing = <R extends object>(repo: R): R => {
    const real = repo as Record<string, unknown>;
    const original = real[point.method];
    if (typeof original !== 'function') return repo;
    const wrapped = Object.create(repo) as Record<string, unknown>;
    wrapped[point.method] = (...args: unknown[]) => {
      calls += 1;
      if (calls === point.call) {
        fired = true;
        throw new Error(
          `Simulated crash: ${point.repo}.${point.method}, call ${String(calls)}.`
        );
      }
      return (original as (...rest: unknown[]) => unknown).apply(repo, args);
    };
    return wrapped as R;
  };

  const maybe = <R extends object>(repo: R, name: keyof CentralBankTx): R =>
    point.repo === name ? crashing(repo) : repo;

  const withCrashCentral = (tx: CentralBankTx): CentralBankTx => ({
    commercialBanks: maybe(tx.commercialBanks, 'commercialBanks'),
    accounts: maybe(tx.accounts, 'accounts'),
    claims: maybe(tx.claims, 'claims'),
    payments: maybe(tx.payments, 'payments'),
    settings: maybe(tx.settings, 'settings'),
  });

  const withCrashBank = (tx: CommercialBankTx): CommercialBankTx => ({
    accounts: maybe(tx.accounts, 'accounts'),
    claims: maybe(tx.claims, 'claims'),
    payments: maybe(tx.payments, 'payments'),
    settings: maybe(tx.settings, 'settings'),
  });

  const centralBankDb = Object.create(system.centralBank) as CentralBankDb;
  Object.assign(centralBankDb, withCrashCentral(system.centralBank), {
    transaction: <T>(fn: (tx: CentralBankTx) => Promise<T>): Promise<T> =>
      system.centralBank.transaction(tx => fn(withCrashCentral(tx))),
  });

  const commercialBankDb = (bankId: number): CommercialBankDb => {
    const real = system.commercialBank(bankId);
    const broken = Object.create(real) as CommercialBankDb;
    Object.assign(broken, withCrashBank(real), {
      transaction: <T>(fn: (tx: CommercialBankTx) => Promise<T>): Promise<T> =>
        real.transaction(tx => fn(withCrashBank(tx))),
    });
    return broken;
  };

  return { centralBankDb, commercialBankDb, fired: () => fired };
}
