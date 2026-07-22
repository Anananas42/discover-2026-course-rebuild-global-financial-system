// The curriculum: the course's stage progression, defined once, here.
// Each stage lists the ids of the TASK regions (in packages/) that belong
// to it — the stage order is the teaching order: a working cashless
// economy before client lending exists, so "loans create money" lands
// against a baseline where money only ever moved. The one layer where
// credit precedes payments is the central bank's own (stage 2 before 3),
// of necessity: loans are the faucet, and there is nothing to move until
// lending creates it.
//
// Who reads this: the financial system reveals each operation's UI once
// its task's stub is replaced (task-status.ts detects that); the guide
// groups tasks under stages. Task titles live in the markers themselves
// (`// TASK <id>: <title>`), never here — one source of truth each way.
// curriculum.test.ts locks this list against the actual markers, so the
// two cannot drift apart.

export interface CurriculumTask {
  id: string;
  /** The functionality, as a user story: who does what, and why. */
  story: string;
  /** How to walk the story by hand, in order — in the financial system
   *  from stage 1 on; stage 0 walks the code and the guide itself.
   *  Written for the moment the task lands: they only use operations
   *  that exist by then. */
  steps: string[];
}

export interface CurriculumStage {
  /** The stage number — its task ids are `<stage>.<n>`. */
  stage: number;
  /** Where this stage lives on the classroom board: the major system
   *  (the institution students know from the workbench tabs) and the
   *  subsystem it restores — short plain words, unambiguous within
   *  their group ("Central bank · Money creation"). */
  system: string;
  subsystem: string;
  /** The board's ticker line when this stage comes online — a plain
   *  sentence about what the country can now do; {country} is
   *  substituted. */
  announcement: string;
  title: string;
  /** A short lede under the stage pill, before the tasks — the story of
   *  what the student is here to do. Only the mission briefing carries
   *  one; the mission stages open with their outcome line instead. */
  intro?: string;
  /** What the economy can do once the stage's tasks are implemented;
   *  empty when there is nothing to say (stage 0), which renders no
   *  line. */
  outcome: string;
  tasks: CurriculumTask[];
}

/** Task ids by name, for the UI surfaces they unlock. */
export const TASK = {
  openBank: '1.1',
  lendToBank: '2.1',
  receiveRepayment: '2.2',
  writeOffBankDebt: '2.3',
  setPolicyRate: '2.4',
  transferReserves: '3.1',
  payBank: '3.2',
  internalTransfer: '4.1',
  receivePayment: '4.2',
  interbankTransfer: '4.3',
  payFromBank: '4.4',
  becomeClient: '5.1',
  openAccount: '5.2',
  renamePerson: '5.3',
  sendMoney: '6.1',
  lendToClient: '7.1',
  writeOffLoan: '7.2',
  repayLoan: '8.1',
} as const;

