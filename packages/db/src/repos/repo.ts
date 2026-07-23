// The base every repository builds on. A repo is constructed for ONE
// institution's database (its Postgres schema) and can never reach
// another's — whose data a repo touches is decided here, once, at
// construction, never chosen per call. It also owns the one rule about
// money: repos are the single place where units convert — the domain
// speaks major currency units (Big values), the database stores whole
// minor units (10^decimals per major unit, from the configured currency
// — see currency-config.ts), and money never passes through JS floats.
//
// Each repo is deliberately dumb: reading and writing rows is its job;
// every check and invariant is the responsibility of the code calling
// it. Every repo method takes one input object, so a call site names
// every field it passes — nothing can be swapped silently.

import Big from 'big.js';
import type { Kysely } from 'kysely';

import { currencyDecimals } from '../currency-config.ts';
import type { Database } from '../database-schema.ts';

/** Shared by every repo: the connection, the one institution's schema
 *  the repo is bound to, and the one place minor↔major units convert. */
export abstract class Repo {
  protected readonly dbConnection: Kysely<Database>;
  /** The Postgres schema of the institution this repo belongs to. */
  protected readonly schema: string;
  private readonly minorFactor: Big;

  constructor(dbConnection: Kysely<Database>, schema: string) {
    this.dbConnection = dbConnection;
    this.schema = schema;
    this.minorFactor = new Big(10).pow(currencyDecimals());
  }

  /** The connection scoped to the institution's own schema. */
  protected scoped(): Kysely<Database> {
    return this.dbConnection.withSchema(this.schema);
  }

  protected toMinor(amount: Big): string {
    return amount.times(this.minorFactor).toFixed(0);
  }

  protected toMajor(minor: string): Big {
    return new Big(minor).div(this.minorFactor);
  }
}
