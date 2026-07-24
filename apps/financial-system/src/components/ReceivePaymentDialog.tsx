import Big from 'big.js';
import { ArrowRight, Inbox } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@banks/shared/browser/ui/select.tsx';

import { api } from '../api.ts';
import { formatIban, formatMoney } from '../format.ts';
import { Field, INPUT_CLASS } from './Field.tsx';
import { OperationDialog } from './OperationDialog.tsx';

interface Bank {
  id: number;
  name: string;
  /** How payment messages name the bank. */
  bic: string;
}

/** An account a message names: the bank's own or a client's. */
export interface ReceivableAccount {
  iban: string;
  owner: string;
  balance: string;
}

/** A picked bank's accounts — its own account first among equals, then
 *  clients — richest first, like every list. */
function accountRows(
  bankName: string,
  books: Awaited<ReturnType<typeof api.banks.balanceSheet.query>>
): ReceivableAccount[] {
  return [
    {
      iban: books.ownAccount.iban,
      owner: bankName,
      balance: books.ownAccount.balance,
    },
    ...books.accounts.map(account => ({
      iban: account.iban,
      owner: account.owner,
      balance: account.balance,
    })),
  ].sort((a, b) => new Big(b.balance).cmp(a.balance));
}

function AccountSelect({
  accounts,
  value,
  onChange,
  currency,
  disabled,
}: {
  accounts: ReceivableAccount[];
  value: string;
  onChange: (iban: string) => void;
  currency: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {accounts.map(account => (
          <SelectItem key={account.iban} value={account.iban}>
            <span className="flex flex-col items-start">
              <span>
                {account.owner}{' '}
                <span className="text-muted">
                  ({formatMoney(account.balance)} {currency})
                </span>
              </span>
              <span className="font-mono text-xs tabular-nums text-muted">
                {formatIban(account.iban)}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Debug: hands the selected bank a raw interbank payment message —
 *  the receiving half of a payment, with no acceptance and no
 *  settlement in front of it. */
export function ReceivePaymentDialog({
  bank,
  banks,
  accounts,
  currency,
}: {
  /** The receiving bank — the one this screen impersonates. */
  bank: Bank;
  /** Every bank, for picking a sender to name in the message. */
  banks: Bank[];
  /** The accounts at this bank, richest first. */
  accounts: ReceivableAccount[];
  currency: string;
}) {
  const [fromId, setFromId] = useState('');
  const [fromIban, setFromIban] = useState('');
  const [toIban, setToIban] = useState('');
  const [amount, setAmount] = useState('');
  // A bank never messages itself — on-us payments stay internal — so
  // only other banks can be the sender.
  const senders = banks.filter(candidate => candidate.id !== bank.id);
  const from =
    senders.find(candidate => String(candidate.id) === fromId) ?? senders[0];

  // The sending bank's accounts, fetched when the pick changes — the
  // return-path IBAN is picked, never typed.
  const [fromAccounts, setFromAccounts] = useState<ReceivableAccount[]>([]);
  const fromRef = from?.id;
  const fromName = from?.name;
  useEffect(() => {
    if (fromRef === undefined || fromName === undefined) {
      setFromAccounts([]);
      return;
    }
    let cancelled = false;
    void api.banks.balanceSheet
      .query({ bankId: fromRef })
      .then(books => {
        if (!cancelled) setFromAccounts(accountRows(fromName, books));
      })
      .catch(() => {
        if (!cancelled) setFromAccounts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [fromRef, fromName]);

  const fromAccount =
    fromAccounts.find(candidate => candidate.iban === fromIban) ??
    fromAccounts[0];
  const to =
    accounts.find(candidate => candidate.iban === toIban) ?? accounts[0];

  return (
    <OperationDialog
      debug
      wide
      disabledReason={
        senders.length === 0
          ? 'An interbank message comes from another bank — open a second bank first.'
          : undefined
      }
      trigger={
        <>
          <Inbox size={16} /> Receive an interbank payment message
        </>
      }
      title={`Receive an interbank payment message at ${bank.name}`}
      description={
        <>
          Simulates an incoming payment: your bank acts on a raw payment
          message, as if another bank had sent it — with nothing settled behind
          it.
          <span className="mt-1.5 block">
            The named account grows, and the balance sheet stops balancing:
            money arrived, and no settlement or debit explains it. A real
            message arrives only after the sender was debited and the reserves
            settled.
          </span>
        </>
      }
      runLabel="Receive"
      onRun={async () => {
        if (!from) {
          throw new Error(
            'An interbank message comes from another bank — open a second bank first.'
          );
        }
        if (!fromAccount) {
          throw new Error("Pick the sender's account first.");
        }
        if (!to) {
          throw new Error('There is no account to receive into yet.');
        }
        const result = await api.banks.receivePayment.mutate({
          fromBic: from.bic,
          fromIban: fromAccount.iban,
          toBic: bank.bic,
          toIban: to.iban,
          amount,
        });
        setAmount('');
        return `Received: ${formatMoney(amount)} ${currency} credited to ${result.recipient} — a raw message, nothing settled behind it.`;
      }}
    >
      <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <div className="flex flex-col gap-3">
          <Field label="from bank">
            <Select
              value={String(from?.id ?? '')}
              onValueChange={next => {
                setFromId(next);
                setFromIban('');
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {senders.map(candidate => (
                  <SelectItem key={candidate.id} value={String(candidate.id)}>
                    <span className="font-mono tabular-nums">
                      {candidate.bic}
                    </span>{' '}
                    <span className="text-muted">|</span> {candidate.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="from account (the return path)">
            <AccountSelect
              accounts={fromAccounts}
              value={fromAccount?.iban ?? ''}
              onChange={setFromIban}
              currency={currency}
              disabled={fromAccounts.length === 0}
            />
          </Field>
        </div>
        <ArrowRight
          size={20}
          className="hidden self-center text-muted sm:block"
          aria-hidden
        />
        <div className="flex flex-col gap-3">
          {/* The receiving side is this screen's bank — shown, not chosen. */}
          <Field label="to bank">
            <Select value={String(bank.id)} disabled>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={String(bank.id)}>
                  <span className="font-mono tabular-nums">{bank.bic}</span>{' '}
                  <span className="text-muted">|</span> {bank.name}
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="to account">
            <AccountSelect
              accounts={accounts}
              value={to?.iban ?? ''}
              onChange={setToIban}
              currency={currency}
            />
          </Field>
        </div>
      </div>
      <Field label={`amount (${currency})`}>
        <input
          className={`${INPUT_CLASS} font-mono tabular-nums`}
          value={amount}
          onChange={event => setAmount(event.target.value)}
          placeholder="0"
        />
      </Field>
    </OperationDialog>
  );
}
