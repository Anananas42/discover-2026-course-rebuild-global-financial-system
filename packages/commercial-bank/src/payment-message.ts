// The standardized message an interbank payment travels as: what the
// sending bank puts on the wire, and everything the receiving bank gets
// to act on. Real systems exchange these as ISO 20022 documents over the
// payment network; here the network is a method call, but the shape is
// the lesson — the receiving bank knows nothing but what the message
// carries, and each bank writes only its own books. The recipient is
// named only by IBAN, as on the real wire: the bank code inside it is
// what routed the message, the check digits guard it against corruption,
// and a bank's internal account ids never leave the bank — which is why
// IBANs exist.

import type Big from 'big.js';

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
