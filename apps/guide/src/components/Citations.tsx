import { ChevronRight } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@banks/shared/browser/ui/collapsible.tsx';
import { TASK } from '@banks/shared/curriculum.ts';

// Citations trace the curiosities' checkable real-world claims to their
// sources. The list is reference material like the editor tips, so it
// speaks in the same appendix voice — the page's last disclosure, folded
// by default. Each claim carries a superscript [n] marker that opens the
// list and scrolls to its entry; general principles carry no marker.
// Every entry folds the source's own words behind a second disclosure,
// so a claim can be checked without leaving the page.

type CitationId =
  | 'firstWriting'
  | 'firstCoins'
  | 'intradayLiquidity'
  | 'powCamp'
  | 'rescues2008'
  | 'negativeEquity'
  | 'volckerRates'
  | 'russiaKeyRate'
  | 'ecbNegativeRates'
  | 'bojNegativeRate'
  | 'jyskeMortgage'
  | 'danishMortgageModel'
  | 'danishCdRate'
  | 'greeceCards'
  | 'herstatt'
  | 'keynes'
  | 'banknotesFromReserves'
  | 'promiseToPay'
  | 'ibanRegistry'
  | 'mod97'
  | 'svbOrder'
  | 'moneyCreation'
  | 'fedZeroReserves'
  | 'reserveRatios'
  | 'cnbReserves'
  | 'baselCapital'
  | 'promptCorrective'
  | 'ccyb'
  | 'cnbLtv'
  | 'greatContraction';

type Citation = {
  /** Who stands behind the claim — the author or the institution. */
  source: string;
  /** The work's title; carries the link. */
  title: string;
  /** Where and when it appeared, down to pages where they exist. */
  detail: string;
  url: string;
  /** Books are set in italics; articles and pages stay upright. */
  book?: boolean;
  /** The source's own words, verbatim, one entry per passage —
   *  omissions marked with an ellipsis, tables transcribed row by row. */
  quote: string[];
};

