// The reserve requirement: the central bank's rule for how much of a
// bank's client deposits must be backed by reserves held here. A bank may
// only create a new deposit by lending if, afterwards, its reserves are
// at least the required share of its client deposits — the brake on
// infinite lending, and the reason a bank borrows reserves from the
// central bank before it can lend to anyone. It is the central bank's
// dial: stored in its own database, set from its screen, checked whenever a
// bank lends.
//
// Simplified on purpose: the real Czech requirement is 2% and does not
// bite (banks hold far more, and the binding real-world brake is capital
// adequacy); the United States has run a 0% requirement since 2020. The
// default here is 10% so the rule is felt in the classroom.

import Big from 'big.js';

/** The requirement a freshly reset world starts with: 10%. */
export const DEFAULT_RESERVE_RATIO = new Big('0.10');

/** The key the ratio is stored under in the central bank's settings. */
export const RESERVE_RATIO_KEY = 'reserve-ratio';
