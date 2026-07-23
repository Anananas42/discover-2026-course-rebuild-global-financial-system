// The central bank's own database: the register of licensed commercial
// banks plus the four tables every institution keeps — accounts, claims,
// payments, settings — all bound to the central bank's schema. A task
// acting as the central bank holds exactly this handle and nothing else:
// other institutions' databases are out of reach by construction, the
// way they are in the real world.

import type { Kysely } from 'kysely';

import type { Database } from './database-schema.ts';
import { CENTRAL_BANK_SCHEMA } from './database-schema.ts';
import { CentralBankAccountRepo } from './repos/central-bank-account-repo.ts';
import { ClaimRepo } from './repos/claim-repo.ts';
import { CommercialBankRepo } from './repos/commercial-bank-repo.ts';
import { PaymentRepo } from './repos/payment-repo.ts';
import { SettingRepo } from './repos/setting-repo.ts';

/** The central bank's repositories, one per table. The handle carries
 *  one set for everyday calls; `transaction` hands out a second set
 *  bound to one open transaction. */
export interface CentralBankTx {
  /** The register of licensed banks — only the central bank has one. */
  commercialBanks: CommercialBankRepo;
  /** Reserve accounts and the central bank's own — institutions only,
   *  so this repo's API has no notion of a personal id. */
  accounts: CentralBankAccountRepo;
  claims: ClaimRepo;
  payments: PaymentRepo;
  settings: SettingRepo;
}

function repos(dbConnection: Kysely<Database>): CentralBankTx {
  return {
    commercialBanks: new CommercialBankRepo(dbConnection, CENTRAL_BANK_SCHEMA),
    accounts: new CentralBankAccountRepo(dbConnection),
    claims: new ClaimRepo(dbConnection, CENTRAL_BANK_SCHEMA),
    payments: new PaymentRepo(dbConnection, CENTRAL_BANK_SCHEMA),
    settings: new SettingRepo(dbConnection, CENTRAL_BANK_SCHEMA),
  };
}

export class CentralBankDb implements CentralBankTx {
  readonly commercialBanks: CommercialBankRepo;
  readonly accounts: CentralBankAccountRepo;
  readonly claims: ClaimRepo;
  readonly payments: PaymentRepo;
  readonly settings: SettingRepo;
  private readonly dbConnection: Kysely<Database>;

  constructor(dbConnection: Kysely<Database>) {
    this.dbConnection = dbConnection;
    const bound = repos(dbConnection);
    this.commercialBanks = bound.commercialBanks;
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
  async transaction<T>(fn: (tx: CentralBankTx) => Promise<T>): Promise<T> {
    return this.dbConnection.transaction().execute(trx => fn(repos(trx)));
  }
}