// Entry order is marker order: the record is sorted by each citation's
// first appearance on the page — the tasks' teaching order (by task id,
// not the declaration order of CURIOSITIES_BY_TASK) — so the numbers
// count up as one reads.
const CITATIONS: Record<CitationId, Citation> = {
  firstWriting: {
    source: 'Denise Schmandt-Besserat',
    title: 'The Evolution of Writing',
    detail: 'University of Texas at Austin, accessed July 2026',
    url: 'https://sites.utexas.edu/dsb/tokens/the-evolution-of-writing/',
    quote: [
      'The development from tokens to script reveals that writing emerged from counting and accounting. Writing was used exclusively for accounting until the third millennium BC…',
    ],
  },
  firstCoins: {
    source: 'American Numismatic Association',
    title: 'Lydia & the First Coins',
    detail: 'Money Museum virtual exhibit, accessed July 2026',
    url: 'https://www.money.org/money-museum/virtual-exhibits-hom-case1/',
    quote: [
      'Coins were invented sometime during the 7th century B.C. in Asia Minor. … The first coinage that can be identified with a kingdom comes from Lydia in central Asia Minor.',
    ],
  },
  intradayLiquidity: {
    source: 'Basel Committee on Banking Supervision',
    title: 'Monitoring tools for intraday liquidity management',
    detail: 'Bank for International Settlements, 2013, p. 5',
    url: 'https://www.bis.org/publ/bcbs248.pdf',
    quote: [
      'It will require banks to monitor the net balance of all payments made and received during the day over their settlement account, either with the central bank (if a direct participant) or over their account held with a correspondent bank…',
    ],
  },
  powCamp: {
    source: 'R. A. Radford',
    title: 'The Economic Organisation of a P.O.W. Camp',
    detail: 'Economica, vol. 12, no. 48, 1945, pp. 189–201',
    url: 'https://www.jstor.org/stable/2550133',
    quote: [
      'The cigarette became the standard of value.',
      'With this development everyone, including non-smokers, was willing to sell for cigarettes, using them to buy at another time and place. Cigarettes became the normal currency, though, of course, barter was never extinguished.',
    ],
  },
  rescues2008: {
    source: 'John Weinberg',
    title: 'Support for Specific Institutions',
    detail: 'Federal Reserve History, 2013',
    url: 'https://www.federalreservehistory.org/essays/support-for-specific-institutions',
    quote: [
      'Nonetheless, the Federal Reserve intervened to support some of these institutions, motivated by a desire to avert disorderly failures that could have harmed the US economy more broadly. Bear Stearns, an investment bank, was acquired by JPMorgan Chase (JPMC) in the spring of 2008 in a transaction that was assisted by the Federal Reserve Bank of New York (FRBNY). … The next day, AIG, a large insurance and financial services company received support from the FRBNY.',
    ],
  },
  negativeEquity: {
    source: 'Sarah Bell et al.',
    title: 'Why are central banks reporting losses? Does it matter?',
    detail: 'BIS Bulletin, no. 68, 2023, p. 5',
    url: 'https://www.bis.org/publ/bisbull68.pdf',
    quote: [
      'Losses and negative equity do not directly affect the ability of central banks to operate effectively.',
      'Several central banks had negative equity yet fully met their objectives – for example, the central banks of Chile, Czechia, Israel and Mexico experienced periods of negative equity…',
    ],
  },
  volckerRates: {
    source: 'Federal Reserve History',
    title: "Volcker's Announcement of Anti-Inflation Measures",
    detail: 'accessed July 2026',
    url: 'https://www.federalreservehistory.org/essays/anti-inflation-measures',
    quote: [
      'As a result of the new focus and the restrictive targets set for the money supply, the federal funds rate reached a record high of 20 percent in late 1980.',
      'Meanwhile, the new policy was also pushing the economy into a severe recession where, amid high interest rates, the jobless rate continued to rise and businesses experienced liquidity problems.',
    ],
  },
  russiaKeyRate: {
    source: 'Bank of Russia',
    title: 'Bank of Russia increases the key rate by 200 bp to 21.00% p.a.',
    detail: 'press release, 25 October 2024',
    url: 'https://www.cbr.ru/eng/press/pr/?file=25102024_133000Key_eng.htm',
    quote: [
      'On 25 October 2024, the Bank of Russia Board of Directors decided to increase the key rate by 200 basis points to 21.00% per annum.',
    ],
  },
  ecbNegativeRates: {
    source: 'European Central Bank',
    title: 'Key ECB interest rates',
    detail: 'accessed July 2026',
    url: 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html',
    quote: [
      'Deposit facility — with effect from 11 Jun. 2014: −0.10; from 18 Sep. 2019: −0.50.',
    ],
  },
  bojNegativeRate: {
    source: 'Bank of Japan',
    title:
      "Introduction of 'Quantitative and Qualitative Monetary Easing with a Negative Interest Rate'",
    detail: 'policy statement, 29 January 2016',
    url: 'https://www.boj.or.jp/en/mopo/mpmdeci/mpr_2016/k160129a.pdf',
    quote: [
      'The Bank will apply a negative interest rate of minus 0.1 percent to current accounts that financial institutions hold at the Bank.',
    ],
  },
  jyskeMortgage: {
    source: 'Patrick Collinson',
    title: "Danish bank launches world's first negative interest rate mortgage",
    detail: 'The Guardian, 13 August 2019',
    url: 'https://www.theguardian.com/money/2019/aug/13/danish-bank-launches-worlds-first-negative-interest-rate-mortgage',
    quote: [
      "A Danish bank has launched the world's first negative interest rate mortgage – handing out loans to homeowners where the charge is minus 0.5% a year.",
      "Jyske Bank, Denmark's third largest, has begun offering borrowers a 10-year deal at -0.5%…",
    ],
  },
  danishMortgageModel: {
    source: 'Jesper Berg, Morten Bækmand Nielsen and James Vickery',
    title:
      'Peas in a Pod? Comparing the U.S. and Danish Mortgage Finance Systems',
    detail:
      'Federal Reserve Bank of New York Economic Policy Review, vol. 24, no. 3, 2018',
    url: 'https://www.newyorkfed.org/medialibrary/media/research/epr/2018/epr_2018_us-danish-mortgage-finance_berg.pdf',
    quote: [
      "The homeowner's quarterly mortgage payment equals the cash flow on the bonds issued to fund her loan plus a fixed margin to the mortgage bank.",
    ],
  },
  danishCdRate: {
    source: 'Danmarks Nationalbank',
    title: 'Interest rate reduction',
    detail: 'press release, 12 September 2019',
    url: 'https://www.nationalbanken.dk/en/news-and-knowledge/press/archive/2019/interest-rate-reduction-12-09-2019',
    quote: ['Certificates of deposit: -0.75 per cent'],
  },
  greeceCards: {
    source: 'George Hondroyiannis and Dimitrios Papaoikonomou',
    title: 'The effect of card payments on VAT revenue in Greece',
    detail: 'Bank of Greece Working Paper, no. 225, 2017',
    url: 'https://www.bankofgreece.gr/Publications/Paper2017225.pdf',
    quote: [
      'The imposition of restrictions on cash withdrawals in July 2015, however, triggered a surge in the use of card payments…',
    ],
  },
  herstatt: {
    source: 'Committee on Payment and Settlement Systems',
    title: 'Settlement risk in foreign exchange transactions',
    detail: 'Bank for International Settlements, 1996, section 2.2.1',
    url: 'https://www.bis.org/cpmi/publ/d17.pdf',
    quote: [
      "Prior to the announcement of Herstatt's closure, several of its counterparties had, through their branches or correspondents, irrevocably paid Deutsche Mark to Herstatt on that day through the German payments system against anticipated receipts of US dollars later the same day in New York in respect of maturing spot and forward transactions. Upon the termination of Herstatt's business at 10.30 a.m. New York time on 26th June (3.30 p.m. in Frankfurt), Herstatt's New York correspondent bank suspended outgoing US dollar payments from Herstatt's account. This action left Herstatt's counterparty banks exposed for the full value of the Deutsche Mark deliveries made (credit risk and liquidity risk).",
    ],
  },
  keynes: {
    source: 'John Maynard Keynes',
    title: 'The Economic Consequences of the Peace',
    detail: 'Macmillan, 1919, chapters V and VII',
    url: 'https://www.gutenberg.org/files/15776/15776-h/15776-h.htm#CHAPTER_V',
    book: true,
    quote: [
      "I reach, therefore, the final conclusion that, including all methods of payment—immediately transferable wealth, ceded property, and an annual tribute—$10,000,000,000 is a safe maximum figure of Germany's capacity to pay. In all the actual circumstances, I do not believe that she can pay as much.",
      'If we aim deliberately at the impoverishment of Central Europe, vengeance, I dare predict, will not limp.',
    ],
  },
  banknotesFromReserves: {
    source: 'Michael McLeay, Amar Radia and Ryland Thomas',
    title: 'Money in the modern economy: an introduction',
    detail: 'Bank of England Quarterly Bulletin, 2014 Q1, pp. 4–13 (p. 10)',
    url: 'https://www.bankofengland.co.uk/-/media/boe/files/quarterly-bulletin/2014/money-in-the-modern-economy-an-introduction.pdf',
    quote: [
      'The extra newly issued notes are bought by the commercial banks from the Bank of England. The commercial banks pay for the new currency, a paper IOU of the Bank of England, by swapping it for some of their other, electronic IOUs of the Bank — central bank reserves.',
    ],
  },
  promiseToPay: {
    source: 'Bank of England',
    title: 'Banknote FAQs',
    detail: 'accessed July 2026',
    url: 'https://www.bankofengland.co.uk/faq/banknote',
    quote: [
      "The words 'I promise to pay the bearer on demand the sum of five/ten/twenty/fifty pounds' appear on all of our notes.",
      'However, the value of the pound has not been linked to gold for many years, so the meaning of the promise to pay has changed. You can no longer exchange banknotes for gold.',
    ],
  },
  ibanRegistry: {
    source: 'SWIFT',
    title: 'IBAN Registry',
    detail: 'ISO 13616 Registration Authority, accessed July 2026',
    url: 'https://www.swift.com/resource/iban-registry-pdf',
    quote: [
      'The IBAN structure is defined in ISO 13616-1 and consists of a two-letter ISO 3166-1 country code, followed by two check digits and up to thirty alphanumeric characters for a BBAN… The check digits are calculated based on the scheme defined in ISO/IEC 7064 (MOD97-10).',
    ],
  },
  mod97: {
    source: 'International Organization for Standardization',
    title: 'ISO/IEC 7064:2003 — Check character systems',
    detail: '2003',
    url: 'https://www.iso.org/standard/31531.html',
    quote: [
      "These check character systems can detect: a) all single substitution errors (the substitution of a single character for another, for example '4234' for '1234')…",
    ],
  },
  svbOrder: {
    source: 'California Department of Financial Protection and Innovation',
    title:
      'Order Taking Possession of Property and Business: Silicon Valley Bank',
    detail: '10 March 2023, p. 1',
    url: 'https://dfpi.ca.gov/wp-content/uploads/sites/337/2023/03/DFPI-Orders-Silicon-Valley-Bank-03102023.pdf',
    quote: [
      'Despite the bank being in sound financial condition prior to March 9, 2023, investors and depositors reacted by initiating withdrawals of $42 billion in deposits from the Bank on March 9, 2023, causing a run on the Bank. As of the close of business on March 9, the bank had a negative cash balance of approximately $958 million.',
    ],
  },
  moneyCreation: {
    source: 'Michael McLeay, Amar Radia and Ryland Thomas',
    title: 'Money creation in the modern economy',
    detail: 'Bank of England Quarterly Bulletin, 2014 Q1, pp. 14–27',
    url: 'https://www.bankofengland.co.uk/-/media/boe/files/quarterly-bulletin/2014/money-creation-in-the-modern-economy.pdf',
    quote: [
      'This article explains how the majority of money in the modern economy is created by commercial banks making loans.',
      "…banks do not act simply as intermediaries, lending out deposits that savers place with them, and nor do they 'multiply up' central bank money…",
      'Of the two types of broad money, bank deposits make up the vast majority — 97% of the amount currently in circulation.',
    ],
  },
  fedZeroReserves: {
    source: 'Board of Governors of the Federal Reserve System',
    title:
      'Federal Reserve Actions to Support the Flow of Credit to Households and Businesses',
    detail: 'press release, 15 March 2020',
    url: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20200315b.htm',
    quote: [
      'The Board has reduced reserve requirement ratios to zero percent effective on March 26, the beginning of the next reserve maintenance period.',
    ],
  },
  reserveRatios: {
    source: 'Markets Committee',
    title:
      'MC Compendium: Monetary Policy Frameworks and Central Bank Market Operations',
    detail: 'Bank for International Settlements, 2019, table 4',
    url: 'https://www.bis.org/publ/mc_compendium.pdf',
    quote: [
      'Reserve requirements: ratios and size (table 4) — United Kingdom: N/A; Canada: zero.',
      "The Reserve Bank's reserve requirements are not a Required Reserve Ratio (they are not set as a per cent of the financial institution's liabilities)…",
    ],
  },
  cnbReserves: {
    source: 'Czech National Bank',
    title: 'CNB increases minimum reserve requirement',
    detail: 'press release, 10 October 2024',
    url: 'https://www.cnb.cz/en/cnb-news/press-releases/CNB-increases-minimum-reserve-requirement',
    quote: [
      'The current rate of 2% is to increase to 4% of the reserve base, except for repo liabilities. … The new rate becomes effective on 2 January 2025, i.e. on the first day of the new reserve maintenance cycle.',
    ],
  },
  baselCapital: {
    source: 'Basel Committee on Banking Supervision',
    title: 'RBC20 — Calculation of minimum risk-based capital requirements',
    detail: 'The Basel Framework, Bank for International Settlements',
    url: 'https://www.bis.org/basel_framework/chapter/RBC/20.htm',
    quote: [
      'Banks must meet the following requirements at all times: (1) Common Equity Tier 1 must be at least 4.5% of risk-weighted assets (RWA). (2) Tier 1 capital must be at least 6% of RWA. (3) Total capital must be at least 8.0% of RWA.',
    ],
  },
  promptCorrective: {
    source: 'Federal Deposit Insurance Corporation',
    title: 'Prompt Corrective Action',
    detail: 'Formal and Informal Enforcement Actions Manual, chapter 5',
    url: 'https://www.fdic.gov/regulations/examinations/enforcement-actions/ch-05.pdf',
    quote: [
      'Critically Undercapitalized: Ratio of tangible equity to total assets ≤ 2.0%',
      'Within 90 days after an IDI becomes critically undercapitalized, the appropriate FBA must … appoint a receiver (or, with FDIC concurrence, appoint a conservator) for the IDI…',
    ],
  },
  ccyb: {
    source: 'Czech National Bank',
    title: 'The countercyclical capital buffer',
    detail: 'accessed July 2026',
    url: 'https://www.cnb.cz/en/financial-stability/macroprudential-policy/the-countercyclical-capital-buffer/',
    quote: [
      'If a delegated macroprudential policy authority concludes that the cyclical part of systemic risk is increasing, it should ensure that capital accumulates in the banking sector… Conversely, in a period of declining cyclical systemic risks, this buffer is released.',
      'The CNB stands ready to sharply reduce the rate to zero (i.e. to release the buffer in full) in the event of adverse shocks giving rise to a risk of disruptions to smooth lending to the economy.',
    ],
  },
  cnbLtv: {
    source: 'Czech National Bank',
    title: 'Requirements for LTV, DSTI and DTI limits',
    detail: 'accessed July 2026',
    url: 'https://www.cnb.cz/en/financial-stability/macroprudential-policy/requirements-for-ltv-dsti-and-dti-limits/',
    quote: [
      'Maximum LTV: 80% (90% for applicants under 36 years if the loan is for the purchase of owner-occupied housing)',
    ],
  },
  greatContraction: {
    source: 'Milton Friedman and Anna Jacobson Schwartz',
    title: 'A Monetary History of the United States, 1867–1960',
    detail: 'Princeton University Press, 1963, chapter 7',
    url: 'https://press.princeton.edu/books/paperback/9780691003542/a-monetary-history-of-the-united-states-1867-1960',
    book: true,
    quote: [
      'From the cyclical peak in August 1929 to the cyclical trough in March 1933, the stock of money fell by over a third.',
      'More than one-fifth of the commercial banks in the United States holding nearly one-tenth of the volume of deposits at the beginning of the contraction suspended operations because of financial difficulties. Voluntary liquidations, mergers, and consolidations added to the toll, so that the number of commercial banks fell by well over one-third.',
    ],
  },
};

