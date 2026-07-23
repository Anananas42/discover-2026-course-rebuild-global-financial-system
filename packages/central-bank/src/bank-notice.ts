// A notice from the central bank to one commercial bank: something the
// central bank did has changed how much money the bank itself has —
// interest charged on a loan, a payment made to the bank, a debt
// forgiven. The central bank cannot write the bank's database, any more
// than it can in the real world; it sends the bank a notice, and the
// bank records its own side of the event in its own database (task 2.1).
// Real systems ship these as credit and debit advices over the
// settlement network the central bank operates; here the network is an
// in-process call, wired when the commercial layer starts and registers
// itself (CentralBank.connectCommercialBanks).

import type Big from 'big.js';
import type { Effect } from 'effect';

export interface CentralBankNotice {
  /** Which bank the notice is addressed to. */
  bankId: number;
  /** Why the money moved — for the story and the log; the sign of the
   *  amount already decides the direction. */
  kind: 'interest-charged' | 'payment' | 'debt-forgiven';
  /** Signed, from the bank's perspective: positive grows the bank's own
   *  account, negative shrinks it. A charge is sent negative — and a
   *  negative policy rate flips it into the bank's favor by itself. */
  amount: Big;
}

/** The licensed banks' side of the system, as the central bank sees it.
 *  Implemented by the commercial layer (CommercialBanks), which wires
 *  itself in via CentralBank.connectCommercialBanks — the central bank
 *  never holds a bank's database, only this channel. */
export interface LicensedBanks {
  /** Deliver a notice: the bank records the change on its own account,
   *  in its own database (task 2.1). */
  recordOwnAccountChangeFromCentralBank(
    notice: CentralBankNotice
  ): Effect.Effect<void>;
  /** A fresh license lands at the bank: its own systems come online —
   *  its database, with its own account in it. Prebuilt plumbing. */
  connectBank(input: { bankId: number; name: string }): Effect.Effect<void>;
}
