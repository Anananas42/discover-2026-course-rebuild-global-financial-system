import { Mail } from 'lucide-react';
import { useState } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@banks/shared/browser/ui/select.tsx';

import { api } from '../api.ts';
import { formatMoney } from '../format.ts';
import { Field, INPUT_CLASS } from './Field.tsx';
import { OperationDialog } from './OperationDialog.tsx';

const KINDS = [
  { value: 'interest-charged', label: 'interest charged' },
  { value: 'payment', label: 'payment from the central bank' },
  { value: 'debt-forgiven', label: 'debt forgiven' },
] as const;

type NoticeKind = (typeof KINDS)[number]['value'];

/** Debug: hands the selected bank a raw central bank notice — the
 *  receiving half of the central bank's operations (task 2.1), with no
 *  operation at the central bank behind it. */
export function ReceiveNoticeDialog({
  bank,
  currency,
}: {
  /** The receiving bank — the one this screen impersonates. */
  bank: { id: number; name: string };
  currency: string;
}) {
  const [kind, setKind] = useState<NoticeKind>('payment');
  const [amount, setAmount] = useState('');

  return (
    <OperationDialog
      debug
      trigger={
        <>
          <Mail size={16} /> Receive a central bank notice
        </>
      }
      title={`Receive a central bank notice at ${bank.name}`}
      description={
        <>
          Simulates a notice from the central bank: your bank records the change
          on its own account, as if the central bank had charged it, paid it, or
          forgiven its debt.
          <span className="mt-1.5 block">
            The amount is signed from the bank's perspective — positive grows
            the bank's own account, negative shrinks it; a real interest charge
            arrives negative. Received bare, the notice leaves the balance sheet
            unbalanced: nothing at the central bank backs it.
          </span>
        </>
      }
      runLabel="Receive"
      onRun={async () => {
        await api.banks.receiveCentralBankNotice.mutate({
          bankId: bank.id,
          kind,
          amount,
        });
        const recorded = amount;
        setAmount('');
        return `The notice is recorded — ${bank.name}'s own account moved by ${formatMoney(recorded)} ${currency}.`;
      }}
    >
      <Field label="what happened">
        <Select
          value={kind}
          onValueChange={next => setKind(next as NoticeKind)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KINDS.map(candidate => (
              <SelectItem key={candidate.value} value={candidate.value}>
                {candidate.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label={`amount (${currency}, signed — negative for a charge)`}>
        <input
          className={`${INPUT_CLASS} font-mono tabular-nums`}
          value={amount}
          onChange={event => setAmount(event.target.value)}
          placeholder="-50"
        />
      </Field>
    </OperationDialog>
  );
}