// Where each citation's marker lives — the task whose card must be
// opened for the reverse jump when the marker is not on the page. A
// citation used by several curiosities lists the first one's task.
const CITATION_TASK: Record<CitationId, string> = {
  firstWriting: TASK.openBank,
  firstCoins: TASK.openBank,
  intradayLiquidity: TASK.recordCentralBankNotice,
  powCamp: TASK.receiveRepayment,
  rescues2008: TASK.writeOffBankDebt,
  negativeEquity: TASK.writeOffBankDebt,
  volckerRates: TASK.setPolicyRate,
  russiaKeyRate: TASK.setPolicyRate,
  ecbNegativeRates: TASK.setPolicyRate,
  bojNegativeRate: TASK.setPolicyRate,
  jyskeMortgage: TASK.setPolicyRate,
  danishMortgageModel: TASK.setPolicyRate,
  danishCdRate: TASK.setPolicyRate,
  greeceCards: TASK.internalTransfer,
  herstatt: TASK.interbankTransfer,
  keynes: TASK.payFromBank,
  banknotesFromReserves: TASK.becomeClient,
  promiseToPay: TASK.becomeClient,
  ibanRegistry: TASK.openAccount,
  mod97: TASK.openAccount,
  svbOrder: TASK.sendMoney,
  moneyCreation: TASK.lendToClient,
  fedZeroReserves: TASK.lendToClient,
  reserveRatios: TASK.lendToClient,
  cnbReserves: TASK.lendToClient,
  baselCapital: TASK.lendToClient,
  promptCorrective: TASK.lendToClient,
  ccyb: TASK.lendToClient,
  cnbLtv: TASK.lendToClient,
  greatContraction: TASK.repayLoan,
};

