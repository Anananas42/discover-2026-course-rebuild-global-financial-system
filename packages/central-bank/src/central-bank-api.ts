// What the central bank exposes to the licensed banks — the calls a
// commercial bank may make, and the only way a bank ever touches
// central-bank data: it asks. The reverse direction is bank-notice.ts
// (the central bank telling a bank something changed); between the two
// sits every word institutions exchange, because nobody can reach into
// another institution's database. Implemented by CentralBank; the
// commercial layer holds this interface, not the whole class, so a bank
// can no more call lendToBank than it could in reality.

import type Big from 'big.js';
import type { Effect } from 'effect';

import type { CommercialBank } from '@banks/db/repos/commercial-bank-repo.ts';

import type {
  InsufficientReservesError,
  InvalidAmountError,
  SameBankError,
  UnknownBankError,
} from './bank-errors.ts';

export interface CentralBankApi {
  /** The register of licensed banks — public information: this is how
   *  the rest of the system knows which banks exist. */
  listBanks(): Effect.Effect<CommercialBank[]>;

  /** One licensed bank from the register, or the refusal every
   *  bank-taking operation shares. */
  findBank(input: {
    bankId: number;
  }): Effect.Effect<CommercialBank, UnknownBankError>;

  /** A bank's reserve balance — asked for, never read: the reserves
   *  live in the central bank's database, and nobody sees that but the
   *  central bank. The reserve requirement and settlement cover are
   *  both checked through this. */
  reserveBalance(input: {
    bankId: number;
  }): Effect.Effect<Big, UnknownBankError>;

  /** The reserve requirement, as the stored ratio (0.10 = 10%) — the
   *  central bank's dial on how much banks can lend. */
  reserveRatio(): Effect.Effect<Big>;

  /** Settlement: reserves move from one bank's account to the other's,
   *  in a transaction of the central bank's own — the step behind every
   *  payment that crosses a bank boundary. */
  transferReserves(input: {
    fromBankId: number;
    toBankId: number;
    amount: Big;
  }): Effect.Effect<
    void,
    | UnknownBankError
    | SameBankError
    | InvalidAmountError
    | InsufficientReservesError
  >;
}
