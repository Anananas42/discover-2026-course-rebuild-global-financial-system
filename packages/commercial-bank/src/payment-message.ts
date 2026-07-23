// The standardized message an interbank payment travels as: what the
// sending bank puts on the wire, and everything the receiving bank gets
// to act on. Real systems exchange these as ISO 20022 documents over the
// payment network; here the network is a method call, but the shape is
// the lesson — the receiving bank knows nothing but what the message
// carries, and each bank writes only its own database. The recipient is
// named only by IBAN, as on the real wire: the bank code inside it is
// what routed the message, the check digits guard it against corruption,
// and a bank's internal account ids never leave the bank — which is why
// IBANs exist.

import type Big from 'big.js';
import type { Effect } from 'effect';

import type {
  InvalidAmountError,
  SameBankError,
  UnknownBankError,
} from '@banks/central-bank/bank-errors.ts';
import type { Account } from '@banks/db/repos/account-repo.ts';

import type {
  ForeignIbanError,
  InvalidIbanError,
  MismatchedMessageError,
  UnknownAccountError,
} from './commercial-bank-errors.ts';

export interface PaymentMessage {
  /** The sending bank's BIC — which institution is speaking. A BIC
   *  addresses a bank the way an IBAN addresses one account at a bank:
   *  real networks route bank-to-bank messages that carry no account at
   *  all, and route across countries that use no IBANs, so institutions
   *  need an address of their own. In this one-country system the
   *  IBAN's bank code implies it — the redundancy stops being redundant
   *  the moment a message crosses a border. */
  fromBic: string;
  /** The debited account's IBAN — the return path: a payment that must
   *  bounce (unknown account, a later dispute) goes back here. */
  fromIban: string;
  /** The receiving bank's address — what the network routes by, before
   *  any account is looked at. Here the IBAN's bank code implies it,
   *  and the receiving bank checks the two agree: a message naming one
   *  bank in the BIC and another in the IBAN is rejected as malformed,
   *  as real gateways do. */
  toBic: string;
  /** The recipient's address, exactly as the sender's client gave it. */
  toIban: string;
  amount: Big;
}

/** The receiving end of the wire, as the sending bank sees it: hand the
 *  message over, and the other bank does the rest in its own database.
 *  Implemented by the commercial layer — every bank can receive. */
export interface ReceivingBank {
  /** Act on an arrived payment message: credit the account it names, in
   *  your own database (task 4.2). A sending bank never calls this
   *  directly — it hands its message to the prebuilt deliverPayment,
   *  the wire between banks, at the end of task 4.3. */
  receivePayment(
    message: PaymentMessage
  ): Effect.Effect<
    Account,
    | InvalidIbanError
    | ForeignIbanError
    | MismatchedMessageError
    | SameBankError
    | UnknownBankError
    | UnknownAccountError
    | InvalidAmountError
  >;
}
