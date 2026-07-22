import Big from 'big.js';
import { ChevronRight } from 'lucide-react';
import { Fragment, useEffect, useState, useSyncExternalStore } from 'react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@banks/shared/browser/ui/table.tsx';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@banks/shared/browser/ui/select.tsx';

import { TASK } from '@banks/shared/curriculum.ts';

import { ActionGroup } from './ActionGroup.tsx';
import { concernsAccount } from '../account-activity.ts';
import { api } from '../api.ts';
import { anyDone, isDone } from '../gating.ts';
import { getCallLog, isUnread, subscribeCallLog } from '../call-log.ts';
import { formatIban, formatMoney } from '../format.ts';
import { LogEntries } from './LogEntries.tsx';
import { Amount } from './Amount.tsx';
import { BecomeClientDialog } from './BecomeClientDialog.tsx';
import { CopyIbanButton } from './CopyIbanButton.tsx';
import { LogSection } from './LogSection.tsx';
import { OpenAccountDialog } from './OpenAccountDialog.tsx';
import { RenamePersonDialog } from './RenamePersonDialog.tsx';
import { RepayLoanDialog } from './RepayLoanDialog.tsx';
import { SendMoneyDialog } from './SendMoneyDialog.tsx';
import { SendMoneyInternalDialog } from './SendMoneyInternalDialog.tsx';
import { useStoredState } from '../use-stored-state.ts';

// The person's view of the financial system: you are a person — uniquely
// identified by your personal id, the way a birth number works — and the
// screen aggregates your accounts across every bank you use. This is not
// one bank's app; it is your money. The name is a freely colliding label
// (the pencil relabels it everywhere); the personal id and the IBANs are
// the identity. The big number is the person's total across banks; the
// table under it is where each part actually lives.
//
// No database section here on purpose: the DB slice rule is "the
// persona's own books", and people keep no books — their accounts are
// rows in their banks'.

type ClientRow = Awaited<ReturnType<typeof api.user.list.query>>[number];
type Bank = Awaited<ReturnType<typeof api.banks.list.query>>[number];

interface Config {
  country: string;
  currency: string;
  decimals: number;
  /** Task id → implemented; operations reveal per task (gating.ts). */
  tasks: Record<string, boolean>;
}