const CITATION_IDS = Object.keys(CITATIONS) as CitationId[];

function entryDomId(id: CitationId): string {
  return `citation-${id}`;
}

// The markers live inside curiosity cards while the list sits at the
// page's bottom, so the section's state is a module store the same way
// the curiosities' read state is — any marker can command the section.
type CitationsState = {
  open: boolean;
  /** The entry a marker was just clicked for, briefly highlighted. */
  target: CitationId | null;
};

let snapshot: CitationsState = { open: false, target: null };
const listeners = new Set<() => void>();

function setState(next: CitationsState): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function useCitationsState(): CitationsState {
  return useSyncExternalStore(subscribe, () => snapshot);
}

let highlightTimer: number | undefined;

function revealCitation(id: CitationId): void {
  // When the section is closed, its 150ms height ease has to finish
  // before the entry's final position exists to scroll to.
  const scrollDelay = snapshot.open ? 0 : 200;
  setState({ open: true, target: id });
  window.setTimeout(() => {
    document
      .getElementById(entryDomId(id))
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, scrollDelay);
  window.clearTimeout(highlightTimer);
  highlightTimer = window.setTimeout(
    () => setState({ open: snapshot.open, target: null }),
    2000
  );
}

// The reverse jump: an entry's [n] scrolls back to the marker it was
// cited from. A citation can back several curiosities, so the marker
// clicked last wins, falling back to the first one on the page. Markers
// inside collapsed task cards are unmounted — then the jump first asks
// the page to focus the citation's task card, and catches the marker
// once it appears.
const lastMarker = new Map<CitationId, HTMLElement>();

// Runs once the smooth scroll settles — on scrollend where the browser
// fires it, after a timeout where it does not (or when nothing needed
// to scroll, so the event never comes).
function afterScroll(run: () => void): void {
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    window.removeEventListener('scrollend', finish);
    run();
  };
  window.addEventListener('scrollend', finish, { once: true });
  window.setTimeout(finish, 700);
}

