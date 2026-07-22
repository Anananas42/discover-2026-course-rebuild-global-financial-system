// The price of a client loan: banks lend at interest — the borrower
// receives the amount but owes amount plus interest, and the interest is
// the bank's income, credited to the bank's own account the moment the
// loan is made. The rate is each bank's own decision, stored in that
// bank's books and set from its screen; a bank prices above the central
// bank's policy rate, and the spread is its business.
//
// Simplified on purpose: one flat markup per bank for every loan,
// recognized in full at origination. Real banks quote yearly rates,
// accrue the income over the life of the loan, and price each loan by
// its risk.

import Big from 'big.js';

/** The lending rate a freshly opened bank starts with: 10%. */
export const DEFAULT_INTEREST_RATE = new Big('0.10');

/** The key the rate is stored under in each bank's settings. */
export const INTEREST_RATE_KEY = 'interest-rate';
