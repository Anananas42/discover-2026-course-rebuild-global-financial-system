// The register of licensed commercial banks — a single table, living
// only in the central bank's database: only the central bank knows
// which banks exist. Registering a bank creates its row here, nothing
// more; the bank's own database is the bank's own job and comes online
// separately (see CommercialBankDb.createDatabase).

import { Repo } from './repo.ts';

export interface CommercialBank {
  id: number;
  /** The name the license was issued against — unique in the register.
   *  The id is what every other table refers to the bank by. */
  legalName: string;
}

export class CommercialBankRepo extends Repo {
  /** Registers the bank: one new row in the register. */
  async create({ legalName }: { legalName: string }): Promise<CommercialBank> {
    return this.scoped()
      .insertInto('commercial_banks')
      .values({ legalName })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async get({ id }: { id: number }): Promise<CommercialBank | undefined> {
    return this.scoped()
      .selectFrom('commercial_banks')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
  }

  /** The bank licensed under this legal name, if the register holds
   *  one — the uniqueness check a new license must pass. */
  async getByLegalName({
    legalName,
  }: {
    legalName: string;
  }): Promise<CommercialBank | undefined> {
    return this.scoped()
      .selectFrom('commercial_banks')
      .selectAll()
      .where('legalName', '=', legalName)
      .executeTakeFirst();
  }

  async list(): Promise<CommercialBank[]> {
    return this.scoped()
      .selectFrom('commercial_banks')
      .selectAll()
      .orderBy('id')
      .execute();
  }
}