// One rise of the warn tint, held long enough to read the sentence it
// covers, then a slow fade.
const HIGHLIGHT_KEYFRAMES = {
  backgroundColor: [
    'transparent',
    'color-mix(in srgb, var(--color-warn) 35%, transparent)',
    'color-mix(in srgb, var(--color-warn) 35%, transparent)',
    'transparent',
  ],
  offset: [0, 0.05, 0.85, 1],
};
const HIGHLIGHT_TIMING = { duration: 5000, easing: 'ease-in-out' };

function positionAt(nodes: Text[], offset: number): [Text, number] | null {
  let seen = 0;
  for (const node of nodes) {
    if (offset <= seen + node.data.length) return [node, offset - seen];
    seen += node.data.length;
  }
  return null;
}

// The sentence a marker backs: from the previous sentence's end (or the
// block's start) up to the marker, as a range over the block's text.
// A sentence end is a terminator followed by whitespace, which leaves
// decimals ("99.5") alone; the sentence's own trailing terminator sits
// right before the marker and must not count either.
function sentenceRangeBefore(marker: HTMLElement): Range | null {
  const block = marker.closest('p, li');
  if (!block) return null;
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let text = '';
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const preceding =
      (marker.compareDocumentPosition(node) &
        Node.DOCUMENT_POSITION_PRECEDING) !==
      0;
    if (!preceding) break;
    nodes.push(node as Text);
    text += (node as Text).data;
  }
  const end = text.replace(/\s+$/, '').length;
  const search = text.slice(0, end).replace(/[.!?]+$/, '');
  let start = 0;
  for (const match of search.matchAll(/[.!?]\s+/g)) {
    start = match.index + match[0].length;
  }
  if (start >= end) return null;
  const from = positionAt(nodes, start);
  const to = positionAt(nodes, end);
  if (!from || !to) return null;
  const range = document.createRange();
  range.setStart(from[0], from[1]);
  range.setEnd(to[0], to[1]);
  return range;
}