export const CURRICULUM: CurriculumStage[] = [
  {
    stage: 0,
    system: 'Headquarters',
    subsystem: 'Mission briefing',
    announcement: '{country} reported for duty',
    title: 'Mission briefing',
    // The intro replaces the outcome line: the briefing restores
    // nothing in the economy, so there is no "when this works" to state
    // — the lede sets the scene and points at the work instead.
    // Its stories speak in the briefing voice — headquarters issuing
    // orders — not the user-story voice of the mission stages below.
    intro:
      "Welcome to headquarters. Before the rebuild begins, this briefing drills the handful of moves every later task uses: open a task, write a few lines of code, run its tests. Finish all seven and your country's financial system unlocks.",
    outcome: '',
    tasks: [
      {
        id: '0.1',
        story:
          'Send headquarters your status report — your first line of restored code, and your first passing test.',
        steps: [
          'Read the explainer above and mark it read.',
          'Open the file below and read the documentation above the task — every task has some; this one time, it gives the exact line to write.',
          'Run the tests from this card and watch the task turn green.',
        ],
      },
      {
        id: '0.2',
        story:
          'Add two money amounts the safe way: with a Big method, never with plus.',
        steps: [
          'Open the test file to see the amounts it expects.',
          'The explainer above lists the Big methods — one of them is the whole solution.',
        ],
      },
      {
        id: '0.3',
        story:
          "Read the central bank's own account balance from a repository and hand back the answer untouched.",
        steps: [
          'Read the explainer above.',
          'One line: return what centralBankRepo.ownAccountBalance() gives you.',
        ],
      },
      {
        id: '0.4',
        story:
          "Relay headquarters' status — your first method built on the Effect frame.",
        steps: [
          'Read the explainer above.',
          'Copy the frame; inside it, yield* the prebuilt headquartersStatus() call and return its answer.',
        ],
      },
      {
        id: '0.5',
        story:
          "Wait for headquarters' instructions — an answer that arrives later, as a Promise.",
        steps: [
          'Read the explainer above — the one pattern there is the whole solution.',
        ],
      },
      {
        id: '0.6',
        story:
          'Refuse a negative amount with a named error — the smallest method that can say no.',
        steps: [
          'Read the explainer above.',
          'The signature names the error to fail with; give it the amount as text.',
          'Run the tests: one scenario checks the refusal, two check that valid amounts pass through.',
        ],
      },
      {
        id: '0.7',
        story:
          'Move an amount between two accounts in one transaction — both writes land, or neither does.',
        steps: [
          'Read the explainer above.',
          'Write both new balances — minus the amount, plus the amount — inside one db.transaction call.',
          'Run the tests: one scenario cuts the power between the two writes and checks that nothing moved.',
        ],
      },
    ],
  },
  {
    stage: 1,
    system: 'Central bank',
    subsystem: 'New banks',
    announcement: '{country} can now open new banks',
    title: 'Opening new banks',
    outcome:
      'The central bank licenses commercial banks; every balance reads zero.',
    tasks: [
      {
        id: TASK.openBank,
        story:
          'As the central bank, I license a new commercial bank: I register its name and open its reserve account with me — and the new bank starts its fresh books with its own account.',
        steps: [
          'In the financial system, open the Commercial Bank tab and click "Open a new bank".',
          "Name your country's first bank.",
          'In the Database tab, find your bank in the banks table under Central bank, its reserve account in the accounts table, and its own account in the section named after your bank.',
        ],
      },
    ],
  },
  {
    stage: 2,
    system: 'Central bank',
    subsystem: 'Money creation',
    announcement: '{country} now creates its own money',
    title: 'Central bank credit',
    outcome:
      'Money exists: lending creates reserves, repayment destroys them, a default is written off.',
    tasks: [
      {
        id: TASK.lendToBank,
        story:
          'As the central bank, I create money by lending to a commercial bank: its reserves grow by the amount, and it owes the amount plus interest at the central bank interest rate.',
        steps: [
          'On the Central Bank tab, click "Lend to a bank" and lend, say, 1000.',
          "Watch the bank's reserves grow by 1000 and the claim on it read more (at a 5% rate, 1050).",
          "On the Commercial Bank tab, see the bank's own account go negative by the interest (at 5%, -50): the loan's price is the bank's expense.",
        ],
      },
      {
        id: TASK.receiveRepayment,
        story:
          'As the central bank, I receive a repayment: the bank pays from its reserves, my claim shrinks — repaid money stops existing.',
        steps: [
          'On the Commercial Bank tab, click "Repay the central bank" and repay part of the debt.',
          "On the Central Bank tab, watch the bank's reserves and the claim on it shrink together.",
          'Try repaying more than is owed and read the error.',
        ],
      },
      {
        id: TASK.writeOffBankDebt,
        story:
          "As the central bank, I write off the debt of a bank that cannot pay: the claim dies, my equity takes the loss, and the forgiven amount becomes the bank's gain.",
        steps: [
          'On the Central Bank tab, click "Write off a bank\'s debt" and pick a bank that owes.',
          "Watch the claim disappear and the central bank's equity go negative — only the central bank survives that.",
          "On the Commercial Bank tab, see the forgiven amount arrive in the bank's own account.",
        ],
      },
      {
        id: TASK.setPolicyRate,
        story:
          'As the central bank, I set the central bank interest rate: new loans to banks carry it, existing claims keep the rate they were made at.',
        steps: [
          'Click the "interest rate" pill on the Central Bank tab and set a new rate.',
          'Lend to a bank and check the claim is priced at the new rate.',
          'Try a rate below -5 or above 100 and read the error.',
        ],
      },
    ],
  },
  {
    stage: 3,
    system: 'Central bank',
    subsystem: 'Settlement',
    announcement: '{country} now settles payments between banks',
    title: 'Central bank payments',
    outcome:
      'Reserves move between banks, and the central bank spends its income back into the system.',
    tasks: [
      {
        id: TASK.transferReserves,
        story:
          "As the central bank, I settle a payment between two commercial banks by moving reserves from one bank's account to the other's — never creating or destroying money.",
        steps: [
          'Open a second bank and lend it reserves.',
          'On the Central Bank tab, find "Transfer reserves" in the dashed Debug box and move some from one bank to the other.',
          'Check both reserve accounts at the central bank: the total never changed.',
          "On the Commercial Bank tab, see both banks' balance sheets stop balancing: money moved with no payment behind it, so neither bank's books say why.",
          'Transfer the same amount back and watch both sheets balance again.',
        ],
      },
      {
        id: TASK.payBank,
        story:
          'As the central bank, I spend my interest income into a commercial bank, crediting its reserves and its equity — this is how my income returns to the system.',
        steps: [
          'Lend to a bank first, so the central bank has interest income in its own account.',
          'On the Central Bank tab, click "Pay a bank" and spend some of that income into a bank.',
          "Watch the bank's reserves and equity grow together; then try paying out more than the central bank has earned.",
        ],
      },
    ],
  },
  {
    stage: 4,
    system: 'Commercial banks',
    subsystem: 'Payments',
    announcement: 'Banks in {country} now pay from their own accounts',
    title: 'Commercial bank payments',
    outcome:
      'Banks pay each other from their own accounts — interbank settlement, driven by code.',
    tasks: [
      {
        id: TASK.internalTransfer,
        story:
          'As a commercial bank, I move money between two accounts I hold: both balances change in my own database, in one transaction — no other institution is involved.',
        steps: [
          'The prebuilt transfer(...) engine checks every payment order and resolves its accounts, then routes the movement — here, when both accounts are at one bank.',
        ],
      },
      {
        id: TASK.receivePayment,
        story:
          'As a commercial bank, I receive a payment message from another bank: who sent it, which account to credit, and the amount — nothing more — and I credit that account in my own database.',
        steps: [
          'This is the receiving half of every interbank payment — the next task builds the sending half.',
          'On the Commercial Bank tab, use "Receive an interbank payment message" in the dashed Debug box: pick an account and watch it grow.',
          'The sheet stops balancing: money arrived with nothing settled behind it — real messages arrive only after settlement.',
        ],
      },
      {
        id: TASK.interbankTransfer,
        story:
          'As a commercial bank, I send a payment to another bank: I record the payment and debit the sender, the central bank moves the reserves, and a message tells the other bank to credit the recipient — each bank changes only its own database.',
        steps: [
          'The engine routes here when the recipient is at another bank.',
          'The next task puts the first button on it.',
          'From then on, you can watch the payments table in the Database tab: every interbank payment leaves a row going accepted → settled → completed.',
        ],
      },
      {
        id: TASK.payFromBank,
        story:
          'As a commercial bank, I pay salaries, dividends, or rent from my own account to any IBAN in the country.',
        steps: [
          'Give a bank money of its own first: on the Central Bank tab, use "Pay a bank".',
          "Copy the IBAN of another bank's own account from its balance sheet.",
          'On the Commercial Bank tab, click "Pay from the bank\'s account" and pay it.',
          'Watch reserves settle at the central bank and both equity lines move; then try paying more than the bank owns.',
        ],
      },
    ],
  },
  {
    stage: 5,
    system: 'People',
    subsystem: 'Accounts',
    announcement: 'People in {country} now have bank accounts',
    title: 'Personal accounts',
    outcome: 'People exist: personal ids, accounts at banks, renaming.',
    tasks: [
      {
        id: TASK.becomeClient,
        story:
          'As a person, I walk into a bank for the first time: the system registers me under my personal id — like a birth number — and opens my first account.',
        steps: [
          'On the new People tab, click "Become a client", pick a bank, and enter a name.',
          'Note your personal id — that number, not the name, is who you are.',
          'Create a second person with the same name and see the system keep the two apart.',
        ],
      },
      {
        id: TASK.openAccount,
        story:
          'As a person, I open another account at any bank, under the personal id I already have.',
        steps: [
          'On the People tab, click "Open another account" and pick a different bank.',
          'See the new account listed under the same personal id — the screen sums your money across all your banks.',
        ],
      },
      {
        id: TASK.renamePerson,
        story:
          'As a person, I change my name: every account of mine is relabeled, and nothing else changes — my personal id is who I am.',
        steps: [
          'On the People tab, click the pencil next to your name and change it.',
          'Check every account of yours carries the new label, at every bank.',
          'If another person shares the old name, check they kept it.',
        ],
      },
    ],
  },
  {
    stage: 6,
    system: 'People',
    subsystem: 'Payments',
    announcement: 'People in {country} now pay each other',
    title: 'Personal payments',
    outcome:
      'People pay each other and get paid — money circulates with no client credit yet.',
    tasks: [
      {
        id: TASK.sendMoney,
        story:
          "As a person, I send money from my own account to any IBAN I was given: the system works out the bank from the IBAN itself, honors the order only from the account's holder, and turns down foreign IBANs for now.",
        steps: [
          'Get paid first: on the Commercial Bank tab, use "Pay from the bank\'s account" to send a salary to your IBAN.',
          'On the People tab, click "Send money" and pay another person by their IBAN.',
          'Send across banks and watch reserves settle at the central bank.',
          'Mistype one digit of an IBAN and see the check digits catch it.',
        ],
      },
    ],
  },
  {
    stage: 7,
    system: 'Commercial banks',
    subsystem: 'Lending',
    announcement: 'Banks in {country} now lend to people',
    title: 'Commercial bank credit',
    outcome:
      'Client loans create deposits; the reserve requirement bites; a bad loan makes a bank insolvent.',
    tasks: [
      {
        id: TASK.lendToClient,
        story:
          'As a commercial bank, I create money by lending to a client: their deposit grows by the amount, they owe the amount plus interest at my rate — allowed only while my reserves cover the required share of deposits.',
        steps: [
          'On the Commercial Bank tab, click "Lend to a client" and lend to a person.',
          "Watch their deposit grow by the amount, the loan record the amount plus interest, and the interest land in the bank's own account.",
          'Keep lending until the reserve requirement stops you — then borrow reserves from the central bank and lend again.',
          'The "interest rate" pill is prebuilt — set your own price and check that only new loans carry it.',
          'So is the "reserve requirement" pill on the Central Bank tab — raise it and watch the same reserves support less lending.',
        ],
      },
      {
        id: TASK.writeOffLoan,
        story:
          "As a commercial bank, I write off a loan that will not be repaid: the claim dies and my equity absorbs the loss — the borrower's money stays in circulation.",
        steps: [
          'Lend to a person, then have them send the money away — the borrower now cannot repay.',
          'On the Commercial Bank tab, click "Write off a loan".',
          "Watch the loan vanish and the bank's equity absorb the loss — possibly below zero: an insolvent bank, honestly reported. The spent deposits stay where they went.",
        ],
      },
    ],
  },
  {
    stage: 8,
    system: 'People',
    subsystem: 'Loan repayment',
    announcement: 'People in {country} now repay their loans',
    title: 'Personal credit',
    outcome:
      'Loans are repaid and money dies — the whole system can unwind to zero.',
    tasks: [
      {
        id: TASK.repayLoan,
        story:
          'As a person, I repay my loan: my deposit and my debt shrink together — repaid money stops existing.',
        steps: [
          'On the People tab, click "Repay your loan" and repay what your balance allows.',
          'Watch your balance and your debt shrink together.',
          'The interest needs money your loan did not create: earn a salary (a bank pays your IBAN) and finish repaying.',
          'Now unwind everything — every loan, every debt, at both layers — and end the world at exactly zero.',
        ],
      },
    ],
  },
];

/** Every task id in curriculum order. */
export const ALL_TASK_IDS: string[] = CURRICULUM.flatMap(s =>
  s.tasks.map(t => t.id)
);

/** A task's curriculum entry, by id. */
export function taskById(id: string): CurriculumTask | undefined {
  return CURRICULUM.flatMap(s => s.tasks).find(t => t.id === id);
}
