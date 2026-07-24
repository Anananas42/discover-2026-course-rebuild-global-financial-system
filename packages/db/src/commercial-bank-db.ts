// One commercial bank's own database: the four tables every institution
// keeps — accounts, claims, payments, settings — bound to that bank's
// schema. A task acting as a commercial bank holds exactly this handle
// and nothing else: the central bank's data, and every other bank's, is
// out of reach by construction — to affect it, you send a message or
// call an API, the way real banks do.

import type { Kysely } from 'kysely';

import type { Database } from './database-schema.ts';
import { bankSchemaName, ensureBankDatabase } from './database-schema.ts';
import { AccountRepo } from './repos/account-repo.ts';
import { ClaimRepo } from './repos/claim-repo.ts';
import { PaymentRepo } from './repos/payment-repo.ts';
import { SettingRepo } from './repos/setting-repo.ts';

/** One bank's repositories, one per table. The handle carries one set
 *  for everyday calls; `transaction` hands out a second set bound to
 *  one open transaction. */
export interface CommercialBankTx {
  accounts: AccountRepo;
  claims: ClaimRepo;
  payments: PaymentRepo;
  settings: SettingRepo;
}

function repos(
  dbConnection: Kysely<Database>,
  schema: string
): CommercialBankTx {
  return {
    accounts: new AccountRepo(dbConnection, schema),
    claims: new ClaimRepo(dbConnection, schema),
    payments: new PaymentRepo(dbConnection, schema),
    settings: new SettingRepo(dbConnection, schema),
  };
}

export class CommercialBankDb implements CommercialBankTx {
  readonly bankId: number;
  readonly accounts: AccountRepo;
  readonly claims: ClaimRepo;
  readonly payments: PaymentRepo;
  readonly settings: SettingRepo;
  private readonly dbConnection: Kysely<Database>;

  constructor(dbConnection: Kysely<Database>, bankId: number) {
    this.dbConnection = dbConnection;
    this.bankId = bankId;
    const bound = repos(dbConnection, bankSchemaName(bankId));
    this.accounts = bound.accounts;
    this.claims = bound.claims;
    this.payments = bound.payments;
    this.settings = bound.settings;
  }

  /**
   * Runs `fn` with the repos bound to one database transaction: every
   * write made through `tx` lands together — if anything inside throws,
   * none of them do. A single write is already atomic on its own; a step
   * with more than one write belongs in here.
   */
  async transaction<T>(fn: (tx: CommercialBankTx) => Promise<T>): Promise<T> {
    return this.dbConnection
      .transaction()
      .execute(trx => fn(repos(trx, bankSchemaName(this.bankId))));
  }

  /**
   * Brings the bank's own database online (creates it if it does not
   * exist yet) — the bank's own systems starting up when its license
   * lands. Prebuilt plumbing, idempotent; task code never calls it.
   */
  async createDatabase(): Promise<void> {
    await ensureBankDatabase(this.dbConnection, this.bankId);
  }
}