// The claim lights up with its marker: the sentence is painted as
// absolutely positioned tint boxes, one per line box, removed when the
// highlight fades — overlays, so the React-owned text itself is never
// touched.
function highlightSentence(marker: HTMLElement): void {
  const range = sentenceRangeBefore(marker);
  if (!range) return;
  for (const rect of range.getClientRects()) {
    if (rect.width === 0) continue;
    const box = document.createElement('div');
    box.style.position = 'absolute';
    box.style.left = `${window.scrollX + rect.left - 2}px`;
    box.style.top = `${window.scrollY + rect.top - 1}px`;
    box.style.width = `${rect.width + 4}px`;
    box.style.height = `${rect.height + 2}px`;
    box.style.borderRadius = '3px';
    box.style.pointerEvents = 'none';
    document.body.appendChild(box);
    box.animate(HIGHLIGHT_KEYFRAMES, HIGHLIGHT_TIMING).onfinish = () =>
      box.remove();
  }
}

// Layout around a just-opened card settles over several frames — the
// stage, the card and its content each ease their height open — and a
// scroll aimed mid-animation lands beside the target. Wait until the
// marker's position on the page holds still for a few frames. Measured
// against the document, not the viewport, so an in-flight scroll (the
// focused card brings itself into view) does not hold this up.
function whenStill(
  marker: HTMLElement,
  run: () => void,
  lastTop?: number,
  stillFrames = 0,
  framesLeft = 90
): void {
  const top = marker.getBoundingClientRect().top + window.scrollY;
  const still = top === lastTop ? stillFrames + 1 : 0;
  if (still >= 3 || framesLeft === 0) {
    run();
    return;
  }
  requestAnimationFrame(() =>
    whenStill(marker, run, top, still, framesLeft - 1)
  );
}