export function UserScreen({
  version,
  config,
}: {
  version: number;
  config: Config;
}) {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedId, setSelectedId] = useStoredState('user-identity');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const log = useSyncExternalStore(subscribeCallLog, getCallLog);

  const toggleExpanded = (iban: string) => {
    setExpanded(current => {
      const next = new Set(current);
      if (next.has(iban)) next.delete(iban);
      else next.add(iban);
      return next;
    });
  };

  const persons: { personId: string; name: string; total: Big }[] = [];
  for (const client of clients) {
    const entry = persons.find(person => person.personId === client.personId);
    if (entry) entry.total = entry.total.plus(client.balance);
    else {
      persons.push({
        personId: client.personId,
        name: client.owner,
        total: new Big(client.balance),
      });
    }
  }
  const person =
    persons.find(candidate => candidate.personId === selectedId) ?? persons[0];
  const accounts = clients.filter(
    client => client.personId === person?.personId
  );
  // The table groups accounts under their bank, aggregator-style, each
  // group sorted richest-first like every other account list.
  const byBank: { bankId: number; bankName: string; rows: ClientRow[] }[] = [];
  for (const account of accounts) {
    const group = byBank.find(candidate => candidate.bankId === account.bankId);
    if (group) group.rows.push(account);
    else {
      byBank.push({
        bankId: account.bankId,
        bankName: account.bankName,
        rows: [account],
      });
    }
  }
  for (const group of byBank) {
    group.rows.sort((a, b) => new Big(b.balance).cmp(a.balance));
  }
  const zero = new Big(0);
  const totalBalance = accounts.reduce(
    (sum, account) => sum.plus(account.balance),
    zero
  );
  // Debt is a fact between the person and one bank (the claim is keyed
  // by personal id) — count it once per bank, not once per account row.
  const totalDebt = byBank.reduce(
    (sum, group) => sum.plus(group.rows[0]?.debt ?? zero),
    zero
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.all([api.user.list.query(), api.banks.list.query()])
      .then(([nextClients, nextBanks]) => {
        if (cancelled) return;
        setClients(nextClients);
        setBanks(nextBanks);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [version]);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">You are</h2>
        {persons.length > 0 ? (
          <div className="flex items-center gap-1.5">
            <Select
              value={person?.personId ?? ''}
              onValueChange={setSelectedId}
            >
              <SelectTrigger
                className="w-auto font-semibold"
                aria-label="Which person you are"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {persons.map(candidate => (
                  <SelectItem
                    key={candidate.personId}
                    value={candidate.personId}
                  >
                    <span className="font-mono tabular-nums">
                      {candidate.personId}
                    </span>{' '}
                    <span className="text-muted">|</span> {candidate.name}{' '}
                    <span className="text-muted">
                      ({formatMoney(candidate.total.toFixed(config.decimals))}{' '}
                      {config.currency})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isDone(config.tasks, TASK.renamePerson) && (
              <RenamePersonDialog person={person} />
            )}
          </div>
        ) : (
          <span className="text-lg font-semibold text-muted">nobody yet</span>
        )}
      </div>

      <div className="mb-5 flex flex-wrap gap-3">
        {anyDone(config.tasks, [TASK.becomeClient, TASK.openAccount]) && (
          <ActionGroup
            label="Identity"
            hint={
              <>
                To hold money, a person becomes an entry in a commercial bank's
                database: registered under their personal id, with an account.
                <p className="mt-1">
                  Further accounts can follow, at any bank; each is its own
                  entry with its own IBAN.
                </p>
              </>
            }
          >
            {isDone(config.tasks, TASK.becomeClient) && (
              <BecomeClientDialog
                banks={banks}
                onCreated={({ personId }) => setSelectedId(personId)}
              />
            )}
            {isDone(config.tasks, TASK.openAccount) && (
              <OpenAccountDialog person={person} banks={banks} />
            )}
          </ActionGroup>
        )}
        {isDone(config.tasks, TASK.sendMoney) && (
          <ActionGroup
            label="Payments"
            hint={
              <>
                A transfer between clients of the same bank changes only that
                bank's database: one balance down, another up.
                <p className="mt-1">
                  A transfer to an account at another bank also makes the banks
                  settle: reserves move between them at the central bank.
                </p>
              </>
            }
          >
            <SendMoneyInternalDialog
              clients={clients}
              defaultPersonId={person?.personId}
              currency={config.currency}
            />
            <SendMoneyDialog
              clients={clients}
              defaultPersonId={person?.personId}
              currency={config.currency}
            />
          </ActionGroup>
        )}
        {isDone(config.tasks, TASK.repayLoan) && (
          <ActionGroup
            label="Credit (money creation)"
            hint="A repayment is a loan running in reverse: the account balance goes down and the debt goes down with it — the deposit the loan created is destroyed."
          >
            <RepayLoanDialog accounts={accounts} currency={config.currency} />
          </ActionGroup>
        )}
      </div>

      {person && accounts.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="border-b border-line px-4 py-2.5 text-xs font-semibold tracking-wide text-muted uppercase">
            Your accounts
          </div>
          <div className="px-4 pt-4 pb-1">
            <div className="font-mono text-3xl font-semibold tabular-nums">
              {formatMoney(totalBalance.toFixed(config.decimals))}{' '}
              <span className="text-xl text-muted">{config.currency}</span>
            </div>
            <div className="mt-1 text-sm text-muted">
              {person.name} ·{' '}
              <span className="font-mono tabular-nums">{person.personId}</span>{' '}
              · {accounts.length}{' '}
              {accounts.length === 1 ? 'account' : 'accounts'}
              {totalDebt.gt(0) && (
                <>
                  {' '}
                  · owing{' '}
                  <span className="mx-1 font-mono font-semibold text-ink tabular-nums">
                    {formatMoney(totalDebt.toFixed(config.decimals))}{' '}
                    {config.currency}
                  </span>{' '}
                  on loans
                </>
              )}
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">IBAN</TableHead>
                <TableHead className="pr-4 text-right">balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byBank.map(group => (
                <Fragment key={group.bankId}>
                  <TableRow className="bg-faint">
                    <TableCell
                      colSpan={2}
                      className="py-1.5 pl-4 text-xs font-semibold tracking-wider text-muted uppercase"
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span>{group.bankName}</span>
                        {group.rows[0] && new Big(group.rows[0].debt).gt(0) && (
                          <span className="pr-0.5 font-normal normal-case">
                            owing{' '}
                            <span className="mx-1 font-mono tabular-nums">
                              {formatMoney(group.rows[0].debt)}{' '}
                              {config.currency}
                            </span>{' '}
                            on a loan
                          </span>
                        )}
                      </span>
                    </TableCell>
                  </TableRow>
                  {group.rows.map(account => {
                    const open = expanded.has(account.iban);
                    const activity = log.filter(entry =>
                      concernsAccount(entry, account)
                    );
                    return (
                      <Fragment key={account.iban}>
                        <TableRow
                          className="cursor-pointer hover:bg-faint"
                          onClick={() => toggleExpanded(account.iban)}
                        >
                          <TableCell className="pl-2 font-mono text-xs text-muted tabular-nums">
                            <button
                              className="mr-1 cursor-pointer align-middle text-muted hover:text-ink"
                              title="Show this account's activity"
                              aria-label="Show this account's activity"
                              aria-expanded={open}
                              onClick={event => {
                                event.stopPropagation();
                                toggleExpanded(account.iban);
                              }}
                            >
                              <ChevronRight
                                size={14}
                                className={`transition-transform ${open ? 'rotate-90' : ''}`}
                              />
                            </button>
                            {activity.some(entry => isUnread(entry.id)) && (
                              <span
                                className="mr-1.5 inline-block size-1.5 rounded-full bg-accent align-middle"
                                aria-hidden
                              />
                            )}
                            <span className="mr-1.5">
                              {formatIban(account.iban)}
                            </span>
                            <CopyIbanButton iban={account.iban} />
                          </TableCell>
                          <TableCell className="pr-4 text-right">
                            <Amount
                              value={account.balance}
                              currency={config.currency}
                            />
                          </TableCell>
                        </TableRow>
                        {open && (
                          <TableRow>
                            <TableCell colSpan={2} className="p-0">
                              {activity.length === 0 ? (
                                <p className="px-4 py-2 text-xs text-muted">
                                  No operations touched this account yet.
                                </p>
                              ) : (
                                <LogEntries
                                  entries={activity}
                                  className="divide-y divide-line border-l-2 border-line"
                                />
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">
          Nobody has an account yet — Become a client opens the first one.
          {banks.length === 0 &&
            ' (That needs a bank first — open one on the Commercial Bank tab.)'}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        <LogSection label="Log — user operations" pathPrefixes={['user.']} />
      </div>
    </section>
  );
}