function scrollToMarker(marker: HTMLElement): void {
  whenStill(marker, () => {
    marker.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // The marker is tiny, so it announces itself once the ride ends:
    // the marker and the sentence it backs light up together, drawn
    // imperatively because both live in another component's subtree.
    afterScroll(() => {
      marker.animate(HIGHLIGHT_KEYFRAMES, HIGHLIGHT_TIMING);
      highlightSentence(marker);
    });
  });
}

// A just-focused task card opens across a few renders (the stage first,
// then the card, then its content), so the marker appears a couple of
// frames after the focus request — poll briefly for it.
function waitForMarker(id: CitationId, framesLeft = 60): void {
  const marker = document.querySelector<HTMLElement>(`[data-cite="${id}"]`);
  if (marker) {
    scrollToMarker(marker);
    return;
  }
  if (framesLeft === 0) return;
  requestAnimationFrame(() => waitForMarker(id, framesLeft - 1));
}

function revealMarker(
  id: CitationId,
  focusTask: (taskId: string) => void
): void {
  const remembered = lastMarker.get(id);
  const marker =
    remembered?.isConnected === true
      ? remembered
      : document.querySelector<HTMLElement>(`[data-cite="${id}"]`);
  if (marker) {
    scrollToMarker(marker);
    return;
  }
  // The marker sits in a collapsed task card, unmounted with it. Open
  // the card through the same plumbing as the hero's "Next task"
  // button, then ride to the marker.
  focusTask(CITATION_TASK[id]);
  waitForMarker(id);
}

/** The superscript [n] marker a curiosity hangs on a checkable claim. */
export function Cite({ id }: { id: CitationId }) {
  const citation = CITATIONS[id];

  return (
    <sup className="whitespace-nowrap">
      <a
        href={`#${entryDomId(id)}`}
        data-cite={id}
        title={`${citation.source}, ${citation.title}`}
        onClick={event => {
          event.preventDefault();
          lastMarker.set(id, event.currentTarget);
          revealCitation(id);
        }}
        className="text-[11px] font-medium text-muted hover:text-accent"
      >
        [{CITATION_IDS.indexOf(id) + 1}]
      </a>
    </sup>
  );
}

function CitationEntry({
  id,
  index,
  highlighted,
  onFocusTask,
}: {
  id: CitationId;
  index: number;
  highlighted: boolean;
  onFocusTask: (taskId: string) => void;
}) {
  const citation = CITATIONS[id];
  const [open, setOpen] = useState(false);

  // A marker click is a request for the evidence, so the jump also
  // unfolds the entry's quote.
  useEffect(() => {
    if (highlighted) setOpen(true);
  }, [highlighted]);

  return (
    <li
      id={entryDomId(id)}
      // The flash: full strength the instant the marker is clicked,
      // then a slow fade once the target clears.
      className={`rounded-md px-2 py-1 transition-colors ${
        highlighted ? 'bg-warn/15 duration-150' : 'duration-1000'
      }`}
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        {/* The whole first line toggles the quote, but a link cannot sit
            inside a button, so the line is a plain clickable div and the
            chevron stays a real trigger for the keyboard. The number and
            the source link do their own jobs and stop the line's click. */}
        <div
          className="group flex cursor-pointer items-baseline gap-2"
          onClick={() => setOpen(previous => !previous)}
        >
          <CollapsibleTrigger
            aria-label={open ? 'Hide the source text' : 'Show the source text'}
            className="cursor-pointer self-center text-muted group-hover:text-ink"
            onClick={event => event.stopPropagation()}
          >
            <ChevronRight
              size={13}
              className={`transition-transform ${open ? 'rotate-90' : ''}`}
              aria-hidden
            />
          </CollapsibleTrigger>
          <button
            type="button"
            title="Show where this citation is used"
            className="shrink-0 cursor-pointer text-muted hover:text-accent"
            onClick={event => {
              event.stopPropagation();
              revealMarker(id, onFocusTask);
            }}
          >
            [{index + 1}]
          </button>
          <span className="text-muted">
            {citation.source},{' '}
            <a
              href={citation.url}
              target="_blank"
              rel="noreferrer"
              className="text-ink underline decoration-line underline-offset-2 hover:decoration-ink"
              onClick={event => event.stopPropagation()}
            >
              {citation.book ? <em>{citation.title}</em> : citation.title}
            </a>
            , {citation.detail}.
          </span>
        </div>
        <CollapsibleContent>
          <blockquote className="mt-1.5 mb-1 ml-6 space-y-1.5 border-l-2 border-line pl-3 text-muted">
            {citation.quote.map(passage => (
              <p key={passage}>"{passage}"</p>
            ))}
          </blockquote>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

export function CitationsSection({
  onFocusTask,
}: {
  /** Opens the stage and card of a task whose marker the reverse jump
   *  needs on the page — the hero's "Next task" plumbing, relayed. */
  onFocusTask: (taskId: string) => void;
}) {
  const { open, target } = useCitationsState();

  return (
    <section className="mt-5">
      <Collapsible
        open={open}
        onOpenChange={next => setState({ open: next, target: null })}
      >
        <CollapsibleTrigger className="flex cursor-pointer items-baseline gap-1 text-left text-xs font-semibold tracking-wider text-muted uppercase hover:text-ink">
          <ChevronRight
            size={13}
            className={`self-center transition-transform ${open ? 'rotate-90' : ''}`}
            aria-hidden
          />
          Citations
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ol className="mt-3 space-y-1.5 text-sm">
            {CITATION_IDS.map((id, index) => (
              <CitationEntry
                key={id}
                id={id}
                index={index}
                highlighted={target === id}
                onFocusTask={onFocusTask}
              />
            ))}
          </ol>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
